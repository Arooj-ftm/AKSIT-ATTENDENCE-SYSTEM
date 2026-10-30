
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CalendarCheck,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Clock3,
    LayoutDashboard,
    RefreshCw,
    Target,
    Timer,
    TrendingUp,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./EmployeeDashboard.css";

const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getArray = (data, keys = []) => {
    if (Array.isArray(data)) return data;

    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
    }

    if (Array.isArray(data?.data)) return data.data;

    return [];
};

const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const getDurationMinutes = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();

    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
    ) {
        return 0;
    }

    return Math.floor((end - start) / 60000);
};

const formatHours = (minutes) => {
    const safeMinutes = Math.max(0, Math.floor(minutes || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;

    return remainingMinutes
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
};

const formatPlannedHours = (hours) => {
    const safeHours = Math.max(0, toNumber(hours));
    return `${Number(safeHours.toFixed(1))}h`;
};

const formatDate = (value) => {
    if (!value) return "No deadline";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "No deadline";

    return date.toLocaleDateString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const getTaskStatus = (task) => {
    const status = String(task?.status || "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    if (status === "completed" || status === "complete") {
        return "completed";
    }

    if (status === "overdue") return "overdue";

    if (status === "in_progress" || status === "inprogress") {
        return "in_progress";
    }

    if (task?.deadline || task?.dueDate || task?.endDate) {
        const deadline = new Date(
            task.deadline || task.dueDate || task.endDate
        );
        const today = new Date();

        today.setHours(0, 0, 0, 0);
        deadline.setHours(0, 0, 0, 0);

        if (
            !Number.isNaN(deadline.getTime()) &&
            deadline < today &&
            toNumber(task.progressPercent) < 100
        ) {
            return "overdue";
        }
    }

    return "to_do";
};

const getStatusLabel = (status) => {
    const labels = {
        completed: "Completed",
        in_progress: "In Progress",
        to_do: "To Do",
        overdue: "Overdue",
    };

    return labels[status] || "To Do";
};

const getTaskDeadline = (task) =>
    task?.deadline || task?.dueDate || task?.endDate || null;

const getTaskProgress = (task, assignment) => {
    const value =
        assignment?.progressPercent ??
        task?.progressPercent ??
        assignment?.progress ??
        task?.progress ??
        0;

    return Math.min(100, Math.max(0, toNumber(value)));
};

const getAssignments = (task) =>
    Array.isArray(task?.assignments) ? task.assignments : [];

const getUserIdentifiers = (user) =>
    [
        user?._id,
        user?.id,
        user?.userId,
        user?.employeeId,
    ]
        .filter(Boolean)
        .map(String);

const getAssignmentUser = (assignment) =>
    assignment?.employee ||
    assignment?.user ||
    assignment?.employeeId ||
    assignment?.userId ||
    assignment?.assignee ||
    null;

const getAssignmentUserId = (assignment) => {
    const person = getAssignmentUser(assignment);

    if (person && typeof person === "object") {
        return (
            person._id ||
            person.id ||
            person.userId ||
            person.employeeId
        );
    }

    return person;
};

const getAssignmentForUser = (task, identifiers) => {
    return (
        getAssignments(task).find((assignment) =>
            identifiers.includes(
                String(getAssignmentUserId(assignment) || "")
            )
        ) || null
    );
};

function identifiersMatch(entryUserId, assignment) {
    const assignedId = getAssignmentUserId(assignment);

    if (!assignedId) return true;

    const entryId =
        entryUserId && typeof entryUserId === "object"
            ? entryUserId._id || entryUserId.id || ""
            : entryUserId;

    return String(entryId) === String(assignedId);
}

const getTaskHours = (task, assignment) => {
    const planned = toNumber(
        assignment?.plannedHours ??
        assignment?.estimatedHours ??
        assignment?.hoursPlanned ??
        0
    );

    const entries = Array.isArray(assignment?.timeEntries)
        ? assignment.timeEntries
        : Array.isArray(task?.timeEntries)
            ? task.timeEntries
            : [];

    const logged = entries.reduce((total, entry) => {
        const entryUserId =
            entry?.employeeId?._id ||
            entry?.employeeId ||
            entry?.userId?._id ||
            entry?.userId;

        if (
            entryUserId &&
            !identifiersMatch(entryUserId, assignment)
        ) {
            return total;
        }

        return total + toNumber(
            entry?.hours ??
            entry?.durationHours ??
            entry?.loggedHours ??
            0
        );
    }, 0);

    return { planned, logged };
};

const getOwnTaskRows = (tasks, identifiers) => {
    const rows = [];

    for (const task of tasks) {
        const assignments = getAssignments(task);
        const assignment = getAssignmentForUser(task, identifiers);

        if (assignments.length > 0 && !assignment) continue;

        const progress = getTaskProgress(task, assignment);

        const status = getTaskStatus({
            ...task,
            deadline: getTaskDeadline(task),
            progressPercent: progress,
        });

        rows.push({
            ...task,
            _dashboardAssignment: assignment,
            _dashboardProgress: progress,
            _dashboardStatus: status,
        });
    }

    return rows;
};

const getDonutBackground = (segments) => {
    const total = segments.reduce(
        (sum, segment) => sum + segment.value,
        0
    );

    if (!total) {
        return "conic-gradient(#e9edf4 0% 100%)";
    }

    let current = 0;

    const stops = segments.map((segment) => {
        const start = current;
        current += (segment.value / total) * 100;

        return `${segment.color} ${start}% ${current}%`;
    });

    return `conic-gradient(${stops.join(", ")})`;
};

function DonutChart({ segments, total, label }) {
    const background = getDonutBackground(segments);

    return (
        <div
            className={`employee-donut ${
                total === 0 ? "employee-donut-empty" : ""
            }`}
            style={{
                "--employee-donut-background": background,
            }}
            role="img"
            aria-label={`${label}: ${total} total`}
        >
            <div className="employee-donut-hole">
                <strong>{total}</strong>
                <span>{label}</span>
            </div>
        </div>
    );
}

function Legend({ segments }) {
    return (
        <div className="employee-legend">
            {segments.map((segment) => (
                <div
                    className="employee-legend-row"
                    key={segment.label}
                >
                    <span
                        className="employee-legend-dot"
                        style={{ background: segment.color }}
                    />
                    <span className="employee-legend-label">
                        {segment.label}
                    </span>
                    <strong>{segment.value}</strong>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ children }) {
    return (
        <div className="employee-empty-state">
            {children}
        </div>
    );
}

export default function EmployeeDashboard({ onNavigate }) {
    const { user, token } = useAuth();

    const [greeting] = useState(() => {
        const hour = new Date().getHours();

        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";

        return "Good evening";
    });

    const [tasks, setTasks] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errors, setErrors] = useState([]);

    const today = getToday();
    const currentMonth = getCurrentMonth();

    const userIdentifiers = useMemo(
        () => getUserIdentifiers(user),
        [user]
    );

    const loadDashboard = useCallback(async (isRefresh = false) => {
        if (!token) {
            setTasks([]);
            setAttendance([]);
            setErrors([
                "Please log in to view your dashboard.",
            ]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setErrors([]);

        try {
            const results = await Promise.allSettled([
                apiRequest("/api/tasks", {}, token),
                apiRequest(
                    `/api/attendance?month=${encodeURIComponent(
                        currentMonth
                    )}`,
                    {},
                    token
                ),
            ]);

            const nextErrors = [];

            if (results[0].status === "fulfilled") {
                const data = results[0].value;

                if (data?.success === false) {
                    nextErrors.push(
                        data.message || "Unable to load tasks."
                    );
                    setTasks([]);
                } else {
                    setTasks(
                        getArray(data, [
                            "tasks",
                            "items",
                            "results",
                        ])
                    );
                }
            } else {
                nextErrors.push(
                    results[0].reason?.message ||
                    "Unable to load tasks."
                );
                setTasks([]);
            }

            if (results[1].status === "fulfilled") {
                const data = results[1].value;

                if (data?.success === false) {
                    nextErrors.push(
                        data.message ||
                        "Unable to load attendance."
                    );
                    setAttendance([]);
                } else {
                    setAttendance(
                        Array.isArray(data?.records)
                            ? data.records
                            : []
                    );
                }
            } else {
                nextErrors.push(
                    results[1].reason?.message ||
                    "Unable to load attendance."
                );
                setAttendance([]);
            }

            setErrors(nextErrors);
        } catch (error) {
            setErrors([
                error?.message ||
                "Unable to refresh dashboard data.",
            ]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, currentMonth]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const ownTasks = useMemo(
        () => getOwnTaskRows(tasks, userIdentifiers),
        [tasks, userIdentifiers]
    );

    const taskStats = useMemo(() => {
        const completed = ownTasks.filter(
            (task) => task._dashboardStatus === "completed"
        ).length;

        const inProgress = ownTasks.filter(
            (task) => task._dashboardStatus === "in_progress"
        ).length;

        const overdue = ownTasks.filter(
            (task) => task._dashboardStatus === "overdue"
        ).length;

        const toDo = ownTasks.filter(
            (task) => task._dashboardStatus === "to_do"
        ).length;

        const averageProgress = ownTasks.length
            ? Math.round(
                ownTasks.reduce(
                    (sum, task) =>
                        sum + task._dashboardProgress,
                    0
                ) / ownTasks.length
            )
            : 0;

        const hours = ownTasks.reduce(
            (sum, task) => {
                const result = getTaskHours(
                    task,
                    task._dashboardAssignment
                );

                return {
                    planned: sum.planned + result.planned,
                    logged: sum.logged + result.logged,
                };
            },
            { planned: 0, logged: 0 }
        );

        return {
            total: ownTasks.length,
            completed,
            inProgress,
            overdue,
            toDo,
            averageProgress,
            plannedHours: hours.planned,
            loggedHours: hours.logged,
        };
    }, [ownTasks]);

    const attendanceStats = useMemo(() => {
        const present = attendance.filter(
            (record) =>
                record.checkIn &&
                record.status !== "on_leave"
        ).length;

        const completed = attendance.filter(
            (record) =>
                record.checkIn &&
                record.checkOut &&
                record.status !== "on_leave"
        ).length;

        const onLeave = attendance.filter(
            (record) => record.status === "on_leave"
        ).length;

        const workingMinutes = attendance.reduce(
            (total, record) => {
                if (
                    !record.checkIn ||
                    record.status === "on_leave"
                ) {
                    return total;
                }

                if (record.checkOut) {
                    return total + getDurationMinutes(
                        record.checkIn,
                        record.checkOut
                    );
                }

                if (record.date === today) {
                    return total + getDurationMinutes(
                        record.checkIn,
                        new Date()
                    );
                }

                return total;
            },
            0
        );

        const todayRecord =
            attendance.find(
                (record) => record.date === today
            ) || null;

        return {
            present,
            completed,
            onLeave,
            workingMinutes,
            todayRecord,
        };
    }, [attendance, today]);

    const taskSegments = [
        {
            label: "Completed",
            value: taskStats.completed,
            color: "#159a70",
        },
        {
            label: "In Progress",
            value: taskStats.inProgress,
            color: "#4d7fe5",
        },
        {
            label: "To Do",
            value: taskStats.toDo,
            color: "#e8aa43",
        },
        {
            label: "Overdue",
            value: taskStats.overdue,
            color: "#df5e69",
        },
    ];

    const attendanceSegments = [
        {
            label: "Completed Days",
            value: attendanceStats.completed,
            color: "#159a70",
        },
        {
            label: "Checked In",
            value: Math.max(
                0,
                attendanceStats.present -
                    attendanceStats.completed
            ),
            color: "#4d7fe5",
        },
        {
            label: "On Leave",
            value: attendanceStats.onLeave,
            color: "#8b6bd6",
        },
    ];

    const recentTasks = useMemo(() => {
        return [...ownTasks]
            .sort((a, b) => {
                const aDate = new Date(
                    getTaskDeadline(a) ||
                    a.updatedAt ||
                    a.createdAt ||
                    0
                ).getTime();

                const bDate = new Date(
                    getTaskDeadline(b) ||
                    b.updatedAt ||
                    b.createdAt ||
                    0
                ).getTime();

                return aDate - bDate;
            })
            .slice(0, 5);
    }, [ownTasks]);

    const weeklyHours = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        const dayOffset = (now.getDay() + 6) % 7;

        startOfWeek.setDate(now.getDate() - dayOffset);
        startOfWeek.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(startOfWeek);

            date.setDate(startOfWeek.getDate() + index);

            const key = `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, "0")}-${String(
                date.getDate()
            ).padStart(2, "0")}`;

            const record = attendance.find(
                (item) => item.date === key
            );

            let minutes = 0;

            if (record?.checkIn) {
                minutes = getDurationMinutes(
                    record.checkIn,
                    record.checkOut ||
                        (key === today ? new Date() : null)
                );
            }

            return {
                key,
                label: date.toLocaleDateString([], {
                    weekday: "short",
                }),
                hours: minutes / 60,
            };
        });
    }, [attendance, today]);

    const maxWeeklyHours = Math.max(
        1,
        ...weeklyHours.map((day) => day.hours)
    );

    const hoursPercent =
        taskStats.plannedHours > 0
            ? Math.min(
                100,
                Math.round(
                    (taskStats.loggedHours /
                        taskStats.plannedHours) *
                        100
                )
            )
            : 0;

    const handleNavigate = (page) => {
        onNavigate?.(page);
    };

    return (
        <main className="employee-dashboard-page">
            <PageHeader
                eyebrow="EMPLOYEE PORTAL"
                title="Employee Dashboard"
                description="Your personal overview of attendance, tasks, progress, and working hours."
                icon={LayoutDashboard}
                onRefresh={() => loadDashboard(true)}
                refreshing={loading || refreshing}
            />

            <section className="employee-welcome-row">
                <div>
                    <span className="employee-welcome-label">
                        YOUR WORKSPACE
                    </span>

                    <h2>
                        {greeting}, {user?.name || "Employee"}!
                    </h2>

                    <p>
                        Here is your personal work summary for this month.
                    </p>
                </div>

                <div className="employee-date-chip">
                    <CalendarDays size={17} />
                    <span>
                        {new Date().toLocaleDateString([], {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}
                    </span>
                </div>
            </section>

            {errors.length > 0 && (
                <div
                    className="employee-dashboard-alert"
                    role="alert"
                >
                    <AlertCircle size={18} />

                    <div>
                        <strong>
                            Some dashboard information could not be loaded.
                        </strong>

                        <ul>
                            {errors.map((error, index) => (
                                <li key={`${error}-${index}`}>
                                    {error}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadDashboard(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw size={14} />
                        Retry
                    </button>
                </div>
            )}

            <section
                className="employee-kpi-grid"
                aria-label="My statistics"
            >
                <article className="employee-kpi-card">
                    <div className="employee-kpi-top">
                        <span className="employee-kpi-icon employee-icon-blue">
                            <ClipboardList size={19} />
                        </span>
                        <span className="employee-kpi-tag">Assigned</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.total}</strong>
                    <span className="employee-kpi-label">My Tasks</span>
                    <small>Tasks assigned to your account</small>
                </article>

                <article className="employee-kpi-card">
                    <div className="employee-kpi-top">
                        <span className="employee-kpi-icon employee-icon-green">
                            <CheckCircle2 size={19} />
                        </span>
                        <span className="employee-kpi-tag">Done</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.completed}</strong>
                    <span className="employee-kpi-label">Completed Tasks</span>
                    <small>Assignments marked completed</small>
                </article>

                <article className="employee-kpi-card">
                    <div className="employee-kpi-top">
                        <span className="employee-kpi-icon employee-icon-violet">
                            <Activity size={19} />
                        </span>
                        <span className="employee-kpi-tag">Active</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.inProgress}</strong>
                    <span className="employee-kpi-label">In Progress</span>
                    <small>Tasks currently being worked on</small>
                </article>

                <article className="employee-kpi-card">
                    <div className="employee-kpi-top">
                        <span className="employee-kpi-icon employee-icon-red">
                            <AlertCircle size={19} />
                        </span>
                        <span className="employee-kpi-tag">Attention</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.overdue}</strong>
                    <span className="employee-kpi-label">Overdue Tasks</span>
                    <small>Incomplete tasks past their deadline</small>
                </article>

                <article className="employee-kpi-card">
                    <div className="employee-kpi-top">
                        <span className="employee-kpi-icon employee-icon-teal">
                            <CalendarCheck size={19} />
                        </span>
                        <span className="employee-kpi-tag">This month</span>
                    </div>
                    <strong>{loading ? "—" : attendanceStats.present}</strong>
                    <span className="employee-kpi-label">Days Checked In</span>
                    <small>Recorded attendance days</small>
                </article>

                <article className="employee-kpi-card">
                    <div className="employee-kpi-top">
                        <span className="employee-kpi-icon employee-icon-orange">
                            <Clock3 size={19} />
                        </span>
                        <span className="employee-kpi-tag">This month</span>
                    </div>
                    <strong className="employee-kpi-hours">
                        {loading
                            ? "—"
                            : formatHours(attendanceStats.workingMinutes)}
                    </strong>
                    <span className="employee-kpi-label">Recorded Work Time</span>
                    <small>Calculated from attendance records</small>
                </article>
            </section>

            <section className="employee-main-grid">
                <article className="employee-panel">
                    <div className="employee-panel-heading">
                        <div>
                            <span className="employee-section-eyebrow">
                                TASK OVERVIEW
                            </span>
                            <h2>My Task Progress</h2>
                            <p>
                                Breakdown of your assigned tasks by status.
                            </p>
                        </div>

                        <span className="employee-panel-icon">
                            <Target size={18} />
                        </span>
                    </div>

                    {loading ? (
                        <EmptyState>
                            Loading task statistics...
                        </EmptyState>
                    ) : (
                        <>
                            <div className="employee-chart-layout">
                                <DonutChart
                                    segments={taskSegments}
                                    total={taskStats.total}
                                    label="Total tasks"
                                />
                                <Legend segments={taskSegments} />
                            </div>

                            <div className="employee-progress-summary">
                                <div>
                                    <span>Average task progress</span>
                                    <strong>
                                        {taskStats.averageProgress}%
                                    </strong>
                                </div>

                                <div className="employee-progress-track">
                                    <span
                                        style={{
                                            width: `${taskStats.averageProgress}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </article>

                <article className="employee-panel">
                    <div className="employee-panel-heading">
                        <div>
                            <span className="employee-section-eyebrow">
                                ATTENDANCE OVERVIEW
                            </span>
                            <h2>My Attendance</h2>
                            <p>
                                Your recorded attendance for{" "}
                                {new Date().toLocaleDateString([], {
                                    month: "long",
                                    year: "numeric",
                                })}
                                .
                            </p>
                        </div>

                        <span className="employee-panel-icon">
                            <CalendarCheck size={18} />
                        </span>
                    </div>

                    {loading ? (
                        <EmptyState>
                            Loading attendance...
                        </EmptyState>
                    ) : (
                        <>
                            <div className="employee-chart-layout">
                                <DonutChart
                                    segments={attendanceSegments}
                                    total={attendance.length}
                                    label="Records"
                                />
                                <Legend segments={attendanceSegments} />
                            </div>

                            <div className="employee-attendance-total">
                                <div>
                                    <span>Today's status</span>
                                    <strong>
                                        {attendanceStats.todayRecord?.status === "on_leave"
                                            ? "On Leave"
                                            : attendanceStats.todayRecord?.checkOut
                                                ? "Completed"
                                                : attendanceStats.todayRecord?.checkIn
                                                    ? "Checked In"
                                                    : "Not Checked In"}
                                    </strong>
                                </div>

                                <span className="employee-today-indicator">
                                    <span />
                                    {attendanceStats.todayRecord?.checkIn
                                        ? "Attendance recorded"
                                        : "Awaiting check-in"}
                                </span>
                            </div>
                        </>
                    )}
                </article>
            </section>

            <section className="employee-main-grid">
                <article className="employee-panel">
                    <div className="employee-panel-heading">
                        <div>
                            <span className="employee-section-eyebrow">
                                WEEKLY ACTIVITY
                            </span>
                            <h2>Attendance Hours</h2>
                            <p>
                                Hours calculated from this week's attendance records.
                            </p>
                        </div>

                        <span className="employee-panel-icon">
                            <TrendingUp size={18} />
                        </span>
                    </div>

                    {loading ? (
                        <EmptyState>
                            Loading weekly activity...
                        </EmptyState>
                    ) : (
                        <div className="employee-week-chart">
                            {weeklyHours.map((day) => (
                                <div
                                    className="employee-week-column"
                                    key={day.key}
                                >
                                    <span className="employee-week-value">
                                        {day.hours > 0
                                            ? `${day.hours.toFixed(1)}h`
                                            : "—"}
                                    </span>

                                    <div className="employee-week-track">
                                        <span
                                            style={{
                                                height: `${Math.max(
                                                    day.hours > 0 ? 5 : 0,
                                                    (day.hours / maxWeeklyHours) * 100
                                                )}%`,
                                            }}
                                        />
                                    </div>

                                    <span className="employee-week-label">
                                        {day.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="employee-chart-footnote">
                        Hours are based on recorded check-in and check-out times.
                        Days without a completed record may show partial hours.
                    </p>
                </article>

                <article className="employee-panel">
                    <div className="employee-panel-heading">
                        <div>
                            <span className="employee-section-eyebrow">
                                TIME MANAGEMENT
                            </span>
                            <h2>Planned vs. Logged Hours</h2>
                            <p>
                                Hours recorded against your assigned task estimates.
                            </p>
                        </div>

                        <span className="employee-panel-icon">
                            <Timer size={18} />
                        </span>
                    </div>

                    {loading ? (
                        <EmptyState>
                            Loading work-hour summary...
                        </EmptyState>
                    ) : (
                        <>
                            <div className="employee-hours-grid">
                                <div className="employee-hours-card">
                                    <span className="employee-hours-icon employee-hours-planned">
                                        <Clock3 size={17} />
                                    </span>
                                    <small>Planned Hours</small>
                                    <strong>
                                        {formatPlannedHours(taskStats.plannedHours)}
                                    </strong>
                                </div>

                                <div className="employee-hours-card">
                                    <span className="employee-hours-icon employee-hours-logged">
                                        <CheckCircle2 size={17} />
                                    </span>
                                    <small>Logged Hours</small>
                                    <strong>
                                        {formatPlannedHours(taskStats.loggedHours)}
                                    </strong>
                                </div>
                            </div>

                            <div className="employee-hours-comparison">
                                <div>
                                    <span>Planned hours completed</span>
                                    <strong>
                                        {taskStats.plannedHours > 0
                                            ? `${hoursPercent}%`
                                            : "—"}
                                    </strong>
                                </div>

                                <div className="employee-hours-track">
                                    <span
                                        className={
                                            taskStats.loggedHours >
                                            taskStats.plannedHours
                                                ? "employee-hours-over"
                                                : ""
                                        }
                                        style={{
                                            width: `${hoursPercent}%`,
                                        }}
                                    />
                                </div>

                                <p>
                                    {taskStats.plannedHours > 0
                                        ? `${formatPlannedHours(
                                            Math.max(
                                                0,
                                                taskStats.plannedHours -
                                                    taskStats.loggedHours
                                            )
                                        )} remaining against the current estimate.`
                                        : "No planned-hour estimates are available for your assignments."}
                                </p>
                            </div>
                        </>
                    )}
                </article>
            </section>

            <section className="employee-panel employee-recent-panel">
                <div className="employee-panel-heading">
                    <div>
                        <span className="employee-section-eyebrow">
                            YOUR WORK
                        </span>
                        <h2>Recent Tasks & Projects</h2>
                        <p>
                            Your assignments and current progress.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="employee-view-all"
                        onClick={() =>
                            handleNavigate("Tasks & Projects")
                        }
                    >
                        View all <ArrowRight size={15} />
                    </button>
                </div>

                {loading ? (
                    <EmptyState>Loading your tasks...</EmptyState>
                ) : recentTasks.length === 0 ? (
                    <EmptyState>
                        No assigned tasks are available yet.
                    </EmptyState>
                ) : (
                    <div className="employee-table-wrap">
                        <table className="employee-recent-table">
                            <thead>
                                <tr>
                                    <th>Task / Project</th>
                                    <th>Deadline</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {recentTasks.map((task, index) => {
                                    const status = task._dashboardStatus;
                                    const progress = task._dashboardProgress;
                                    const id =
                                        task._id ||
                                        task.id ||
                                        `${task.title}-${index}`;

                                    return (
                                        <tr key={id}>
                                            <td>
                                                <div className="employee-task-name">
                                                    <span className="employee-task-icon">
                                                        <ClipboardList size={16} />
                                                    </span>

                                                    <div>
                                                        <strong>
                                                            {task.title ||
                                                                task.name ||
                                                                "Untitled Task"}
                                                        </strong>
                                                        <small>
                                                            {task.type || "Task"}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                {formatDate(getTaskDeadline(task))}
                                            </td>

                                            <td>
                                                <div className="employee-table-progress">
                                                    <div>
                                                        <span />
                                                        <span
                                                            style={{
                                                                width: `${progress}%`,
                                                            }}
                                                        />
                                                    </div>

                                                    <strong>{progress}%</strong>
                                                </div>
                                            </td>

                                            <td>
                                                <span
                                                    className={`employee-task-status employee-status-${status.replace("_", "-")}`}
                                                >
                                                    <i />
                                                    {getStatusLabel(status)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
