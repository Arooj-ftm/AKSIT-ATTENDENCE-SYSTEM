
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock3,
    Edit3,
    Eye,
    FileText,
    FolderKanban,
    LoaderCircle,
    Plus,
    Search,
    Send,
    Trash2,
    Users,
    X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import "./CTOTasks.css";

const EMPTY_FORM = {
    title: "",
    description: "",
    type: "Task",
    deadline: "",
    assignments: {},
};

function getId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return String(value._id || value.id || "");
}

function getPerson(value) {
    if (!value || typeof value !== "object") return null;
    return value;
}

function getEmployeeName(value) {
    const person = getPerson(value);
    return person?.name || person?.fullName || "Employee";
}

function getEmployeeId(assignment) {
    return getId(assignment?.employeeId || assignment?.employee);
}

function getTaskAssignments(task) {
    return Array.isArray(task?.assignments) ? task.assignments : [];
}

function getTaskTitle(task) {
    return task?.title || task?.name || "Untitled task";
}

function getDeadlineInput(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
    if (!value) return "No date";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function hoursFromMinutes(minutes) {
    return Math.max(0, Number(minutes || 0)) / 60;
}

function getWorkedMinutes(assignment, task) {
    const employeeId = getEmployeeId(assignment);
    const entries = Array.isArray(task?.timeEntries)
        ? task.timeEntries
        : [];

    return entries.reduce((total, entry) => {
        const entryEmployeeId = getId(
            entry.employeeId || entry.employee
        );

        if (
            employeeId &&
            entryEmployeeId &&
            entryEmployeeId !== employeeId
        ) {
            return total;
        }

        return total + Math.max(
            0,
            Number(entry.workedMinutes || entry.minutes || 0)
        );
    }, 0);
}

function getProgress(assignment, task) {
    const status = String(assignment?.status || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");

    if (status === "completed") return 100;

    const toProgress = (value) => {
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === "" ||
            !Number.isFinite(Number(value))
        ) {
            return null;
        }

        return Math.min(100, Math.max(0, Number(value)));
    };

    // Assignment ki saved completion progress.
    const assignmentProgress = toProgress(
        assignment?.progressPercent ??
        assignment?.progress ??
        assignment?.completionPercent
    );

    // Employee ki latest daily report.
    const employeeId = getEmployeeId(assignment);
    const reports = Array.isArray(task?.dailyReports)
        ? task.dailyReports
        : [];

    const latestReport = reports
        .filter((report) => {
            const reportEmployeeId = getId(
                report.employeeId || report.employee
            );

            return (
                employeeId &&
                reportEmployeeId === employeeId
            );
        })
        .sort((a, b) => {
            const dateA = new Date(
                a.submittedAt || a.updatedAt || a.date || 0
            ).getTime();

            const dateB = new Date(
                b.submittedAt || b.updatedAt || b.date || 0
            ).getTime();

            return dateB - dateA;
        })[0];

    const reportProgress = toProgress(
        latestReport?.progressPercent ??
        latestReport?.progress ??
        latestReport?.completionPercent
    );

    // Saved assignment progress ko priority do.
    if (assignmentProgress !== null && assignmentProgress > 0) {
        return assignmentProgress;
    }

    if (reportProgress !== null) {
        return reportProgress;
    }

    return assignmentProgress ?? 0;
}


function getStatus(assignment, task) {
    const status = String(assignment?.status || "").toLowerCase();
    const progress = getProgress(assignment, task);

    const deadline = task?.deadline
        ? new Date(task.deadline)
        : null;

    if (status === "completed" || progress >= 100) {
        return "Completed";
    }

    if (
        deadline &&
        !Number.isNaN(deadline.getTime()) &&
        deadline < new Date()
    ) {
        return "Overdue";
    }

    if (
        status === "in progress" ||
        status === "in_progress" ||
        progress > 0
    ) {
        return "In Progress";
    }

    return "To Do";
}

function getDailyReports(task, employeeId) {
    const reports = Array.isArray(task?.dailyReports)
        ? task.dailyReports
        : [];

    return reports
        .filter((report) => {
            const reportEmployeeId = getId(
                report.employeeId || report.employee
            );

            return (
                !employeeId ||
                !reportEmployeeId ||
                reportEmployeeId === employeeId
            );
        })
        .sort((a, b) => {
            const dateA = new Date(
                a.submittedAt || a.updatedAt || a.date || 0
            ).getTime();

            const dateB = new Date(
                b.submittedAt || b.updatedAt || b.date || 0
            ).getTime();

            return dateB - dateA;
        });
}

function getTimeEntries(task, employeeId) {
    const entries = Array.isArray(task?.timeEntries)
        ? task.timeEntries
        : [];

    return entries
        .filter((entry) => {
            const entryEmployeeId = getId(
                entry.employeeId || entry.employee
            );

            return (
                !employeeId ||
                !entryEmployeeId ||
                entryEmployeeId === employeeId
            );
        })
        .sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0).getTime();
            const dateB = new Date(b.date || b.createdAt || 0).getTime();

            return dateB - dateA;
        });
}

