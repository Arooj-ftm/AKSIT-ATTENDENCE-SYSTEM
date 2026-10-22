
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    RefreshCw,
    Search,
    ClipboardList,
    FileText,
    Send,
    PlayCircle,
    Timer,
    X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import "./EmployeeTasks.css";
import PageHeader from "../components/PageHeader";

const STATUS_OPTIONS = [
    "To Do",
    "In Progress",
    "Completed",
];

function getId(value) {
    if (!value) return "";

    if (typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return String(value);
}

function formatDate(value) {
    if (!value) return "No deadline";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "No deadline";

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatHours(minutes = 0) {
    const totalMinutes = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return `${hours}h ${remainingMinutes}m`;
}

function getWorkedMinutes(task, employeeId) {
    return (task.timeEntries || []).reduce((total, entry) => {
        return getId(entry.employeeId) === employeeId
            ? total + Number(entry.workedMinutes || 0)
            : total;
    }, 0);
}

function getAssignment(task, employeeId) {
    return (task.assignments || []).find(
        (assignment) => getId(assignment.employeeId) === employeeId
    );
}

function hasDeadlinePassed(deadline) {
    if (!deadline) return false;

    const deadlineEnd = new Date(deadline);

    if (Number.isNaN(deadlineEnd.getTime())) return false;

    deadlineEnd.setHours(23, 59, 59, 999);

    return deadlineEnd.getTime() < Date.now();
}

function getStatus(task, assignment) {
    if (assignment?.status === "Completed") return "Completed";

    if (
        assignment?.status === "Overdue" ||
        (
            hasDeadlinePassed(task.deadline) &&
            assignment?.status !== "Completed"
        )
    ) {
        return "Overdue";
    }

    return assignment?.status || "To Do";
}

export default function EmployeeTasks() {
    const { user, token } = useAuth();

    const employeeId = getId(user?.id || user?._id);

    const [tasks, setTasks] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [timeModal, setTimeModal] = useState(false);
    const [reportModal, setReportModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    const [timeForm, setTimeForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "10:00",
        notes: "",
    });

    const [reportForm, setReportForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        progressPercent: 10,
        workSummary: "",
        blockers: "",
    });

    const loadTasks = useCallback(async (showRefresh = false) => {
        if (showRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const response = await apiRequest("/api/tasks", {}, token);

            const list = Array.isArray(response)
                ? response
                : response.tasks || response.data || [];

            setTasks(list);
        } catch (err) {
            setError(err.message || "Tasks load nahi ho sake.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const myTasks = useMemo(() => {
        if (!employeeId) return [];

        return tasks.filter((task) => {
            const assignment = getAssignment(task, employeeId);

            return (
                assignment &&
                !task.isDeleted &&
                task.deletedAt == null
            );
        });
    }, [tasks, employeeId]);

    const visibleTasks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return myTasks.filter((task) => {
            const assignment = getAssignment(task, employeeId);
            const status = getStatus(task, assignment);

            const matchesSearch =
                !query ||
                String(task.title || "").toLowerCase().includes(query) ||
                String(task.description || "").toLowerCase().includes(query);

            const matchesStatus =
                statusFilter === "All" ||
                status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [myTasks, search, statusFilter, employeeId]);

    const stats = useMemo(() => {
        const result = {
            total: myTasks.length,
            todo: 0,
            progress: 0,
            completed: 0,
            overdue: 0,
        };

        myTasks.forEach((task) => {
            const status = getStatus(
                task,
                getAssignment(task, employeeId)
            );

            if (status === "To Do") result.todo++;
            if (status === "In Progress") result.progress++;
            if (status === "Completed") result.completed++;
            if (status === "Overdue") result.overdue++;
        });

        return result;
    }, [myTasks, employeeId]);

    async function updateStatus(task, status) {
        const taskId = getId(task._id || task.id);

        if (status === "Completed" && hasDeadlinePassed(task.deadline)) {
            setError(
                "Deadline guzar chuki hai. Task complete karne se pehle manager se deadline extend karwao."
            );
            return;
        }

        setActionLoading(`${taskId}-status`);
        setError("");
        setNotice("");

        try {
            await apiRequest(
                `/api/tasks/${taskId}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ status }),
                },
                token
            );

            setNotice("Task status successfully update ho gaya.");
            await loadTasks();
        } catch (err) {
            const message = err.message || "Status update nahi ho saka.";

            setError(
                /deadline|overdue|extension/i.test(message)
                    ? `${message} Zaroorat ho to manager se deadline extend karwao.`
                    : message
            );
        } finally {
            setActionLoading("");
        }
    }

    function openTimeModal(task) {
        if (hasDeadlinePassed(task.deadline)) {
            setError(
                "Deadline guzar chuki hai. Working hours log karne ke liye manager se deadline extension request karo."
            );
            return;
        }

        setSelectedTask(task);

        setTimeForm({
            date: new Date().toISOString().slice(0, 10),
            startTime: "09:00",
            endTime: "10:00",
            notes: "",
        });

        setTimeModal(true);
        setError("");
        setNotice("");
    }

    async function submitTimeEntry(event) {
        event.preventDefault();

        if (!selectedTask) return;

        if (hasDeadlinePassed(selectedTask.deadline)) {
            setError(
                "Deadline guzar chuki hai. Manager se deadline extend karwao."
            );
            return;
        }

        const { date, startTime, endTime, notes } = timeForm;

        if (!date || !startTime || !endTime) {
            setError("Date aur start/end time select karo.");
            return;
        }

        if (date > new Date().toISOString().slice(0, 10)) {
            setError("Future date ke working hours log nahi kar sakte.");
            return;
        }

        if (endTime <= startTime) {
            setError("End time, start time se baad ka hona chahiye.");
            return;
        }

        setActionLoading("time-entry");
        setError("");
        setNotice("");

        try {
            await apiRequest(
                `/api/tasks/${getId(selectedTask._id || selectedTask.id)}/time-entries`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        date,
                        startTime,
                        endTime,
                        notes: notes.trim(),
                    }),
                },
                token
            );

            setTimeModal(false);
            setSelectedTask(null);
            setNotice("Working hours successfully log ho gaye.");

            await loadTasks();
        } catch (err) {
            const message = err.message || "Working hours save nahi ho sake.";

            setError(
                /deadline|overdue|extension/i.test(message)
                    ? `${message} Manager se deadline extension request karo.`
                    : message
            );
        } finally {
            setActionLoading("");
        }
    }

    function openReportModal(task) {
        if (hasDeadlinePassed(task.deadline)) {
            setError(
                "Deadline guzar chuki hai. Daily report update karne ke liye manager se deadline extension request karo."
            );
            return;
        }

        const assignment = getAssignment(task, employeeId);

        setSelectedTask(task);

        setReportForm({
            date: new Date().toISOString().slice(0, 10),
            progressPercent: Math.min(
                99,
                Math.max(0, Number(assignment?.progressPercent || 0))
            ),
            workSummary: "",
            blockers: "",
        });

        setReportModal(true);
        setError("");
        setNotice("");
    }

    async function submitDailyReport(event) {
        event.preventDefault();

        if (!selectedTask) return;

        if (hasDeadlinePassed(selectedTask.deadline)) {
            setError(
                "Deadline guzar chuki hai. Report submit karne se pehle manager se deadline extend karwao."
            );
            return;
        }

        const {
            date,
            progressPercent,
            workSummary,
            blockers,
        } = reportForm;

        if (!date || !workSummary.trim()) {
            setError("Date aur aaj ke kaam ki report required hai.");
            return;
        }

        if (date > new Date().toISOString().slice(0, 10)) {
            setError("Future date ki daily report submit nahi kar sakte.");
            return;
        }

        const progressValue = Number(progressPercent);

        if (
            !Number.isFinite(progressValue) ||
            progressValue < 0 ||
            progressValue > 99
        ) {
            setError(
                "Progress 0 se 99% tak enter karo. 100% ke liye task ko Completed mark karo."
            );
            return;
        }

        setActionLoading("daily-report");
        setError("");
        setNotice("");

        try {
            await apiRequest(
                `/api/tasks/${getId(selectedTask._id || selectedTask.id)}/daily-reports`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        date,
                        progressPercent: progressValue,
                        workSummary: workSummary.trim(),
                        blockers: blockers.trim(),
                    }),
                },
                token
            );

            setReportModal(false);
            setSelectedTask(null);
            setNotice("Daily work report successfully submit ho gayi.");

            await loadTasks();
        } catch (err) {
            const message = err.message || "Daily report submit nahi ho saki.";

            setError(
                /deadline|completed|100%|extension|overdue/i.test(message)
                    ? `${message} Agar deadline guzar chuki hai, manager se deadline extend karwao.`
                    : message
            );
        } finally {
            setActionLoading("");
        }
    }

    return (
        <main className="employee-tasks-page">
            <PageHeader
                eyebrow="EMPLOYEE WORKSPACE"
                title="My Tasks & Projects"
                description="Apne assigned tasks, deadlines aur working hours ek hi jagah manage karo."
                icon={ClipboardList}
                onRefresh={() => loadTasks(true)}
                refreshing={loading || refreshing}
            />


            {error && (
                <div className="employee-tasks-alert employee-tasks-alert-error">
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
                <div className="employee-tasks-alert employee-tasks-alert-success">
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

            <section className="employee-tasks-stats">
                <article className="employee-tasks-stat-card">
                    <div className="employee-tasks-stat-icon stat-icon-blue">
                        <ClipboardList size={21} />
                    </div>
                    <div>
                        <span>Total Tasks</span>
                        <strong>{stats.total}</strong>
                    </div>
                </article>

                <article className="employee-tasks-stat-card">
                    <div className="employee-tasks-stat-icon stat-icon-orange">
                        <Clock3 size={21} />
                    </div>
                    <div>
                        <span>To Do</span>
                        <strong>{stats.todo}</strong>
                    </div>
                </article>

                <article className="employee-tasks-stat-card">
                    <div className="employee-tasks-stat-icon stat-icon-purple">
                        <PlayCircle size={21} />
                    </div>
                    <div>
                        <span>In Progress</span>
                        <strong>{stats.progress}</strong>
                    </div>
                </article>

                <article className="employee-tasks-stat-card">
                    <div className="employee-tasks-stat-icon stat-icon-green">
                        <CheckCircle2 size={21} />
                    </div>
                    <div>
                        <span>Completed</span>
                        <strong>{stats.completed}</strong>
                    </div>
                </article>
            </section>

            <section className="employee-tasks-workspace">
                <div className="employee-tasks-section-heading">
                    <div>
                        <h2>Assigned to me</h2>
                        <p>
                            {myTasks.length} task{myTasks.length === 1 ? "" : "s"} assigned to you
                        </p>
                    </div>

                    {stats.overdue > 0 && (
                        <span className="employee-tasks-overdue-count">
                            {stats.overdue} overdue
                        </span>
                    )}
                </div>

                <div className="employee-tasks-toolbar">
                    <label className="employee-tasks-search">
                        <Search size={18} />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search your tasks..."
                        />
                    </label>

                    <select
                        className="employee-tasks-filter"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        aria-label="Filter tasks by status"
                    >
                        <option value="All">All statuses</option>
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                </div>

                {loading ? (
                    <div className="employee-tasks-empty">
                        <RefreshCw size={25} className="employee-tasks-spinning" />
                        <h3>Loading your tasks...</h3>
                    </div>
                ) : visibleTasks.length === 0 ? (
                    <div className="employee-tasks-empty">
                        <div className="employee-tasks-empty-icon">
                            <ClipboardList size={30} />
                        </div>

                        <h3>
                            {myTasks.length === 0
                                ? "No tasks assigned yet"
                                : "No matching tasks"}
                        </h3>

                        <p>
                            {myTasks.length === 0
                                ? "Jab manager tumhe task assign karega, woh yahan show hoga."
                                : "Search ya status filter change karke dobara check karo."}
                        </p>
                    </div>
                ) : (
                    <div className="employee-tasks-list">
                        {visibleTasks.map((task) => {
                            const taskId = getId(task._id || task.id);
                            const assignment = getAssignment(task, employeeId);
                            const status = getStatus(task, assignment);
                            const workedMinutes = getWorkedMinutes(task, employeeId);

                            const plannedHours = Number(
                                assignment?.plannedHours || 0
                            );

                            const plannedMinutes = plannedHours * 60;


                            const hoursProgress = plannedMinutes > 0
                                ? Math.min(
                                    100,
                                    Math.round((workedMinutes / plannedMinutes) * 100)
                                )
                                : status === "Completed"
                                    ? 100
                                    : 0;

                            // Actual completion progress comes from the saved assignment progress.
                            // Logged hours are displayed separately as planned hours used.
                            const savedProgress = Number(assignment?.progressPercent);

                            const progress = status === "Completed"
                                ? 100
                                : Number.isFinite(savedProgress)
                                    ? Math.min(99, Math.max(0, savedProgress))
                                    : 0;

                            const isCompleted = status === "Completed";
                            const deadlinePassed = hasDeadlinePassed(task.deadline);

                            return (
                                <article
                                    className="employee-task-card"
                                    key={taskId}
                                >
                                    <div className="employee-task-card-top">
                                        <div className="employee-task-card-title">
                                            <span className="employee-task-card-icon">
                                                <ClipboardList size={20} />
                                            </span>

                                            <div>
                                                <h3>{task.title}</h3>
                                                <span className="employee-task-id">
                                                    {task.type === "Project" ? "Project" : "Task"} #{taskId.slice(-6)}
                                                </span>
                                            </div>
                                        </div>

                                        <span
                                            className={`employee-task-status status-${status.toLowerCase().replace(/\s+/g, "-")}`}
                                        >
                                            {status}
                                        </span>
                                    </div>

                                    {task.description && (
                                        <p className="employee-task-description">
                                            {task.description}
                                        </p>
                                    )}

                                    <div className="employee-task-meta">
                                        <div>
                                            <CalendarDays size={16} />
                                            <span>Deadline:</span>
                                            <strong>{formatDate(task.deadline)}</strong>
                                        </div>

                                        <div>
                                            <Timer size={16} />
                                            <span>Planned:</span>
                                            <strong>{plannedHours}h</strong>
                                        </div>

                                        <div>
                                            <Clock3 size={16} />
                                            <span>Logged:</span>
                                            <strong>{formatHours(workedMinutes)}</strong>
                                        </div>
                                    </div>

                                    <div className="employee-task-progress">
                                        <div className="employee-task-progress-labels">
                                            <span>Work completion progress</span>
                                            <strong>{progress}%</strong>
                                        </div>

                                        <div
                                            className="employee-task-progress-track"
                                            role="progressbar"
                                            aria-valuenow={progress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label="Work completion progress"
                                        >
                                            <div
                                                className="employee-task-progress-fill"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="employee-task-progress">
                                        <div className="employee-task-progress-labels">
                                            <span>Planned hours used</span>
                                            <strong>{hoursProgress}%</strong>
                                        </div>

                                        <div
                                            className="employee-task-progress-track"
                                            role="progressbar"
                                            aria-valuenow={hoursProgress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label="Planned hours used"
                                        >
                                            <div
                                                className="employee-task-progress-fill"
                                                style={{ width: `${hoursProgress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="employee-task-card-actions">
                                        <label className="employee-task-status-control">
                                            <span>Update status</span>

                                            <select
                                                value={
                                                    STATUS_OPTIONS.includes(status)
                                                        ? status
                                                        : "In Progress"
                                                }
                                                onChange={(event) =>
                                                    updateStatus(task, event.target.value)
                                                }
                                                disabled={
                                                    isCompleted ||
                                                    actionLoading === `${taskId}-status`
                                                }
                                            >
                                                {STATUS_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <button
                                            type="button"
                                            className="employee-task-log-button"
                                            onClick={() => openReportModal(task)}
                                            disabled={isCompleted || deadlinePassed}
                                            title={
                                                deadlinePassed && !isCompleted
                                                    ? "Deadline pass ho chuki hai. Manager se extension request karein."
                                                    : "Submit daily progress and work report"
                                            }
                                        >
                                            <FileText size={16} />
                                            Daily work report
                                        </button>

                                        <button
                                            type="button"
                                            className="employee-task-log-button"
                                            onClick={() => openTimeModal(task)}
                                            disabled={isCompleted || deadlinePassed}
                                            title={
                                                deadlinePassed && !isCompleted
                                                    ? "Deadline pass ho chuki hai. Manager se extension request karein."
                                                    : "Log working hours"
                                            }
                                        >
                                            <Clock3 size={16} />
                                            Log working hours
                                        </button>
                                    </div>

                                    {deadlinePassed && !isCompleted && (
                                        <div className="employee-task-completed-note">
                                            <AlertCircle size={16} />
                                            Deadline pass ho chuki hai. Further updates ya completion ke liye manager se deadline extend karwao.
                                        </div>
                                    )}

                                    {isCompleted && (
                                        <div className="employee-task-completed-note">
                                            <CheckCircle2 size={16} />
                                            This task is completed.
                                        </div>
                                    )}

                                    {(task.dailyReports || [])
                                        .filter(
                                            (report) =>
                                                getId(report.employeeId) === employeeId
                                        )
                                        .slice(-2)
                                        .reverse()
                                        .map((report, index) => (
                                            <div
                                                className="employee-task-completed-note"
                                                key={`${taskId}-report-${report._id || report.date || index}`}
                                            >
                                                <FileText size={16} />
                                                <span>
                                                    Latest report ({formatDate(report.date)}):{" "}
                                                    {Number(report.progressPercent || 0)}% —{" "}
                                                    {report.workSummary}
                                                </span>
                                            </div>
                                        ))}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {reportModal && (
                <div
                    className="employee-task-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setReportModal(false);
                        }
                    }}
                >
                    <section
                        className="employee-task-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="employee-task-report-title"
                    >
                        <div className="employee-task-modal-header">
                            <div>
                                <span>DAILY PROGRESS</span>
                                <h2 id="employee-task-report-title">
                                    Submit daily work report
                                </h2>
                                <p>{selectedTask?.title}</p>
                            </div>

                            <button
                                type="button"
                                className="employee-task-modal-close"
                                onClick={() => setReportModal(false)}
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            className="employee-task-time-form"
                            onSubmit={submitDailyReport}
                        >
                            <label>
                                Report date
                                <input
                                    type="date"
                                    value={reportForm.date}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(event) =>
                                        setReportForm((previous) => ({
                                            ...previous,
                                            date: event.target.value,
                                        }))
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Work completion progress (%)
                                <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    step="1"
                                    value={reportForm.progressPercent}
                                    onChange={(event) =>
                                        setReportForm((previous) => ({
                                            ...previous,
                                            progressPercent: event.target.value,
                                        }))
                                    }
                                    required
                                />
                                <small>
                                    100% karne ke liye task ko Completed mark karein.
                                    Deadline guzarne par manager extension zaroori hai.
                                </small>
                            </label>

                            <label>
                                Work completed today
                                <textarea
                                    rows={4}
                                    value={reportForm.workSummary}
                                    onChange={(event) =>
                                        setReportForm((previous) => ({
                                            ...previous,
                                            workSummary: event.target.value,
                                        }))
                                    }
                                    placeholder="Aaj task par kya kaam kiya? Details likhein..."
                                    maxLength={3000}
                                    required
                                />
                            </label>

                            <label>
                                Blockers / issues (optional)
                                <textarea
                                    rows={3}
                                    value={reportForm.blockers}
                                    onChange={(event) =>
                                        setReportForm((previous) => ({
                                            ...previous,
                                            blockers: event.target.value,
                                        }))
                                    }
                                    placeholder="Koi issue ya blocker ho to yahan likhein..."
                                    maxLength={2000}
                                />
                            </label>

                            <div className="employee-task-time-actions">
                                <button
                                    type="button"
                                    className="employee-task-cancel-button"
                                    onClick={() => setReportModal(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="employee-task-save-button"
                                    disabled={actionLoading === "daily-report"}
                                >
                                    <Send size={16} />
                                    {actionLoading === "daily-report"
                                        ? "Submitting..."
                                        : "Submit report"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {timeModal && (
                <div
                    className="employee-task-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setTimeModal(false);
                        }
                    }}
                >
                    <section
                        className="employee-task-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="employee-task-modal-title"
                    >
                        <div className="employee-task-modal-header">
                            <div>
                                <span>WORK LOG</span>
                                <h2 id="employee-task-modal-title">
                                    Log working hours
                                </h2>
                                <p>{selectedTask?.title}</p>
                            </div>

                            <button
                                type="button"
                                className="employee-task-modal-close"
                                onClick={() => setTimeModal(false)}
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            className="employee-task-time-form"
                            onSubmit={submitTimeEntry}
                        >
                            <label>
                                Work date
                                <input
                                    type="date"
                                    value={timeForm.date}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(event) =>
                                        setTimeForm((previous) => ({
                                            ...previous,
                                            date: event.target.value,
                                        }))
                                    }
                                    required
                                />
                            </label>

                            <div className="employee-task-time-grid">
                                <label>
                                    Start time
                                    <input
                                        type="time"
                                        value={timeForm.startTime}
                                        onChange={(event) =>
                                            setTimeForm((previous) => ({
                                                ...previous,
                                                startTime: event.target.value,
                                            }))
                                        }
                                        required
                                    />
                                </label>

                                <label>
                                    End time
                                    <input
                                        type="time"
                                        value={timeForm.endTime}
                                        onChange={(event) =>
                                            setTimeForm((previous) => ({
                                                ...previous,
                                                endTime: event.target.value,
                                            }))
                                        }
                                        required
                                    />
                                </label>
                            </div>

                            <label>
                                Work notes (optional)
                                <textarea
                                    rows={3}
                                    value={timeForm.notes}
                                    onChange={(event) =>
                                        setTimeForm((previous) => ({
                                            ...previous,
                                            notes: event.target.value,
                                        }))
                                    }
                                    placeholder="What did you work on?"
                                    maxLength={1000}
                                />
                            </label>

                            <div className="employee-task-time-actions">
                                <button
                                    type="button"
                                    className="employee-task-cancel-button"
                                    onClick={() => setTimeModal(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="employee-task-save-button"
                                    disabled={actionLoading === "time-entry"}
                                >
                                    {actionLoading === "time-entry"
                                        ? "Saving..."
                                        : "Save work log"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}
