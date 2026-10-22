
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Users, Search, RefreshCw, UserRound, BriefcaseBusiness,
    Mail, CalendarDays, ClipboardList, CheckCircle2, Clock3,
    AlertCircle, ChevronDown, ChevronUp, Building2, TrendingUp,
    LoaderCircle, Pencil, Save, X, Plus, Trash2, ArrowLeft,
    LayoutDashboard, CircleAlert, Target, ListTodo,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../api/api";
import "./CTOManagerProfiles.css";

const getId = (value) => {
    if (!value) return "";
    if (typeof value === "object") return String(value._id || value.id || "");
    return String(value);
};

const getName = (value) => {
    if (!value) return "Unknown";
    if (typeof value === "object") {
        return value.name || value.fullName || value.email || "Unknown";
    }
    return String(value);
};

const getRole = (value) =>
    String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const getDate = (value) => {
    if (!value) return "Not specified";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not specified";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const getDateInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getHours = (minutes = 0) =>
    (Math.max(0, Number(minutes) || 0) / 60).toFixed(1);

const getAssignments = (task) =>
    Array.isArray(task?.assignments) ? task.assignments : [];

const getWorkedMinutes = (task) =>
    (Array.isArray(task?.timeEntries) ? task.timeEntries : []).reduce(
        (sum, entry) => sum + (Number(entry?.workedMinutes) || 0),
        0
    );

const getEmployeeWorkedMinutes = (task, employeeId) =>
    (Array.isArray(task?.timeEntries) ? task.timeEntries : [])
        .filter((entry) => getId(entry?.employeeId) === employeeId)
        .reduce((sum, entry) => sum + (Number(entry?.workedMinutes) || 0), 0);

const getProgress = (task) => {
    const assignments = getAssignments(task);
    if (!assignments.length) return 0;

    return Math.round(
        assignments.reduce((sum, assignment) => {
            const completed =
                String(assignment?.status || "").toLowerCase() === "completed";

            return sum + (completed
                ? 100
                : Math.max(0, Math.min(100, Number(assignment?.progressPercent) || 0)));
        }, 0) / assignments.length
    );
};

const getStatus = (task) => {
    const assignments = getAssignments(task);
    if (!assignments.length) return "Unassigned";

    if (assignments.every((assignment) =>
        String(assignment?.status || "").toLowerCase() === "completed" ||
        Number(assignment?.progressPercent) >= 100
    )) return "Completed";

    const deadline = task?.deadline ? new Date(task.deadline) : null;
    if (deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) {
        return "Overdue";
    }

    if (assignments.some((assignment) =>
        String(assignment?.status || "").toLowerCase() === "in progress" ||
        Number(assignment?.progressPercent) > 0
    )) return "In Progress";

    return "To Do";
};

const getManagerId = (task) => getId(task?.managerId || task?.createdBy);
const getDepartment = (manager) => manager?.department || "Not assigned";

function CTOManagerProfiles() {
    const { user, token } = useAuth();

    const [managers, setManagers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [tasks, setTasks] = useState([]);

    // Start with the directory. Open a profile only after manager selection.
    const [view, setView] = useState("directory");
    const [selectedManagerId, setSelectedManagerId] = useState("");
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("all");
    const [expandedTasks, setExpandedTasks] = useState({});

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingTask, setSavingTask] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [editingTask, setEditingTask] = useState(null);
    const [taskForm, setTaskForm] = useState({
        title: "",
        description: "",
        deadline: "",
        assignments: [],
    });

    const loadData = useCallback(async (showRefresh = false) => {
        if (!token) {
            setLoading(false);
            setError("Your session is not available. Please log in again.");
            return;
        }

        if (showRefresh) setRefreshing(true);
        else setLoading(true);

        setError("");

        try {
            const [employeeResponse, taskResponse] = await Promise.all([
                apiRequest("/api/cto-md/employees", {}, token),
                apiRequest("/api/tasks", {}, token),
            ]);

            const employeeList = Array.isArray(employeeResponse)
                ? employeeResponse
                : employeeResponse?.employees ||
                employeeResponse?.data?.employees || [];

            const taskList = Array.isArray(taskResponse)
                ? taskResponse
                : taskResponse?.tasks ||
                taskResponse?.data?.tasks || [];

            setManagers(employeeList.filter((person) =>
                getRole(person?.role) === "manager" &&
                person?.status !== "Inactive"
            ));

            setEmployees(employeeList.filter((person) =>
                getRole(person?.role) === "employee" &&
                person?.status !== "Inactive"
            ));

            setTasks(taskList.filter((task) => !task?.isDeleted));
            setNotice("");
        } catch (err) {
            setError(err?.message || "Unable to load manager profiles. Please try again.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const departments = useMemo(() =>
        [...new Set(managers.map((manager) => manager?.department).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b)),
        [managers]);

    const filteredManagers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return managers.filter((manager) => {
            const matchesSearch = !query || [
                manager?.name,
                manager?.fullName,
                manager?.email,
                manager?.designation,
                manager?.department,
            ].some((value) => String(value || "").toLowerCase().includes(query));

            const matchesDepartment =
                department === "all" || manager?.department === department;

            return matchesSearch && matchesDepartment;
        });
    }, [managers, search, department]);

    const selectedManager = useMemo(
        () => managers.find((manager) => getId(manager) === selectedManagerId) || null,
        [managers, selectedManagerId]
    );

    const managerTasks = useMemo(() => {
        if (!selectedManagerId) return [];

        return tasks
            .filter((task) => getManagerId(task) === selectedManagerId)
            .sort((a, b) =>
                (b?.deadline ? new Date(b.deadline).getTime() : 0) -
                (a?.deadline ? new Date(a.deadline).getTime() : 0)
            );
    }, [tasks, selectedManagerId]);

    const managerStats = useMemo(() => ({
        total: managerTasks.length,
        completed: managerTasks.filter((task) => getStatus(task) === "Completed").length,
        overdue: managerTasks.filter((task) => getStatus(task) === "Overdue").length,
        inProgress: managerTasks.filter((task) => getStatus(task) === "In Progress").length,
        assignments: managerTasks.reduce((sum, task) => sum + getAssignments(task).length, 0),
        workedHours: Number(getHours(managerTasks.reduce((sum, task) => sum + getWorkedMinutes(task), 0))),
    }), [managerTasks]);

    const companyCompleted = tasks.filter((task) => getStatus(task) === "Completed").length;
    const companyOverdue = tasks.filter((task) => getStatus(task) === "Overdue").length;
    const companyInProgress = tasks.filter((task) => getStatus(task) === "In Progress").length;

    const openManager = (manager) => {
        setSelectedManagerId(getId(manager));
        setExpandedTasks({});
        setNotice("");
        setError("");
        setView("profile");
    };

    const backToDirectory = () => {
        setView("directory");
        setExpandedTasks({});
        setNotice("");
        setError("");
    };

    const toggleTask = (taskId) => {
        setExpandedTasks((current) => ({ ...current, [taskId]: !current[taskId] }));
    };

    const openTaskEditor = (task) => {
        setEditingTask(task);
        setTaskForm({
            title: task?.title || "",
            description: task?.description || "",
            deadline: getDateInputValue(task?.deadline),
            assignments: getAssignments(task).map((assignment) => ({
                employeeId: getId(assignment?.employeeId),
                plannedHours: String(Number(assignment?.plannedHours) || ""),
            })),
        });
        setError("");
        setNotice("");
    };

    const closeTaskEditor = () => {
        if (savingTask) return;
        setEditingTask(null);
        setTaskForm({ title: "", description: "", deadline: "", assignments: [] });
        setError("");
    };

    const updateTaskForm = (field, value) => {
        setTaskForm((current) => ({ ...current, [field]: value }));
    };

    const updateAssignment = (index, field, value) => {
        setTaskForm((current) => ({
            ...current,
            assignments: current.assignments.map((assignment, i) =>
                i === index ? { ...assignment, [field]: value } : assignment
            ),
        }));
    };

    const addAssignment = () => {
        setTaskForm((current) => ({
            ...current,
            assignments: [...current.assignments, { employeeId: "", plannedHours: "" }],
        }));
    };

    const removeAssignment = (index) => {
        setTaskForm((current) => ({
            ...current,
            assignments: current.assignments.filter((_, i) => i !== index),
        }));
    };

    const saveTaskChanges = async (event) => {
        event.preventDefault();
        if (!editingTask || !token) return;

        const title = taskForm.title.trim();

        if (title.length < 2) {
            setError("Task title must contain at least 2 characters.");
            return;
        }

        if (!taskForm.deadline) {
            setError("Please select a task deadline.");
            return;
        }

        const assignments = taskForm.assignments
            .filter((assignment) => assignment.employeeId)
            .map((assignment) => ({
                employeeId: assignment.employeeId,
                plannedHours: Number(assignment.plannedHours),
            }));

        if (assignments.some((assignment) =>
            !Number.isFinite(assignment.plannedHours) ||
            assignment.plannedHours < 0.25 ||
            assignment.plannedHours > 1000
        )) {
            setError("Planned hours must be between 0.25 and 1000 for each assigned employee.");
            return;
        }

        const employeeIds = assignments.map((assignment) => assignment.employeeId);
        if (new Set(employeeIds).size !== employeeIds.length) {
            setError("An employee can only be assigned once to the same task.");
            return;
        }

        setSavingTask(true);
        setError("");
        setNotice("");

        try {
            const payload = {
                title,
                description: taskForm.description.trim(),
                deadline: new Date(`${taskForm.deadline}T23:59:00`).toISOString(),
                assignments,
            };

            await apiRequest(
                `/api/tasks/${getId(editingTask)}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
                token
            );

            setEditingTask(null);
            await loadData(true);
            setNotice("Task updated successfully.");
        } catch (err) {
            setError(err?.message || "Unable to update this task. Please try again.");
        } finally {
            setSavingTask(false);
        }
    };

    if (getRole(user?.role) !== "cto_md") {
        return (
            <main className="cto-manager-profiles-page">
                <div className="cmp-message cmp-message-error">
                    <AlertCircle size={20} />
                    <div>
                        <strong>Access denied</strong>
                        <p>Manager Profiles is available only to the CTO / Managing Director.</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="cto-manager-profiles-page cmp-redesign">
            <header className="cmp-hero">
                <div className="cmp-hero-copy">
                    <span className="cmp-eyebrow">
                        <BriefcaseBusiness size={15} />
                        COMPANY MANAGEMENT
                    </span>
                    <h1>{view === "directory" ? "Manager Directory" : "Manager Profile"}</h1>
                    <p>
                        {view === "directory"
                            ? "Explore manager profiles and monitor company-wide task performance."
                            : "Review this manager's information, assigned work and project progress."}
                    </p>
                </div>

                <div className="cmp-hero-actions">
                    {view === "profile" && (
                        <button type="button" className="cmp-back-button" onClick={backToDirectory}>
                            <ArrowLeft size={17} /> All managers
                        </button>
                    )}
                    <button
                        type="button"
                        className="cmp-icon-button cmp-hero-refresh"
                        onClick={() => loadData(true)}
                        disabled={refreshing || loading}
                        title="Refresh manager profiles and tasks"
                        aria-label="Refresh manager profiles and tasks"
                    >
                        {refreshing
                            ? <LoaderCircle className="cmp-spin" size={21} />
                            : <RefreshCw size={21} />}
                    </button>
                </div>
            </header>

            {error && !editingTask && (
                <div className="cmp-message cmp-message-error" role="alert">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button type="button" onClick={() => loadData(true)} className="cmp-inline-button">
                        Retry
                    </button>
                </div>
            )}

            {notice && (
                <div className="cmp-message cmp-message-success">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button type="button" className="cmp-notice-dismiss" onClick={() => setNotice("")} aria-label="Dismiss message">
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="cmp-summary-grid">
                <article className="cmp-summary-card">
                    <div className="cmp-summary-icon cmp-blue"><Users size={21} /></div>
                    <div><span>Total Managers</span><strong>{managers.length}</strong><small>Active manager profiles</small></div>
                </article>
                <article className="cmp-summary-card">
                    <div className="cmp-summary-icon cmp-purple"><ClipboardList size={21} /></div>
                    <div><span>Company Tasks</span><strong>{tasks.length}</strong><small>All active tasks</small></div>
                </article>
                <article className="cmp-summary-card">
                    <div className="cmp-summary-icon cmp-green"><CheckCircle2 size={21} /></div>
                    <div><span>Completed</span><strong>{companyCompleted}</strong><small>Tasks completed</small></div>
                </article>
                <article className="cmp-summary-card">
                    <div className="cmp-summary-icon cmp-orange"><CircleAlert size={21} /></div>
                    <div><span>Overdue</span><strong>{companyOverdue}</strong><small>Need attention</small></div>
                </article>
            </section>

            {view === "directory" ? (
                <section className="cmp-directory-view">


                    <div className="cmp-directory-tools">
                        <label className="cmp-search">
                            <Search size={18} />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name, email or department..."
                            />
                        </label>
                        <label className="cmp-filter-label">
                            <span>Department</span>
                            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                                <option value="all">All departments</option>
                                {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                    </div>

                    {loading ? (
                        <div className="cmp-directory-state">
                            <LoaderCircle className="cmp-spin" size={30} />
                            <strong>Loading manager directory...</strong>
                        </div>
                    ) : filteredManagers.length === 0 ? (
                        <div className="cmp-directory-state">
                            <Users size={34} />
                            <strong>No managers found</strong>
                            <p>Try another search term or choose a different department.</p>
                        </div>
                    ) : (
                        <div className="cmp-manager-grid">
                            {filteredManagers.map((manager) => {
                                const managerId = getId(manager);
                                const ownedTasks = tasks.filter((task) => getManagerId(task) === managerId);
                                const completed = ownedTasks.filter((task) => getStatus(task) === "Completed").length;
                                const progress = ownedTasks.length
                                    ? Math.round(ownedTasks.reduce((sum, task) => sum + getProgress(task), 0) / ownedTasks.length)
                                    : 0;

                                return (
                                    <button
                                        type="button"
                                        className="cmp-directory-card"
                                        key={managerId}
                                        onClick={() => openManager(manager)}
                                    >
                                        <div className="cmp-directory-card-top">
                                            <span className="cmp-directory-avatar">
                                                {String(manager?.name || manager?.fullName || "M").trim().charAt(0).toUpperCase()}
                                            </span>
                                            <span className="cmp-directory-arrow"><ChevronDown size={18} /></span>
                                        </div>
                                        <h3>{manager?.name || manager?.fullName || "Unnamed manager"}</h3>
                                        <p className="cmp-directory-designation">{manager?.designation || "Manager"}</p>
                                        <span className="cmp-department-chip"><Building2 size={14} />{getDepartment(manager)}</span>
                                        <span className="cmp-directory-email"><Mail size={14} />{manager?.email || "Email not provided"}</span>

                                        <div className="cmp-directory-metrics">
                                            <div><strong>{ownedTasks.length}</strong><span>Tasks</span></div>
                                            <div><strong>{completed}</strong><span>Completed</span></div>
                                            <div><strong>{progress}%</strong><span>Progress</span></div>
                                        </div>
                                        <div className="cmp-progress-track">
                                            <div className="cmp-progress-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                        <span className="cmp-open-profile">Open full profile <ArrowLeft size={15} /></span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            ) : (
                <section className="cmp-profile-view">
                    {!selectedManager ? (
                        <div className="cmp-directory-state">
                            <UserRound size={34} />
                            <strong>Manager profile not found</strong>
                            <button type="button" className="cmp-back-button" onClick={backToDirectory}>
                                <ArrowLeft size={16} /> Back to directory
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="cmp-profile-page-heading">
                                <div className="cmp-profile-heading-left">
                                    <span className="cmp-profile-avatar">
                                        {String(selectedManager?.name || selectedManager?.fullName || "M").trim().charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                        <span className="cmp-section-kicker"><UserRound size={15} /> MANAGER DETAILS</span>
                                        <h2>{selectedManager?.name || selectedManager?.fullName || "Unnamed manager"}</h2>
                                        <p>{selectedManager?.designation || "Manager"} · {getDepartment(selectedManager)}</p>
                                    </div>
                                </div>
                                <span className="cmp-status-pill cmp-status-active">Active manager</span>
                            </div>

                            <div className="cmp-profile-info-grid">
                                <div className="cmp-profile-info"><Mail size={19} /><div><small>Email address</small><strong>{selectedManager?.email || "Not provided"}</strong></div></div>
                                <div className="cmp-profile-info"><Building2 size={19} /><div><small>Department</small><strong>{getDepartment(selectedManager)}</strong></div></div>
                                <div className="cmp-profile-info"><BriefcaseBusiness size={19} /><div><small>Designation</small><strong>{selectedManager?.designation || "Manager"}</strong></div></div>
                                <div className="cmp-profile-info"><CalendarDays size={19} /><div><small>Joining date</small><strong>{getDate(selectedManager?.joiningDate)}</strong></div></div>
                            </div>

                            <div className="cmp-profile-stats-grid">
                                <article><span className="cmp-profile-stat-icon"><ListTodo size={18} /></span><div><small>Total tasks</small><strong>{managerStats.total}</strong></div></article>
                                <article><span className="cmp-profile-stat-icon is-green"><CheckCircle2 size={18} /></span><div><small>Completed</small><strong>{managerStats.completed}</strong></div></article>
                                <article><span className="cmp-profile-stat-icon is-blue"><TrendingUp size={18} /></span><div><small>In progress</small><strong>{managerStats.inProgress}</strong></div></article>
                                <article><span className="cmp-profile-stat-icon is-red"><CircleAlert size={18} /></span><div><small>Overdue</small><strong>{managerStats.overdue}</strong></div></article>
                                <article><span className="cmp-profile-stat-icon is-purple"><Users size={18} /></span><div><small>Assignments</small><strong>{managerStats.assignments}</strong></div></article>
                                <article><span className="cmp-profile-stat-icon is-orange"><Clock3 size={18} /></span><div><small>Actual hours</small><strong>{managerStats.workedHours}h</strong></div></article>
                            </div>

                            <section className="cmp-tasks-section">
                                <div className="cmp-tasks-heading">
                                    <div>
                                        <span className="cmp-section-kicker"><Target size={15} /> WORK OVERVIEW</span>
                                        <h2>Tasks & Projects</h2>
                                        <p>Tasks created by {selectedManager?.name || selectedManager?.fullName || "this manager"}.</p>
                                    </div>
                                    <span className="cmp-task-total">{managerTasks.length} tasks</span>
                                </div>

                                {managerTasks.length === 0 ? (
                                    <div className="cmp-directory-state cmp-no-tasks">
                                        <ClipboardList size={34} />
                                        <strong>No tasks found</strong>
                                        <p>No active tasks created by this manager were returned by the task API.</p>
                                    </div>
                                ) : (
                                    <div className="cmp-task-list">
                                        {managerTasks.map((task) => {
                                            const taskId = getId(task);
                                            const status = getStatus(task);
                                            const progress = getProgress(task);
                                            const assignments = getAssignments(task);
                                            const expanded = Boolean(expandedTasks[taskId]);
                                            const plannedHours = assignments.reduce((sum, assignment) => sum + (Number(assignment?.plannedHours) || 0), 0);

                                            const reports = (Array.isArray(task?.dailyReports) ? task.dailyReports : [])
                                                .filter((report) => assignments.some((assignment) =>
                                                    getId(assignment?.employeeId) === getId(report?.employeeId)
                                                ))
                                                .sort((a, b) =>
                                                    new Date(b?.date || b?.submittedAt || 0).getTime() -
                                                    new Date(a?.date || a?.submittedAt || 0).getTime()
                                                ).slice(0, 5);

                                            return (
                                                <article className="cmp-task-card" key={taskId}>
                                                    <div className="cmp-task-card-top">
                                                        <button type="button" className="cmp-task-toggle" onClick={() => toggleTask(taskId)} aria-expanded={expanded}>
                                                            <span className="cmp-task-main">
                                                                <span className="cmp-task-title-row">
                                                                    <strong>{task?.title || "Untitled task"}</strong>
                                                                    <span className={`cmp-task-status cmp-status-${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
                                                                </span>
                                                                <span className="cmp-task-description">{task?.description || "No description provided."}</span>
                                                                <span className="cmp-task-meta">
                                                                    <span><CalendarDays size={14} /> Due {getDate(task?.deadline)}</span>
                                                                    <span><Users size={14} /> {assignments.length} employee{assignments.length === 1 ? "" : "s"}</span>
                                                                </span>
                                                            </span>
                                                            <span className="cmp-task-expand-icon">{expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}</span>
                                                        </button>
                                                        <button type="button" className="cmp-edit-task-button" onClick={() => openTaskEditor(task)}>
                                                            <Pencil size={15} /> Edit task
                                                        </button>
                                                    </div>

                                                    <div className="cmp-task-summary-row">
                                                        <div className="cmp-task-progress-block">
                                                            <div className="cmp-progress-label"><span>Overall progress</span><strong>{progress}%</strong></div>
                                                            <div className="cmp-progress-track"><div className="cmp-progress-fill" style={{ width: `${progress}%` }} /></div>
                                                        </div>
                                                        <div className="cmp-task-hours">
                                                            <span><Clock3 size={15} /> Planned <strong>{plannedHours.toFixed(1)}h</strong></span>
                                                            <span><TrendingUp size={15} /> Worked <strong>{getHours(getWorkedMinutes(task))}h</strong></span>
                                                        </div>
                                                    </div>

                                                    {expanded && (
                                                        <div className="cmp-task-details">
                                                            <h3>Employee assignments</h3>
                                                            {assignments.length === 0 ? (
                                                                <p className="cmp-muted">No employee assignments.</p>
                                                            ) : (
                                                                <div className="cmp-assignment-list">
                                                                    {assignments.map((assignment, index) => {
                                                                        const employeeId = getId(assignment?.employeeId);
                                                                        const completed = String(assignment?.status || "").toLowerCase() === "completed";
                                                                        const assignmentProgress = completed ? 100 : Math.max(0, Math.min(100, Number(assignment?.progressPercent) || 0));

                                                                        return (
                                                                            <div className="cmp-assignment-item" key={`${employeeId}-${index}`}>
                                                                                <div className="cmp-assignment-heading">
                                                                                    <div><strong>{getName(assignment?.employeeId)}</strong><small>{assignment?.status || "To Do"}</small></div>
                                                                                    <strong>{assignmentProgress}%</strong>
                                                                                </div>
                                                                                <div className="cmp-progress-track cmp-progress-small"><div className="cmp-progress-fill" style={{ width: `${assignmentProgress}%` }} /></div>
                                                                                <div className="cmp-assignment-meta">
                                                                                    <span>Planned: {Number(assignment?.plannedHours) || 0}h</span>
                                                                                    <span>Actual: {getHours(getEmployeeWorkedMinutes(task, employeeId))}h</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            <h3 className="cmp-history-title">Latest daily reports</h3>
                                                            {reports.length === 0 ? (
                                                                <p className="cmp-muted">No daily reports available for this task.</p>
                                                            ) : reports.map((report, index) => (
                                                                <div className="cmp-report-item" key={`${getId(report?.employeeId)}-${report?.date || index}`}>
                                                                    <div className="cmp-report-heading">
                                                                        <strong>{getName(report?.employeeId)}</strong>
                                                                        <small>{getDate(report?.date || report?.submittedAt)}</small>
                                                                    </div>
                                                                    <p>{report?.workSummary || "No work summary submitted."}</p>
                                                                    {report?.blockers && <p className="cmp-blocker"><AlertCircle size={14} /> Blocker: {report.blockers}</p>}
                                                                    <span className="cmp-report-progress">Progress: {Number(report?.progressPercent) || 0}%</span>
                                                                </div>
                                                            ))}

                                                            <div className="cmp-task-footer">
                                                                <span>Created by: {getName(task?.managerId || task?.createdBy)}</span>
                                                                <span>Department: {task?.department || getDepartment(selectedManager)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </section>
            )}

            {editingTask && (
                <div className="cmp-editor-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeTaskEditor();
                }}>
                    <section className="cmp-task-editor" role="dialog" aria-modal="true" aria-labelledby="cmp-task-editor-title">
                        <div className="cmp-editor-header">
                            <div>
                                <span className="cmp-profile-tag">CTO / MANAGING DIRECTOR</span>
                                <h2 id="cmp-task-editor-title">Edit task</h2>
                                <p>Update task details and employee assignments.</p>
                            </div>
                            <button type="button" className="cmp-icon-button" onClick={closeTaskEditor} disabled={savingTask} aria-label="Close edit task form">
                                <X size={18} />
                            </button>
                        </div>

                        <form className="cmp-editor-form" onSubmit={saveTaskChanges}>
                            <label>Task title
                                <input type="text" value={taskForm.title} onChange={(event) => updateTaskForm("title", event.target.value)} minLength={2} required />
                            </label>
                            <label>Description
                                <textarea rows={3} value={taskForm.description} onChange={(event) => updateTaskForm("description", event.target.value)} placeholder="Describe the task or project..." />
                            </label>
                            <label>Deadline
                                <input type="date" value={taskForm.deadline} onChange={(event) => updateTaskForm("deadline", event.target.value)} required />
                            </label>

                            <div className="cmp-editor-assignment-heading">
                                <div><h3>Employee assignments</h3><p>Choose employees and set each person's planned hours.</p></div>
                                <button type="button" className="cmp-add-assignment-button" onClick={addAssignment}><Plus size={15} /> Add employee</button>
                            </div>

                            {taskForm.assignments.length === 0 ? (
                                <p className="cmp-editor-empty">No employees assigned. Add an employee or save without assignments.</p>
                            ) : (
                                <div className="cmp-editor-assignment-list">
                                    {taskForm.assignments.map((assignment, index) => {
                                        const original = getAssignments(editingTask).find((item) => getId(item?.employeeId) === assignment.employeeId);
                                        const employeeExists = employees.some((employee) => getId(employee) === assignment.employeeId);

                                        return (
                                            <div className="cmp-editor-assignment" key={`assignment-${index}`}>
                                                <label>Employee
                                                    <select value={assignment.employeeId} onChange={(event) => updateAssignment(index, "employeeId", event.target.value)}>
                                                        <option value="">Select employee</option>
                                                        {employees.map((employee) => (
                                                            <option key={getId(employee)} value={getId(employee)}>
                                                                {employee?.name || employee?.fullName || employee?.email || "Unnamed employee"}
                                                            </option>
                                                        ))}
                                                        {assignment.employeeId && !employeeExists && (
                                                            <option value={assignment.employeeId}>{getName(original?.employeeId)}</option>
                                                        )}
                                                    </select>
                                                </label>
                                                <label>Planned hours
                                                    <input type="number" min="0.25" max="1000" step="0.25" value={assignment.plannedHours} onChange={(event) => updateAssignment(index, "plannedHours", event.target.value)} required={Boolean(assignment.employeeId)} />
                                                </label>
                                                <button type="button" className="cmp-remove-assignment-button" onClick={() => removeAssignment(index)} aria-label="Remove employee assignment">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {error && <div className="cmp-message cmp-message-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}

                            <div className="cmp-editor-actions">
                                <button type="button" className="cmp-editor-cancel" onClick={closeTaskEditor} disabled={savingTask}>Cancel</button>
                                <button type="submit" className="cmp-editor-save" disabled={savingTask}>
                                    {savingTask ? <LoaderCircle className="cmp-spin" size={16} /> : <Save size={16} />}
                                    {savingTask ? "Saving..." : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}

export default CTOManagerProfiles;