function getErrorMessage(error, fallback) {
    return error?.message || fallback;
}

export default function CTOTasks() {
    const { user, token } = useAuth();

    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pageError, setPageError] = useState("");
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [expandedTask, setExpandedTask] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const isCto = user?.role === "cto_md";

    const loadData = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setPageError(
                "Please sign in again to access company tasks."
            );
            return;
        }

        setLoading(true);
        setPageError("");

        try {
            const [taskResponse, employeeResponse] = await Promise.all([
                apiRequest("/api/tasks", {}, token),
                apiRequest("/api/cto-md/employees", {}, token),
            ]);

            const taskList = Array.isArray(taskResponse)
                ? taskResponse
                : taskResponse?.tasks ||
                taskResponse?.data?.tasks ||
                [];

            const employeeList = Array.isArray(employeeResponse)
                ? employeeResponse
                : employeeResponse?.employees ||
                employeeResponse?.data?.employees ||
                [];

            console.log(
                "CTO ASSIGNMENT DETAILS:",
                JSON.stringify(
                    tasks.map((task) => ({
                        title: task.title,
                        assignments: (task.assignments || []).map((assignment) => ({
                            employee: assignment.employeeId?.name || assignment.employee?.name,
                            employeeId:
                                assignment.employeeId?._id ||
                                assignment.employeeId ||
                                assignment.employee?._id ||
                                assignment.employee,
                            progressPercent: assignment.progressPercent,
                            status: assignment.status,
                            plannedHours: assignment.plannedHours,
                        })),
                        timeEntries: (task.timeEntries || []).map((entry) => ({
                            employee: entry.employeeId?.name,
                            employeeId: entry.employeeId?._id || entry.employeeId,
                            workedMinutes: entry.workedMinutes,
                        })),
                    })),
                    null,
                    2
                )
            );
            setTasks(taskList.filter((task) => !task?.isDeleted));
            setEmployees(employeeList);
        } catch (error) {
            setPageError(
                getErrorMessage(
                    error,
                    "Unable to load company tasks."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const departments = useMemo(() => {
        return [
            ...new Set(
                employees
                    .map((employee) =>
                        String(employee.department || "").trim()
                    )
                    .filter(Boolean)
            ),
        ].sort((a, b) => a.localeCompare(b));
    }, [employees]);

    const allAssignments = useMemo(() => {
        return tasks.flatMap((task) =>
            getTaskAssignments(task).map((assignment) => ({
                task,
                assignment,
            }))
        );
    }, [tasks]);

    const stats = useMemo(() => {
        const completed = allAssignments.filter(
            ({ assignment, task }) =>
                getStatus(assignment, task) === "Completed"
        ).length;

        const inProgress = allAssignments.filter(
            ({ assignment, task }) =>
                getStatus(assignment, task) === "In Progress"
        ).length;

        const overdue = allAssignments.filter(
            ({ assignment, task }) =>
                getStatus(assignment, task) === "Overdue"
        ).length;

        const plannedHours = allAssignments.reduce(
            (sum, item) =>
                sum + Number(item.assignment.plannedHours || 0),
            0
        );

        const actualHours = allAssignments.reduce(
            (sum, item) =>
                sum +
                hoursFromMinutes(
                    getWorkedMinutes(item.assignment, item.task)
                ),
            0
        );

        return {
            tasks: tasks.length,
            assignments: allAssignments.length,
            completed,
            inProgress,
            overdue,
            plannedHours,
            actualHours,
        };
    }, [tasks, allAssignments]);

    const filteredTasks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return tasks.filter((task) => {
            const assignments = getTaskAssignments(task);

            const departmentMatches =
                departmentFilter === "all" ||
                String(task.department || "").toLowerCase() ===
                departmentFilter.toLowerCase() ||
                assignments.some((assignment) => {
                    const employee = employees.find(
                        (item) =>
                            getId(item) === getEmployeeId(assignment)
                    );

                    return (
                        String(employee?.department || "").toLowerCase() ===
                        departmentFilter.toLowerCase()
                    );
                });

            const typeMatches =
                typeFilter === "all" ||
                String(task.type || "Task").toLowerCase() ===
                typeFilter.toLowerCase();

            const statusMatches =
                statusFilter === "all" ||
                assignments.some(
                    (assignment) =>
                        getStatus(assignment, task)
                            .toLowerCase()
                            .replace(" ", "_") === statusFilter
                );

            const searchable = [
                getTaskTitle(task),
                task.description,
                task.department,
                task.managerId?.name,
                task.createdBy?.name,
                ...assignments.map((assignment) =>
                    getEmployeeName(
                        assignment.employeeId || assignment.employee
                    )
                ),
            ]
                .join(" ")
                .toLowerCase();

            return (
                departmentMatches &&
                typeMatches &&
                statusMatches &&
                (!query || searchable.includes(query))
            );
        });
    }, [
        tasks,
        search,
        statusFilter,
        typeFilter,
        departmentFilter,
        employees,
    ]);

    const openCreateModal = () => {
        setEditingTask(null);
        setForm({ ...EMPTY_FORM, assignments: {} });
        setNotice("");
        setPageError("");
        setModalOpen(true);
    };

    const openEditModal = (task) => {
        const assignments = {};

        getTaskAssignments(task).forEach((assignment) => {
            const employeeId = getEmployeeId(assignment);

            if (employeeId) {
                assignments[employeeId] = String(
                    assignment.plannedHours ?? ""
                );
            }
        });

        setEditingTask(task);
        setForm({
            title: getTaskTitle(task),
            description: task.description || "",
            type: task.type || "Task",
            deadline: getDeadlineInput(task.deadline),
            assignments,
        });

        setNotice("");
        setPageError("");
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;

        setModalOpen(false);
        setEditingTask(null);
        setForm({ ...EMPTY_FORM, assignments: {} });
    };

    const updateField = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const toggleEmployee = (employeeId, checked) => {
        setForm((current) => {
            const assignments = { ...current.assignments };

            if (checked) {
                assignments[employeeId] =
                    assignments[employeeId] || "8";
            } else {
                delete assignments[employeeId];
            }

            return { ...current, assignments };
        });
    };

    const updatePlannedHours = (employeeId, value) => {
        setForm((current) => ({
            ...current,
            assignments: {
                ...current.assignments,
                [employeeId]: value,
            },
        }));
    };

    const saveTask = async (event) => {
        event.preventDefault();
        setPageError("");
        setNotice("");

        if (!form.title.trim() || form.title.trim().length < 2) {
            setPageError(
                "Please enter a task or project title with at least 2 characters."
            );
            return;
        }

        if (!form.deadline) {
            setPageError("Please select a deadline.");
            return;
        }

        const selectedAssignments = Object.entries(form.assignments)
            .filter(([, hours]) => String(hours).trim() !== "")
            .map(([employeeId, hours]) => ({
                employeeId,
                plannedHours: Number(hours),
            }));

        if (!selectedAssignments.length) {
            setPageError(
                "Select at least one employee and enter their planned hours."
            );
            return;
        }

        const invalidHours = selectedAssignments.some(
            (assignment) =>
                !Number.isFinite(assignment.plannedHours) ||
                assignment.plannedHours < 0.25 ||
                assignment.plannedHours > 1000
        );

        if (invalidHours) {
            setPageError(
                "Planned hours must be between 0.25 and 1000 for each employee."
            );
            return;
        }

        setSaving(true);

        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                type: form.type,
                deadline: new Date(
                    `${form.deadline}T23:59:00`
                ).toISOString(),
                assignments: selectedAssignments,
            };

            if (editingTask) {
                await apiRequest(
                    `/api/tasks/${getId(editingTask)}`,
                    { method: "PUT", body: payload },
                    token
                );

                setNotice("Task or project updated successfully.");
            } else {
                await apiRequest(
                    "/api/tasks",
                    { method: "POST", body: payload },
                    token
                );

                setNotice("Task or project created successfully.");
            }

            setModalOpen(false);
            setEditingTask(null);
            setForm({ ...EMPTY_FORM, assignments: {} });

            await loadData();
        } catch (error) {
            setPageError(
                getErrorMessage(
                    error,
                    "Unable to save this task or project."
                )
            );
        } finally {
            setSaving(false);
        }
    };

    const deleteTask = async (task) => {
        const confirmed = window.confirm(
            `Delete "${getTaskTitle(task)}"? Its work history should be retained by the server.`
        );

        if (!confirmed) return;

        setPageError("");
        setNotice("");

        try {
            await apiRequest(
                `/api/tasks/${getId(task)}`,
                {
                    method: "DELETE",
                    body: {
                        reason: "Deleted by CTO / Managing Director",
                    },
                },
                token
            );

            setTasks((current) =>
                current.filter(
                    (item) => getId(item) !== getId(task)
                )
            );

            setNotice(
                "Task deleted. Existing history is retained by the backend."
            );
        } catch (error) {
            setPageError(
                getErrorMessage(error, "Unable to delete this task.")
            );
        }
    };

    if (!isCto) {
        return (
            <main className="cto-tasks-page">
                <div className="cto-tasks-access">
                    <AlertCircle size={24} />
                    <h2>Access restricted</h2>
                    <p>
                        This company-wide workspace is available to the
                        CTO / Managing Director.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="cto-tasks-page">
            <PageHeader
                eyebrow="CTO / MANAGING DIRECTOR"
                title="Tasks & Projects"
                description="Monitor work across departments, assign company-wide tasks, and track planned hours, progress and deadlines."
                onRefresh={loadData}
                refreshing={loading}
                actions={
                    <button
                        type="button"
                        className="cto-btn cto-btn-primary"
                        onClick={openCreateModal}
                    >
                        <Plus size={17} />
                        Create task
                    </button>
                }
            />

            {pageError && (
                <div
                    className="cto-alert cto-alert-error"
                    role="alert"
                >
                    <AlertCircle size={18} />
                    <span>{pageError}</span>
                    <button
                        type="button"
                        aria-label="Dismiss error"
                        onClick={() => setPageError("")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {notice && (
                <div
                    className="cto-alert cto-alert-success"
                    role="status"
                >
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button
                        type="button"
                        aria-label="Dismiss message"
                        onClick={() => setNotice("")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="cto-stats-grid">
                <StatCard
                    icon={<FolderKanban />}
                    label="Total tasks"
                    value={stats.tasks}
                    detail="Company-wide tasks & projects"
                />
                <StatCard
                    icon={<Users />}
                    label="Assignments"
                    value={stats.assignments}
                    detail="Employee assignments"
                />
                <StatCard
                    icon={<CheckCircle2 />}
                    label="Completed"
                    value={stats.completed}
                    detail="Completed assignments"
                />
                <StatCard
                    icon={<Activity />}
                    label="In progress"
                    value={stats.inProgress}
                    detail="Active assignments"
                />
                <StatCard
                    icon={<AlertCircle />}
                    label="Overdue"
                    value={stats.overdue}
                    detail="Past-deadline assignments"
                />
                <StatCard
                    icon={<Clock3 />}
                    label="Actual / planned"
                    value={`${stats.actualHours.toFixed(1)} / ${stats.plannedHours.toFixed(1)}h`}
                    detail="Logged hours versus planned hours"
                />
            </section>

            <section className="cto-tasks-panel">
                <div className="cto-panel-heading">
                    <div>
                        <h2>Company task register</h2>
                        <p>
                            Search, filter and manage work from every
                            department.
                        </p>
                    </div>
                    <span className="cto-result-count">
                        {filteredTasks.length} results
                    </span>
                </div>

                <div className="cto-task-filters">
                    <label className="cto-search-field">
                        <Search size={17} />
                        <input
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search task, employee or manager..."
                        />
                    </label>

                    <select
                        value={departmentFilter}
                        onChange={(event) =>
                            setDepartmentFilter(event.target.value)
                        }
                        aria-label="Filter by department"
                    >
                        <option value="all">All departments</option>
                        {departments.map((department) => (
                            <option key={department} value={department}>
                                {department}
                            </option>
                        ))}
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(event) =>
                            setTypeFilter(event.target.value)
                        }
                        aria-label="Filter by type"
                    >
                        <option value="all">All types</option>
                        <option value="Task">Tasks</option>
                        <option value="Project">Projects</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                        aria-label="Filter by status"
                    >
                        <option value="all">All statuses</option>
                        <option value="to_do">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                    </select>
                </div>

                {loading ? (
                    <div className="cto-empty-state">
                        <LoaderCircle
                            className="cto-spin"
                            size={30}
                        />
                        <h3>Loading company tasks</h3>
                        <p>
                            Fetching tasks and employee assignments...
                        </p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="cto-empty-state">
                        <FolderKanban size={34} />
                        <h3>No tasks found</h3>
                        <p>
                            Try changing your filters or create a new task
                            for the company.
                        </p>
                        <button
                            type="button"
                            className="cto-btn cto-btn-primary"
                            onClick={openCreateModal}
                        >
                            <Plus size={16} /> Create task
                        </button>
                    </div>
                ) : (
                    <div className="cto-task-list">
                        {filteredTasks.map((task) => {
                            const assignments = getTaskAssignments(task);
                            const taskId = getId(task);
                            const isExpanded = expandedTask === taskId;

                            const completedCount = assignments.filter(
                                (assignment) =>
                                    getStatus(assignment, task) ===
                                    "Completed"
                            ).length;

                            const progress = assignments.length
                                ? Math.round(
                                    assignments.reduce(
                                        (sum, assignment) =>
                                            sum +
                                            getProgress(assignment, task),
                                        0
                                    ) / assignments.length
                                )
                                : 0;

                            const creator = getPerson(
                                task.managerId || task.createdBy
                            );

                            const plannedTotal = assignments.reduce(
                                (sum, assignment) =>
                                    sum +
                                    Number(assignment.plannedHours || 0),
                                0
                            );

                            const actualTotal = assignments.reduce(
                                (sum, assignment) =>
                                    sum +
                                    hoursFromMinutes(
                                        getWorkedMinutes(assignment, task)
                                    ),
                                0
                            );

                            return (
                                <article
                                    className="cto-task-card"
                                    key={taskId}
                                >
                                    <div className="cto-task-card-main">
                                        <div className="cto-task-icon">
                                            {String(task.type).toLowerCase() ===
                                                "project" ? (
                                                <FolderKanban size={21} />
                                            ) : (
                                                <FileText size={21} />
                                            )}
                                        </div>

                                        <div className="cto-task-content">
                                            <div className="cto-task-title-row">
                                                <div>
                                                    <div className="cto-task-labels">
                                                        <span
                                                            className={`cto-type-pill ${String(
                                                                task.type
                                                            ).toLowerCase() ===
                                                                "project"
                                                                ? "project"
                                                                : ""
                                                                }`}
                                                        >
                                                            {task.type ||
                                                                "Task"}
                                                        </span>

                                                        {task.department && (
                                                            <span className="cto-department-pill">
                                                                {task.department}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h3>
                                                        {getTaskTitle(task)}
                                                    </h3>
                                                </div>

                                                <div className="cto-task-actions">
                                                    <button
                                                        type="button"
                                                        className="cto-icon-btn"
                                                        title="Edit task"
                                                        onClick={() =>
                                                            openEditModal(task)
                                                        }
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="cto-icon-btn cto-icon-danger"
                                                        title="Delete task"
                                                        onClick={() =>
                                                            deleteTask(task)
                                                        }
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {task.description && (
                                                <p className="cto-task-description">
                                                    {task.description}
                                                </p>
                                            )}

                                            <div className="cto-task-meta">
                                                <span>
                                                    <CalendarDays size={14} />
                                                    Due{" "}
                                                    {formatDate(task.deadline)}
                                                </span>
                                                <span>
                                                    <Users size={14} />
                                                    {assignments.length} assigned
                                                </span>

                                                {creator?.name && (
                                                    <span>
                                                        <Eye size={14} />
                                                        Created by{" "}
                                                        {creator.name}
                                                    </span>
                                                )}

                                                <span>
                                                    <Clock3 size={14} />
                                                    {actualTotal.toFixed(1)}h /{" "}
                                                    {plannedTotal.toFixed(1)}h
                                                </span>
                                            </div>

                                            <div className="cto-task-progress">
                                                <div className="cto-progress-label">
                                                    <span>
                                                        Overall progress
                                                    </span>
                                                    <strong>
                                                        {progress}%
                                                    </strong>
                                                </div>

                                                <div className="cto-progress-track">
                                                    <div
                                                        className="cto-progress-fill"
                                                        style={{
                                                            width: `${progress}%`,
                                                        }}
                                                    />
                                                </div>

                                                <span className="cto-progress-footnote">
                                                    {completedCount} of{" "}
                                                    {assignments.length}{" "}
                                                    assignments completed
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="cto-expand-button"
                                        onClick={() =>
                                            setExpandedTask(
                                                isExpanded ? "" : taskId
                                            )
                                        }
                                        aria-expanded={isExpanded}
                                    >
                                        <span>
                                            {isExpanded
                                                ? "Hide assignment details"
                                                : "View assignments & work history"}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronUp size={17} />
                                        ) : (
                                            <ChevronDown size={17} />
                                        )}
                                    </button>

                                    {isExpanded && (
                                        <div className="cto-task-details">
                                            {assignments.length === 0 ? (
                                                <p className="cto-no-assignments">
                                                    No employee assignments
                                                    are attached to this task.
                                                </p>
                                            ) : (
                                                assignments.map(
                                                    (assignment, index) => {
                                                        const employeeId =
                                                            getEmployeeId(
                                                                assignment
                                                            );

                                                        const assignedPerson =
                                                            assignment.employeeId ||
                                                            assignment.employee;

                                                        const employee =
                                                            employees.find(
                                                                (item) =>
                                                                    getId(item) ===
                                                                    employeeId
                                                            );

                                                        const progressValue =
                                                            getProgress(
                                                                assignment,
                                                                task
                                                            );

                                                        const status =
                                                            getStatus(
                                                                assignment,
                                                                task
                                                            );

                                                        const workedMinutes =
                                                            getWorkedMinutes(
                                                                assignment,
                                                                task
                                                            );

                                                        const reports =
                                                            getDailyReports(
                                                                task,
                                                                employeeId
                                                            );

                                                        const entries =
                                                            getTimeEntries(
                                                                task,
                                                                employeeId
                                                            );

                                                        const plannedHours =
                                                            Number(
                                                                assignment.plannedHours ||
                                                                0
                                                            );

                                                        const workedHours =
                                                            hoursFromMinutes(
                                                                workedMinutes
                                                            );

                                                        const exceeded =
                                                            workedHours >
                                                            plannedHours;

                                                        return (
                                                            <div
                                                                className="cto-assignment-card"
                                                                key={`${employeeId || "assignment"}-${index}`}
                                                            >
                                                                <div className="cto-assignment-top">
                                                                    <div className="cto-avatar">
                                                                        {getEmployeeName(
                                                                            assignedPerson
                                                                        )
                                                                            .slice(
                                                                                0,
                                                                                1
                                                                            )
                                                                            .toUpperCase()}
                                                                    </div>

                                                                    <div className="cto-assignment-person">
                                                                        <strong>
                                                                            {getEmployeeName(
                                                                                assignedPerson
                                                                            )}
                                                                        </strong>
                                                                        <span>
                                                                            {employee?.department ||
                                                                                getPerson(
                                                                                    assignedPerson
                                                                                )
                                                                                    ?.department ||
                                                                                "Department not specified"}

                                                                            {employee?.designation
                                                                                ? ` · ${employee.designation}`
                                                                                : ""}
                                                                        </span>
                                                                    </div>

                                                                    <span
                                                                        className={`cto-status-pill ${status.toLowerCase().replace(" ", "-")}`}
                                                                    >
                                                                        {status}
                                                                    </span>
                                                                </div>

                                                                <div className="cto-assignment-metrics">
                                                                    <div>
                                                                        <span>
                                                                            Planned
                                                                        </span>
                                                                        <strong>
                                                                            {plannedHours.toFixed(
                                                                                2
                                                                            )}
                                                                            h
                                                                        </strong>
                                                                    </div>

                                                                    <div>
                                                                        <span>
                                                                            Actual
                                                                        </span>
                                                                        <strong
                                                                            className={
                                                                                exceeded
                                                                                    ? "cto-over-hours"
                                                                                    : ""
                                                                            }
                                                                        >
                                                                            {workedHours.toFixed(
                                                                                2
                                                                            )}
                                                                            h
                                                                        </strong>
                                                                    </div>

                                                                    <div>
                                                                        <span>
                                                                            Progress
                                                                        </span>
                                                                        <strong>
                                                                            {progressValue}
                                                                            %
                                                                        </strong>
                                                                    </div>

                                                                    <div>
                                                                        <span>
                                                                            Deadline
                                                                        </span>
                                                                        <strong>
                                                                            {formatDate(
                                                                                task.deadline
                                                                            )}
                                                                        </strong>
                                                                    </div>
                                                                </div>

                                                                <div className="cto-progress-track cto-assignment-progress">
                                                                    <div
                                                                        className="cto-progress-fill"
                                                                        style={{
                                                                            width: `${progressValue}%`,
                                                                        }}
                                                                    />
                                                                </div>

                                                                {exceeded && (
                                                                    <div className="cto-inline-warning">
                                                                        <AlertCircle
                                                                            size={
                                                                                15
                                                                            }
                                                                        />
                                                                        Actual
                                                                        hours
                                                                        have
                                                                        exceeded
                                                                        this
                                                                        employee's
                                                                        planned
                                                                        hours.
                                                                    </div>
                                                                )}

                                                                {(reports.length >
                                                                    0 ||
                                                                    entries.length >
                                                                    0) && (
                                                                        <div className="cto-work-history">
                                                                            {reports.length >
                                                                                0 && (
                                                                                    <div className="cto-history-section">
                                                                                        <h4>
                                                                                            <FileText
                                                                                                size={
                                                                                                    15
                                                                                                }
                                                                                            />
                                                                                            Daily
                                                                                            reports
                                                                                            & blockers
                                                                                        </h4>

                                                                                        {reports.map(
                                                                                            (
                                                                                                report,
                                                                                                reportIndex
                                                                                            ) => (
                                                                                                <div
                                                                                                    className="cto-history-item"
                                                                                                    key={
                                                                                                        report._id ||
                                                                                                        reportIndex
                                                                                                    }
                                                                                                >
                                                                                                    <div className="cto-history-item-heading">
                                                                                                        <strong>
                                                                                                            {formatDate(
                                                                                                                report.date ||
                                                                                                                report.submittedAt ||
                                                                                                                report.createdAt
                                                                                                            )}
                                                                                                        </strong>

                                                                                                        {report.workedMinutes !=
                                                                                                            null && (
                                                                                                                <span>
                                                                                                                    {hoursFromMinutes(
                                                                                                                        report.workedMinutes
                                                                                                                    ).toFixed(
                                                                                                                        2
                                                                                                                    )}
                                                                                                                    h
                                                                                                                </span>
                                                                                                            )}

                                                                                                        {report.progressPercent !=
                                                                                                            null && (
                                                                                                                <span>
                                                                                                                    {Number(
                                                                                                                        report.progressPercent
                                                                                                                    )}
                                                                                                                    % progress
                                                                                                                </span>
                                                                                                            )}
                                                                                                    </div>

                                                                                                    {(report.workSummary ||
                                                                                                        report.report ||
                                                                                                        report.description ||
                                                                                                        report.workDone ||
                                                                                                        report.summary) && (
                                                                                                            <p>
                                                                                                                {report.workSummary ||
                                                                                                                    report.report ||
                                                                                                                    report.description ||
                                                                                                                    report.workDone ||
                                                                                                                    report.summary}
                                                                                                            </p>
                                                                                                        )}

                                                                                                    {report.blockers && (
                                                                                                        <p className="cto-blocker-text">
                                                                                                            <AlertCircle
                                                                                                                size={
                                                                                                                    14
                                                                                                                }
                                                                                                            />
                                                                                                            {" "}
                                                                                                            {report.blockers}
                                                                                                        </p>
                                                                                                    )}
                                                                                                </div>
                                                                                            )
                                                                                        )}
                                                                                    </div>
                                                                                )}

                                                                            {entries.length >
                                                                                0 && (
                                                                                    <div className="cto-history-section">
                                                                                        <h4>
                                                                                            <Clock3
                                                                                                size={
                                                                                                    15
                                                                                                }
                                                                                            />
                                                                                            Logged
                                                                                            work
                                                                                        </h4>

                                                                                        {entries.map(
                                                                                            (
                                                                                                entry,
                                                                                                entryIndex
                                                                                            ) => (
                                                                                                <div
                                                                                                    className="cto-history-item"
                                                                                                    key={
                                                                                                        entry._id ||
                                                                                                        entryIndex
                                                                                                    }
                                                                                                >
                                                                                                    <div className="cto-history-item-heading">
                                                                                                        <strong>
                                                                                                            {formatDate(
                                                                                                                entry.date ||
                                                                                                                entry.createdAt
                                                                                                            )}
                                                                                                        </strong>

                                                                                                        <span>
                                                                                                            {hoursFromMinutes(
                                                                                                                entry.workedMinutes ||
                                                                                                                entry.minutes
                                                                                                            ).toFixed(
                                                                                                                2
                                                                                                            )}
                                                                                                            h
                                                                                                        </span>
                                                                                                    </div>

                                                                                                    {(entry.description ||
                                                                                                        entry.note ||
                                                                                                        entry.workDescription) && (
                                                                                                            <p>
                                                                                                                {entry.description ||
                                                                                                                    entry.note ||
                                                                                                                    entry.workDescription}
                                                                                                            </p>
                                                                                                        )}
                                                                                                </div>
                                                                                            )
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                        </div>
                                                                    )}

                                                                {reports.length ===
                                                                    0 &&
                                                                    entries.length ===
                                                                    0 && (
                                                                        <p className="cto-no-history">
                                                                            No daily
                                                                            reports
                                                                            or time
                                                                            entries
                                                                            available
                                                                            for this
                                                                            assignment
                                                                            yet.
                                                                        </p>
                                                                    )}
                                                            </div>
                                                        );
                                                    }
                                                )
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {modalOpen && (
                <div
                    className="cto-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <section
                        className="cto-task-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cto-task-modal-title"
                    >
                        <div className="cto-modal-header">
                            <div>
                                <span className="cto-tasks-eyebrow">
                                    COMPANY-WIDE WORKSPACE
                                </span>
                                <h2 id="cto-task-modal-title">
                                    {editingTask
                                        ? "Edit task or project"
                                        : "Create task or project"}
                                </h2>
                                <p>
                                    Choose employees from across the company
                                    and set individual planned hours.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="cto-icon-btn"
                                aria-label="Close modal"
                                onClick={closeModal}
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <form
                            onSubmit={saveTask}
                            className="cto-task-form"
                        >
                            <div className="cto-form-grid">
                                <label className="cto-form-field cto-form-full">
                                    <span>
                                        Title <b>*</b>
                                    </span>
                                    <input
                                        value={form.title}
                                        onChange={(event) =>
                                            updateField(
                                                "title",
                                                event.target.value
                                            )
                                        }
                                        placeholder="e.g. Employee onboarding portal"
                                        required
                                        minLength={2}
                                        maxLength={160}
                                    />
                                </label>

                                <label className="cto-form-field">
                                    <span>
                                        Type <b>*</b>
                                    </span>
                                    <select
                                        value={form.type}
                                        onChange={(event) =>
                                            updateField(
                                                "type",
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="Task">Task</option>
                                        <option value="Project">
                                            Project
                                        </option>
                                    </select>
                                </label>

                                <label className="cto-form-field">
                                    <span>
                                        Deadline <b>*</b>
                                    </span>
                                    <input
                                        type="date"
                                        value={form.deadline}
                                        onChange={(event) =>
                                            updateField(
                                                "deadline",
                                                event.target.value
                                            )
                                        }
                                        required
                                    />
                                </label>

                                <label className="cto-form-field cto-form-full">
                                    <span>Description</span>
                                    <textarea
                                        value={form.description}
                                        onChange={(event) =>
                                            updateField(
                                                "description",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Describe the expected outcome, scope or requirements..."
                                        rows={3}
                                        maxLength={4000}
                                    />
                                </label>
                            </div>

                            <div className="cto-employee-picker-heading">
                                <div>
                                    <h3>
                                        Assign employees <b>*</b>
                                    </h3>
                                    <p>
                                        {
                                            Object.keys(form.assignments)
                                                .length
                                        }{" "}
                                        selected · Planned hours are set per
                                        employee.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="cto-select-all"
                                    onClick={() => {
                                        const allSelected =
                                            employees.length > 0 &&
                                            employees.every((employee) =>
                                                form.assignments[getId(employee)]
                                            );

                                        setForm((current) => {
                                            const assignments = {
                                                ...current.assignments,
                                            };

                                            if (allSelected) {
                                                employees.forEach(
                                                    (employee) => {
                                                        delete assignments[
                                                            getId(employee)
                                                        ];
                                                    }
                                                );
                                            } else {
                                                employees.forEach(
                                                    (employee) => {
                                                        const id =
                                                            getId(employee);

                                                        if (id) {
                                                            assignments[id] =
                                                                assignments[id] ||
                                                                "8";
                                                        }
                                                    }
                                                );
                                            }

                                            return {
                                                ...current,
                                                assignments,
                                            };
                                        });
                                    }}
                                    disabled={!employees.length}
                                >
                                    {employees.length > 0 &&
                                        employees.every(
                                            (employee) =>
                                                form.assignments[getId(employee)]
                                        )
                                        ? "Deselect all"
                                        : "Select all"}
                                </button>
                            </div>

                            {employees.length === 0 ? (
                                <div className="cto-no-employees">
                                    <Users size={22} />
                                    <span>
                                        No active company employees were
                                        returned by the server.
                                    </span>
                                </div>
                            ) : (
                                <div className="cto-employee-list">
                                    {employees.map((employee) => {
                                        const id = getId(employee);
                                        const selected =
                                            Object.prototype.hasOwnProperty.call(
                                                form.assignments,
                                                id
                                            );

                                        return (
                                            <div
                                                className={`cto-employee-row ${selected ? "selected" : ""
                                                    }`}
                                                key={id}
                                            >
                                                <label className="cto-employee-select">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected}
                                                        onChange={(event) =>
                                                            toggleEmployee(
                                                                id,
                                                                event.target
                                                                    .checked
                                                            )
                                                        }
                                                    />

                                                    <span className="cto-checkmark">
                                                        <Check size={13} />
                                                    </span>

                                                    <span className="cto-employee-avatar">
                                                        {(
                                                            employee.name ||
                                                            "E"
                                                        )
                                                            .slice(0, 1)
                                                            .toUpperCase()}
                                                    </span>

                                                    <span className="cto-employee-info">
                                                        <strong>
                                                            {employee.name ||
                                                                "Unnamed employee"}
                                                        </strong>
                                                        <small>
                                                            {employee.department ||
                                                                "No department"}
                                                            {employee.designation
                                                                ? ` · ${employee.designation}`
                                                                : ""}
                                                        </small>
                                                    </span>
                                                </label>

                                                {selected && (
                                                    <label className="cto-hours-input">
                                                        <span>Hours</span>
                                                        <input
                                                            type="number"
                                                            min="0.25"
                                                            max="1000"
                                                            step="0.25"
                                                            value={
                                                                form.assignments[
                                                                id
                                                                ]
                                                            }
                                                            onChange={(event) =>
                                                                updatePlannedHours(
                                                                    id,
                                                                    event.target
                                                                        .value
                                                                )
                                                            }
                                                            aria-label={`Planned hours for ${employee.name}`}
                                                            required
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="cto-modal-footer">
                                <button
                                    type="button"
                                    className="cto-btn cto-btn-secondary"
                                    onClick={closeModal}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="cto-btn cto-btn-primary"
                                    disabled={saving || !employees.length}
                                >
                                    {saving ? (
                                        <LoaderCircle
                                            className="cto-spin"
                                            size={17}
                                        />
                                    ) : (
                                        <Send size={16} />
                                    )}

                                    {saving
                                        ? "Saving..."
                                        : editingTask
                                            ? "Save changes"
                                            : "Create task"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}

function StatCard({ icon, label, value, detail }) {
    return (
        <article className="cto-stat-card">
            <div className="cto-stat-top">
                <span className="cto-stat-icon">{icon}</span>
                <span className="cto-stat-label">{label}</span>
            </div>
            <strong className="cto-stat-value">{value}</strong>
            <span className="cto-stat-detail">{detail}</span>
        </article>
    );
}
