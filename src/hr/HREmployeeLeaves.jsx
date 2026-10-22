import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Search,
    RefreshCw,
    CalendarDays,
    Users,
    Clock3,
    CheckCircle2,
    XCircle,
    Eye,
    X,
    Check,
    AlertCircle,
    FileText,
    ChevronDown,
    Wallet,
    Paperclip,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import "./HREmployeeLeaves.css";
import PageHeader from "../components/PageHeader";

const STATUSES = ["All", "Pending", "Approved", "Rejected"];

const TABS = [
    { id: "approvals", label: "Pending approvals" },
    { id: "records", label: "Company leave records" },
    { id: "balances", label: "Leave balances" },
];

const getArray = (response, ...keys) => {
    if (Array.isArray(response)) return response;

    for (const key of keys) {
        if (Array.isArray(response?.[key])) {
            return response[key];
        }
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    return [];
};

const getId = (value) => {
    if (value && typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return value ? String(value) : "";
};

const normalize = (value) =>
    String(value ?? "").trim().toLowerCase();

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatRole = (role) => {
    const roles = {
        employee: "Employee",
        manager: "Manager",
        hr: "HR",
        ceo: "CEO",
        admin: "Admin",
        super_admin: "Super Admin",
        superadmin: "Super Admin",
        super_user: "Super Admin",
        superuser: "Super Admin",
    };

    return roles[normalize(role)] || role || "Staff";
};

const leaveTypeLabel = (type) => {
    const labels = {
        annual: "Annual Leave",
        casual: "Casual Leave",
        sick: "Sick Leave",
        emergency: "Emergency Leave",
        half_day: "Half-Day Leave",
        short: "Short Leave",
    };

    return labels[normalize(type)] || type || "Leave";
};

const employeeName = (request) => {
    const owner = request?.userId || request?.user;

    if (owner && typeof owner === "object") {
        return (
            owner.name ||
            owner.fullName ||
            owner.email ||
            "Staff member"
        );
    }

    return request?.employeeName || "Staff member";
};

const employeeEmail = (request) => {
    const owner = request?.userId || request?.user;

    if (owner && typeof owner === "object") {
        return owner.email || request?.email || "";
    }

    return request?.email || "";
};

const employeeDepartment = (request) => {
    const owner = request?.userId || request?.user;

    if (owner && typeof owner === "object") {
        return owner.department || request?.department || "—";
    }

    return request?.department || "—";
};

const employeeRole = (request) => {
    const owner = request?.userId || request?.user;

    if (owner && typeof owner === "object") {
        return owner.role || request?.employeeRole || "";
    }

    return request?.employeeRole || request?.role || "";
};

const statusLabel = (request) => {
    const status = normalize(request?.status);
    const stage = normalize(request?.approvalStage || "hr");

    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";

    if (status === "pending") {
        if (stage === "manager") return "Pending · Manager";
        if (stage === "hr") return "Pending · HR";
        if (stage === "ceo") return "Pending · CEO";
    }

    return status
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : "Unknown";
};

const statusClass = (request) => {
    const status = normalize(request?.status);
    const stage = normalize(request?.approvalStage || "hr");

    if (status === "approved") return "approved";
    if (status === "rejected") return "rejected";
    if (status === "pending") return `pending-${stage}`;

    return "pending";
};

const balanceValue = (balance, type, field) =>
    Number(balance?.balances?.[type]?.[field] ?? 0);

const canReview = (request) => {
    const status = normalize(request?.status);
    const stage = normalize(request?.approvalStage || "hr");
    const ownerRole = normalize(employeeRole(request));
    const requestId = request?._id || request?.id;

    return (
        Boolean(requestId) &&
        status === "pending" &&
        stage === "hr" &&
        ownerRole !== "hr" &&
        ![
            "admin",
            "super_admin",
            "superadmin",
            "super_user",
            "superuser",
        ].includes(ownerRole)
    );
};

const getCertificateUrl = (request) => {
    const certificate =
        request?.medicalCertificate ||
        request?.medicalCertificateUrl ||
        request?.certificate;

    if (typeof certificate === "string") {
        return certificate;
    }

    if (certificate && typeof certificate === "object") {
        return (
            certificate.url ||
            certificate.path ||
            certificate.fileUrl ||
            ""
        );
    }

    return "";
};

const getCalendarDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
    ) {
        return 0;
    }

    return Math.floor((end - start) / 86400000) + 1;
};


