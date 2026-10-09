
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Plus, Search, Clock3, CalendarDays, ChevronDown, X, User, Users,
    Check, CheckCircle2, Pencil, Trash2, PlayCircle, ClipboardList,
    ShieldCheck, AlertTriangle, Send,
} from "lucide-react";

import {
    initialTasks,
    createTask,
    getTaskProgress,
    getEmployeeProgress,
    getEmployeeHours,
    getEmployeeDailyHours,
    getEmployeePlannedHours,
    getEmployeeAllowedHours,
    hasExceededEmployeeAllowance,
    getTaskStatus,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    isValidTimeEntry,
    TASK_STATUS,
} from "../data/tasksData";

import "./Tasks.css";

const today = () => new Date().toISOString().split("T")[0];

const getName = (employee) =>
    employee?.name || employee?.fullName || "Unknown employee";

export default function Tasks({
    team = [],
    role = "manager",
    onRoleChange,
}) {
    const [tasks, setTasks] = useState(initialTasks);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [managerAlerts, setManagerAlerts] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [roleMenuOpen, setRoleMenuOpen] = useState(false);
    const roleMenuRef = useRef(null);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [timeTask, setTimeTask] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);

    const [form, setForm] = useState({
        title: "",
        description: "",
        deadline: "",
        plannedHours: "",
        employeeIds: [],
        plannedHoursByEmployee: {},
    });

    const [timeForm, setTimeForm] = useState({
        date: today(),
        startTime: "",
        endTime: "",
    });

    const currentEmployee =
        team.find((employee) =>
            employee.role?.toLowerCase().includes("employee")
        ) || team[0] || null;

    const currentEmployeeId = currentEmployee?.id;

    const managers = useMemo(
        () =>
            team.filter((employee) => {
                const r = employee.role?.toLowerCase() || "";
                return (
                    r.includes("manager") ||
                    r.includes("hr") ||
                    r.includes("ceo") ||
                    r.includes("admin")
                );
            }),
        [team]
    );

    const employees = useMemo(
        () =>
            team.filter((employee) => {
                const r = employee.role?.toLowerCase() || "";
                return !(
                    r.includes("manager") ||
                    r.includes("hr") ||
                    r.includes("ceo") ||
                    r.includes("admin")
                );
            }),
        [team]
    );

    const getEmployeeName = (employeeId) => {
        const employee = team.find(
            (item) => String(item.id) === String(employeeId)
        );
        return getName(employee);
    };

    // Each employee has their own planned time and 15% allowance.
    const getAllowedHours = (task, employeeId) =>
        getEmployeeAllowedHours(task, employeeId);

    const isTimeExceeded = (task, employeeId) =>
        hasExceededEmployeeAllowance(task, employeeId);

    const getExceededHours = (task, employeeId) => {
        const actual = getEmployeeHours(task, employeeId);
        return Math.max(
            0,
            actual - getAllowedHours(task, employeeId)
        );
    };

    const notifyManager = (task, employeeId) => {
        const alertId = `${task.id}-${employeeId}`;

        setManagerAlerts((current) => {
            if (current.some((alert) => alert.id === alertId)) {
                return current;
            }

            return [
                ...current,
                {
                    id: alertId,
                    taskId: task.id,
                    taskTitle: task.title,
                    employeeId,
                    employeeName: getEmployeeName(employeeId),
                    managerId: task.managerId,
                    actualHours: getEmployeeHours(task, employeeId),
                    plannedHours: getEmployeePlannedHours(task, employeeId),
                    allowedHours: getAllowedHours(task, employeeId),
                    createdAt: new Date().toISOString(),
                },
            ];
        });
    };

    const visibleTasks = useMemo(
        () =>
            tasks.filter((task) => {
                const status = getTaskStatus(task);

                const matchesStatus =
                    statusFilter === "All" || status === statusFilter;

                const matchesSearch =
                    `${task.title} ${task.description || ""}`
                        .toLowerCase()
                        .includes(search.toLowerCase());

                if (role === "employee") {
                    const assigned = task.employeeIds?.some(
                        (id) => String(id) === String(currentEmployeeId)
                    );
                    if (!assigned) return false;
                }

                return matchesStatus && matchesSearch;
            }),
        [tasks, role, currentEmployeeId, statusFilter, search]
    );

    const stats = useMemo(() => {
        const relevantTasks =
            role === "employee"
                ? tasks.filter((task) =>
                    task.employeeIds?.some(
                        (id) => String(id) === String(currentEmployeeId)
                    )
                )
                : tasks;

        return {
            total: relevantTasks.length,
            inProgress: relevantTasks.filter(
                (task) => getTaskStatus(task) === TASK_STATUS.IN_PROGRESS
            ).length,
            completed: relevantTasks.filter(
                (task) => getTaskStatus(task) === TASK_STATUS.COMPLETED
            ).length,
            overdue: relevantTasks.filter(
                (task) => getTaskStatus(task) === TASK_STATUS.OVERDUE
            ).length,
        };
    }, [tasks, role, currentEmployeeId]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (
                roleMenuRef.current &&
                !roleMenuRef.current.contains(event.target)
            ) {
                setRoleMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () =>
            document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const resetTaskForm = () => {
        setForm({
            title: "",
            description: "",
            deadline: "",
            plannedHours: "",
            employeeIds: [],
            plannedHoursByEmployee: {},
        });
    };

    const openCreateTask = () => {
        resetTaskForm();
        setShowCreate(true);
    };

    const toggleEmployee = (employeeId) => {
        setForm((current) => {
            const exists = current.employeeIds.some(
                (id) => String(id) === String(employeeId)
            );

            const nextIds = exists
                ? current.employeeIds.filter(
                    (id) => String(id) !== String(employeeId)
                )
                : [...current.employeeIds, employeeId];

            const nextHours = { ...current.plannedHoursByEmployee };

            if (exists) {
                delete nextHours[employeeId];
            }

            return {
                ...current,
                employeeIds: nextIds,
                plannedHoursByEmployee: nextHours,
            };
        });
    };

    const submitTask = (event) => {
        event.preventDefault();

        if (!form.title.trim()) return;

        let employeeIds = form.employeeIds;
        let plannedHoursByEmployee = {
            ...form.plannedHoursByEmployee,
        };

        if (role === "employee") {
            if (currentEmployeeId == null) return;
            employeeIds = [currentEmployeeId];

            plannedHoursByEmployee = {
                [currentEmployeeId]: form.plannedHours,
            };
        }

        if (role === "manager" && employeeIds.length === 0) {
            window.alert("Please select at least one employee.");
            return;
        }

        for (const employeeId of employeeIds) {
            const hours = plannedHoursByEmployee[employeeId];

            if (hours === undefined || hours === "" || Number(hours) <= 0) {
                window.alert(
                    `Please enter planned hours for ${getEmployeeName(employeeId)}.`
                );
                return;
            }
        }

        const newTask = createTask({
            title: form.title,
            description: form.description,
            managerId: managers[0]?.id || currentEmployeeId || null,
            employeeIds,
            deadline: form.deadline,
            plannedHours: form.plannedHours,
            plannedHoursByEmployee,
        });

        setTasks((current) => [newTask, ...current]);
        setShowCreate(false);
        resetTaskForm();
    };

    const openTaskDetails = (task) => {
        setSelectedTask(task);
        setShowDetails(true);
    };

    const openTimeModal = (task, entry = null) => {
        setTimeTask(task);
        setEditingEntry(entry);

        setTimeForm({
            date: entry?.date || today(),
            startTime: entry?.startTime || "",
            endTime: entry?.endTime || "",
        });

        setShowTimeModal(true);
    };

    const closeTimeModal = () => {
        setShowTimeModal(false);
        setTimeTask(null);
        setEditingEntry(null);
        setTimeForm({
            date: today(),
            startTime: "",
            endTime: "",
        });
    };

    const saveTimeEntry = (event) => {
        event.preventDefault();
        if (!timeTask || currentEmployeeId == null) return;

        const entry = {
            date: timeForm.date,
            startTime: timeForm.startTime,
            endTime: timeForm.endTime,
        };

        setTasks((currentTasks) =>
            currentTasks.map((task) => {
                if (task.id !== timeTask.id) return task;

                if (editingEntry) {
                    return updateTimeEntry(
                        task,
                        currentEmployeeId,
                        editingEntry.id,
                        entry
                    );
                }

                return addTimeEntry(task, currentEmployeeId, entry);
            })
        );

        closeTimeModal();
    };

    const removeTimeEntry = (task, entryId) => {
        if (currentEmployeeId == null) return;

        setTasks((currentTasks) =>
            currentTasks.map((currentTask) =>
                currentTask.id === task.id
                    ? deleteTimeEntry(currentTask, currentEmployeeId, entryId)
                    : currentTask
            )
        );
    };

    const activeSelectedTask =
        tasks.find((task) => task.id === selectedTask?.id) ||
        selectedTask;

    const getTaskEntries = (task, employeeId) =>
        task?.timeEntries?.[employeeId] || [];

    const assignments = useMemo(
        () =>
            tasks.flatMap((task) =>
                (task.employeeIds || []).map((employeeId) => ({
                    task,
                    employeeId,
                }))
            ),
        [tasks]
    );

    const exceededAssignments = assignments.filter(
        ({ task, employeeId }) => isTimeExceeded(task, employeeId)
    );

    return (
        <main className="tasks-page">
            {/* HERO */}

            <section className="tasks-hero">
                <div className="tasks-hero-content">
                    <div className="tasks-hero-left">
                        <div className="tasks-hero-kicker">TASKS</div>
                        <h1>{role === "hr" ? "HR Task Monitoring" : "My Tasks"}</h1>
                        <p>
                            {role === "hr"
                                ? "Monitor each employee's working hours and task progress."
                                : role === "manager"
                                    ? "Create tasks, set individual employee hours and monitor progress."
                                    : "View your assigned work and log your working hours."}
                        </p>
                    </div>

                    <div className="tasks-hero-right">
                        <div
                            className={`tasks-role-dropdown ${roleMenuOpen ? "open" : ""}`}
                            ref={roleMenuRef}
                        >
                            <button
                                type="button"
                                className="tasks-role-trigger"
                                onClick={() => setRoleMenuOpen((value) => !value)}
                            >
                                <div className="tasks-role-icon">
                                    {role === "hr" ? (
                                        <ShieldCheck size={20} />
                                    ) : role === "manager" ? (
                                        <Users size={20} />
                                    ) : (
                                        <User size={20} />
                                    )}
                                </div>

                                <div className="tasks-role-text">
                                    <span>Viewing as</span>
                                    <strong>
                                        {role === "hr"
                                            ? "HR"
                                            : role === "manager"
                                                ? "Manager"
                                                : "Employee"}
                                    </strong>
                                </div>

                                <ChevronDown size={19} className="tasks-role-chevron" />
                            </button>

                            <AnimatePresence>
                                {roleMenuOpen && (
                                    <motion.div
                                        className="tasks-role-menu"
                                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                        transition={{ duration: 0.16 }}
                                    >
                                        {[
                                            {
                                                value: "employee",
                                                label: "Employee",
                                                sub: "My workspace",
                                                Icon: User,
                                            },
                                            {
                                                value: "manager",
                                                label: "Manager",
                                                sub: "Team management",
                                                Icon: Users,
                                            },
                                            {
                                                value: "hr",
                                                label: "HR",
                                                sub: "Company-wide monitoring",
                                                Icon: ShieldCheck,
                                            },
                                        ].map(({ value, label, sub, Icon }) => (
                                            <button
                                                type="button"
                                                key={value}
                                                className={`tasks-role-option ${role === value ? "selected" : ""
                                                    }`}
                                                onClick={() => {
                                                    onRoleChange?.(value);
                                                    setRoleMenuOpen(false);
                                                }}
                                            >
                                                <div className="tasks-role-option-icon">
                                                    <Icon size={18} />
                                                </div>
                                                <div className="tasks-role-option-content">
                                                    <strong>{label}</strong>
                                                    <span>{sub}</span>
                                                </div>
                                                {role === value && (
                                                    <Check size={19} className="tasks-role-check" />
                                                )}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {role !== "hr" && (
                            <button className="primary-btn" onClick={openCreateTask}>
                                <Plus size={17} />
                                {role === "manager" ? "Create Task" : "Create My Task"}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* HR DASHBOARD: one row per employee-task assignment */}

            {role === "hr" && (
                <section className="hr-monitoring">
                    <div className="hr-monitoring-heading">
                        <div>
                            <h2>Employee Task Monitoring</h2>
                            <p>
                                Each employee is checked against their own planned hours.
                            </p>
                        </div>
                        <div className="hr-monitoring-icon">
                            <ShieldCheck size={23} />
                        </div>
                    </div>

                    <div className="hr-summary-grid">
                        <div className="hr-summary-card">
                            <span>Total assignments</span>
                            <strong>{assignments.length}</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>Time exceeded</span>
                            <strong className="hr-warning-number">
                                {exceededAssignments.length}
                            </strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>Employees assigned</span>
                            <strong>
                                {new Set(assignments.map((item) => String(item.employeeId))).size}
                            </strong>
                        </div>
                    </div>

                    <div className="hr-assignment-list">
                        {assignments.length === 0 ? (
                            <div className="hr-empty">
                                <ClipboardList size={28} />
                                <strong>No assigned tasks yet</strong>
                                <span>Tasks assigned to employees will appear here.</span>
                            </div>
                        ) : (
                            assignments.map(({ task, employeeId }) => {
                                const employee = team.find(
                                    (item) => String(item.id) === String(employeeId)
                                );

                                const planned = getEmployeePlannedHours(task, employeeId);
                                const actual = getEmployeeHours(task, employeeId);
                                const allowed = getAllowedHours(task, employeeId);
                                const progress = getEmployeeProgress(task, employeeId);
                                const exceeded = isTimeExceeded(task, employeeId);
                                const alertId = `${task.id}-${employeeId}`;

                                const deadlineMissed =
                                    task.deadline &&
                                    task.deadline < today() &&
                                    getTaskStatus(task) !== TASK_STATUS.COMPLETED;

                                return (
                                    <article className="hr-assignment-card" key={alertId}>
                                        <div className="hr-assignment-top">
                                            <div className="hr-employee-avatar">
                                                {getName(employee).charAt(0).toUpperCase()}
                                            </div>

                                            <div className="hr-assignment-info">
                                                <strong>{getName(employee)}</strong>
                                                <span>{task.title}</span>
                                                <small>
                                                    Manager: {getEmployeeName(task.managerId)}
                                                </small>
                                            </div>

                                            <div className="hr-assignment-badges">
                                                {exceeded && (
                                                    <span className="hr-alert-badge">
                                                        <AlertTriangle size={13} />
                                                        Time exceeded
                                                    </span>
                                                )}
                                                {deadlineMissed && (
                                                    <span className="hr-deadline-badge">
                                                        Deadline missed
                                                    </span>
                                                )}
                                                {!exceeded && !deadlineMissed && (
                                                    <span className="hr-normal-badge">
                                                        Within limit
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="hr-progress-label">
                                            <span>Individual progress</span>
                                            <strong>{progress}%</strong>
                                        </div>

                                        <div
                                            className="progress-track"
                                            role="progressbar"
                                            aria-valuenow={progress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        >
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>

                                        <div className="hr-hours-grid">
                                            <div>
                                                <span>Deadline</span>
                                                <strong>{task.deadline || "Not set"}</strong>
                                            </div>
                                            <div>
                                                <span>Individual target</span>
                                                <strong>{planned}h</strong>
                                            </div>
                                            <div>
                                                <span>Allowed (+15%)</span>
                                                <strong>{allowed.toFixed(2)}h</strong>
                                            </div>
                                            <div>
                                                <span>Actual</span>
                                                <strong className={exceeded ? "hr-warning-number" : ""}>
                                                    {actual.toFixed(2)}h
                                                </strong>
                                            </div>
                                        </div>

                                        {exceeded && (
                                            <div className="hr-alert-footer">
                                                <div>
                                                    <AlertTriangle size={17} />
                                                    <span>
                                                        Exceeded allowance by{" "}
                                                        {getExceededHours(task, employeeId).toFixed(2)}h
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="secondary-btn"
                                                    disabled={managerAlerts.some(
                                                        (alert) => alert.id === alertId
                                                    )}
                                                    onClick={() => notifyManager(task, employeeId)}
                                                >
                                                    <Send size={15} />
                                                    {managerAlerts.some(
                                                        (alert) => alert.id === alertId
                                                    )
                                                        ? "Manager Notified"
                                                        : "Notify Manager"}
                                                </button>
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </div>
                </section>
            )}

            {/* MANAGER ALERTS */}

            {role === "manager" && managerAlerts.length > 0 && (
                <section className="manager-hr-alerts">
                    <div className="manager-hr-alerts-heading">
                        <AlertTriangle size={20} />
                        <div>
                            <h3>HR Working-Hour Alerts</h3>
                            <p>Assignments flagged for exceeding their individual allowance.</p>
                        </div>
                    </div>

                    {managerAlerts.map((alert) => (
                        <div className="manager-hr-alert-row" key={alert.id}>
                            <div>
                                <strong>{alert.employeeName}</strong>
                                <span>{alert.taskTitle}</span>
                            </div>
                            <div className="manager-hr-alert-hours">
                                <strong>{alert.actualHours.toFixed(2)}h recorded</strong>
                                <span>{alert.allowedHours.toFixed(2)}h allowed</span>
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* STATS */}

            <section className="tasks-stats">
                {[
                    { label: "Total Tasks", value: stats.total, status: "All", Icon: ClipboardList },
                    { label: "In Progress", value: stats.inProgress, status: TASK_STATUS.IN_PROGRESS, Icon: PlayCircle },
                    { label: "Completed", value: stats.completed, status: TASK_STATUS.COMPLETED, Icon: CheckCircle2 },
                    { label: "Overdue", value: stats.overdue, status: TASK_STATUS.OVERDUE, Icon: Clock3 },
                ].map(({ label, value, status, Icon }) => (
                    <button
                        key={label}
                        className={`task-stat-card ${statusFilter === status ? "active" : ""}`}
                        onClick={() => setStatusFilter(status)}
                    >
                        <div className="task-stat-icon"><Icon size={19} /></div>
                        <div><strong>{value}</strong><span>{label}</span></div>
                    </button>
                ))}
            </section>

            {/* SEARCH / FILTER */}

            <section className="tasks-toolbar">
                <div className="tasks-search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                        <button className="search-clear" onClick={() => setSearch("")}>
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="tasks-filters">
                    {[
                        "All",
                        TASK_STATUS.TODO,
                        TASK_STATUS.IN_PROGRESS,
                        TASK_STATUS.COMPLETED,
                        TASK_STATUS.OVERDUE,
                    ].map((status) => (
                        <button
                            key={status}
                            className={statusFilter === status ? "task-filter active" : "task-filter"}
                            onClick={() => setStatusFilter(status)}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </section>

            {/* TASK LIST */}

            {visibleTasks.length === 0 ? (
                <section className="tasks-empty">
                    <div className="empty-icon"><ClipboardList size={28} /></div>
                    <h3>No tasks found</h3>
                    <p>
                        {role === "hr"
                            ? "There are no tasks matching your filters."
                            : role === "manager"
                                ? "Create tasks and assign employees to get started."
                                : "Your assigned tasks will appear here."}
                    </p>
                    {role !== "hr" && (
                        <button className="primary-btn" onClick={openCreateTask}>
                            <Plus size={17} />
                            {role === "manager" ? "Create Task" : "Create My Task"}
                        </button>
                    )}
                </section>
            ) : (
                <section className="tasks-grid">
                    {visibleTasks.map((task) => {
                        const status = getTaskStatus(task);
                        const progress =
                            role === "employee"
                                ? getEmployeeProgress(task, currentEmployeeId)
                                : getTaskProgress(task);
                        const employeeHours = getEmployeeHours(task, currentEmployeeId);
                        const individualPlanned =
                            getEmployeePlannedHours(task, currentEmployeeId);

                        return (
                            <article className="task-card" key={task.id}>
                                <div className="task-card-top">
                                    <span className={`task-status ${status.toLowerCase().replace(/\s+/g, "-")}`}>
                                        {status}
                                    </span>
                                    <button
                                        className="icon-btn"
                                        onClick={() => openTaskDetails(task)}
                                        title="View task"
                                    >
                                        <ClipboardList size={17} />
                                    </button>
                                </div>

                                <h3>{task.title}</h3>
                                {task.description && (
                                    <p className="task-description">{task.description}</p>
                                )}

                                <div className="task-meta">
                                    <span>
                                        <CalendarDays size={15} />
                                        {task.deadline
                                            ? new Date(`${task.deadline}T00:00:00`).toLocaleDateString()
                                            : "No deadline"}
                                    </span>
                                    <span>
                                        <Clock3 size={15} />
                                        {role === "employee"
                                            ? `${individualPlanned}h planned`
                                            : `${task.employeeIds?.length || 0} assigned`}
                                    </span>
                                </div>

                                {role === "manager" && (
                                    <>
                                        <div className="task-assignees">
                                            <Users size={15} />
                                            <span>
                                                {task.employeeIds?.length || 0} employee
                                                {task.employeeIds?.length === 1 ? "" : "s"} assigned
                                            </span>
                                        </div>
                                        <div className="task-progress-header">
                                            <span>Team progress</span><strong>{progress}%</strong>
                                        </div>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                    </>
                                )}

                                {role === "employee" && (
                                    <>
                                        <div className="task-progress-header">
                                            <span>My progress</span><strong>{progress}%</strong>
                                        </div>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                        <div className="task-hours-summary">
                                            <Clock3 size={15} />
                                            <span>{employeeHours.toFixed(2)} hours worked</span>
                                        </div>
                                    </>
                                )}

                                <div className="task-card-footer">
                                    <button className="secondary-btn" onClick={() => openTaskDetails(task)}>
                                        View Details
                                    </button>
                                    {role === "employee" && (
                                        <button className="primary-btn small" onClick={() => openTimeModal(task)}>
                                            <Clock3 size={15} /> Log Time
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}

            {/* CREATE TASK MODAL */}

            {showCreate && (
                <div className="tasks-overlay" onMouseDown={() => setShowCreate(false)}>
                    <div className="task-modal" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{role === "manager" ? "Create New Task" : "Create My Task"}</h2>
                                <p>
                                    {role === "manager"
                                        ? "Assign employees and set each person's planned hours."
                                        : "Create a task for yourself."}
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form className="task-form" onSubmit={submitTask}>
                            <label>
                                Task Title
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                    placeholder="e.g. Prepare monthly report"
                                    required
                                />
                            </label>

                            <label>
                                Description
                                <textarea
                                    value={form.description}
                                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="Describe the task..."
                                    rows={4}
                                />
                            </label>

                            <label>
                                Deadline
                                <input
                                    type="date"
                                    value={form.deadline}
                                    onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
                                />
                            </label>

                            {role === "manager" && (
                                <div className="employee-picker">
                                    <div className="employee-picker-header">
                                        <div>
                                            <strong>Assign Employees</strong>
                                            <span>Select employees and enter individual targets below.</span>
                                        </div>
                                        <span className="selected-count">{form.employeeIds.length} selected</span>
                                    </div>

                                    <div className="employee-picker-list">
                                        {employees.length === 0 ? (
                                            <div className="picker-empty">No employees available.</div>
                                        ) : (
                                            employees.map((employee) => {
                                                const selected = form.employeeIds.some(
                                                    (id) => String(id) === String(employee.id)
                                                );

                                                return (
                                                    <button
                                                        type="button"
                                                        key={employee.id}
                                                        className={selected ? "employee-picker-item selected" : "employee-picker-item"}
                                                        onClick={() => toggleEmployee(employee.id)}
                                                    >
                                                        <div className="employee-picker-avatar">
                                                            {getName(employee).charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="employee-picker-info">
                                                            <strong>{getName(employee)}</strong>
                                                            <span>{employee.role || "Employee"}</span>
                                                        </div>
                                                        <div className="employee-check">
                                                            {selected ? <CheckCircle2 size={19} /> : <span />}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Separate planned-hours input for every selected employee */}

                                    {form.employeeIds.length > 0 && (
                                        <div className="employee-hours-fields">
                                            <h4>Individual Planned Hours</h4>
                                            {form.employeeIds.map((employeeId) => (
                                                <label key={employeeId}>
                                                    {getEmployeeName(employeeId)} — Planned Hours
                                                    <input
                                                        type="number"
                                                        min="0.25"
                                                        step="0.25"
                                                        required
                                                        value={form.plannedHoursByEmployee[employeeId] ?? ""}
                                                        placeholder="e.g. 8"
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                plannedHoursByEmployee: {
                                                                    ...prev.plannedHoursByEmployee,
                                                                    [employeeId]: event.target.value,
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {role === "employee" && (
                                <>
                                    <label>
                                        My Planned Hours
                                        <input
                                            type="number"
                                            min="0.25"
                                            step="0.25"
                                            required
                                            value={form.plannedHours}
                                            onChange={(event) => setForm((prev) => ({ ...prev, plannedHours: event.target.value }))}
                                            placeholder="e.g. 8"
                                        />
                                    </label>
                                    <div className="self-task-note">
                                        <Users size={17} />
                                        <span>This task will automatically be assigned to you.</span>
                                    </div>
                                </>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="secondary-btn" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary-btn">
                                    <Plus size={17} /> Create Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TASK DETAILS MODAL */}

            {showDetails && activeSelectedTask && (
                <div className="tasks-overlay" onMouseDown={() => setShowDetails(false)}>
                    <div
                        className="task-modal task-details-modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div>
                                <span className={`task-status ${getTaskStatus(activeSelectedTask).toLowerCase().replace(/\s+/g, "-")}`}>
                                    {getTaskStatus(activeSelectedTask)}
                                </span>
                                <h2>{activeSelectedTask.title}</h2>
                                {activeSelectedTask.description && <p>{activeSelectedTask.description}</p>}
                            </div>
                            <button className="modal-close" onClick={() => setShowDetails(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="task-detail-meta">
                            <div>
                                <CalendarDays size={17} />
                                <span>Deadline: {activeSelectedTask.deadline || "Not set"}</span>
                            </div>
                            <div>
                                <Users size={17} />
                                <span>{activeSelectedTask.employeeIds?.length || 0} assigned</span>
                            </div>
                        </div>

                        {(role === "manager" || role === "hr") && (
                            <div className="employee-progress-section">
                                <div className="section-heading">
                                    <div>
                                        <h3>Individual Employee Progress</h3>
                                        <p>Each employee is measured against their own planned hours.</p>
                                    </div>
                                    <strong>{getTaskProgress(activeSelectedTask)}%</strong>
                                </div>

                                <div className="employee-progress-list">
                                    {activeSelectedTask.employeeIds?.map((employeeId) => {
                                        const progress = getEmployeeProgress(activeSelectedTask, employeeId);
                                        const worked = getEmployeeHours(activeSelectedTask, employeeId);
                                        const planned = getEmployeePlannedHours(activeSelectedTask, employeeId);
                                        const allowed = getAllowedHours(activeSelectedTask, employeeId);
                                        const exceeded = isTimeExceeded(activeSelectedTask, employeeId);

                                        return (
                                            <div className="employee-progress-row" key={employeeId}>
                                                <div className="employee-row-top">
                                                    <div>
                                                        <strong>{getEmployeeName(employeeId)}</strong>
                                                        <span>
                                                            {worked.toFixed(2)}h worked · {planned}h planned · {allowed.toFixed(2)}h allowed
                                                        </span>
                                                    </div>
                                                    <strong>{progress}%</strong>
                                                </div>
                                                <div className="progress-track">
                                                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                                {exceeded && (
                                                    <div className="hr-alert-footer">
                                                        <div>
                                                            <AlertTriangle size={16} />
                                                            <span>
                                                                Exceeded by {getExceededHours(activeSelectedTask, employeeId).toFixed(2)}h
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {role === "employee" && (
                            <div className="employee-time-section">
                                <div className="section-heading">
                                    <div>
                                        <h3>My Time</h3>
                                        <p>Only completed Start + End entries count toward progress.</p>
                                    </div>
                                    <button className="primary-btn small" onClick={() => openTimeModal(activeSelectedTask)}>
                                        <Plus size={15} /> Add Time
                                    </button>
                                </div>

                                <div className="daily-hours-card">
                                    <div>
                                        <span>Today</span>
                                        <strong>
                                            {getEmployeeDailyHours(activeSelectedTask, currentEmployeeId, today()).toFixed(2)}h
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Total</span>
                                        <strong>{getEmployeeHours(activeSelectedTask, currentEmployeeId).toFixed(2)}h</strong>
                                    </div>
                                    <div>
                                        <span>Progress</span>
                                        <strong>{getEmployeeProgress(activeSelectedTask, currentEmployeeId)}%</strong>
                                    </div>
                                </div>

                                <div className="time-entry-list">
                                    {getTaskEntries(activeSelectedTask, currentEmployeeId).length === 0 ? (
                                        <div className="time-empty">No time entries yet.</div>
                                    ) : (
                                        getTaskEntries(activeSelectedTask, currentEmployeeId).map((entry) => {
                                            const valid = isValidTimeEntry(entry);
                                            const hours =
                                                valid
                                                    ? (new Date(`1970-01-01T${entry.endTime}`) -
                                                        new Date(`1970-01-01T${entry.startTime}`)) / 3600000
                                                    : 0;

                                            return (
                                                <div className={valid ? "time-entry-row" : "time-entry-row incomplete"} key={entry.id}>
                                                    <div className="time-entry-date">
                                                        <CalendarDays size={15} />
                                                        <strong>{entry.date}</strong>
                                                    </div>
                                                    <div className="time-entry-times">
                                                        <span>Start: {entry.startTime || "--:--"}</span>
                                                        <span>End: {entry.endTime || "--:--"}</span>
                                                    </div>
                                                    <div className="time-entry-hours">
                                                        {valid ? `${hours.toFixed(2)}h` : "Incomplete"}
                                                    </div>
                                                    <div className="time-entry-actions">
                                                        <button className="icon-btn" title="Edit" onClick={() => openTimeModal(activeSelectedTask, entry)}>
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button className="icon-btn danger" title="Delete" onClick={() => removeTimeEntry(activeSelectedTask, entry.id)}>
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="secondary-btn" onClick={() => setShowDetails(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TIME ENTRY MODAL */}

            {showTimeModal && timeTask && (
                <div className="tasks-overlay" onMouseDown={closeTimeModal}>
                    <div className="task-modal time-modal" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{editingEntry ? "Edit Time Entry" : "Log Working Time"}</h2>
                                <p>{timeTask.title}</p>
                            </div>
                            <button className="modal-close" onClick={closeTimeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <form className="task-form" onSubmit={saveTimeEntry}>
                            <label>
                                Date
                                <input
                                    type="date"
                                    value={timeForm.date}
                                    onChange={(event) => setTimeForm((prev) => ({ ...prev, date: event.target.value }))}
                                    required
                                />
                            </label>

                            <div className="form-two-columns">
                                <label>
                                    Start Time
                                    <input
                                        type="time"
                                        value={timeForm.startTime}
                                        onChange={(event) => setTimeForm((prev) => ({ ...prev, startTime: event.target.value }))}
                                    />
                                </label>
                                <label>
                                    End Time
                                    <input
                                        type="time"
                                        value={timeForm.endTime}
                                        onChange={(event) => setTimeForm((prev) => ({ ...prev, endTime: event.target.value }))}
                                    />
                                </label>
                            </div>

                            <div className="time-entry-help">
                                <Clock3 size={17} />
                                <span>
                                    Missing Start or End Time means the entry is incomplete and does not count toward progress.
                                </span>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="secondary-btn" onClick={closeTimeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary-btn">
                                    <CheckCircle2 size={17} /> Save Time
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}