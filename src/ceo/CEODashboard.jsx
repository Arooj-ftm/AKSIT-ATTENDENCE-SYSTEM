
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    BriefcaseBusiness,
    CalendarCheck,
    CheckCircle2,
    Clock3,
    RefreshCw,
    ShieldAlert,
    Users,
    ClipboardList,
    CalendarDays,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./CEODashboard.css";

const localDate = () => {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-");
};

const getId = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
        return String(value._id || value.id || "");
    }
    return String(value);
};

const getTaskStatus = (task) => {
    const assignments = Array.isArray(task.assignments)
        ? task.assignments
        : [];

    if (
        assignments.length > 0 &&
        assignments.every((item) => item.status === "Completed")
    ) {
        return "Completed";
    }

    if (task.deadline) {
        const deadline = new Date(task.deadline);

        if (!Number.isNaN(deadline.getTime())) {
            deadline.setHours(23, 59, 59, 999);

            if (Date.now() > deadline.getTime()) {
                return "Overdue";
            }
        }
    }

    const hasProgress = assignments.some(
        (item) =>
            item.status === "In Progress" ||
            Number(item.progressPercent) > 0
    );

    const hasLoggedTime = (task.timeEntries || []).some(
        (entry) => Number(entry.workedMinutes) > 0
    );

    return hasProgress || hasLoggedTime ? "In Progress" : "To Do";
};

const getTaskProgress = (task) => {
    const assignments = Array.isArray(task.assignments)
        ? task.assignments
        : [];

    if (!assignments.length) return 0;

    const total = assignments.reduce((sum, item) => {
        const value = Number(item.progressPercent);
        return sum + (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);
    }, 0);

    return Math.round(total / assignments.length);
};

const getPersonName = (person) => {
    if (!person) return "Unknown";
    if (typeof person === "string") return person;
    return person.name || person.fullName || person.email || "Unknown";
};

const getErrorMessage = (error) =>
    error?.message || "Dashboard data could not be loaded.";

const statusLabels = {
    "To Do": "To Do",
    "In Progress": "In Progress",
    Completed: "Completed",
    Overdue: "Overdue",
};

