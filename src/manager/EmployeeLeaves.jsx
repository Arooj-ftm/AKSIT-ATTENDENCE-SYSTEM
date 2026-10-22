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
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./EmployeeLeaves.css";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const displayStatus = (request) => {
    if (request.status === "approved") return "Approved";
    if (request.status === "rejected") return "Rejected";

    if (
        request.status === "pending" &&
        request.approvalStage === "hr" &&
        request.managerDecision === "approved"
    ) {
        return "Forwarded to HR";
    }

    return "Pending";
};

const employeeName = (request) => {
    const employee = request.userId;

    if (employee && typeof employee === "object") {
        return (
            employee.name ||
            employee.fullName ||
            employee.email ||
            "Employee"
        );
    }

    return request.employeeName || "Employee";
};

const employeeDepartment = (request) => {
    const employee = request.userId;

    if (employee && typeof employee === "object") {
        return employee.department || "—";
    }

    return request.department || "—";
};

const leaveTypeLabel = (type) => {
    const labels = {
        annual: "Annual leave",
        casual: "Casual leave",
        sick: "Sick leave",
        emergency: "Emergency leave",
        half_day: "Half day",
        short: "Short leave",
    };

    return labels[type] || type || "Leave";
};

export default function EmployeeLeaves() {
    const { user, token } = useAuth();

    const [requests, setRequests] = useState([]);
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

    const loadRequests = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            try {
                const response = await apiRequest("/api/leaves", {}, token);

                const data = Array.isArray(response)
                    ? response
                    : response?.leaves ||
                    response?.requests ||
                    response?.data ||
                    [];

                setRequests(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(
                    err?.message ||
                    "Could not load leave requests. Please try again."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [token]
    );

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const managerRequests = useMemo(() => {
        return requests.filter((request) => {
            const stage = request.approvalStage || "hr";

            return (
                request.status === "pending" &&
                (stage === "manager" ||
                    (stage === "hr" &&
                        request.managerDecision === "approved"))
            );
        });
    }, [requests]);

    const filteredRequests = useMemo(() => {
        const term = search.trim().toLowerCase();

        return managerRequests.filter((request) => {
            const status = displayStatus(request);

            const matchesStatus =
                statusFilter === "All" ||
                (statusFilter === "Pending" &&
                    request.status === "pending" &&
                    (request.approvalStage || "hr") === "manager") ||
                (statusFilter === "Approved" &&
                    request.status === "pending" &&
                    request.approvalStage === "hr" &&
                    request.managerDecision === "approved") ||
                (statusFilter === "Rejected" &&
                    request.status === "rejected");

            const text = [
                employeeName(request),
                employeeDepartment(request),
                request.reason,
                request.userId?.email,
                leaveTypeLabel(request.leaveType),
                displayStatus(request),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return matchesStatus && text.includes(term);
        });
    }, [managerRequests, search, statusFilter]);

    const pendingCount = managerRequests.filter(
        (request) =>
            request.status === "pending" &&
            (request.approvalStage || "hr") === "manager"
    ).length;

    const forwardedCount = managerRequests.filter(
        (request) =>
            request.status === "pending" &&
            request.approvalStage === "hr" &&
            request.managerDecision === "approved"
    ).length;

    const uniqueEmployees = new Set(
        managerRequests.map((request) => {
            const id = request.userId;

            if (id && typeof id === "object") {
                return id._id || id.id || employeeName(request);
            }

            return id || employeeName(request);
        })
    ).size;

    const openReview = (request, action) => {
        setReviewTarget(request);
        setReviewAction(action);
        setReviewComment("");
        setError("");
        setNotice("");
    };

    const submitReview = async () => {
        if (!reviewTarget || !reviewAction || submitting) return;

        if (reviewAction === "reject" && !reviewComment.trim()) {
            setError("Please enter a reason for rejecting this request.");
            return;
        }

        setSubmitting(true);
        setError("");
        setNotice("");

        try {
            const requestId = reviewTarget._id || reviewTarget.id;

            if (!requestId) {
                throw new Error("Leave request ID is missing.");
            }

            await apiRequest(
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
                reviewAction === "approve"
                    ? "Leave request forwarded to HR for final approval."
                    : "Leave request rejected successfully."
            );

            await loadRequests(true);
        } catch (err) {
            setError(
                err?.message ||
                "Could not submit the review. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const canReview = (request) =>
        request.status === "pending" &&
        (request.approvalStage || "hr") === "manager";

    return (
        <main className="main employee-leaves-page">
            <PageHeader
                eyebrow="MANAGER WORKSPACE"
                title="Employee Leaves"
                description="Review your team's leave requests and forward recommendations to HR."
                icon={CalendarDays}
                onRefresh={() => loadRequests(true)}
                refreshing={loading || refreshing}
            />

            {notice && (
                <div className="el-alert el-alert-success" role="status">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button
                        type="button"
                        aria-label="Dismiss notification"
                        onClick={() => setNotice("")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {error && (
                <div className="el-alert el-alert-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                        type="button"
                        aria-label="Dismiss error"
                        onClick={() => setError("")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="el-stats">
                <article className="el-stat-card">
                    <div className="el-stat-icon el-icon-blue">
                        <FileText size={21} />
                    </div>
                    <div>
                        <p>Total requests</p>
                        <h2>{managerRequests.length}</h2>
                        <span>Requests in your review list</span>
                    </div>
                </article>

                <article className="el-stat-card">
                    <div className="el-stat-icon el-icon-amber">
                        <Clock3 size={21} />
                    </div>
                    <div>
                        <p>Awaiting review</p>
                        <h2>{pendingCount}</h2>
                        <span>Need your decision</span>
                    </div>
                </article>

                <article className="el-stat-card">
                    <div className="el-stat-icon el-icon-green">
                        <CheckCircle2 size={21} />
                    </div>
                    <div>
                        <p>Forwarded to HR</p>
                        <h2>{forwardedCount}</h2>
                        <span>Awaiting HR's final decision</span>
                    </div>
                </article>

                <article className="el-stat-card">
                    <div className="el-stat-icon el-icon-purple">
                        <Users size={21} />
                    </div>
                    <div>
                        <p>Team members</p>
                        <h2>{uniqueEmployees}</h2>
                        <span>Employees with leave requests</span>
                    </div>
                </article>
            </section>

            <section className="el-panel">
                <div className="el-panel-heading">
                    <div>
                        <h2>Leave requests</h2>
                        <p>Search and review your team's requests.</p>
                    </div>

                    <span className="el-total-badge">
                        {filteredRequests.length} requests
                    </span>
                </div>

                <div className="el-toolbar">
                    <label className="el-search">
                        <Search size={17} />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search employee, department, leave..."
                        />
                    </label>

                    <label className="el-filter">
                        <span>Status</span>
                        <span className="el-filter-control">
                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                {STATUS_FILTERS.map((status) => (
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
                    <div className="el-empty">
                        <RefreshCw size={24} className="el-spin" />
                        <h3>Loading leave requests</h3>
                        <p>Please wait while we fetch the latest requests.</p>
                    </div>
                ) : managerRequests.length === 0 ? (
                    <div className="el-empty">
                        <div className="el-empty-icon">
                            <CalendarDays size={27} />
                        </div>
                        <h3>No leave requests found</h3>
                        <p>
                            {search || statusFilter !== "All"
                                ? "Try changing your search or status filter."
                                : "New requests from your department will appear here."}
                        </p>
                        {(search || statusFilter !== "All") && (
                            <button
                                type="button"
                                className="el-clear-button"
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
                    <div className="el-table-wrap">
                        <table className="el-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Leave type</th>
                                    <th>Leave dates</th>
                                    <th>Days</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRequests.map((request) => {
                                    const status = displayStatus(request);
                                    const reviewable = canReview(request);

                                    return (
                                        <tr key={request._id || request.id}>
                                            <td>
                                                <div className="el-employee">
                                                    <div className="el-avatar">
                                                        {employeeName(request)
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>

                                                    <div>
                                                        <strong>
                                                            {employeeName(request)}
                                                        </strong>
                                                        <span>
                                                            {employeeDepartment(request)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                <span className="el-leave-type">
                                                    {leaveTypeLabel(request.leaveType)}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="el-dates">
                                                    <span>
                                                        {formatDate(request.startDate)}
                                                    </span>
                                                    <span>
                                                        to {formatDate(request.endDate)}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <strong>
                                                    {request.requestedDays ?? "—"}
                                                </strong>
                                            </td>

                                            <td>
                                                <span
                                                    className={`el-status el-status-${status
                                                        .toLowerCase()
                                                        .replace(/\s+/g, "-")}`}
                                                >
                                                    <span className="el-status-dot" />
                                                    {status}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="el-actions">
                                                    <button
                                                        type="button"
                                                        className="el-action el-view"
                                                        title="View details"
                                                        aria-label="View leave details"
                                                        onClick={() =>
                                                            setSelectedRequest(request)
                                                        }
                                                    >
                                                        <Eye size={16} />
                                                    </button>

                                                    {reviewable && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="el-action el-approve"
                                                                title="Approve and forward to HR"
                                                                aria-label="Approve leave request"
                                                                onClick={() =>
                                                                    openReview(request, "approve")
                                                                }
                                                            >
                                                                <Check size={16} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="el-action el-reject"
                                                                title="Reject request"
                                                                aria-label="Reject leave request"
                                                                onClick={() =>
                                                                    openReview(request, "reject")
                                                                }
                                                            >
                                                                <XCircle size={16} />
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

                <div className="el-panel-footer">
                    <span>Signed in as {user?.name || "Manager"}</span>
                    <span>
                        Manager review does not constitute HR's final approval.
                    </span>
                </div>
            </section>

            {selectedRequest && (
                <div
                    className="el-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedRequest(null);
                        }
                    }}
                >
                    <section
                        className="el-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="el-details-title"
                    >
                        <div className="el-modal-header">
                            <div>
                                <span className="el-eyebrow">REQUEST DETAILS</span>
                                <h2 id="el-details-title">Leave information</h2>
                            </div>

                            <button
                                type="button"
                                className="el-modal-close"
                                onClick={() => setSelectedRequest(null)}
                                aria-label="Close details"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="el-detail-grid">
                            <div className="el-detail-item">
                                <span>Employee</span>
                                <strong>{employeeName(selectedRequest)}</strong>
                            </div>

                            <div className="el-detail-item">
                                <span>Department</span>
                                <strong>{employeeDepartment(selectedRequest)}</strong>
                            </div>

                            <div className="el-detail-item">
                                <span>Leave type</span>
                                <strong>
                                    {leaveTypeLabel(selectedRequest.leaveType)}
                                </strong>
                            </div>

                            <div className="el-detail-item">
                                <span>Requested days</span>
                                <strong>
                                    {selectedRequest.requestedDays ?? "—"}
                                </strong>
                            </div>

                            <div className="el-detail-item">
                                <span>Start date</span>
                                <strong>{formatDate(selectedRequest.startDate)}</strong>
                            </div>

                            <div className="el-detail-item">
                                <span>End date</span>
                                <strong>{formatDate(selectedRequest.endDate)}</strong>
                            </div>

                            {selectedRequest.halfDayPeriod && (
                                <div className="el-detail-item">
                                    <span>Half-day period</span>
                                    <strong>{selectedRequest.halfDayPeriod}</strong>
                                </div>
                            )}

                            {selectedRequest.startTime && (
                                <div className="el-detail-item">
                                    <span>Start time</span>
                                    <strong>{selectedRequest.startTime}</strong>
                                </div>
                            )}

                            {selectedRequest.endTime && (
                                <div className="el-detail-item">
                                    <span>End time</span>
                                    <strong>{selectedRequest.endTime}</strong>
                                </div>
                            )}
                        </div>

                        <div className="el-reason">
                            <span>Employee's reason</span>
                            <p>{selectedRequest.reason || "No reason provided."}</p>
                        </div>

                        {selectedRequest.medicalCertificate && (
                            <div className="el-reason">
                                <span>Medical certificate</span>
                                <p>
                                    {typeof selectedRequest.medicalCertificate ===
                                        "string"
                                        ? selectedRequest.medicalCertificate
                                        : "Certificate attached to this request."}
                                </p>
                            </div>
                        )}

                        <div className="el-modal-footer">
                            <button
                                type="button"
                                className="el-secondary-button"
                                onClick={() => setSelectedRequest(null)}
                            >
                                Close
                            </button>

                            {canReview(selectedRequest) && (
                                <>
                                    <button
                                        type="button"
                                        className="el-danger-button"
                                        onClick={() =>
                                            openReview(selectedRequest, "reject")
                                        }
                                    >
                                        <XCircle size={16} />
                                        Reject
                                    </button>

                                    <button
                                        type="button"
                                        className="el-primary-button"
                                        onClick={() =>
                                            openReview(selectedRequest, "approve")
                                        }
                                    >
                                        <Check size={16} />
                                        Approve &amp; forward
                                    </button>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {reviewTarget && (
                <div
                    className="el-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !submitting) {
                            setReviewTarget(null);
                            setError("");
                        }
                    }}
                >
                    <section
                        className="el-modal el-review-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="el-review-title"
                    >
                        <div className="el-modal-header">
                            <div>
                                <span className="el-eyebrow">MANAGER DECISION</span>
                                <h2 id="el-review-title">
                                    {reviewAction === "approve"
                                        ? "Approve and forward?"
                                        : "Reject leave request?"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="el-modal-close"
                                disabled={submitting}
                                onClick={() => setReviewTarget(null)}
                                aria-label="Close review"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="el-review-summary">
                            <div className="el-avatar">
                                {employeeName(reviewTarget).charAt(0).toUpperCase()}
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
                            <div className="el-review-info">
                                <AlertCircle size={18} />
                                <p>
                                    Your approval will forward this request to HR for
                                    the final decision. Leave balance and attendance
                                    should only be updated after HR's final approval.
                                </p>
                            </div>
                        ) : (
                            <label className="el-comment-field">
                                <span>
                                    Rejection reason <b>*</b>
                                </span>
                                <textarea
                                    value={reviewComment}
                                    onChange={(event) =>
                                        setReviewComment(event.target.value)
                                    }
                                    placeholder="Explain why this leave request is being rejected..."
                                    rows={4}
                                    required
                                />
                            </label>
                        )}

                        {error && (
                            <div className="el-inline-error">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="el-modal-footer">
                            <button
                                type="button"
                                className="el-secondary-button"
                                disabled={submitting}
                                onClick={() => setReviewTarget(null)}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className={
                                    reviewAction === "approve"
                                        ? "el-primary-button"
                                        : "el-danger-button"
                                }
                                disabled={submitting}
                                onClick={submitReview}
                            >
                                {submitting ? (
                                    <>
                                        <RefreshCw size={16} className="el-spin" />
                                        Submitting...
                                    </>
                                ) : reviewAction === "approve" ? (
                                    <>
                                        <Check size={16} />
                                        Confirm &amp; forward
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