const getRequestedDays = (request) => {
    const leaveType = String(request?.leaveType || "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    if (leaveType === "half_day") {
        return 0.5;
    }

    if (leaveType === "short") {
        return "Short";
    }

    const requestedDays = Number(request?.requestedDays);

    if (
        request?.requestedDays != null &&
        Number.isFinite(requestedDays) &&
        requestedDays > 0
    ) {
        return requestedDays;
    }

    return getCalendarDays(
        request?.startDate,
        request?.endDate
    ) || "—";
};


const getReviewDetails = (request) => {
    if (request?.rejectionReason) {
        return request.rejectionReason;
    }

    if (request?.reviewComment) {
        return request.reviewComment;
    }

    if (request?.managerComment) {
        return `Manager: ${request.managerComment}`;
    }

    if (request?.reviewedAt) {
        return `Reviewed ${formatDate(request.reviewedAt)}`;
    }

    return "Awaiting review";
};

export default function HREmployeeLeaves() {
    const auth = useAuth();
    const user = auth?.user || auth?.currentUser || auth?.employee;
    const token = auth?.token;

    const [activeTab, setActiveTab] = useState("approvals");
    const [approvals, setApprovals] = useState([]);
    const [records, setRecords] = useState([]);
    const [balances, setBalances] = useState([]);
    const [balanceYear, setBalanceYear] = useState(
        new Date().getFullYear()
    );

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviewAction, setReviewAction] = useState("");
    const [reviewComment, setReviewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const loadData = useCallback(async (isRefresh = false) => {
        if (!token) {
            setApprovals([]);
            setRecords([]);
            setBalances([]);
            setLoading(false);
            setRefreshing(false);
            setError("Please log in to view company leave records.");
            return;
        }

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const results = await Promise.allSettled([
                apiRequest("/api/leaves?status=pending", {}, token),
                apiRequest("/api/leaves/company-records", {}, token),
                apiRequest("/api/leaves/all-balances", {}, token),
            ]);

            const [approvalResult, recordResult, balanceResult] = results;
            const failures = [];

            if (approvalResult.status === "fulfilled") {
                setApprovals(
                    getArray(
                        approvalResult.value,
                        "requests",
                        "leaves"
                    )
                );
            } else {
                failures.push(
                    `Approval queue: ${approvalResult.reason?.message || "Unable to load"
                    }`
                );
            }

            if (recordResult.status === "fulfilled") {
                setRecords(
                    getArray(
                        recordResult.value,
                        "requests",
                        "leaves",
                        "records"
                    )
                );
            } else {
                failures.push(
                    `Company records: ${recordResult.reason?.message || "Unable to load"
                    }`
                );
            }

            if (balanceResult.status === "fulfilled") {
                const response = balanceResult.value;

                setBalances(
                    getArray(
                        response,
                        "balances",
                        "staffBalances",
                        "employees"
                    )
                );

                if (response?.year) {
                    setBalanceYear(Number(response.year));
                }
            } else {
                failures.push(
                    `Leave balances: ${balanceResult.reason?.message || "Unable to load"
                    }`
                );
            }

            if (failures.length) {
                setError(failures.join(" | "));
            }
        } catch (err) {
            setError(
                err?.message ||
                "Could not load company leave data. Please refresh and try again."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const pendingApprovals = useMemo(
        () => approvals.filter(canReview),
        [approvals]
    );

    const filteredApprovals = useMemo(() => {
        const term = search.trim().toLowerCase();

        const source =
            statusFilter === "Approved" || statusFilter === "Rejected"
                ? records
                : pendingApprovals;

        return source.filter((request) => {
            const text = [
                employeeName(request),
                employeeDepartment(request),
                employeeEmail(request),
                employeeRole(request),
                leaveTypeLabel(request.leaveType),
                request.reason,
                statusLabel(request),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesStatus =
                statusFilter === "All" ||
                (statusFilter === "Pending" && canReview(request)) ||
                (statusFilter === "Approved" &&
                    normalize(request.status) === "approved") ||
                (statusFilter === "Rejected" &&
                    normalize(request.status) === "rejected");

            return matchesStatus && text.includes(term);
        });
    }, [pendingApprovals, records, search, statusFilter]);

    const filteredRecords = useMemo(() => {
        const term = search.trim().toLowerCase();

        return records.filter((request) => {
            const text = [
                employeeName(request),
                employeeDepartment(request),
                employeeEmail(request),
                employeeRole(request),
                leaveTypeLabel(request.leaveType),
                request.reason,
                statusLabel(request),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesStatus =
                statusFilter === "All" ||
                normalize(request.status) === normalize(statusFilter);

            return matchesStatus && text.includes(term);
        });
    }, [records, search, statusFilter]);

    const uniqueStaff = useMemo(
        () =>
            new Set(
                records.map(
                    (request) =>
                        getId(request.userId || request.user) ||
                        employeeEmail(request) ||
                        employeeName(request)
                )
            ).size,
        [records]
    );

    const approvedCount = useMemo(
        () =>
            records.filter(
                (request) => normalize(request.status) === "approved"
            ).length,
        [records]
    );

    const openReview = (request, action) => {
        if (!canReview(request)) {
            setError(
                "This request is not currently eligible for an HR decision. Refresh the records and check its approval stage."
            );
            return;
        }

        setReviewTarget(request);
        setReviewAction(action);
        setReviewComment("");
        setError("");
        setNotice("");
    };

    const submitReview = async () => {
        if (!reviewTarget || !reviewAction || submitting) return;

        if (!canReview(reviewTarget)) {
            setError(
                "This request is no longer awaiting HR's decision. Refresh the page."
            );
            return;
        }

        if (
            reviewAction === "reject" &&
            !reviewComment.trim()
        ) {
            setError("Please provide a reason for rejecting this request.");
            return;
        }

        const requestId = reviewTarget._id || reviewTarget.id;

        if (!requestId) {
            setError("Leave request ID is missing.");
            return;
        }

        setSubmitting(true);
        setError("");
        setNotice("");

        try {
            const response = await apiRequest(
                `/api/leaves/${requestId}/review`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status:
                            reviewAction === "approve"
                                ? "approved"
                                : "rejected",
                        comment: reviewComment.trim(),
                        rejectionReason:
                            reviewAction === "reject"
                                ? reviewComment.trim()
                                : "",
                    }),
                },
                token
            );

            setReviewTarget(null);
            setSelectedRequest(null);

            setNotice(
                response?.message ||
                (reviewAction === "approve"
                    ? "Leave request approved successfully."
                    : "Leave request rejected successfully.")
            );

            await loadData(true);
        } catch (err) {
            setError(
                err?.message ||
                "Could not submit the decision. Check the approval stage and try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const activeList =
        activeTab === "approvals"
            ? filteredApprovals
            : filteredRecords;

    return (
        <main className="hr-leaves-page">
            <PageHeader
                eyebrow="HR WORKSPACE"
                title="Employee Leaves"
                description="Review leave requests, monitor company leave activity, and check employee leave balances."
                icon={CalendarDays}
                onRefresh={() => loadData(true)}
                refreshing={loading || refreshing}
            />
            {notice && (
                <div className="hrl-alert hrl-success" role="status">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button
                        type="button"
                        onClick={() => setNotice("")}
                        aria-label="Dismiss notification"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {error && (
                <div className="hrl-alert hrl-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="hrl-stats">
                <article className="hrl-stat-card">
                    <div className="hrl-stat-icon hrl-blue">
                        <FileText size={21} />
                    </div>
                    <div>
                        <p>Company requests</p>
                        <h2>{records.length}</h2>
                        <span>All available leave records</span>
                    </div>
                </article>

                <article className="hrl-stat-card">
                    <div className="hrl-stat-icon hrl-amber">
                        <Clock3 size={21} />
                    </div>
                    <div>
                        <p>Awaiting HR</p>
                        <h2>{pendingApprovals.length}</h2>
                        <span>Requests requiring your decision</span>
                    </div>
                </article>

                <article className="hrl-stat-card">
                    <div className="hrl-stat-icon hrl-green">
                        <CheckCircle2 size={21} />
                    </div>
                    <div>
                        <p>Approved</p>
                        <h2>{approvedCount}</h2>
                        <span>Approved leave records</span>
                    </div>
                </article>

                <article className="hrl-stat-card">
                    <div className="hrl-stat-icon hrl-purple">
                        <Users size={21} />
                    </div>
                    <div>
                        <p>Staff with requests</p>
                        <h2>{uniqueStaff}</h2>
                        <span>Across the company</span>
                    </div>
                </article>
            </section>

            <nav className="hrl-tabs" aria-label="Leave sections">
                {TABS.map((tab) => (
                    <button
                        type="button"
                        key={tab.id}
                        className={activeTab === tab.id ? "active" : ""}
                        onClick={() => {
                            setActiveTab(tab.id);
                            setSearch("");
                            setStatusFilter("All");
                            setError("");
                        }}
                    >
                        {tab.label}

                        {tab.id === "approvals" &&
                            pendingApprovals.length > 0 && (
                                <span className="hrl-tab-count">
                                    {pendingApprovals.length}
                                </span>
                            )}
                    </button>
                ))}
            </nav>

            {activeTab === "balances" ? (
                <section className="hrl-panel">
                    <div className="hrl-panel-heading">
                        <div>
                            <h2>Company leave balances</h2>
                            <p>
                                Annual, casual and sick leave entitlements
                                for {balanceYear}.
                            </p>
                        </div>
                        <span className="hrl-total">
                            {balances.length} staff
                        </span>
                    </div>

                    {loading ? (
                        <div className="hrl-empty">
                            <RefreshCw className="hrl-spin" size={24} />
                            <h3>Loading balances</h3>
                        </div>
                    ) : balances.length === 0 ? (
                        <div className="hrl-empty">
                            <Wallet size={28} />
                            <h3>No balances found</h3>
                            <p>
                                Company leave balances will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="hrl-table-wrap">
                            <table className="hrl-table hrl-balance-table">
                                <thead>
                                    <tr>
                                        <th>Staff member</th>
                                        <th>Department</th>
                                        <th>Role</th>
                                        <th>Annual remaining</th>
                                        <th>Casual remaining</th>
                                        <th>Sick remaining</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {balances.map((item, index) => (
                                        <tr
                                            key={
                                                item.userId ||
                                                item.email ||
                                                item._id ||
                                                index
                                            }
                                        >
                                            <td>
                                                <div className="hrl-person">
                                                    <div className="hrl-avatar">
                                                        {String(item.name || "S")
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <strong>
                                                            {item.name ||
                                                                "Staff member"}
                                                        </strong>
                                                        <span>
                                                            {item.email || "—"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>{item.department || "—"}</td>
                                            <td>{formatRole(item.role)}</td>

                                            {["annual", "casual", "sick"].map(
                                                (type) => (
                                                    <td key={type}>
                                                        <div className="hrl-balance-value">
                                                            <strong>
                                                                {balanceValue(
                                                                    item,
                                                                    type,
                                                                    "remaining"
                                                                )}
                                                            </strong>
                                                            <span>
                                                                {balanceValue(
                                                                    item,
                                                                    type,
                                                                    "used"
                                                                )}{" "}
                                                                used ·{" "}
                                                                {balanceValue(
                                                                    item,
                                                                    type,
                                                                    "pending"
                                                                )}{" "}
                                                                pending
                                                            </span>
                                                        </div>
                                                    </td>
                                                )
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : (
                <section className="hrl-panel">
                    <div className="hrl-panel-heading">
                        <div>
                            <h2>
                                {activeTab === "approvals"
                                    ? "Pending approvals"
                                    : "Company leave records"}
                            </h2>
                            <p>
                                {activeTab === "approvals"
                                    ? "Requests currently eligible for HR review."
                                    : "Review requests at different approval stages and completed decisions."}
                            </p>
                        </div>

                        <span className="hrl-total">
                            {activeList.length} requests
                        </span>
                    </div>

                    <div className="hrl-toolbar">
                        <label className="hrl-search">
                            <Search size={17} />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search staff, department, leave..."
                            />
                        </label>

                        <label className="hrl-filter">
                            <span>Status</span>
                            <span className="hrl-select-wrap">
                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(event.target.value)
                                    }
                                >
                                    {STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={15} />
                            </span>
                        </label>
                    </div>

                    {loading ? (
                        <div className="hrl-empty">
                            <RefreshCw className="hrl-spin" size={24} />
                            <h3>Loading leave requests</h3>
                            <p>
                                Please wait while company records load.
                            </p>
                        </div>
                    ) : activeList.length === 0 ? (
                        <div className="hrl-empty">
                            <div className="hrl-empty-icon">
                                <CalendarDays size={27} />
                            </div>
                            <h3>No leave requests found</h3>
                            <p>
                                {search || statusFilter !== "All"
                                    ? "Try changing your search or status filter."
                                    : activeTab === "approvals"
                                        ? "There are no requests awaiting HR's decision."
                                        : "No company leave records were returned."}
                            </p>

                            {(search || statusFilter !== "All") && (
                                <button
                                    type="button"
                                    className="hrl-clear"
                                    onClick={() => {
                                        setSearch("");
                                        setStatusFilter("All");
                                    }}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="hrl-table-wrap">
                            <table className="hrl-table">
                                <thead>
                                    <tr>
                                        <th>Staff member</th>
                                        <th>Leave type</th>
                                        <th>Dates</th>
                                        <th>Days</th>
                                        <th>Status / stage</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {activeList.map((request, index) => {
                                        const status = statusLabel(request);
                                        const reviewable = canReview(request);

                                        return (
                                            <tr
                                                key={
                                                    request._id ||
                                                    request.id ||
                                                    index
                                                }
                                            >
                                                <td>
                                                    <div className="hrl-person">
                                                        <div className="hrl-avatar">
                                                            {employeeName(request)
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <strong>
                                                                {employeeName(
                                                                    request
                                                                )}
                                                            </strong>
                                                            <span>
                                                                {employeeDepartment(
                                                                    request
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td>
                                                    <span className="hrl-leave-type">
                                                        {leaveTypeLabel(
                                                            request.leaveType
                                                        )}
                                                    </span>

                                                    {request.leaveType ===
                                                        "half_day" && (
                                                            <small className="hrl-leave-subtext">
                                                                {request.halfDayPeriod ===
                                                                    "second_half"
                                                                    ? "Second half"
                                                                    : "First half"}
                                                            </small>
                                                        )}
                                                </td>

                                                <td>
                                                    <div className="hrl-dates">
                                                        <span>
                                                            {formatDate(
                                                                request.startDate
                                                            )}
                                                        </span>
                                                        <span>
                                                            to{" "}
                                                            {formatDate(
                                                                request.endDate
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td>
                                                    <strong>
                                                        {getRequestedDays(
                                                            request
                                                        )}
                                                    </strong>
                                                </td>

                                                <td>
                                                    <span
                                                        className={`hrl-status hrl-status-${statusClass(
                                                            request
                                                        )}`}
                                                    >
                                                        <span className="hrl-status-dot" />
                                                        {status}
                                                    </span>
                                                </td>

                                                <td>
                                                    <div className="hrl-actions">
                                                        <button
                                                            type="button"
                                                            className="hrl-action hrl-view"
                                                            title="View details"
                                                            aria-label="View leave details"
                                                            onClick={() =>
                                                                setSelectedRequest(
                                                                    request
                                                                )
                                                            }
                                                        >
                                                            <Eye size={16} />
                                                        </button>

                                                        {reviewable && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="hrl-action hrl-approve"
                                                                    title="Approve leave"
                                                                    aria-label="Approve leave"
                                                                    onClick={() =>
                                                                        openReview(
                                                                            request,
                                                                            "approve"
                                                                        )
                                                                    }
                                                                >
                                                                    <Check
                                                                        size={16}
                                                                    />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="hrl-action hrl-reject"
                                                                    title="Reject leave"
                                                                    aria-label="Reject leave"
                                                                    onClick={() =>
                                                                        openReview(
                                                                            request,
                                                                            "reject"
                                                                        )
                                                                    }
                                                                >
                                                                    <XCircle
                                                                        size={16}
                                                                    />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <footer className="hrl-footer">
                        <span>
                            Signed in as {user?.name || user?.fullName || "HR"}
                        </span>
                        <span>
                            Only requests at the HR approval stage can be
                            decided by HR.
                        </span>
                    </footer>
                </section>
            )}

            {selectedRequest && (
                <div
                    className="hrl-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedRequest(null);
                        }
                    }}
                >
                    <section
                        className="hrl-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="hrl-details-title"
                    >
                        <div className="hrl-modal-header">
                            <div>
                                <span className="hrl-eyebrow">
                                    LEAVE DETAILS
                                </span>
                                <h2 id="hrl-details-title">
                                    Request information
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="hrl-close"
                                onClick={() => setSelectedRequest(null)}
                                aria-label="Close details"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="hrl-detail-grid">
                            <div>
                                <span>Staff member</span>
                                <strong>
                                    {employeeName(selectedRequest)}
                                </strong>
                            </div>

                            <div>
                                <span>Email</span>
                                <strong>
                                    {employeeEmail(selectedRequest) || "—"}
                                </strong>
                            </div>

                            <div>
                                <span>Department</span>
                                <strong>
                                    {employeeDepartment(selectedRequest)}
                                </strong>
                            </div>

                            <div>
                                <span>Role</span>
                                <strong>
                                    {formatRole(employeeRole(selectedRequest))}
                                </strong>
                            </div>

                            <div>
                                <span>Leave type</span>
                                <strong>
                                    {leaveTypeLabel(
                                        selectedRequest.leaveType
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Start date</span>
                                <strong>
                                    {formatDate(selectedRequest.startDate)}
                                </strong>
                            </div>

                            <div>
                                <span>End date</span>
                                <strong>
                                    {formatDate(selectedRequest.endDate)}
                                </strong>
                            </div>

                            <div>
                                <span>Requested days</span>
                                <strong>
                                    {getRequestedDays(selectedRequest)}
                                </strong>
                            </div>

                            <div>
                                <span>Current status</span>
                                <strong>
                                    {statusLabel(selectedRequest)}
                                </strong>
                            </div>

                            {selectedRequest.startTime && (
                                <div>
                                    <span>Start time</span>
                                    <strong>
                                        {selectedRequest.startTime}
                                    </strong>
                                </div>
                            )}

                            {selectedRequest.endTime && (
                                <div>
                                    <span>End time</span>
                                    <strong>
                                        {selectedRequest.endTime}
                                    </strong>
                                </div>
                            )}

                            {selectedRequest.halfDayPeriod && (
                                <div>
                                    <span>Half-day period</span>
                                    <strong>
                                        {selectedRequest.halfDayPeriod ===
                                            "second_half"
                                            ? "Second Half"
                                            : "First Half"}
                                    </strong>
                                </div>
                            )}

                            {selectedRequest.balanceLeaveType && (
                                <div>
                                    <span>Leave balance used</span>
                                    <strong>
                                        {leaveTypeLabel(
                                            selectedRequest.balanceLeaveType
                                        )}
                                    </strong>
                                </div>
                            )}

                            {selectedRequest.approvalStage && (
                                <div>
                                    <span>Approval stage</span>
                                    <strong>
                                        {formatRole(
                                            selectedRequest.approvalStage
                                        )}
                                    </strong>
                                </div>
                            )}
                        </div>

                        <div className="hrl-reason">
                            <span>Reason</span>
                            <p>
                                {selectedRequest.reason ||
                                    "No reason provided."}
                            </p>
                        </div>

                        {selectedRequest.managerComment && (
                            <div className="hrl-reason">
                                <span>Manager comment</span>
                                <p>{selectedRequest.managerComment}</p>
                            </div>
                        )}

                        {selectedRequest.rejectionReason && (
                            <div className="hrl-reason">
                                <span>Decision / rejection reason</span>
                                <p>{selectedRequest.rejectionReason}</p>
                            </div>
                        )}

                        {getCertificateUrl(selectedRequest) && (
                            <div className="hrl-reason">
                                <span>Medical certificate</span>
                                <p>
                                    <a
                                        href={getCertificateUrl(
                                            selectedRequest
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Paperclip
                                            size={15}
                                            style={{
                                                verticalAlign: "middle",
                                                marginRight: 6,
                                            }}
                                        />
                                        View medical certificate
                                    </a>
                                </p>
                            </div>
                        )}

                        {selectedRequest.medicalCertificate &&
                            !getCertificateUrl(selectedRequest) && (
                                <div className="hrl-reason">
                                    <span>Medical certificate</span>
                                    <p>
                                        A medical certificate is attached to
                                        this request.
                                    </p>
                                </div>
                            )}

                        <div className="hrl-reason">
                            <span>Review details</span>
                            <p>{getReviewDetails(selectedRequest)}</p>
                        </div>

                        <div className="hrl-modal-footer">
                            <button
                                type="button"
                                className="hrl-secondary"
                                onClick={() => setSelectedRequest(null)}
                            >
                                Close
                            </button>

                            {canReview(selectedRequest) && (
                                <>
                                    <button
                                        type="button"
                                        className="hrl-danger"
                                        onClick={() =>
                                            openReview(
                                                selectedRequest,
                                                "reject"
                                            )
                                        }
                                    >
                                        <XCircle size={16} />
                                        Reject
                                    </button>

                                    <button
                                        type="button"
                                        className="hrl-primary"
                                        onClick={() =>
                                            openReview(
                                                selectedRequest,
                                                "approve"
                                            )
                                        }
                                    >
                                        <Check size={16} />
                                        Approve
                                    </button>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {reviewTarget && (
                <div
                    className="hrl-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !submitting
                        ) {
                            setReviewTarget(null);
                        }
                    }}
                >
                    <section
                        className="hrl-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="hrl-review-title"
                    >
                        <div className="hrl-modal-header">
                            <div>
                                <span className="hrl-eyebrow">
                                    HR DECISION
                                </span>
                                <h2 id="hrl-review-title">
                                    {reviewAction === "approve"
                                        ? "Approve this leave?"
                                        : "Reject this leave?"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="hrl-close"
                                disabled={submitting}
                                onClick={() => setReviewTarget(null)}
                                aria-label="Close review"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="hrl-review-summary">
                            <div className="hrl-avatar">
                                {employeeName(reviewTarget)
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>
                            <div>
                                <strong>{employeeName(reviewTarget)}</strong>
                                <span>
                                    {leaveTypeLabel(reviewTarget.leaveType)} ·{" "}
                                    {formatDate(reviewTarget.startDate)}
                                </span>
                            </div>
                        </div>

                        {reviewAction === "approve" ? (
                            <div className="hrl-review-info">
                                <AlertCircle size={18} />
                                <p>
                                    Confirm that this request is eligible for
                                    approval. The backend should validate the
                                    approval stage and update leave balances
                                    according to your configured rules.
                                </p>
                            </div>
                        ) : (
                            <label className="hrl-comment">
                                <span>
                                    Rejection reason <b>*</b>
                                </span>
                                <textarea
                                    value={reviewComment}
                                    onChange={(event) =>
                                        setReviewComment(event.target.value)
                                    }
                                    placeholder="Explain why this request is being rejected..."
                                    rows={4}
                                    required
                                    disabled={submitting}
                                />
                            </label>
                        )}

                        <div className="hrl-modal-footer">
                            <button
                                type="button"
                                className="hrl-secondary"
                                disabled={submitting}
                                onClick={() => setReviewTarget(null)}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className={
                                    reviewAction === "approve"
                                        ? "hrl-primary"
                                        : "hrl-danger"
                                }
                                disabled={
                                    submitting ||
                                    !canReview(reviewTarget) ||
                                    (reviewAction === "reject" &&
                                        !reviewComment.trim())
                                }
                                onClick={submitReview}
                            >
                                {submitting ? (
                                    <>
                                        <RefreshCw
                                            size={16}
                                            className="hrl-spin"
                                        />
                                        Submitting...
                                    </>
                                ) : reviewAction === "approve" ? (
                                    <>
                                        <Check size={16} />
                                        Confirm approval
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={16} />
                                        Confirm rejection
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}