export default function CEODashboard() {
    const { token, user } = useAuth();

    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async (refresh = false) => {
        if (!token) {
            setError("Your login session could not be verified. Please sign in again.");
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (refresh) setRefreshing(true);
        else setLoading(true);

        setError("");

        const today = localDate();
        const month = today.slice(0, 7);

        const results = await Promise.allSettled([
            apiRequest("/api/ceo/employees", {}, token),
            apiRequest(
                `/api/cto-md/company-attendance?date=${today}&month=${month}&view=daily`,
                {},
                token
            ),
            apiRequest("/api/tasks", {}, token),
            apiRequest("/api/leaves/company-records", {}, token),
        ]);

        const errors = [];

        if (results[0].status === "fulfilled") {
            const data = results[0].value;
            const list = data.employees || data.data || [];
            setEmployees(Array.isArray(list) ? list : []);
        } else {
            setEmployees([]);
            errors.push(`Employees: ${getErrorMessage(results[0].reason)}`);
        }

        if (results[1].status === "fulfilled") {
            setAttendance(results[1].value);
        } else {
            setAttendance(null);
            errors.push(`Attendance: ${getErrorMessage(results[1].reason)}`);
        }

        if (results[2].status === "fulfilled") {
            const list = results[2].value.tasks || [];
            setTasks(Array.isArray(list) ? list : []);
        } else {
            setTasks([]);
            errors.push(`Tasks: ${getErrorMessage(results[2].reason)}`);
        }

        if (results[3].status === "fulfilled") {
            const data = results[3].value;
            const list = data.requests || data.leaves || [];
            setLeaveRequests(Array.isArray(list) ? list : []);
        } else {
            setLeaveRequests([]);
            errors.push(`Leave requests: ${getErrorMessage(results[3].reason)}`);
        }

        if (errors.length) {
            setError(errors.join(" "));
        }

        setLoading(false);
        setRefreshing(false);
    }, [token]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const activeTasks = useMemo(
        () => tasks.map((task) => ({
            ...task,
            dashboardStatus: getTaskStatus(task),
            dashboardProgress: getTaskProgress(task),
        })),
        [tasks]
    );

    const taskStats = useMemo(() => ({
        total: activeTasks.length,
        inProgress: activeTasks.filter((task) => task.dashboardStatus === "In Progress").length,
        completed: activeTasks.filter((task) => task.dashboardStatus === "Completed").length,
        overdue: activeTasks.filter((task) => task.dashboardStatus === "Overdue").length,
        toDo: activeTasks.filter((task) => task.dashboardStatus === "To Do").length,
    }), [activeTasks]);

    const attendanceSummary = attendance?.summary || {};
    const attendanceRecords = Array.isArray(attendance?.records)
        ? attendance.records
        : [];

    const attendanceStats = useMemo(() => {
        const present = Number(
            attendanceSummary.present ??
            attendanceRecords.filter((record) => record.status === "present").length
        );

        const absent = Number(
            attendanceSummary.absent ??
            attendanceRecords.filter((record) => record.status === "absent").length
        );

        const onLeave = Number(
            attendanceSummary.onLeave ??
            attendanceRecords.filter((record) => record.status === "on_leave").length
        );

        const total = Number(
            attendanceSummary.totalEmployees ?? employees.length
        );

        return {
            total,
            present,
            absent,
            onLeave,
            rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
    }, [attendanceSummary, attendanceRecords, employees.length]);

    const departmentStats = useMemo(() => {
        const counts = {};

        employees.forEach((employee) => {
            const department = String(employee.department || "Unassigned").trim() || "Unassigned";
            counts[department] = (counts[department] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [employees]);

    const pendingLeaves = useMemo(
        () => leaveRequests.filter(
            (request) => String(request.status || "").toLowerCase() === "pending"
        ),
        [leaveRequests]
    );

    const recentOverdueTasks = useMemo(
        () => activeTasks
            .filter((task) => task.dashboardStatus === "Overdue")
            .sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0))
            .slice(0, 4),
        [activeTasks]
    );

    const overallProgress = useMemo(() => {
        if (!activeTasks.length) return 0;

        return Math.round(
            activeTasks.reduce((sum, task) => sum + task.dashboardProgress, 0) /
            activeTasks.length
        );
    }, [activeTasks]);

    const formatDeadline = (value) => {
        if (!value) return "No deadline";
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? "Date unavailable"
            : date.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
    };

    const todayLabel = new Date(`${localDate()}T00:00:00`).toLocaleDateString(
        undefined,
        { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    );

    return (
        <main className="ceo-dashboard">
            <PageHeader
                eyebrow="AKSIT GLOBAL · EXECUTIVE WORKSPACE"
                title="CEO Dashboard"
                description={`Welcome, ${user?.name || "CEO"}. Here's your company overview for ${todayLabel}.`}
                icon={Activity}
                onRefresh={() => loadDashboard(true)}
                refreshing={refreshing}
                className="ceo-dashboard-header"
            />

            {error && (
                <div className="ceod-alert ceod-alert-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => loadDashboard(true)}
                        disabled={refreshing}
                    >
                        Retry
                    </button>
                </div>
            )}

            <section className="ceod-kpi-grid" aria-label="Executive metrics">
                <KpiCard
                    icon={Users}
                    tone="blue"
                    label="Active Employees"
                    value={employees.length}
                    note="Company workforce"
                    loading={loading}
                />
                <KpiCard
                    icon={CalendarCheck}
                    tone="green"
                    label="Present Today"
                    value={attendanceStats.present}
                    note={`${attendanceStats.rate}% of active workforce`}
                    loading={loading}
                />
                <KpiCard
                    icon={ClipboardList}
                    tone="purple"
                    label="Active Tasks"
                    value={taskStats.total - taskStats.completed}
                    note={`${taskStats.inProgress} currently in progress`}
                    loading={loading}
                />
                <KpiCard
                    icon={CheckCircle2}
                    tone="teal"
                    label="Completed Tasks"
                    value={taskStats.completed}
                    note="All assigned employees completed"
                    loading={loading}
                />
                <KpiCard
                    icon={CalendarDays}
                    tone="orange"
                    label="Pending Leave Requests"
                    value={pendingLeaves.length}
                    note="Company-wide requests"
                    loading={loading}
                />
            </section>

            <section className="ceod-main-grid">
                <article className="ceod-panel ceod-attendance-panel">
                    <PanelHeading
                        icon={Activity}
                        title="Today's Attendance"
                        subtitle="Company-wide daily attendance snapshot"
                    />

                    {loading ? (
                        <LoadingState />
                    ) : !attendance ? (
                        <EmptyState message="Attendance data is unavailable." />
                    ) : (
                        <>
                            <div className="ceod-attendance-overview">
                                <div className="ceod-attendance-ring" style={{ "--progress": `${attendanceStats.rate}%` }}>
                                    <div>
                                        <strong>{attendanceStats.rate}%</strong>
                                        <span>present</span>
                                    </div>
                                </div>
                                <div className="ceod-attendance-legend">
                                    <LegendRow label="Present" value={attendanceStats.present} tone="green" />
                                    <LegendRow label="Absent" value={attendanceStats.absent} tone="red" />
                                    <LegendRow label="On leave" value={attendanceStats.onLeave} tone="orange" />
                                    <LegendRow label="Total employees" value={attendanceStats.total} tone="blue" />
                                </div>
                            </div>
                            <p className="ceod-chart-footnote">
                                Rate = employees marked present divided by the active workforce for today.
                            </p>
                        </>
                    )}
                </article>

                <article className="ceod-panel ceod-task-panel">
                    <PanelHeading
                        icon={BriefcaseBusiness}
                        title="Task Status"
                        subtitle="Current status of company tasks and projects"
                    />

                    {loading ? (
                        <LoadingState />
                    ) : !tasks.length ? (
                        <EmptyState message="No task data is available yet." />
                    ) : (
                        <div className="ceod-task-breakdown">
                            {Object.entries(statusLabels).map(([status, label]) => {
                                const count = taskStats[
                                    status === "To Do" ? "toDo" :
                                    status === "In Progress" ? "inProgress" :
                                    status === "Completed" ? "completed" : "overdue"
                                ];
                                const percentage = taskStats.total
                                    ? Math.round((count / taskStats.total) * 100)
                                    : 0;

                                return (
                                    <div className="ceod-bar-row" key={status}>
                                        <div className="ceod-bar-label">
                                            <span>{label}</span>
                                            <strong>{count}</strong>
                                        </div>
                                        <div className="ceod-bar-track">
                                            <span
                                                className={`ceod-bar-fill status-${status.toLowerCase().replace(/\s+/g, "-")}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </article>
            </section>

            <section className="ceod-main-grid ceod-lower-grid">
                <article className="ceod-panel">
                    <PanelHeading
                        icon={Users}
                        title="Department Distribution"
                        subtitle="Active employees grouped by department"
                    />

                    {loading ? (
                        <LoadingState />
                    ) : !departmentStats.length ? (
                        <EmptyState message="No department information is available." />
                    ) : (
                        <div className="ceod-department-list">
                            {departmentStats.map((department) => {
                                const percent = employees.length
                                    ? Math.round((department.count / employees.length) * 100)
                                    : 0;

                                return (
                                    <div className="ceod-department-row" key={department.name}>
                                        <div className="ceod-department-info">
                                            <span>{department.name}</span>
                                            <strong>{department.count}</strong>
                                        </div>
                                        <div className="ceod-bar-track">
                                            <span
                                                className="ceod-bar-fill department-fill"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </article>

                <article className="ceod-panel">
                    <PanelHeading
                        icon={Activity}
                        title="Overall Task Progress"
                        subtitle="Average reported progress across active tasks"
                    />

                    {loading ? (
                        <LoadingState />
                    ) : !tasks.length ? (
                        <EmptyState message="No task progress is available." />
                    ) : (
                        <div className="ceod-progress-summary">
                            <div className="ceod-progress-number">
                                <strong>{overallProgress}%</strong>
                                <span>average progress</span>
                            </div>
                            <div className="ceod-progress-track">
                                <span style={{ width: `${overallProgress}%` }} />
                            </div>
                            <div className="ceod-progress-details">
                                <span>
                                    <CheckCircle2 size={15} />
                                    {taskStats.completed} completed
                                </span>
                                <span>
                                    <Clock3 size={15} />
                                    {taskStats.inProgress} in progress
                                </span>
                            </div>
                            <p className="ceod-chart-footnote">
                                Each task contributes equally to this average; task progress is based on assignment progress reported by the backend.
                            </p>
                        </div>
                    )}
                </article>
            </section>

            <section className="ceod-panel ceod-alerts-panel">
                <PanelHeading
                    icon={ShieldAlert}
                    title="Executive Attention"
                    subtitle="Items that may need follow-up"
                    trailing={
                        <span className="ceod-alert-count">
                            {recentOverdueTasks.length + pendingLeaves.length}
                        </span>
                    }
                />

                {loading ? (
                    <LoadingState />
                ) : recentOverdueTasks.length === 0 && pendingLeaves.length === 0 ? (
                    <div className="ceod-all-clear">
                        <CheckCircle2 size={22} />
                        <div>
                            <strong>No pending alerts</strong>
                            <p>No overdue tasks or pending leave requests were found in the loaded records.</p>
                        </div>
                    </div>
                ) : (
                    <div className="ceod-alert-list">
                        {recentOverdueTasks.map((task) => (
                            <div className="ceod-alert-item" key={getId(task) || task.title}>
                                <span className="ceod-alert-icon overdue">
                                    <Clock3 size={18} />
                                </span>
                                <div className="ceod-alert-copy">
                                    <strong>{task.title || "Untitled task"} is overdue</strong>
                                    <p>
                                        {task.department || "Company-wide"} · Deadline {formatDeadline(task.deadline)}
                                    </p>
                                </div>
                                <span className="ceod-alert-tag overdue">Overdue</span>
                            </div>
                        ))}

                        {pendingLeaves.slice(0, 5).map((request, index) => (
                            <div className="ceod-alert-item" key={getId(request) || `${request.startDate}-${index}`}>
                                <span className="ceod-alert-icon leave">
                                    <CalendarDays size={18} />
                                </span>
                                <div className="ceod-alert-copy">
                                    <strong>
                                        Leave request from {getPersonName(request.userId || request.employeeId || request.user)}
                                    </strong>
                                    <p>
                                        {request.leaveType || "Leave"} · {formatDeadline(request.startDate)} to {formatDeadline(request.endDate)}
                                    </p>
                                </div>
                                <span className="ceod-alert-tag leave">Pending</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <footer className="ceod-footer">
                <Activity size={15} />
                <span>
                    Executive overview · Data is loaded from the connected company APIs.
                </span>
                <span className="ceod-footer-date">{todayLabel}</span>
            </footer>
        </main>
    );
}

function KpiCard({ icon: Icon, tone, label, value, note, loading }) {
    return (
        <article className="ceod-kpi-card">
            <div className="ceod-kpi-top">
                <span className={`ceod-kpi-icon ${tone}`}>
                    <Icon size={20} />
                </span>
                <span className="ceod-kpi-label">{label}</span>
            </div>
            <strong className="ceod-kpi-value">
                {loading ? "—" : value}
            </strong>
            <span className="ceod-kpi-note">{note}</span>
        </article>
    );
}

function PanelHeading({ icon: Icon, title, subtitle, trailing }) {
    return (
        <div className="ceod-panel-heading">
            <div className="ceod-panel-heading-icon">
                <Icon size={19} />
            </div>
            <div className="ceod-panel-heading-copy">
                <h2>{title}</h2>
                <p>{subtitle}</p>
            </div>
            {trailing}
        </div>
    );
}

function LegendRow({ label, value, tone }) {
    return (
        <div className="ceod-legend-row">
            <span className={`ceod-legend-dot ${tone}`} />
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="ceod-state">
            <RefreshCw size={21} className="ceod-spin" />
            <span>Loading data...</span>
        </div>
    );
}

function EmptyState({ message }) {
    return (
        <div className="ceod-state">
            <Activity size={23} />
            <span>{message}</span>
        </div>
    );
}
