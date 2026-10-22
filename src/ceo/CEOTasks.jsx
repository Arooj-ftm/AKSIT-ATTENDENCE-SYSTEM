
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Eye,
    FileText,
    RefreshCw,
    Search,
    Users,
    X,
    ClipboardList,
    MessageSquareText,
    AlertTriangle,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./CEOTasks.css";

const STATUS_OPTIONS = [
    "All Statuses",
    "To Do",
    "In Progress",
    "Completed",
    "Overdue",
];

const getId = (value) => {
    if (!value) return "";

    if (typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return String(value);
};

const getName = (person) => {
    if (!person) return "Unknown";

    if (typeof person === "string") return person;

    return (
        person.name ||
        person.fullName ||
        person.email ||
        "Unknown"
    );
};

const getEmail = (person) => {
    if (!person || typeof person !== "object") return "";
    return person.email || "";
};

const formatDate = (value) => {
    if (!value) return "No deadline";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const formatDateTime = (value) => {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const formatHours = (minutes) => {
    const hours = Math.max(0, Number(minutes) || 0) / 60;
    return `${Number(hours.toFixed(2))}h`;
};

const getEmployeeWorkedMinutes = (task, employeeId) => {
    if (!employeeId) return 0;

    const entries = Array.isArray(task.timeEntries)
        ? task.timeEntries
        : [];

    return entries.reduce((total, entry) => {
        if (getId(entry.employeeId) !== employeeId) {
            return total;
        }

        return (
            total +
            Math.max(0, Number(entry.workedMinutes) || 0)
        );
    }, 0);
};

const getEmployeeReports = (task, employeeId) => {
    const reports = Array.isArray(task.dailyReports)
        ? task.dailyReports
        : [];

    return reports
        .filter(
            (report) =>
                getId(report.employeeId) === employeeId
        )
        .slice()
        .sort((a, b) => {
            const dateA = new Date(
                a.submittedAt || a.date || 0
            ).getTime();

            const dateB = new Date(
                b.submittedAt || b.date || 0
            ).getTime();

            return (
                (Number.isNaN(dateB) ? 0 : dateB) -
                (Number.isNaN(dateA) ? 0 : dateA)
            );
        });
};

const getTaskEmployees = (task) => {
    const assignments = Array.isArray(task.assignments)
        ? task.assignments
        : [];

    return assignments.map((assignment, index) => {
        const employee = assignment.employeeId;
        const employeeId = getId(employee);

        const workedMinutes = getEmployeeWorkedMinutes(
            task,
            employeeId
        );

        const plannedHours = Math.max(
            0,
            Number(assignment.plannedHours) || 0
        );

        const plannedMinutes = plannedHours * 60;

        const hoursProgress =
            plannedMinutes > 0
                ? Math.min(
                    100,
                    Math.round(
                        (workedMinutes / plannedMinutes) * 100
                    )
                )
                : 0;

        // Use the progress value maintained by the backend.
        // Fall back to logged/planned hours for older records.
        const backendProgress = Number(
            assignment.progressPercent
        );

        const progress = Number.isFinite(backendProgress)
            ? Math.min(100, Math.max(0, backendProgress))
            : hoursProgress;

        return {
            id: employeeId || `${getName(employee)}-${index}`,
            employeeId,
            name: getName(employee),
            email: getEmail(employee),
            department:
                typeof employee === "object" && employee
                    ? employee.department ||
                    task.department ||
                    "Unassigned"
                    : task.department || "Unassigned",
            plannedHours,
            workedMinutes,
            progress,
            status: assignment.status || "To Do",
            reports: getEmployeeReports(task, employeeId),
        };
    });
};

const isPastDeadline = (deadline) => {
    if (!deadline) return false;

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) return false;

    // Match the backend rule: the deadline remains valid
    // until the end of its calendar day.
    date.setHours(23, 59, 59, 999);

    return Date.now() > date.getTime();
};

const getTaskSummary = (task) => {
    const employees = getTaskEmployees(task);

    const completedCount = employees.filter(
        (employee) => employee.status === "Completed"
    ).length;

    const workedMinutes = employees.reduce(
        (total, employee) =>
            total + employee.workedMinutes,
        0
    );

    const plannedHours = employees.reduce(
        (total, employee) =>
            total + employee.plannedHours,
        0
    );

    const progress =
        employees.length > 0
            ? Math.round(
                employees.reduce(
                    (total, employee) =>
                        total + employee.progress,
                    0
                ) / employees.length
            )
            : 0;

    let status = "To Do";

    if (
        employees.length > 0 &&
        completedCount === employees.length
    ) {
        status = "Completed";
    } else if (isPastDeadline(task.deadline)) {
        status = "Overdue";
    } else if (
        employees.some(
            (employee) =>
                employee.status === "In Progress" ||
                employee.progress > 0 ||
                employee.workedMinutes > 0
        )
    ) {
        status = "In Progress";
    }

    return {
        employees,
        status,
        progress,
        workedMinutes,
        plannedHours,
        completedCount,
    };
};

const statusClass = (status) =>
    String(status || "To Do")
        .toLowerCase()
        .replace(/\s+/g, "-");

export default function CEOTasks() {
    const { token } = useAuth();

    const [tasks, setTasks] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] =
        useState("All Statuses");
    const [departmentFilter, setDepartmentFilter] =
        useState("All Departments");
    const [deadlineFilter, setDeadlineFilter] =
        useState("All Deadlines");
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadTasks = useCallback(
        async (isRefresh = false) => {
            if (!token) {
                setTasks([]);
                setError(
                    "Your session could not be verified. Please sign in again."
                );
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            try {
                const response = await apiRequest(
                    "/api/tasks",
                    {},
                    token
                );

                const receivedTasks = Array.isArray(
                    response.tasks
                )
                    ? response.tasks
                    : [];

                setTasks(receivedTasks);

                setSelectedTask((current) => {
                    if (!current) return null;

                    return (
                        receivedTasks.find(
                            (task) =>
                                getId(task) === getId(current)
                        ) || null
                    );
                });
            } catch (err) {
                setError(
                    err.message ||
                    "Unable to load company tasks."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [token]
    );

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const departments = useMemo(() => {
        const values = tasks
            .map((task) =>
                String(task.department || "").trim()
            )
            .filter(Boolean);

        return [
            "All Departments",
            ...Array.from(new Set(values)).sort(
                (a, b) => a.localeCompare(b)
            ),
        ];
    }, [tasks]);

    const preparedTasks = useMemo(
        () =>
            tasks.map((task) => ({
                ...task,
                summary: getTaskSummary(task),
            })),
        [tasks]
    );

    const stats = useMemo(
        () => ({
            total: preparedTasks.length,
            completed: preparedTasks.filter(
                (task) =>
                    task.summary.status === "Completed"
            ).length,
            overdue: preparedTasks.filter(
                (task) =>
                    task.summary.status === "Overdue"
            ).length,
            inProgress: preparedTasks.filter(
                (task) =>
                    task.summary.status === "In Progress"
            ).length,
        }),
        [preparedTasks]
    );

    const filteredTasks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return preparedTasks.filter((task) => {
            const summary = task.summary;
            const managerName = getName(task.managerId);

            const employeeNames = summary.employees
                .map(
                    (employee) =>
                        `${employee.name} ${employee.email} ${employee.department}`
                )
                .join(" ");

            const searchableText = [
                task.title,
                task.description,
                task.type,
                task.department,
                managerName,
                getEmail(task.managerId),
                employeeNames,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (
                query &&
                !searchableText.includes(query)
            ) {
                return false;
            }

            if (
                statusFilter !== "All Statuses" &&
                summary.status !== statusFilter
            ) {
                return false;
            }

            if (
                departmentFilter !== "All Departments" &&
                task.department !== departmentFilter
            ) {
                return false;
            }

            if (deadlineFilter === "Overdue") {
                if (summary.status !== "Overdue") {
                    return false;
                }
            }

            if (deadlineFilter === "Due Soon") {
                if (
                    !task.deadline ||
                    summary.status === "Completed"
                ) {
                    return false;
                }

                const deadline = new Date(task.deadline);

                if (Number.isNaN(deadline.getTime())) {
                    return false;
                }

                deadline.setHours(23, 59, 59, 999);

                const daysRemaining =
                    (deadline.getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24);

                if (
                    daysRemaining < 0 ||
                    daysRemaining > 7
                ) {
                    return false;
                }
            }

            if (
                deadlineFilter === "No Deadline" &&
                task.deadline
            ) {
                return false;
            }

            return true;
        });
    }, [
        preparedTasks,
        search,
        statusFilter,
        departmentFilter,
        deadlineFilter,
    ]);

    const closeDetails = useCallback(() => {
        setSelectedTask(null);
    }, []);

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("All Statuses");
        setDepartmentFilter("All Departments");
        setDeadlineFilter("All Deadlines");
    };

    return (
        <main className="main ceo-tasks-page">

            <PageHeader
                eyebrow="COMPANY WORKSPACE"
                title="Tasks & Projects"
                description="Company-wide visibility into assignments, employee workload, deadlines and task progress."
                icon={ClipboardList}
                onRefresh={() => loadTasks(true)}
                refreshing={loading || refreshing}
            />


            {error && (
                <div
                    className="ceo-tasks-alert"
                    role="alert"
                >
                    <AlertCircle size={19} />
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => loadTasks(true)}
                        disabled={refreshing}
                    >
                        Try again
                    </button>
                </div>
            )}

            <section
                className="ceo-task-stats"
                aria-label="Task statistics"
            >
                <article className="ceo-task-stat-card">
                    <div className="ceo-task-stat-icon stat-purple">
                        <FileText size={21} />
                    </div>
                    <div>
                        <span>Total Tasks / Projects</span>
                        <strong>
                            {loading ? "—" : stats.total}
                        </strong>
                        <small>Active company assignments</small>
                    </div>
                </article>

                <article className="ceo-task-stat-card">
                    <div className="ceo-task-stat-icon stat-blue">
                        <Activity size={21} />
                    </div>
                    <div>
                        <span>In Progress</span>
                        <strong>
                            {loading ? "—" : stats.inProgress}
                        </strong>
                        <small>Currently being worked on</small>
                    </div>
                </article>

                <article className="ceo-task-stat-card">
                    <div className="ceo-task-stat-icon stat-green">
                        <CheckCircle2 size={21} />
                    </div>
                    <div>
                        <span>Completed</span>
                        <strong>
                            {loading ? "—" : stats.completed}
                        </strong>
                        <small>All assigned employees completed</small>
                    </div>
                </article>

                <article className="ceo-task-stat-card">
                    <div className="ceo-task-stat-icon stat-red">
                        <Clock3 size={21} />
                    </div>
                    <div>
                        <span>Overdue</span>
                        <strong>
                            {loading ? "—" : stats.overdue}
                        </strong>
                        <small>Past deadline and incomplete</small>
                    </div>
                </article>
            </section>

            <section className="ceo-tasks-content">
                <div className="ceo-tasks-section-heading">
                    <div>
                        <h2>Company task register</h2>
                        <p>
                            Review task ownership and individual
                            employee progress.
                        </p>
                    </div>

                    <span className="ceo-tasks-result-count">
                        {filteredTasks.length}{" "}
                        {filteredTasks.length === 1
                            ? "task"
                            : "tasks"}
                    </span>
                </div>

                <div className="ceo-tasks-filters">
                    <label className="ceo-tasks-search">
                        <Search size={17} />

                        <input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search task, manager or employee..."
                            aria-label="Search tasks"
                        />
                    </label>

                    <label className="ceo-tasks-select-wrap">
                        <span className="ceo-tasks-sr-only">
                            Status
                        </span>

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(
                                    event.target.value
                                )
                            }
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option
                                    key={status}
                                    value={status}
                                >
                                    {status}
                                </option>
                            ))}
                        </select>

                        <ChevronDown size={15} />
                    </label>

                    <label className="ceo-tasks-select-wrap">
                        <span className="ceo-tasks-sr-only">
                            Department
                        </span>

                        <select
                            value={departmentFilter}
                            onChange={(event) =>
                                setDepartmentFilter(
                                    event.target.value
                                )
                            }
                        >
                            {departments.map((department) => (
                                <option
                                    key={department}
                                    value={department}
                                >
                                    {department}
                                </option>
                            ))}
                        </select>

                        <ChevronDown size={15} />
                    </label>

                    <label className="ceo-tasks-select-wrap">
                        <span className="ceo-tasks-sr-only">
                            Deadline
                        </span>

                        <select
                            value={deadlineFilter}
                            onChange={(event) =>
                                setDeadlineFilter(
                                    event.target.value
                                )
                            }
                        >
                            <option value="All Deadlines">
                                All Deadlines
                            </option>
                            <option value="Due Soon">
                                Due in 7 days
                            </option>
                            <option value="Overdue">
                                Overdue
                            </option>
                            <option value="No Deadline">
                                No deadline
                            </option>
                        </select>

                        <ChevronDown size={15} />
                    </label>
                </div>

                {loading ? (
                    <div className="ceo-tasks-state">
                        <RefreshCw
                            size={25}
                            className="ceo-spin"
                        />
                        <h3>Loading company tasks</h3>
                        <p>
                            Getting the latest task and assignment
                            information.
                        </p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="ceo-tasks-state">
                        <div className="ceo-tasks-empty-icon">
                            <FileText size={25} />
                        </div>

                        <h3>
                            {tasks.length
                                ? "No matching tasks"
                                : "No tasks available"}
                        </h3>

                        <p>
                            {tasks.length
                                ? "Try changing your search or filters."
                                : "Company tasks will appear here when managers create assignments."}
                        </p>

                        {tasks.length > 0 && (
                            <button
                                type="button"
                                className="ceo-tasks-clear-filters"
                                onClick={clearFilters}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="ceo-tasks-table-wrap">
                        <table className="ceo-tasks-table">
                            <thead>
                                <tr>
                                    <th>Task / Project</th>
                                    <th>Manager</th>
                                    <th>Department</th>
                                    <th>Assigned employees</th>
                                    <th>Deadline</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                    <th>Details</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredTasks.map((task) => {
                                    const summary = task.summary;

                                    return (
                                        <tr
                                            key={
                                                getId(task) ||
                                                task.title
                                            }
                                        >
                                            <td>
                                                <div className="ceo-task-name-cell">
                                                    <strong>
                                                        {task.title ||
                                                            "Untitled task"}
                                                    </strong>

                                                    <span className="ceo-task-type">
                                                        {task.type === "Project"
                                                            ? "Project"
                                                            : "Task"}
                                                    </span>

                                                    <span>
                                                        {task.description ||
                                                            "No description provided"}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <div className="ceo-task-person">
                                                    <strong>
                                                        {getName(
                                                            task.managerId
                                                        )}
                                                    </strong>
                                                    <span>
                                                        {getEmail(
                                                            task.managerId
                                                        ) || "Manager"}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <span className="ceo-task-department">
                                                    {task.department ||
                                                        "Unassigned"}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="ceo-task-assignee-cell">
                                                    <div className="ceo-task-avatar-stack">
                                                        {summary.employees
                                                            .slice(0, 3)
                                                            .map((employee) => (
                                                                <span
                                                                    key={employee.id}
                                                                    title={employee.name}
                                                                >
                                                                    {employee.name
                                                                        .charAt(0)
                                                                        .toUpperCase()}
                                                                </span>
                                                            ))}
                                                    </div>

                                                    <span>
                                                        {summary.employees.length}{" "}
                                                        {summary.employees.length === 1
                                                            ? "employee"
                                                            : "employees"}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <div className="ceo-task-deadline">
                                                    <CalendarDays size={15} />
                                                    <span>
                                                        {formatDate(
                                                            task.deadline
                                                        )}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <div className="ceo-task-progress">
                                                    <div className="ceo-task-progress-label">
                                                        <strong>
                                                            {summary.progress}%
                                                        </strong>
                                                        <span>
                                                            {formatHours(
                                                                summary.workedMinutes
                                                            )}{" "}
                                                            /{" "}
                                                            {summary.plannedHours.toFixed(
                                                                1
                                                            )}
                                                            h
                                                        </span>
                                                    </div>

                                                    <div
                                                        className="ceo-task-progress-track"
                                                        role="progressbar"
                                                        aria-label={`${task.title} progress`}
                                                        aria-valuemin={0}
                                                        aria-valuemax={100}
                                                        aria-valuenow={summary.progress}
                                                    >
                                                        <span
                                                            style={{
                                                                width: `${summary.progress}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                <span
                                                    className={`ceo-task-status status-${statusClass(
                                                        summary.status
                                                    )}`}
                                                >
                                                    {summary.status}
                                                </span>
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="ceo-task-view-button"
                                                    onClick={() =>
                                                        setSelectedTask(task)
                                                    }
                                                    aria-label={`View details for ${task.title}`}
                                                    title="View task details"
                                                >
                                                    <Eye size={17} />
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

            <section className="ceo-tasks-footer-note">
                <Users size={17} />
                <p>
                    Monitoring view only. Task changes and time entries
                    are managed by authorized users through their
                    respective workspaces.
                </p>
            </section>

            {selectedTask && (
                <div
                    className="ceo-task-modal-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget
                        ) {
                            closeDetails();
                        }
                    }}
                >
                    <section
                        className="ceo-task-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ceo-task-modal-title"
                    >
                        <header className="ceo-task-modal-header">
                            <div>
                                <span className="ceo-tasks-eyebrow">
                                    {selectedTask.type === "Project"
                                        ? "PROJECT OVERVIEW"
                                        : "TASK OVERVIEW"}
                                </span>

                                <h2 id="ceo-task-modal-title">
                                    {selectedTask.title}
                                </h2>

                                <span className="ceo-task-type">
                                    {selectedTask.type === "Project"
                                        ? "Project"
                                        : "Task"}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="ceo-task-modal-close"
                                onClick={closeDetails}
                                aria-label="Close task details"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <div className="ceo-task-modal-body">
                            <p className="ceo-task-modal-description">
                                {selectedTask.description ||
                                    "No description provided."}
                            </p>

                            {isPastDeadline(
                                selectedTask.deadline
                            ) &&
                                getTaskSummary(selectedTask).status !==
                                "Completed" && (
                                    <div
                                        className="ceo-tasks-alert"
                                        role="status"
                                    >
                                        <AlertTriangle size={18} />
                                        <span>
                                            This task has passed its deadline
                                            and is not fully completed.
                                        </span>
                                    </div>
                                )}

                            <div className="ceo-task-detail-grid">
                                <div>
                                    <span>Manager</span>
                                    <strong>
                                        {getName(
                                            selectedTask.managerId
                                        )}
                                    </strong>
                                    <small>
                                        {getEmail(
                                            selectedTask.managerId
                                        )}
                                    </small>
                                </div>

                                <div>
                                    <span>Department</span>
                                    <strong>
                                        {selectedTask.department ||
                                            "Unassigned"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Deadline</span>
                                    <strong>
                                        {formatDate(
                                            selectedTask.deadline
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Task status</span>
                                    <strong>
                                        {getTaskSummary(
                                            selectedTask
                                        ).status}
                                    </strong>
                                </div>

                                <div>
                                    <span>Total planned hours</span>
                                    <strong>
                                        {getTaskSummary(
                                            selectedTask
                                        ).plannedHours.toFixed(1)}
                                        h
                                    </strong>
                                </div>

                                <div>
                                    <span>Total logged hours</span>
                                    <strong>
                                        {formatHours(
                                            getTaskSummary(
                                                selectedTask
                                            ).workedMinutes
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Overall progress</span>
                                    <strong>
                                        {getTaskSummary(
                                            selectedTask
                                        ).progress}
                                        %
                                    </strong>
                                </div>

                                <div>
                                    <span>Created</span>
                                    <strong>
                                        {formatDate(
                                            selectedTask.createdAt
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <div className="ceo-task-employees-heading">
                                <h3>Employee assignments</h3>
                                <span>
                                    {getTaskEmployees(
                                        selectedTask
                                    ).length}{" "}
                                    assigned
                                </span>
                            </div>

                            {getTaskEmployees(
                                selectedTask
                            ).length === 0 ? (
                                <p className="ceo-task-no-employees">
                                    No employee assignments are available
                                    for this task.
                                </p>
                            ) : (
                                <div className="ceo-task-employee-list">
                                    {getTaskEmployees(
                                        selectedTask
                                    ).map((employee) => (
                                        <article
                                            className="ceo-task-employee-row"
                                            key={employee.id}
                                        >
                                            <div className="ceo-task-employee-identity">
                                                <span className="ceo-task-employee-avatar">
                                                    {employee.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </span>

                                                <div>
                                                    <strong>
                                                        {employee.name}
                                                    </strong>
                                                    <small>
                                                        {employee.email ||
                                                            employee.department}
                                                    </small>
                                                </div>
                                            </div>

                                            <div className="ceo-task-employee-work">
                                                <span>
                                                    {formatHours(
                                                        employee.workedMinutes
                                                    )}{" "}
                                                    /{" "}
                                                    {employee.plannedHours.toFixed(
                                                        1
                                                    )}
                                                    h
                                                </span>

                                                <div
                                                    className="ceo-task-progress-track"
                                                    role="progressbar"
                                                    aria-label={`${employee.name} progress`}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                    aria-valuenow={employee.progress}
                                                >
                                                    <span
                                                        style={{
                                                            width: `${employee.progress}%`,
                                                        }}
                                                    />
                                                </div>

                                                <small>
                                                    {employee.progress}% reported progress
                                                </small>
                                            </div>

                                            <span
                                                className={`ceo-task-status status-${statusClass(
                                                    employee.status
                                                )}`}
                                            >
                                                {employee.status}
                                            </span>
                                        </article>
                                    ))}
                                </div>
                            )}

                            <div className="ceo-task-time-heading">
                                <h3>Daily progress reports</h3>
                            </div>

                            {Array.isArray(
                                selectedTask.dailyReports
                            ) &&
                                selectedTask.dailyReports.length > 0 ? (
                                <div className="ceo-task-time-list">
                                    {selectedTask.dailyReports
                                        .slice()
                                        .sort((a, b) => {
                                            const dateA = new Date(
                                                a.submittedAt ||
                                                a.date ||
                                                0
                                            ).getTime();

                                            const dateB = new Date(
                                                b.submittedAt ||
                                                b.date ||
                                                0
                                            ).getTime();

                                            return (
                                                (Number.isNaN(dateB)
                                                    ? 0
                                                    : dateB) -
                                                (Number.isNaN(dateA)
                                                    ? 0
                                                    : dateA)
                                            );
                                        })
                                        .map((report, index) => {
                                            const employee =
                                                getTaskEmployees(
                                                    selectedTask
                                                ).find(
                                                    (person) =>
                                                        person.employeeId ===
                                                        getId(
                                                            report.employeeId
                                                        )
                                                );

                                            return (
                                                <article
                                                    className="ceo-task-time-entry"
                                                    key={
                                                        report._id ||
                                                        `${getId(
                                                            report.employeeId
                                                        )}-${report.date}-${index}`
                                                    }
                                                >
                                                    <div>
                                                        <strong>
                                                            {employee?.name ||
                                                                getName(
                                                                    report.employeeId
                                                                )}
                                                        </strong>
                                                        <span>
                                                            Report date:{" "}
                                                            {formatDate(
                                                                report.date
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <strong>
                                                            {Math.min(
                                                                100,
                                                                Math.max(
                                                                    0,
                                                                    Number(
                                                                        report.progressPercent
                                                                    ) || 0
                                                                )
                                                            )}
                                                            % progress
                                                        </strong>
                                                        <span>
                                                            Submitted:{" "}
                                                            {formatDateTime(
                                                                report.submittedAt
                                                            )}
                                                        </span>
                                                    </div>

                                                    {report.workSummary && (
                                                        <div className="ceo-task-report-block">
                                                            <strong>
                                                                <ClipboardList
                                                                    size={15}
                                                                />
                                                                Work summary
                                                            </strong>
                                                            <p>
                                                                {report.workSummary}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {report.blockers && (
                                                        <div className="ceo-task-report-block ceo-task-report-blocker">
                                                            <strong>
                                                                <MessageSquareText
                                                                    size={15}
                                                                />
                                                                Blockers
                                                            </strong>
                                                            <p>
                                                                {report.blockers}
                                                            </p>
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                </div>
                            ) : (
                                <p className="ceo-task-no-employees">
                                    No daily progress reports have been
                                    submitted yet.
                                </p>
                            )}

                            <div className="ceo-task-time-heading">
                                <h3>Logged work sessions</h3>
                            </div>

                            {Array.isArray(
                                selectedTask.timeEntries
                            ) &&
                                selectedTask.timeEntries.length > 0 ? (
                                <div className="ceo-task-time-list">
                                    {selectedTask.timeEntries
                                        .slice()
                                        .sort((a, b) => {
                                            const dateA = new Date(
                                                a.loggedAt ||
                                                a.createdAt ||
                                                a.date
                                            ).getTime();

                                            const dateB = new Date(
                                                b.loggedAt ||
                                                b.createdAt ||
                                                b.date
                                            ).getTime();

                                            return (
                                                (Number.isNaN(dateB)
                                                    ? 0
                                                    : dateB) -
                                                (Number.isNaN(dateA)
                                                    ? 0
                                                    : dateA)
                                            );
                                        })
                                        .map((entry, index) => {
                                            const employee =
                                                getTaskEmployees(
                                                    selectedTask
                                                ).find(
                                                    (person) =>
                                                        person.employeeId ===
                                                        getId(
                                                            entry.employeeId
                                                        )
                                                );

                                            return (
                                                <article
                                                    className="ceo-task-time-entry"
                                                    key={
                                                        entry._id ||
                                                        `${entry.date}-${entry.startTime}-${index}`
                                                    }
                                                >
                                                    <div>
                                                        <strong>
                                                            {employee?.name ||
                                                                getName(
                                                                    entry.employeeId
                                                                )}
                                                        </strong>
                                                        <span>
                                                            {formatDate(
                                                                entry.date
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <strong>
                                                            {entry.startTime ||
                                                                "—"}{" "}
                                                            –{" "}
                                                            {entry.endTime ||
                                                                "—"}
                                                        </strong>
                                                        <span>
                                                            {formatHours(
                                                                entry.workedMinutes
                                                            )}
                                                        </span>
                                                    </div>

                                                    {entry.note && (
                                                        <p className="ceo-task-time-note">
                                                            {entry.note}
                                                        </p>
                                                    )}
                                                </article>
                                            );
                                        })}
                                </div>
                            ) : (
                                <p className="ceo-task-no-employees">
                                    No work sessions have been logged yet.
                                </p>
                            )}
                        </div>

                        <footer className="ceo-task-modal-footer">
                            <span>
                                Monitoring view only
                            </span>

                            <button
                                type="button"
                                className="ceo-tasks-refresh"
                                onClick={closeDetails}
                            >
                                Close details
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </main>
    );
}
