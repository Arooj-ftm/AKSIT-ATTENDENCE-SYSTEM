import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    FileText,
    RefreshCw,
    Timer,
    TrendingUp,
    X,
    Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./EmployeeMonthlyReport.css";

const pad = (value) => String(value).padStart(2, "0");

const COMPANY_REPORT_ROLES = [
    "hr",
    "ceo",
    "cto_md",
    "superuser",
];

function normalizeRole(role) {
    return String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function shiftMonth(month, amount) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(year, monthNumber - 1 + amount, 1);

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatMonth(month) {
    const [year, monthNumber] = month.split("-").map(Number);

    return new Date(year, monthNumber - 1, 1).toLocaleDateString(
        "en-GB",
        { month: "long", year: "numeric" }
    );
}

function formatDate(value) {
    if (!value) return "—";

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    const date = match
        ? new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        )
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatTime(value) {
    if (!value) return "—";

    if (/^\d{2}:\d{2}$/.test(String(value))) {
        return value;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatHours(minutes = 0) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const remaining = total % 60;

    if (!hours) return `${remaining}m`;
    if (!remaining) return `${hours}h`;

    return `${hours}h ${remaining}m`;
}

function getId(value) {
    if (!value) return "";

    if (typeof value === "object") {
        return String(value._id || value.id || value.userId || "");
    }

    return String(value);
}

function getReportEmployee(report) {
    return report?.user || report?.employee || report || {};
}

function getReportEmployeeId(report) {
    const employee = getReportEmployee(report);

    return getId(
        employee.id ||
        employee._id ||
        employee.userId ||
        employee.employeeId
    );
}

function getStatusClass(status) {
    const normalized = String(status || "Not Started")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return `employee-monthly-status-${normalized || "not-started"}`;
}

function getDayStatus(day) {
    const status = String(
        day?.status ||
        day?.attendanceStatus ||
        day?.leaveStatus ||
        ""
    ).trim();

    if (status) return status;
    if (day?.leave) return "On Leave";
    if (day?.holiday) return "Holiday";

    return "Not Started";
}

function isExcludedDay(day) {
    const status = getDayStatus(day).toLowerCase();

    return (
        day?.isSunday === true ||
        day?.isHoliday === true ||
        day?.isWorkingDay === false ||
        day?.holiday?.isWorkingDay === false ||
        status.includes("sunday") ||
        status.includes("holiday") ||
        status.includes("off day") ||
        status.includes("off-day")
    );
}

function getWorkedMinutes(day) {
    const candidates = [
        day?.netWorkedMinutes,
        day?.workedMinutes,
        day?.actualMinutes,
        day?.totalWorkedMinutes,
        day?.summary?.netWorkedMinutes,
        day?.summary?.actualMinutes,
    ];

    for (const value of candidates) {
        if (value !== undefined && value !== null && value !== "") {
            const minutes = Number(value);

            if (Number.isFinite(minutes)) {
                return Math.max(0, minutes);
            }
        }
    }

    if (day?.netWorkedHours != null) {
        const hours = Number(day.netWorkedHours);

        if (Number.isFinite(hours)) {
            return Math.max(0, Math.round(hours * 60));
        }
    }

    return 0;
}

function getTargetMinutes(day) {
    const status = getDayStatus(day).toLowerCase();

    if (isExcludedDay(day) || status.includes("leave")) {
        return 0;
    }

    const candidates = [
        day?.targetMinutes,
        day?.requiredMinutes,
        day?.dailyTargetMinutes,
        day?.expectedMinutes,
    ];

    for (const value of candidates) {
        if (value !== undefined && value !== null && value !== "") {
            const minutes = Number(value);

            if (Number.isFinite(minutes)) {
                return Math.max(0, minutes);
            }
        }
    }

    if (day?.targetHours != null) {
        const hours = Number(day.targetHours);

        if (Number.isFinite(hours)) {
            return Math.max(0, Math.round(hours * 60));
        }
    }

    return 420;
}

function getCheckIn(day) {
    return day?.checkIn || day?.checkInTime || day?.attendance?.checkIn || null;
}

function getCheckOut(day) {
    return day?.checkOut || day?.checkOutTime || day?.attendance?.checkOut || null;
}

function getLeaveName(day) {
    return (
        day?.leaveType ||
        day?.leave?.leaveType ||
        day?.leave?.type ||
        ""
    );
}

function getProgress(day) {
    const target = getTargetMinutes(day);
    const worked = getWorkedMinutes(day);

    if (target <= 0) return null;

    return Math.min(100, Math.round((worked / target) * 100));
}

function getSummaryValue(summary, keys, fallback = 0) {
    for (const key of keys) {
        if (summary?.[key] !== undefined && summary?.[key] !== null) {
            const value = Number(summary[key]);

            if (Number.isFinite(value)) return value;
        }
    }

    return fallback;
}

function getDailyRows(days) {
    return [...days].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
    );
}

function getPresentStatus(status, worked) {
    return (
        status.includes("present") ||
        status.includes("target met") ||
        status.includes("in progress") ||
        status.includes("incomplete") ||
        status.includes("target missed") ||
        status.includes("late") ||
        (worked > 0 && !status.includes("leave"))
    );
}

export default function EmployeeMonthlyReport() {
    const { user, token } = useAuth();

    // Used to scroll to the selected employee's detailed report.
    const reportDetailsRef = useRef(null);

    const role = normalizeRole(user?.role);
    const isSuperAdmin = role === "super_admin";
    const isCompanyWide = COMPANY_REPORT_ROLES.includes(role);

    const [month, setMonth] = useState(getCurrentMonth);
    const [reports, setReports] = useState([]);
    const [singleReport, setSingleReport] = useState(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const loadReport = useCallback(async (showRefresh = false) => {
        if (showRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        if (isSuperAdmin) {
            setReports([]);
            setSingleReport(null);
            setSelectedEmployeeId("");
            setError(
                "Super Admin accounts do not have access to monthly attendance reports."
            );
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const response = await apiRequest(
                `/api/attendance/monthly-report?month=${encodeURIComponent(month)}`,
                {},
                token
            );

            const payload = response?.data ?? response;

            const employeeReports = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.employees)
                    ? payload.employees
                    : Array.isArray(response?.employees)
                        ? response.employees
                        : [];

            // Never display Super Admin accounts as employee reports.
            const filteredEmployeeReports = employeeReports.filter((item) => {
                const employee = getReportEmployee(item);
                return normalizeRole(employee.role) !== "super_admin";
            });

            const currentUserId = getId(
                user?.id || user?._id || user?.userId
            );

            if (isCompanyWide) {
                setReports(filteredEmployeeReports);
                setSingleReport(null);

                // Keep the current selection only if it still exists.
                // Otherwise, no employee report is opened by default.
                setSelectedEmployeeId((currentSelectedId) => {
                    const selectedStillExists = filteredEmployeeReports.some(
                        (item) =>
                            getReportEmployeeId(item) === currentSelectedId
                    );

                    return selectedStillExists ? currentSelectedId : "";
                });
            } else {
                // Employee accounts can only display their own report.
                const ownReport = filteredEmployeeReports.find(
                    (item) =>
                        getReportEmployeeId(item) === currentUserId
                );

                if (ownReport) {
                    setSingleReport(ownReport);
                } else if (
                    payload?.summary &&
                    Array.isArray(payload?.days) &&
                    normalizeRole(
                        getReportEmployee(payload).role || user?.role
                    ) !== "super_admin"
                ) {
                    setSingleReport(payload);
                } else {
                    setSingleReport(null);
                }

                setReports([]);
                setSelectedEmployeeId("");
            }
        } catch (err) {
            setError(err.message || "Unable to load the monthly report.");
            setReports([]);
            setSingleReport(null);
            setSelectedEmployeeId("");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [month, token, user, isCompanyWide, isSuperAdmin]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const filteredEmployees = useMemo(() => {
        const query = employeeSearch.trim().toLowerCase();

        if (!query) return reports;

        return reports.filter((item) => {
            const employee = getReportEmployee(item);

            return [
                employee.name,
                employee.email,
                employee.department,
                employee.designation,
                employee.role,
            ].some((value) =>
                String(value || "").toLowerCase().includes(query)
            );
        });
    }, [reports, employeeSearch]);

    const report = isCompanyWide
        ? reports.find(
            (item) =>
                getReportEmployeeId(item) === selectedEmployeeId
        ) || null
        : singleReport;

    // Scroll only when a company-wide user selects a valid employee report.
    // The effect is deliberately placed after `report` is declared.
    useEffect(() => {
        if (!isCompanyWide || !selectedEmployeeId || !report || loading) {
            return;
        }

        const frame = requestAnimationFrame(() => {
            reportDetailsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [isCompanyWide, selectedEmployeeId, report, loading]);

    const employee = getReportEmployee(report);
    const summary = report?.summary || {};
    const days = Array.isArray(report?.days) ? report.days : [];

    const rows = useMemo(() => getDailyRows(days), [days]);

    const visibleRows = useMemo(() => {
        if (statusFilter === "All") return rows;

        return rows.filter((day) => {
            const status = getDayStatus(day).toLowerCase();
            const worked = getWorkedMinutes(day);

            if (statusFilter === "Present") {
                return getPresentStatus(status, worked);
            }

            if (statusFilter === "Absent") {
                return status.includes("absent");
            }

            if (statusFilter === "Leave") {
                return status.includes("leave") || Boolean(day?.leave);
            }

            if (statusFilter === "Holiday / Sunday") {
                return isExcludedDay(day);
            }

            if (statusFilter === "Incomplete") {
                return (
                    status.includes("incomplete") ||
                    status.includes("not started") ||
                    status.includes("pending") ||
                    status.includes("target missed") ||
                    status.includes("upcoming")
                );
            }

            return status === statusFilter.toLowerCase();
        });
    }, [rows, statusFilter]);

    const calculated = useMemo(() => {
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;
        let excludedDays = 0;
        let workedMinutes = 0;
        let targetMinutes = 0;
        let completedDays = 0;
        let eligibleDays = 0;

        days.forEach((day) => {
            const status = getDayStatus(day).toLowerCase();
            const worked = getWorkedMinutes(day);
            const target = getTargetMinutes(day);

            workedMinutes += worked;

            if (isExcludedDay(day)) {
                excludedDays++;
                return;
            }

            if (status.includes("leave") || day?.leave) {
                leaveDays++;
                return;
            }

            if (status.includes("absent")) {
                absentDays++;
            }

            if (getPresentStatus(status, worked)) {
                presentDays++;
            }

            if (target > 0) {
                targetMinutes += target;
                eligibleDays++;

                if (worked >= target) completedDays++;
            }
        });

        return {
            presentDays,
            absentDays,
            leaveDays,
            excludedDays,
            workedMinutes,
            targetMinutes,
            completedDays,
            eligibleDays,
            dailyTargetCompletion: eligibleDays
                ? Math.round((completedDays / eligibleDays) * 100)
                : 0,
            monthlyHoursCompletion: targetMinutes
                ? Math.min(
                    100,
                    Math.round((workedMinutes / targetMinutes) * 100)
                )
                : 0,
        };
    }, [days]);

    const presentDays = getSummaryValue(
        summary,
        ["presentDays", "daysPresent", "present"],
        calculated.presentDays
    );

    const absentDays = getSummaryValue(
        summary,
        ["absentDays", "daysAbsent", "absent"],
        calculated.absentDays
    );

    const leaveDays = getSummaryValue(
        summary,
        ["leaveDays", "approvedLeaveDays", "daysOnLeave"],
        calculated.leaveDays
    );

    const workedMinutes = getSummaryValue(
        summary,
        [
            "actualMinutes",
            "totalWorkedMinutes",
            "netWorkedMinutes",
            "workedMinutes",
        ],
        calculated.workedMinutes
    );

    const targetMinutes = getSummaryValue(
        summary,
        [
            "requiredMinutes",
            "totalTargetMinutes",
            "targetMinutes",
        ],
        calculated.targetMinutes
    );

    const dailyCompletion = Math.min(
        100,
        Math.max(
            0,
            getSummaryValue(
                summary,
                [
                    "dailyTargetCompletionPercent",
                    "attendanceCompletionPercent",
                    "completionPercent",
                ],
                calculated.dailyTargetCompletion
            )
        )
    );

    const hoursCompletion = Math.min(
        100,
        Math.max(
            0,
            getSummaryValue(
                summary,
                ["monthlyHoursCompletionPercent"],
                targetMinutes > 0
                    ? Math.round((workedMinutes / targetMinutes) * 100)
                    : calculated.monthlyHoursCompletion
            )
        )
    );

    const today = (() => {
        const now = new Date();
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    })();

    const isCurrentMonth = month === getCurrentMonth();

    const previousMonth = () => {
        setNotice("");
        setMonth((current) => shiftMonth(current, -1));
    };

    const nextMonth = () => {
        if (shiftMonth(month, 1) > getCurrentMonth()) return;

        setNotice("");
        setMonth((current) => shiftMonth(current, 1));
    };

    const roleTitle = {
        hr: "HR Monthly Attendance Reports",
        ceo: "CEO Monthly Attendance Reports",
        cto_md: "CTO / Managing Director Monthly Reports",
        superuser: "Company Monthly Attendance Reports",
    };

    const pageTitle = isCompanyWide
        ? roleTitle[role] || "Company Monthly Attendance Reports"
        : "Monthly Attendance Report";

    const pageDescription = isCompanyWide
        ? "Review monthly attendance, working hours, and daily progress across the company."
        : "Review your monthly attendance, working hours, and daily progress.";

    return (
        <main className="employee-monthly-report-page">
            <PageHeader
                eyebrow={isCompanyWide ? "COMPANY REPORTING" : "EMPLOYEE WORKSPACE"}
                title={pageTitle}
                description={pageDescription}
                icon={CalendarDays}
                onRefresh={() => loadReport(true)}
                refreshing={loading || refreshing}
            />

            {error && (
                <div
                    className="employee-monthly-alert employee-monthly-alert-error"
                    role="alert"
                >
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

            {notice && (
                <div className="employee-monthly-alert employee-monthly-alert-success">
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

            {!isSuperAdmin && (
                <>
                    <section className="employee-monthly-toolbar">
                        <div className="employee-monthly-month-heading">
                            <span className="employee-monthly-month-icon">
                                <CalendarDays size={20} />
                            </span>

                            <div>
                                <span className="employee-monthly-overline">
                                    REPORT PERIOD
                                </span>
                                <h2>{formatMonth(month)}</h2>
                            </div>
                        </div>

                        <div className="employee-monthly-month-controls">
                            <button
                                type="button"
                                onClick={previousMonth}
                                aria-label="Previous month"
                                title="Previous month"
                            >
                                <ChevronLeft size={19} />
                            </button>

                            <input
                                type="month"
                                value={month}
                                max={getCurrentMonth()}
                                onChange={(event) => {
                                    const value = event.target.value;

                                    if (value && value <= getCurrentMonth()) {
                                        setMonth(value);
                                        setNotice("");
                                    }
                                }}
                                aria-label="Select report month"
                            />

                            <button
                                type="button"
                                onClick={nextMonth}
                                disabled={isCurrentMonth}
                                aria-label="Next month"
                                title="Next month"
                            >
                                <ChevronRight size={19} />
                            </button>
                        </div>
                    </section>

                    {isCompanyWide && !loading && (
                        <section className="employee-monthly-days-section">
                            <div className="employee-monthly-section-heading">
                                <div>
                                    <h2>
                                        <Users
                                            size={20}
                                            style={{
                                                display: "inline",
                                                verticalAlign: "middle",
                                                marginRight: 8,
                                            }}
                                        />
                                        Employee Reports
                                    </h2>

                                    <p>
                                        {filteredEmployees.length} of {reports.length} employees
                                    </p>
                                </div>

                                <label className="employee-monthly-filter">
                                    <span>Search</span>
                                    <input
                                        type="search"
                                        value={employeeSearch}
                                        onChange={(event) =>
                                            setEmployeeSearch(event.target.value)
                                        }
                                        placeholder="Name, department or email"
                                        aria-label="Search employee reports"
                                    />
                                </label>
                            </div>

                            {filteredEmployees.length === 0 ? (
                                <div className="employee-monthly-table-empty">
                                    <Users size={24} />
                                    <p>
                                        No employee reports were found for this month.
                                    </p>
                                </div>
                            ) : (
                                <div className="employee-monthly-table-wrap">
                                    <table className="employee-monthly-table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Department</th>
                                                <th>Present Days</th>
                                                <th>Absent Days</th>
                                                <th>Working Hours</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {filteredEmployees.map((item) => {
                                                const itemEmployee = getReportEmployee(item);
                                                const itemSummary = item?.summary || {};
                                                const itemId = getReportEmployeeId(item);
                                                const isSelected =
                                                    itemId === selectedEmployeeId;

                                                return (
                                                    <tr key={itemId || itemEmployee.email}>
                                                        <td>
                                                            <div className="employee-monthly-date-cell">
                                                                <strong>
                                                                    {itemEmployee.name || "Unnamed employee"}
                                                                </strong>
                                                                <small>
                                                                    {itemEmployee.email ||
                                                                        itemEmployee.designation ||
                                                                        "—"}
                                                                </small>
                                                            </div>
                                                        </td>

                                                        <td>{itemEmployee.department || "—"}</td>

                                                        <td>
                                                            {getSummaryValue(
                                                                itemSummary,
                                                                [
                                                                    "presentDays",
                                                                    "daysPresent",
                                                                    "present",
                                                                ],
                                                                (item.days || []).filter((day) =>
                                                                    getPresentStatus(
                                                                        getDayStatus(day).toLowerCase(),
                                                                        getWorkedMinutes(day)
                                                                    ) && !isExcludedDay(day)
                                                                ).length
                                                            )}
                                                        </td>

                                                        <td>
                                                            {getSummaryValue(
                                                                itemSummary,
                                                                [
                                                                    "absentDays",
                                                                    "daysAbsent",
                                                                    "absent",
                                                                ],
                                                                (item.days || []).filter((day) =>
                                                                    getDayStatus(day)
                                                                        .toLowerCase()
                                                                        .includes("absent")
                                                                ).length
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatHours(
                                                                getSummaryValue(
                                                                    itemSummary,
                                                                    [
                                                                        "actualMinutes",
                                                                        "totalWorkedMinutes",
                                                                        "workedMinutes",
                                                                    ],
                                                                    (item.days || []).reduce(
                                                                        (total, day) =>
                                                                            total +
                                                                            getWorkedMinutes(day),
                                                                        0
                                                                    )
                                                                )
                                                            )}
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="employee-monthly-primary-button"
                                                                onClick={() => {
                                                                    setSelectedEmployeeId(itemId);
                                                                    setStatusFilter("All");
                                                                }}
                                                                aria-pressed={isSelected}
                                                            >
                                                                {isSelected
                                                                    ? "Viewing report"
                                                                    : "View report"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}

                    {loading ? (
                        <div className="employee-monthly-state">
                            <RefreshCw
                                size={27}
                                className="employee-monthly-spin"
                            />
                            <h3>Loading monthly report...</h3>
                            <p>Retrieving attendance records.</p>
                        </div>
                    ) : !report ? (
                        isCompanyWide ? null : (
                            <div className="employee-monthly-state">
                                <div className="employee-monthly-state-icon">
                                    <FileText size={28} />
                                </div>

                                <h3>Report Not Available</h3>
                                <p>
                                    Your report for this month was not found in the API response.
                                    Verify the backend endpoint and attendance records.
                                </p>

                                <button
                                    type="button"
                                    className="employee-monthly-primary-button"
                                    onClick={() => loadReport(true)}
                                    disabled={refreshing}
                                >
                                    <RefreshCw size={16} />
                                    Try again
                                </button>
                            </div>
                        )
                    ) : (
                        <>
                            <section
                                ref={isCompanyWide ? reportDetailsRef : null}
                                className="employee-monthly-profile"
                            >
                                <div className="employee-monthly-avatar">
                                    {String(employee.name || user?.name || "E")
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div className="employee-monthly-profile-info">
                                    <span>
                                        {isCompanyWide
                                            ? "EMPLOYEE REPORT"
                                            : "MY ATTENDANCE REPORT"}
                                    </span>

                                    <h2>
                                        {employee.name || user?.name || "My Attendance"}
                                    </h2>

                                    <p>
                                        {employee.employeeId ||
                                            employee.email ||
                                            user?.email ||
                                            "Personal monthly attendance summary"}
                                        {employee.department
                                            ? ` • ${employee.department}`
                                            : ""}
                                    </p>
                                </div>

                                <div className="employee-monthly-profile-period">
                                    <CalendarDays size={17} />
                                    <span>{formatMonth(month)}</span>
                                </div>
                            </section>

                            <section className="employee-monthly-stats">
                                <article className="employee-monthly-stat-card">
                                    <div className="employee-monthly-stat-top">
                                        <span>Present Days</span>
                                        <span className="employee-monthly-stat-icon monthly-icon-green">
                                            <CheckCircle2 size={19} />
                                        </span>
                                    </div>
                                    <strong>{presentDays}</strong>
                                    <small>Days with attendance</small>
                                </article>

                                <article className="employee-monthly-stat-card">
                                    <div className="employee-monthly-stat-top">
                                        <span>Absent Days</span>
                                        <span className="employee-monthly-stat-icon monthly-icon-red">
                                            <AlertCircle size={19} />
                                        </span>
                                    </div>
                                    <strong>{absentDays}</strong>
                                    <small>Recorded absences</small>
                                </article>

                                <article className="employee-monthly-stat-card">
                                    <div className="employee-monthly-stat-top">
                                        <span>Approved Leave</span>
                                        <span className="employee-monthly-stat-icon monthly-icon-purple">
                                            <CalendarDays size={19} />
                                        </span>
                                    </div>
                                    <strong>{leaveDays}</strong>
                                    <small>Leave days in report</small>
                                </article>

                                <article className="employee-monthly-stat-card">
                                    <div className="employee-monthly-stat-top">
                                        <span>Net Working Hours</span>
                                        <span className="employee-monthly-stat-icon monthly-icon-blue">
                                            <Clock3 size={19} />
                                        </span>
                                    </div>
                                    <strong>{formatHours(workedMinutes)}</strong>
                                    <small>Lunch break excluded by API</small>
                                </article>
                            </section>

                            <section className="employee-monthly-progress-grid">
                                <article className="employee-monthly-progress-card">
                                    <div className="employee-monthly-progress-heading">
                                        <span className="employee-monthly-progress-icon">
                                            <TrendingUp size={19} />
                                        </span>
                                        <div>
                                            <h3>Daily Target Completion</h3>
                                            <p>
                                                Days that met their required work hours
                                            </p>
                                        </div>
                                    </div>

                                    <div className="employee-monthly-progress-value">
                                        <strong>{dailyCompletion}%</strong>
                                        <span>
                                            {summary.targetMetDays ?? calculated.completedDays} of{" "}
                                            {summary.eligibleDays ?? calculated.eligibleDays} eligible days
                                        </span>
                                    </div>

                                    <div
                                        className="employee-monthly-progress-track"
                                        role="progressbar"
                                        aria-valuenow={dailyCompletion}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label="Daily target completion"
                                    >
                                        <div
                                            className="employee-monthly-progress-fill monthly-progress-green"
                                            style={{ width: `${dailyCompletion}%` }}
                                        />
                                    </div>
                                </article>

                                <article className="employee-monthly-progress-card">
                                    <div className="employee-monthly-progress-heading">
                                        <span className="employee-monthly-progress-icon monthly-progress-icon-blue">
                                            <Timer size={19} />
                                        </span>
                                        <div>
                                            <h3>Monthly Hours Completion</h3>
                                            <p>
                                                Actual net hours compared with required hours
                                            </p>
                                        </div>
                                    </div>

                                    <div className="employee-monthly-progress-value">
                                        <strong>{hoursCompletion}%</strong>
                                        <span>
                                            {formatHours(workedMinutes)} /{" "}
                                            {formatHours(targetMinutes)}
                                        </span>
                                    </div>

                                    <div
                                        className="employee-monthly-progress-track"
                                        role="progressbar"
                                        aria-valuenow={hoursCompletion}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label="Monthly hours completion"
                                    >
                                        <div
                                            className="employee-monthly-progress-fill monthly-progress-blue"
                                            style={{ width: `${hoursCompletion}%` }}
                                        />
                                    </div>
                                </article>
                            </section>

                            <section className="employee-monthly-days-section">
                                <div className="employee-monthly-section-heading">
                                    <div>
                                        <h2>Daily Attendance Details</h2>
                                        <p>
                                            {visibleRows.length} of {days.length} dates shown
                                        </p>
                                    </div>

                                    <label className="employee-monthly-filter">
                                        <span>Filter</span>
                                        <select
                                            value={statusFilter}
                                            onChange={(event) =>
                                                setStatusFilter(event.target.value)
                                            }
                                            aria-label="Filter attendance by status"
                                        >
                                            <option value="All">All days</option>
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                            <option value="Leave">Leave</option>
                                            <option value="Incomplete">
                                                Incomplete / Pending
                                            </option>
                                            <option value="Holiday / Sunday">
                                                Holiday / Sunday
                                            </option>
                                        </select>
                                    </label>
                                </div>

                                {visibleRows.length === 0 ? (
                                    <div className="employee-monthly-table-empty">
                                        <CalendarDays size={24} />
                                        <p>
                                            No attendance records match this filter.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="employee-monthly-table-wrap">
                                        <table className="employee-monthly-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Check In</th>
                                                    <th>Check Out</th>
                                                    <th>Net Hours</th>
                                                    <th>Daily Target</th>
                                                    <th>Progress</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {visibleRows.map((day, index) => {
                                                    const status = getDayStatus(day);
                                                    const worked = getWorkedMinutes(day);
                                                    const target = getTargetMinutes(day);
                                                    const progress = getProgress(day);
                                                    const leaveName = getLeaveName(day);

                                                    return (
                                                        <tr
                                                            key={`${day.date || "date"}-${index}`}
                                                        >
                                                            <td>
                                                                <div className="employee-monthly-date-cell">
                                                                    <strong>
                                                                        {formatDate(day.date)}
                                                                    </strong>
                                                                    {day.date === today && (
                                                                        <span>Today</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td>
                                                                {formatTime(getCheckIn(day))}
                                                            </td>
                                                            <td>
                                                                {formatTime(getCheckOut(day))}
                                                            </td>

                                                            <td>
                                                                <strong className="employee-monthly-hours">
                                                                    {formatHours(worked)}
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {target > 0
                                                                    ? formatHours(target)
                                                                    : "—"}
                                                            </td>

                                                            <td>
                                                                {progress === null ? (
                                                                    <span className="employee-monthly-no-target">
                                                                        N/A
                                                                    </span>
                                                                ) : (
                                                                    <div className="employee-monthly-row-progress">
                                                                        <div className="employee-monthly-row-progress-track">
                                                                            <div
                                                                                style={{
                                                                                    width: `${progress}%`,
                                                                                }}
                                                                                className={
                                                                                    progress >= 100
                                                                                        ? "is-complete"
                                                                                        : ""
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <span>{progress}%</span>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td>
                                                                <div className="employee-monthly-status-cell">
                                                                    <span
                                                                        className={`employee-monthly-status ${getStatusClass(status)}`}
                                                                    >
                                                                        {status}
                                                                    </span>

                                                                    {leaveName && (
                                                                        <small>
                                                                            {leaveName.replace(/_/g, " ")}
                                                                        </small>
                                                                    )}

                                                                    {day?.holidayName && (
                                                                        <small>
                                                                            {day.holidayName}
                                                                        </small>
                                                                    )}

                                                                    {day?.holiday?.name && (
                                                                        <small>
                                                                            {day.holiday.name}
                                                                        </small>
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

                                <div className="employee-monthly-table-note">
                                    <AlertCircle size={16} />
                                    <p>
                                        Net working hours and daily targets are calculated using
                                        backend report data. Sundays, holidays, and approved
                                        leaves are displayed according to their respective
                                        attendance statuses and are not treated as absences.
                                    </p>
                                </div>
                            </section>
                        </>
                    )}
                </>
            )}
        </main>
    );
}