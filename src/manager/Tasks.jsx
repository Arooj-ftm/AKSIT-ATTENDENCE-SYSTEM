
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Clock3,
    Edit3,
    FileText,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    Users,
    X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./Tasks.css";

const STATUSES = ["All", "To Do", "In Progress", "Completed", "Overdue"];

const emptyForm = {
    title: "",
    description: "",
    type: "Task",
    deadline: "",
    assignments: {},
};

function getId(value) {
    if (value && typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return String(value || "");
}

function getEmployeeName(value) {
    return value?.name || value?.email || "Employee";
}

function formatDate(value) {
    if (!value) return "No date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatHours(minutes = 0) {
    return `${(Number(minutes || 0) / 60).toFixed(1)}h`;
}

function getDeadlineDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function deadlineHasPassed(value) {
    if (!value) return false;

    const deadline = new Date(value);

    if (Number.isNaN(deadline.getTime())) return false;

    // Date-only deadlines remain valid until the end of that day.
    deadline.setHours(23, 59, 59, 999);

    return Date.now() > deadline.getTime();
}

function isOverdue(task, assignment) {
    return (
        assignment?.status !== "Completed" &&
        deadlineHasPassed(task?.deadline)
    );
}

function getEmployeeWorkedMinutes(task, employeeId) {
    return (task.timeEntries || [])
        .filter((entry) => getId(entry.employeeId) === employeeId)
        .reduce(
            (total, entry) => total + Number(entry.workedMinutes || 0),
            0
        );
}

function getEmployeeEntries(task, employeeId) {
    return (task.timeEntries || [])
        .filter((entry) => getId(entry.employeeId) === employeeId)
        .sort((a, b) => {
            const dateComparison = String(b.date || "").localeCompare(
                String(a.date || "")
            );

            return (
                dateComparison ||
                String(b.startTime || "").localeCompare(
                    String(a.startTime || "")
                )
            );
        });
}

function getEmployeeReports(task, employeeId) {
    return (task.dailyReports || [])
        .filter((report) => getId(report.employeeId) === employeeId)
        .sort((a, b) =>
            String(b.date || "").localeCompare(String(a.date || ""))
        );
}

function getStatus(task, assignment) {
    if (assignment?.status === "Completed") return "Completed";
    if (isOverdue(task, assignment)) return "Overdue";

    return assignment?.status || "To Do";
}

function getApiMessage(error, fallback) {
    return error?.message || fallback;
}

function getStatusClass(status) {
    return `tasks-status tasks-status-${String(status)
        .toLowerCase()
        .replace(/\s+/g, "-")}`;
}

export default function Tasks() {
    const { user, token } = useAuth();

    const isManager =
        String(user?.role || "").toLowerCase() === "manager";

    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [loading, setLoading] = useState(true);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState("");

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const [expandedReports, setExpandedReports] = useState(
        () => new Set()
    );

    const loadTasks = useCallback(async () => {
        if (!token || !isManager) {
            setTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await apiRequest("/api/tasks", {}, token);

            setTasks(
                Array.isArray(response)
                    ? response
                    : Array.isArray(response?.tasks)
                        ? response.tasks
                        : []
            );
        } catch (err) {
            setError(getApiMessage(err, "Unable to load tasks."));
        } finally {
            setLoading(false);
        }
    }, [token, isManager]);

    const loadEmployees = useCallback(async () => {
        if (!token || !isManager) {
            setEmployees([]);
            setEmployeesLoading(false);
            return;
        }

        setEmployeesLoading(true);

        try {
            const response = await apiRequest(
                "/api/manager/employees",
                {},
                token
            );

            setEmployees(
                Array.isArray(response)
                    ? response
                    : Array.isArray(response?.employees)
                        ? response.employees
                        : []
            );
        } catch (err) {
            setError(
                getApiMessage(
                    err,
                    "Unable to load your department employees."
                )
            );
        } finally {
            setEmployeesLoading(false);
        }
    }, [token, isManager]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const filteredTasks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return tasks.filter((task) => {
            const assignments = task.assignments || [];

            const matchesSearch =
                !query ||
                String(task.title || "").toLowerCase().includes(query) ||
                String(task.description || "").toLowerCase().includes(query) ||
                String(task.type || "Task").toLowerCase().includes(query) ||
                assignments.some((assignment) =>
                    getEmployeeName(assignment.employeeId)
                        .toLowerCase()
                        .includes(query)
                );

            const matchesStatus =
                statusFilter === "All" ||
                assignments.some(
                    (assignment) =>
                        getStatus(task, assignment) === statusFilter
                );

            return matchesSearch && matchesStatus;
        });
    }, [tasks, search, statusFilter]);

    const stats = useMemo(() => {
        const assignments = tasks.flatMap(
            (task) => task.assignments || []
        );

        const completed = assignments.filter(
            (assignment) => assignment.status === "Completed"
        ).length;

        const inProgress = assignments.filter(
            (assignment) => assignment.status === "In Progress"
        ).length;

        const overdue = tasks.reduce(
            (total, task) =>
                total +
                (task.assignments || []).filter((assignment) =>
                    isOverdue(task, assignment)
                ).length,
            0
        );

        const exceeded = tasks.reduce(
            (total, task) =>
                total +
                (task.assignments || []).filter((assignment) => {
                    const employeeId = getId(assignment.employeeId);
                    const workedMinutes = getEmployeeWorkedMinutes(
                        task,
                        employeeId
                    );

                    return (
                        Number(assignment.plannedHours || 0) > 0 &&
                        workedMinutes > Number(assignment.plannedHours) * 60
                    );
                }).length,
            0
        );

        return {
            tasks: tasks.length,
            assignments: assignments.length,
            completed,
            inProgress,
            overdue,
            exceeded,
        };
    }, [tasks]);

    function openCreateModal() {
        setEditingTask(null);
        setForm({
            ...emptyForm,
            assignments: {},
        });
        setError("");
        setNotice("");
        setModalOpen(true);
    }

    function openEditModal(task) {
        const assignments = {};

        (task.assignments || []).forEach((assignment) => {
            const employeeId = getId(assignment.employeeId);

            if (employeeId) {
                assignments[employeeId] = String(
                    assignment.plannedHours ?? ""
                );
            }
        });

        setEditingTask(task);

        setForm({
            title: task.title || "",
            description: task.description || "",
            type: task.type || "Task",
            deadline: getDeadlineDate(task.deadline),
            assignments,
        });

        setError("");
        setNotice("");
        setModalOpen(true);
    }

    function toggleEmployee(employeeId, checked) {
        setForm((current) => {
            const assignments = { ...current.assignments };

            if (checked) {
                assignments[employeeId] =
                    assignments[employeeId] || "1";
            } else {
                delete assignments[employeeId];
            }

            return { ...current, assignments };
        });
    }

    function changePlannedHours(employeeId, value) {
        setForm((current) => ({
            ...current,
            assignments: {
                ...current.assignments,
                [employeeId]: value,
            },
        }));
    }

    async function saveTask(event) {
        event.preventDefault();

        setError("");
        setNotice("");

        if (
            !form.title.trim() ||
            form.title.trim().length < 2 ||
            form.title.trim().length > 150
        ) {
            setError("Task title must be between 2 and 150 characters.");
            return;
        }

        if (form.description.length > 5000) {
            setError("Description cannot exceed 5000 characters.");
            return;
        }

        if (!["Task", "Project"].includes(form.type)) {
            setError("Choose Task or Project.");
            return;
        }

        if (!form.deadline) {
            setError("Choose a deadline.");
            return;
        }

        const deadlineDate = new Date(`${form.deadline}T23:59:00`);

        if (
            Number.isNaN(deadlineDate.getTime()) ||
            getDeadlineDate(deadlineDate) !== form.deadline
        ) {
            setError("Please choose a valid deadline.");
            return;
        }

        const assignments = Object.entries(form.assignments).map(
            ([employeeId, plannedHours]) => ({
                employeeId,
                plannedHours: Number(plannedHours),
            })
        );

        if (assignments.length === 0) {
            setError("Select at least one employee.");
            return;
        }

        if (
            assignments.some(
                (assignment) =>
                    !Number.isFinite(assignment.plannedHours) ||
                    assignment.plannedHours < 0.25 ||
                    assignment.plannedHours > 1000
            )
        ) {
            setError(
                "Each employee needs planned hours between 0.25 and 1000."
            );
            return;
        }

        setSaving(true);

        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                type: form.type,
                deadline: deadlineDate.toISOString(),
                assignments,
            };

            if (editingTask) {
                await apiRequest(
                    `/api/tasks/${getId(editingTask)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(payload),
                    },
                    token
                );

                setNotice(
                    "Task updated successfully. Deadline and assignments saved."
                );
            } else {
                await apiRequest(
                    "/api/tasks",
                    {
                        method: "POST",
                        body: JSON.stringify(payload),
                    },
                    token
                );

                setNotice("Task created and assigned successfully.");
            }

            setModalOpen(false);
            await loadTasks();
        } catch (err) {
            setError(getApiMessage(err, "Unable to save task."));
        } finally {
            setSaving(false);
        }
    }

    async function deleteTask(task) {
        const confirmed = window.confirm(
            `Delete "${task.title}" from active tasks? Its task and working-hours history will be preserved.`
        );

        if (!confirmed) return;

        setError("");
        setNotice("");
        setDeletingId(getId(task));

        try {
            await apiRequest(
                `/api/tasks/${getId(task)}`,
                {
                    method: "DELETE",
                    body: JSON.stringify({
                        reason: "Deleted by manager",
                    }),
                },
                token
            );

            setNotice(
                "Task deleted. Its history has been preserved."
            );

            await loadTasks();
        } catch (err) {
            setError(getApiMessage(err, "Unable to delete task."));
        } finally {
            setDeletingId("");
        }
    }

    function toggleReports(taskId, employeeId) {
        const key = `${taskId}:${employeeId}`;

        setExpandedReports((current) => {
            const next = new Set(current);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }

    if (!user) {
        return (
            <div className="tasks-page">
                <div className="tasks-alert tasks-alert-error">
                    Please log in to access Tasks &amp; Projects.
                </div>
            </div>
        );
    }

    if (!isManager) {
        return (
            <div className="tasks-page">
                <div
                    className="tasks-alert tasks-alert-error"
                    role="alert"
                >
                    This page is available to managers only.
                </div>
            </div>
        );
    }

    return (
        <div className="tasks-page">
            <PageHeader
                eyebrow="WORK MANAGEMENT"
                title="Team Tasks & Projects"
                description="Assign work, manage deadlines, review daily reports and monitor your team's progress and working hours."
                icon={ClipboardList}
                onRefresh={() => {
                    loadTasks();
                    loadEmployees();
                }}
                refreshing={loading || employeesLoading}
                actions={(
                    <button
                        type="button"
                        className="tasks-button tasks-button-primary"
                        onClick={openCreateModal}
                    >
                        <Plus size={18} />
                        Create task
                    </button>
                )}
            />

            {error && (
                <div className="tasks-alert tasks-alert-error" role="alert">
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
                <div className="tasks-alert tasks-alert-success" role="status">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button
                        type="button"
                        onClick={() => setNotice("")}
                        aria-label="Dismiss notice"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="tasks-stats-grid">
                <article className="tasks-stat-card">
                    <div className="tasks-stat-icon tasks-icon-purple">
                        <ClipboardList size={20} />
                    </div>
                    <div>
                        <span>Active tasks</span>
                        <strong>{stats.tasks}</strong>
                    </div>
                </article>

                <article className="tasks-stat-card">
                    <div className="tasks-stat-icon tasks-icon-blue">
                        <Users size={20} />
                    </div>
                    <div>
                        <span>Assignments</span>
                        <strong>{stats.assignments}</strong>
                    </div>
                </article>

                <article className="tasks-stat-card">
                    <div className="tasks-stat-icon tasks-icon-green">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <span>Completed</span>
                        <strong>{stats.completed}</strong>
                    </div>
                </article>

                <article className="tasks-stat-card">
                    <div className="tasks-stat-icon tasks-icon-orange">
                        <Clock3 size={20} />
                    </div>
                    <div>
                        <span>In progress</span>
                        <strong>{stats.inProgress}</strong>
                    </div>
                </article>

                <article className="tasks-stat-card">
                    <div className="tasks-stat-icon tasks-icon-orange">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <span>Overdue assignments</span>
                        <strong>{stats.overdue}</strong>
                    </div>
                </article>
            </section>

            {stats.exceeded > 0 && (
                <div className="tasks-alert tasks-alert-error" role="status">
                    <AlertTriangle size={18} />
                    <span>
                        {stats.exceeded} employee assignment
                        {stats.exceeded === 1 ? "" : "s"} exceeded planned
                        hours. Review the warnings below.
                    </span>
                </div>
            )}

            <section className="tasks-workspace">
                <div className="tasks-toolbar">
                    <div className="tasks-search">
                        <Search size={18} />
                        <input
                            type="search"
                            placeholder="Search tasks or employees..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <select
                        className="tasks-filter"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                        aria-label="Filter by status"
                    >
                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status === "All" ? "All statuses" : status}
                            </option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="tasks-empty">
                        <RefreshCw className="tasks-spin" size={25} />
                        <p>Loading tasks...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="tasks-empty">
                        <div className="tasks-empty-icon">
                            <ClipboardList size={28} />
                        </div>
                        <h3>No tasks found</h3>
                        <p>
                            {search || statusFilter !== "All"
                                ? "Try changing your search or status filter."
                                : "Create a task or project and assign it to employees in your department."}
                        </p>
                        <button
                            type="button"
                            className="tasks-button tasks-button-primary"
                            onClick={openCreateModal}
                        >
                            <Plus size={17} />
                            Create your first task
                        </button>
                    </div>
                ) : (
                    <div className="tasks-list">
                        {filteredTasks.map((task) => {
                            const assignments = task.assignments || [];
                            const taskId = getId(task);

                            const totalWorkedMinutes = (
                                task.timeEntries || []
                            ).reduce(
                                (total, entry) =>
                                    total + Number(entry.workedMinutes || 0),
                                0
                            );

                            const plannedHours = assignments.reduce(
                                (total, assignment) =>
                                    total + Number(assignment.plannedHours || 0),
                                0
                            );

                            const taskOverdue = assignments.some((assignment) =>
                                isOverdue(task, assignment)
                            );

                            return (
                                <article className="tasks-card" key={taskId}>
                                    <div className="tasks-card-top">
                                        <div className="tasks-card-title-wrap">
                                            <span className="tasks-card-label">
                                                {task.type || "Task"} ·{" "}
                                                {task.department || "Department"}
                                            </span>

                                            <h3>{task.title}</h3>

                                            {task.description && (
                                                <p className="tasks-description">
                                                    {task.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="tasks-card-actions">
                                            <button
                                                type="button"
                                                className="tasks-icon-button"
                                                onClick={() => openEditModal(task)}
                                                aria-label={`Edit ${task.title}`}
                                                title="Edit task or extend deadline"
                                            >
                                                <Edit3 size={17} />
                                            </button>

                                            <button
                                                type="button"
                                                className="tasks-icon-button tasks-icon-danger"
                                                onClick={() => deleteTask(task)}
                                                disabled={deletingId === taskId}
                                                aria-label={`Delete ${task.title}`}
                                                title="Delete task"
                                            >
                                                {deletingId === taskId ? (
                                                    <RefreshCw
                                                        size={17}
                                                        className="tasks-spin"
                                                    />
                                                ) : (
                                                    <Trash2 size={17} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="tasks-meta">
                                        <span>
                                            <CalendarDays size={15} />
                                            Due {formatDate(task.deadline)}
                                        </span>

                                        <span>
                                            <Users size={15} />
                                            {assignments.length}{" "}
                                            {assignments.length === 1
                                                ? "employee"
                                                : "employees"}
                                        </span>

                                        <span>
                                            <Clock3 size={15} />
                                            {formatHours(totalWorkedMinutes)} logged
                                        </span>

                                        {taskOverdue && (
                                            <span>
                                                <AlertTriangle size={15} />
                                                Deadline passed
                                            </span>
                                        )}
                                    </div>

                                    <div className="tasks-assignment-list">
                                        {assignments.map((assignment) => {
                                            const employeeId = getId(
                                                assignment.employeeId
                                            );

                                            const employeeName = getEmployeeName(
                                                assignment.employeeId
                                            );

                                            const workedMinutes =
                                                getEmployeeWorkedMinutes(
                                                    task,
                                                    employeeId
                                                );

                                            const workedHours = workedMinutes / 60;
                                            const planned = Number(
                                                assignment.plannedHours || 0
                                            );

                                            const exceeded =
                                                planned > 0 &&
                                                workedHours > planned;

                                            // Progress reflects the employee's reported
                                            // progress, not the number of hours logged.

                                            const progress = Math.max(
                                                0,
                                                Math.min(
                                                    100,
                                                    planned > 0
                                                        ? Math.round((workedHours / planned) * 100)
                                                        : Number(assignment.progressPercent || 0)
                                                )
                                            );


                                            const overdue = isOverdue(
                                                task,
                                                assignment
                                            );

                                            const status = getStatus(
                                                task,
                                                assignment
                                            );

                                            const reportKey =
                                                `${taskId}:${employeeId}`;

                                            const reportOpen =
                                                expandedReports.has(reportKey);

                                            const entries = getEmployeeEntries(
                                                task,
                                                employeeId
                                            );

                                            const reports = getEmployeeReports(
                                                task,
                                                employeeId
                                            );

                                            return (
                                                <div
                                                    className="tasks-assignment-block"
                                                    key={employeeId}
                                                >
                                                    <div className="tasks-assignment-row">
                                                        <div className="tasks-assignee">
                                                            <span className="tasks-avatar">
                                                                {employeeName
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>

                                                            <div>
                                                                <strong>
                                                                    {employeeName}
                                                                </strong>
                                                                <small>
                                                                    {workedHours.toFixed(1)}
                                                                    {" / "}
                                                                    {planned}
                                                                    {" hours logged"}
                                                                </small>
                                                            </div>
                                                        </div>

                                                        <div className="tasks-progress-wrap">
                                                            <div
                                                                className="tasks-progress-track"
                                                                role="progressbar"
                                                                aria-valuenow={progress}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                                aria-label={`${employeeName} task progress`}
                                                            >
                                                                <div
                                                                    className="tasks-progress-fill"
                                                                    style={{
                                                                        width: `${progress}%`,
                                                                    }}
                                                                />
                                                            </div>

                                                            <small>{progress}%</small>
                                                        </div>

                                                        <span className={getStatusClass(status)}>
                                                            {status}
                                                        </span>
                                                    </div>

                                                    <div className="tasks-employee-summary">
                                                        <span>
                                                            Reported progress:{" "}
                                                            <strong>{progress}%</strong>
                                                        </span>
                                                        <span>
                                                            Planned hours:{" "}
                                                            <strong>{planned}h</strong>
                                                        </span>
                                                        <span>
                                                            Actual hours:{" "}
                                                            <strong>
                                                                {workedHours.toFixed(1)}h
                                                            </strong>
                                                        </span>
                                                    </div>

                                                    {exceeded && (
                                                        <div className="tasks-alert tasks-alert-error">
                                                            <AlertTriangle size={16} />
                                                            <span>
                                                                Planned hours exceeded by{" "}
                                                                {(
                                                                    workedHours - planned
                                                                ).toFixed(1)}
                                                                {" hours."}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {overdue && (
                                                        <div className="tasks-alert tasks-alert-error">
                                                            <AlertCircle size={16} />
                                                            <span>
                                                                Deadline passed. The employee
                                                                can continue logging work, but
                                                                completion is blocked until
                                                                you extend the deadline.
                                                            </span>
                                                        </div>
                                                    )}

                                                    <button
                                                        type="button"
                                                        className="tasks-button tasks-button-secondary"
                                                        onClick={() =>
                                                            toggleReports(
                                                                taskId,
                                                                employeeId
                                                            )
                                                        }
                                                        aria-expanded={reportOpen}
                                                    >
                                                        <FileText size={16} />
                                                        {reportOpen
                                                            ? "Hide reports and work logs"
                                                            : `View daily reports (${reports.length}) and work logs (${entries.length})`}
                                                        {reportOpen ? (
                                                            <ChevronUp size={16} />
                                                        ) : (
                                                            <ChevronDown size={16} />
                                                        )}
                                                    </button>

                                                    {reportOpen && (
                                                        <div className="tasks-reports">
                                                            <section className="tasks-report-section">
                                                                <h4>
                                                                    Daily progress reports
                                                                </h4>

                                                                {reports.length === 0 ? (
                                                                    <p className="tasks-muted">
                                                                        No daily progress reports
                                                                        have been submitted yet.
                                                                    </p>
                                                                ) : (
                                                                    reports.map(
                                                                        (report, index) => (
                                                                            <article
                                                                                className="tasks-report-entry"
                                                                                key={
                                                                                    report._id ||
                                                                                    `${report.date}-${index}`
                                                                                }
                                                                            >
                                                                                <div className="tasks-report-heading">
                                                                                    <strong>
                                                                                        {formatDate(
                                                                                            report.date
                                                                                        )}
                                                                                    </strong>
                                                                                    <span>
                                                                                        {Number(
                                                                                            report.progressPercent || 0
                                                                                        )}%
                                                                                        {" progress"}
                                                                                    </span>
                                                                                </div>

                                                                                <div className="tasks-report-note">
                                                                                    <strong>
                                                                                        Work completed
                                                                                    </strong>
                                                                                    <p>
                                                                                        {report.workSummary ||
                                                                                            "No work summary provided."}
                                                                                    </p>
                                                                                </div>

                                                                                <div className="tasks-report-note">
                                                                                    <strong>
                                                                                        Blockers
                                                                                    </strong>
                                                                                    <p>
                                                                                        {report.blockers?.trim() ||
                                                                                            "No blockers reported."}
                                                                                    </p>
                                                                                </div>

                                                                                <p className="tasks-muted">
                                                                                    Submitted{" "}
                                                                                    {report.submittedAt
                                                                                        ? new Date(
                                                                                            report.submittedAt
                                                                                        ).toLocaleString()
                                                                                        : "date unavailable"}
                                                                                </p>
                                                                            </article>
                                                                        )
                                                                    )
                                                                )}
                                                            </section>

                                                            <section className="tasks-report-section">
                                                                <h4>
                                                                    Working-hour logs
                                                                </h4>

                                                                {entries.length === 0 ? (
                                                                    <p className="tasks-muted">
                                                                        No working hours have
                                                                        been logged yet.
                                                                    </p>
                                                                ) : (
                                                                    entries.map(
                                                                        (entry, index) => (
                                                                            <article
                                                                                className="tasks-report-entry"
                                                                                key={
                                                                                    entry._id ||
                                                                                    `${entry.date}-${entry.startTime}-${index}`
                                                                                }
                                                                            >
                                                                                <div className="tasks-report-heading">
                                                                                    <strong>
                                                                                        {formatDate(
                                                                                            entry.date
                                                                                        )}
                                                                                    </strong>
                                                                                    <span>
                                                                                        {formatHours(
                                                                                            entry.workedMinutes
                                                                                        )}
                                                                                    </span>
                                                                                </div>

                                                                                <p>
                                                                                    <Clock3
                                                                                        size={14}
                                                                                    />
                                                                                    {" "}
                                                                                    {entry.startTime ||
                                                                                        "--:--"}
                                                                                    {" – "}
                                                                                    {entry.endTime ||
                                                                                        "--:--"}
                                                                                </p>

                                                                                <div className="tasks-report-note">
                                                                                    <strong>
                                                                                        Work note
                                                                                    </strong>
                                                                                    <p>
                                                                                        {entry.note?.trim() ||
                                                                                            "No work notes provided."}
                                                                                    </p>
                                                                                </div>
                                                                            </article>
                                                                        )
                                                                    )
                                                                )}
                                                            </section>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="tasks-card-footer">
                                        <span>
                                            Total planned: {plannedHours} hours
                                        </span>
                                        <span>
                                            Created {formatDate(task.createdAt)}
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {modalOpen && (
                <div
                    className="tasks-modal-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !saving
                        ) {
                            setModalOpen(false);
                        }
                    }}
                >
                    <section
                        className="tasks-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tasks-modal-title"
                    >
                        <div className="tasks-modal-header">
                            <div>
                                <span className="tasks-eyebrow">
                                    TASK MANAGEMENT
                                </span>
                                <h2 id="tasks-modal-title">
                                    {editingTask
                                        ? "Edit task or project"
                                        : "Create a task or project"}
                                </h2>
                                <p>
                                    Set the deadline, select employees and
                                    assign individual planned hours.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="tasks-icon-button"
                                onClick={() => setModalOpen(false)}
                                disabled={saving}
                                aria-label="Close dialog"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={saveTask} className="tasks-form">
                            <label className="tasks-field">
                                <span>Work type *</span>
                                <select
                                    value={form.type}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            type: event.target.value,
                                        }))
                                    }
                                    required
                                >
                                    <option value="Task">Task</option>
                                    <option value="Project">Project</option>
                                </select>
                            </label>

                            <label className="tasks-field">
                                <span>Title *</span>
                                <input
                                    type="text"
                                    maxLength={150}
                                    value={form.title}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            title: event.target.value,
                                        }))
                                    }
                                    placeholder={
                                        form.type === "Project"
                                            ? "e.g. Employee Portal Redesign"
                                            : "e.g. Prepare monthly HR report"
                                    }
                                    required
                                />
                            </label>

                            <label className="tasks-field">
                                <span>Description</span>
                                <textarea
                                    rows={3}
                                    maxLength={5000}
                                    value={form.description}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            description: event.target.value,
                                        }))
                                    }
                                    placeholder="Add task details, expectations and deliverables..."
                                />
                            </label>

                            <label className="tasks-field">
                                <span>
                                    Deadline *
                                    {editingTask &&
                                        deadlineHasPassed(editingTask.deadline) &&
                                        " — extend to allow completion"}
                                </span>
                                <input
                                    type="date"
                                    value={form.deadline}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            deadline: event.target.value,
                                        }))
                                    }
                                    required
                                />
                            </label>

                            <div className="tasks-assignee-picker">
                                <div className="tasks-picker-heading">
                                    <div>
                                        <strong>Assign employees *</strong>
                                        <p>
                                            Select employees and set individual
                                            planned hours.
                                        </p>
                                    </div>
                                    <span>
                                        {Object.keys(form.assignments).length}
                                        {" selected"}
                                    </span>
                                </div>

                                {employeesLoading ? (
                                    <p className="tasks-muted">
                                        Loading department employees...
                                    </p>
                                ) : employees.length === 0 ? (
                                    <p className="tasks-muted">
                                        No active employees were found in
                                        your department.
                                    </p>
                                ) : (
                                    <div className="tasks-employee-picker-list">
                                        {employees.map((employee) => {
                                            const id = getId(employee);

                                            const checked =
                                                Object.prototype.hasOwnProperty.call(
                                                    form.assignments,
                                                    id
                                                );

                                            return (
                                                <div
                                                    className={`tasks-employee-option ${checked ? "is-selected" : ""
                                                        }`}
                                                    key={id}
                                                >
                                                    <label className="tasks-employee-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(event) =>
                                                                toggleEmployee(
                                                                    id,
                                                                    event.target.checked
                                                                )
                                                            }
                                                        />

                                                        <span className="tasks-avatar">
                                                            {getEmployeeName(employee)
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>

                                                        <span className="tasks-employee-info">
                                                            <strong>
                                                                {getEmployeeName(employee)}
                                                            </strong>
                                                            <small>
                                                                {employee.designation ||
                                                                    employee.email}
                                                            </small>
                                                        </span>
                                                    </label>

                                                    {checked && (
                                                        <label className="tasks-hours-input">
                                                            <span>Planned hours</span>
                                                            <input
                                                                type="number"
                                                                min="0.25"
                                                                max="1000"
                                                                step="0.25"
                                                                value={
                                                                    form.assignments[id]
                                                                }
                                                                onChange={(event) =>
                                                                    changePlannedHours(
                                                                        id,
                                                                        event.target.value
                                                                    )
                                                                }
                                                                required
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="tasks-modal-footer">
                                <button
                                    type="button"
                                    className="tasks-button tasks-button-secondary"
                                    onClick={() => setModalOpen(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="tasks-button tasks-button-primary"
                                    disabled={
                                        saving ||
                                        employeesLoading ||
                                        employees.length === 0
                                    }
                                >
                                    {saving
                                        ? "Saving..."
                                        : editingTask
                                            ? "Save changes"
                                            : "Create and assign"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
