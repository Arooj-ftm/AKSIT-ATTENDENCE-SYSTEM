import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    BriefcaseBusiness,
    Building2,
    CalendarCheck,
    CheckCircle2,
    Clock3,
    ListTodo,
    RefreshCw,
    ShieldCheck,
    Users,
    UserRound,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import "./CTODashboard.css";

const getLocalDate = () => {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
};

const normalize = (value) =>
    String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");

const getId = (value) => {
    if (value && typeof value === "object") {
        return String(value._id || value.id || "");
    }
    return String(value || "");
};

const getAssignments = (task) =>
    Array.isArray(task?.assignments) ? task.assignments : [];

const getAssignmentEmployeeId = (assignment) =>
    getId(
        assignment?.employeeId ||
        assignment?.employee?._id ||
        assignment?.employee?.id ||
        assignment?.employee
    );

const getEntryEmployeeId = (entry) =>
    getId(
        entry?.employeeId ||
        entry?.userId ||
        entry?.employee ||
        entry?.user
    );

const getProgress = (assignment) => {
    const value = Number(
        assignment?.progress ??
        assignment?.progressPercentage ??
        assignment?.completionPercentage ??
        0
    );

    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
};

const getTaskStatus = (task, assignment) => {
    const raw = normalize(
        assignment?.status ||
        assignment?.progressStatus ||
        task?.status
    );

    const progress = getProgress(assignment);
    const deadline = task?.deadline ? new Date(task.deadline) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
        raw.includes("complete") ||
        raw === "done" ||
        progress >= 100
    ) {
        return "Completed";
    }

    if (
        raw === "overdue" ||
        (deadline &&
            !Number.isNaN(deadline.getTime()) &&
            deadline < today)
    ) {
        return "Overdue";
    }

    if (
        raw.includes("progress") ||
        raw === "started" ||
        progress > 0
    ) {
        return "In Progress";
    }

    return "To Do";
};

const getWorkedMinutes = (entry) => {
    const directMinutes = Number(
        entry?.workedMinutes ??
        entry?.durationMinutes ??
        entry?.totalWorkedMinutes ??
        0
    );

    if (directMinutes > 0) return directMinutes;

    const hours = Number(entry?.hours ?? entry?.workedHours ?? 0);
    if (hours > 0) return hours * 60;

    const start = entry?.startTime || entry?.checkIn || entry?.clockIn;
    const end = entry?.endTime || entry?.checkOut || entry?.clockOut;

    if (start && end) {
        const difference =
            new Date(end).getTime() - new Date(start).getTime();

        if (Number.isFinite(difference) && difference > 0) {
            return difference / 60000;
        }
    }

    return 0;
};

const formatHours = (minutes) => {
    const hours = Number(minutes || 0) / 60;
    return Number.isFinite(hours) ? `${Number(hours.toFixed(1))}h` : "0h";
};

const formatDate = (value) => {
    if (!value) return "No deadline";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No deadline";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const getDepartment = (employee) =>
    String(employee?.department || "").trim() || "Unassigned";

const getRole = (employee) =>
    normalize(employee?.role || employee?.userRole).replace(/\s+/g, "_");

const getEmployeeName = (employee) =>
    employee?.name || employee?.fullName || "Employee";

const getAttendanceStatus = (record) => {
    const raw = normalize(
        record?.status ||
        record?.attendanceStatus ||
        record?.dayStatus
    );

    if (raw.includes("leave") || raw.includes("holiday")) {
        return "On Leave";
    }

    if (raw === "late" || raw === "late arrival") {
        return "Late";
    }

    if (raw === "half day" || raw === "halfday") {
        return "Half Day";
    }

    if (
        raw === "present" ||
        raw === "checked in" ||
        raw === "checked out" ||
        raw === "completed"
    ) {
        return "Present";
    }

    if (raw === "absent" || raw === "not present") {
        return "Absent";
    }

    if (
        record?.checkIn ||
        record?.checkInTime ||
        record?.checkInAt ||
        record?.clockIn ||
        record?.checkOut ||
        record?.checkOutTime ||
        record?.checkOutAt ||
        record?.clockOut
    ) {
        return "Present";
    }

    return "Absent";
};

const unwrapArray = (response, keys = []) => {
    if (Array.isArray(response)) return response;

    for (const key of keys) {
        if (Array.isArray(response?.[key])) return response[key];
        if (Array.isArray(response?.data?.[key])) return response.data[key];
    }

    if (Array.isArray(response?.data)) return response.data;

    return [];
};

const DONUT_COLORS = {
    completed: "#159a70",
    progress: "#4d7fe5",
    todo: "#e8aa43",
    overdue: "#df5e69",
    present: "#159a70",
    absent: "#df5e69",
    late: "#e8aa43",
    leave: "#8b6bd6",
    half: "#4d7fe5",
};

function DonutChart({ segments, total, centerLabel, centerValue, loading }) {
    let runningTotal = 0;

    const gradientStops = segments.map((segment) => {
        const start = runningTotal;
        const percentage = total > 0 ? (segment.value / total) * 100 : 0;
        runningTotal += percentage;

        return `${segment.color} ${start}% ${runningTotal}%`;
    });

    const hasValues = segments.some((segment) => segment.value > 0);

    return (
        <div
            className={`ctod-donut ${!hasValues ? "ctod-donut-empty" : ""}`}
            style={{
                "--ctod-donut-gradient": hasValues
                    ? `conic-gradient(${gradientStops.join(", ")})`
                    : "conic-gradient(#e9edf4 0% 100%)",
            }}
            role="img"
            aria-label={`${centerLabel}: ${segments
                .map((segment) => `${segment.label} ${segment.value}`)
                .join(", ")}`}
        >
            <div className="ctod-donut-hole">
                <strong>{loading ? "—" : centerValue}</strong>
                <span>{centerLabel}</span>
            </div>
        </div>
    );
}

function ChartLegend({ items, loading }) {
    return (
        <div className="ctod-legend">
            {items.map((item) => (
                <div className="ctod-legend-row" key={item.label}>
                    <span
                        className="ctod-legend-dot"
                        style={{ background: item.color }}
                    />
                    <span className="ctod-legend-label">{item.label}</span>
                    <strong>{loading ? "—" : item.value}</strong>
                </div>
            ))}
        </div>
    );
}

export default function CTODashboard() {
    const { user, token } = useAuth();

    const [employees, setEmployees] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceSummary, setAttendanceSummary] = useState(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errors, setErrors] = useState([]);

    const loadDashboard = useCallback(async (showRefresh = false) => {
        if (!token) {
            setErrors(["Your session has expired. Please log in again."]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (showRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setErrors([]);

        const today = getLocalDate();
        const attendanceParams = new URLSearchParams({
            date: today,
            month: today.slice(0, 7),
            view: "daily",
        });

        const results = await Promise.allSettled([
            apiRequest("/api/cto-md/employees", {}, token),
            apiRequest("/api/tasks", { method: "GET" }, token),
            apiRequest(
                `/api/cto-md/company-attendance?${attendanceParams.toString()}`,
                { method: "GET" },
                token
            ),
        ]);

        const messages = [];
        const [employeeResult, taskResult, attendanceResult] = results;

        if (employeeResult.status === "fulfilled") {
            const response = employeeResult.value;

            if (response?.success === false) {
                messages.push(
                    response.message || "Unable to load employee statistics."
                );
            } else {
                setEmployees(unwrapArray(response, ["employees"]));
            }
        } else {
            messages.push(
                employeeResult.reason?.message ||
                "Employee statistics could not be loaded."
            );
        }

        if (taskResult.status === "fulfilled") {
            const response = taskResult.value;

            if (response?.success === false) {
                messages.push(
                    response.message || "Unable to load task statistics."
                );
            } else {
                setTasks(
                    unwrapArray(response, ["tasks"]).filter(
                        (task) => !task?.isDeleted
                    )
                );
            }
        } else {
            messages.push(
                taskResult.reason?.message ||
                "Task statistics could not be loaded."
            );
        }

        if (attendanceResult.status === "fulfilled") {
            const response = attendanceResult.value;

            if (response?.success === false) {
                messages.push(
                    response.message || "Unable to load attendance statistics."
                );
            } else {
                setAttendanceRecords(
                    unwrapArray(response, ["records", "attendance", "rows"])
                );
                setAttendanceSummary(
                    response?.summary || response?.data?.summary || null
                );
            }
        } else {
            messages.push(
                attendanceResult.reason?.message ||
                "Attendance statistics could not be loaded."
            );
        }

        setErrors(messages);
        setLoading(false);
        setRefreshing(false);
    }, [token]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const activeEmployees = useMemo(
        () =>
            employees.filter(
                (employee) =>
                    normalize(employee?.status || "active") === "active"
            ).length,
        [employees]
    );

    const managerCount = useMemo(
        () =>
            employees.filter((employee) => getRole(employee) === "manager")
                .length,
        [employees]
    );

    const departmentStats = useMemo(() => {
        const counts = new Map();

        employees.forEach((employee) => {
            const department = getDepartment(employee);
            counts.set(department, (counts.get(department) || 0) + 1);
        });

        return [...counts.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [employees]);

    const taskEntries = useMemo(
        () =>
            tasks.flatMap((task) => {
                const assignments = getAssignments(task);

                if (!assignments.length) {
                    return [{
                        task,
                        assignment: null,
                        status: getTaskStatus(task, null),
                    }];
                }

                return assignments.map((assignment) => ({
                    task,
                    assignment,
                    status: getTaskStatus(task, assignment),
                }));
            }),
        [tasks]
    );

    const taskStats = useMemo(() => {
        const stats = {
            active: 0,
            completed: 0,
            overdue: 0,
            toDo: 0,
            inProgress: 0,
            assignments: taskEntries.length,
            plannedMinutes: 0,
            actualMinutes: 0,
            progressTotal: 0,
        };

        taskEntries.forEach(({ assignment, status }) => {
            if (status === "Completed") stats.completed += 1;
            if (status === "Overdue") stats.overdue += 1;
            if (status === "To Do") stats.toDo += 1;
            if (status === "In Progress") stats.inProgress += 1;

            if (status !== "Completed") stats.active += 1;

            stats.progressTotal += getProgress(assignment);
            stats.plannedMinutes +=
                Math.max(0, Number(assignment?.plannedHours || 0)) * 60;
        });

        // Count each time entry only once to avoid duplicated logged hours.
        tasks.forEach((task) => {
            const timeEntries = Array.isArray(task?.timeEntries)
                ? task.timeEntries
                : [];

            timeEntries.forEach((entry) => {
                stats.actualMinutes += getWorkedMinutes(entry);
            });
        });

        stats.averageProgress = stats.assignments
            ? Math.round(stats.progressTotal / stats.assignments)
            : 0;

        return stats;
    }, [tasks, taskEntries]);

    const attendanceStats = useMemo(() => {
        const counts = {
            total: employees.length,
            present: 0,
            absent: 0,
            late: 0,
            onLeave: 0,
            halfDay: 0,
        };

        attendanceRecords.forEach((record) => {
            const status = getAttendanceStatus(record);

            if (status === "Present") counts.present += 1;
            if (status === "Absent") counts.absent += 1;
            if (status === "Late") counts.late += 1;
            if (status === "On Leave") counts.onLeave += 1;
            if (status === "Half Day") counts.halfDay += 1;
        });

        return {
            total: Number(attendanceSummary?.totalEmployees ?? counts.total),
            present: Number(attendanceSummary?.present ?? counts.present),
            absent: Number(attendanceSummary?.absent ?? counts.absent),
            late: Number(attendanceSummary?.late ?? counts.late),
            onLeave: Number(
                attendanceSummary?.onLeave ??
                attendanceSummary?.onLeaveCount ??
                counts.onLeave
            ),
            halfDay: Number(attendanceSummary?.halfDay ?? counts.halfDay),
        };
    }, [employees, attendanceRecords, attendanceSummary]);

    const departmentPerformance = useMemo(
        () =>
            departmentStats.map((department) => {
                const departmentEmployees = employees.filter(
                    (employee) =>
                        getDepartment(employee) === department.name
                );

                const employeeIds = new Set(
                    departmentEmployees.map((employee) =>
                        getId(employee._id || employee.id)
                    ).filter(Boolean)
                );

                const entries = taskEntries.filter(({ task, assignment }) => {
                    if (
                        normalize(task?.department) ===
                        normalize(department.name)
                    ) {
                        return true;
                    }

                    const employeeId = getAssignmentEmployeeId(assignment);
                    return Boolean(employeeId && employeeIds.has(employeeId));
                });

                const completed = entries.filter(
                    (entry) => entry.status === "Completed"
                ).length;

                const progress = entries.length
                    ? Math.round(
                        entries.reduce(
                            (sum, entry) =>
                                sum + getProgress(entry.assignment),
                            0
                        ) / entries.length
                    )
                    : 0;

                return {
                    ...department,
                    completed,
                    taskCount: entries.length,
                    progress,
                };
            }),
        [departmentStats, employees, taskEntries]
    );

    const recentTasks = useMemo(
        () =>
            [...tasks]
                .sort((a, b) => {
                    const dateA = new Date(
                        a.updatedAt || a.createdAt || a.deadline || 0
                    ).getTime();
                    const dateB = new Date(
                        b.updatedAt || b.createdAt || b.deadline || 0
                    ).getTime();

                    return dateB - dateA;
                })
                .slice(0, 5),
        [tasks]
    );

    const taskChartItems = [
        {
            label: "Completed",
            value: taskStats.completed,
            color: DONUT_COLORS.completed,
        },
        {
            label: "In Progress",
            value: taskStats.inProgress,
            color: DONUT_COLORS.progress,
        },
        {
            label: "To Do",
            value: taskStats.toDo,
            color: DONUT_COLORS.todo,
        },
        {
            label: "Overdue",
            value: taskStats.overdue,
            color: DONUT_COLORS.overdue,
        },
    ];

    const attendanceChartItems = [
        {
            label: "Present",
            value: attendanceStats.present,
            color: DONUT_COLORS.present,
        },
        {
            label: "Absent",
            value: attendanceStats.absent,
            color: DONUT_COLORS.absent,
        },
        {
            label: "Late",
            value: attendanceStats.late,
            color: DONUT_COLORS.late,
        },
        {
            label: "On leave",
            value: attendanceStats.onLeave,
            color: DONUT_COLORS.leave,
        },
        {
            label: "Half day",
            value: attendanceStats.halfDay,
            color: DONUT_COLORS.half,
        },
    ];

    const taskChartTotal = taskChartItems.reduce(
        (sum, item) => sum + item.value,
        0
    );

    const attendanceChartTotal = attendanceChartItems.reduce(
        (sum, item) => sum + item.value,
        0
    );

    const attendancePercentage = attendanceStats.total > 0
        ? Math.round(
            (attendanceStats.present / attendanceStats.total) * 100
        )
        : 0;

    const loggedVsPlanned = taskStats.plannedMinutes > 0
        ? Math.round(
            (taskStats.actualMinutes / taskStats.plannedMinutes) * 100
        )
        : 0;

    const currentDate = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const isCto = ["cto_md", "cto md"].includes(normalize(user?.role));

    if (!isCto) {
        return (
            <main className="ctod-page">
                <section className="ctod-access-denied">
                    <ShieldCheck size={34} />
                    <h2>Access restricted</h2>
                    <p>
                        This dashboard is available to CTO / Managing Director
                        accounts only.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="ctod-page">
            <PageHeader
                eyebrow="AKSIT GLOBAL · EXECUTIVE OVERVIEW"
                title="CTO / Managing Director Dashboard"
                description="Company-wide insight into workforce, attendance and delivery."
                icon={Activity}
                onRefresh={() => loadDashboard(true)}
                refreshing={refreshing}
                className="ctod-shared-header"
            />



            {errors.length > 0 && (
                <section className="ctod-alert" role="status">
                    <AlertCircle size={19} />
                    <div>
                        <strong>Some dashboard data could not be loaded</strong>
                        <ul>
                            {errors.map((message, index) => (
                                <li key={`${message}-${index}`}>{message}</li>
                            ))}
                        </ul>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadDashboard(true)}
                    >
                        Retry
                    </button>
                </section>
            )}

            <section className="ctod-kpi-grid" aria-label="Company statistics">
                <article className="ctod-kpi-card">
                    <div className="ctod-kpi-top">
                        <span className="ctod-kpi-icon ctod-icon-blue">
                            <Users size={21} />
                        </span>
                        <span className="ctod-kpi-tag">Workforce</span>
                    </div>
                    <strong>{loading ? "—" : employees.length}</strong>
                    <span className="ctod-kpi-label">Total Employees</span>
                    <small>
                        {loading ? "Loading records" : `${activeEmployees} active employees`}
                    </small>
                </article>

                <article className="ctod-kpi-card">
                    <div className="ctod-kpi-top">
                        <span className="ctod-kpi-icon ctod-icon-violet">
                            <UserRound size={21} />
                        </span>
                        <span className="ctod-kpi-tag">Leadership</span>
                    </div>
                    <strong>{loading ? "—" : managerCount}</strong>
                    <span className="ctod-kpi-label">Managers</span>
                    <small>Based on available employee role records</small>
                </article>

                <article className="ctod-kpi-card">
                    <div className="ctod-kpi-top">
                        <span className="ctod-kpi-icon ctod-icon-green">
                            <CalendarCheck size={21} />
                        </span>
                        <span className="ctod-kpi-tag">Attendance</span>
                    </div>
                    <strong>{loading ? "—" : attendanceStats.present}</strong>
                    <span className="ctod-kpi-label">Present Today</span>
                    <small>
                        {loading
                            ? "Loading attendance"
                            : `${attendancePercentage}% of total workforce`}
                    </small>
                </article>

                <article className="ctod-kpi-card">
                    <div className="ctod-kpi-top">
                        <span className="ctod-kpi-icon ctod-icon-orange">
                            <ListTodo size={21} />
                        </span>
                        <span className="ctod-kpi-tag">Delivery</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.active}</strong>
                    <span className="ctod-kpi-label">Active Assignments</span>
                    <small>
                        {loading ? "Loading tasks" : `${tasks.length} total tasks`}
                    </small>
                </article>

                <article className="ctod-kpi-card">
                    <div className="ctod-kpi-top">
                        <span className="ctod-kpi-icon ctod-icon-teal">
                            <CheckCircle2 size={21} />
                        </span>
                        <span className="ctod-kpi-tag">Completed</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.completed}</strong>
                    <span className="ctod-kpi-label">Completed Assignments</span>
                    <small>Across company tasks</small>
                </article>

                <article className="ctod-kpi-card">
                    <div className="ctod-kpi-top">
                        <span className="ctod-kpi-icon ctod-icon-red">
                            <AlertCircle size={21} />
                        </span>
                        <span className="ctod-kpi-tag">Attention</span>
                    </div>
                    <strong>{loading ? "—" : taskStats.overdue}</strong>
                    <span className="ctod-kpi-label">Overdue Assignments</span>
                    <small>Need review and follow-up</small>
                </article>
            </section>

            <section className="ctod-main-grid">
                <article className="ctod-panel">
                    <div className="ctod-panel-heading">
                        <div>
                            <span className="ctod-section-eyebrow">
                                PROJECT DELIVERY
                            </span>
                            <h2>Task status</h2>
                            <p>How company assignments are progressing.</p>
                        </div>
                        <span className="ctod-panel-icon">
                            <BriefcaseBusiness size={20} />
                        </span>
                    </div>

                    <div className="ctod-chart-layout">
                        <DonutChart
                            segments={taskChartItems}
                            total={taskChartTotal}
                            centerLabel="Assignments"
                            centerValue={taskChartTotal}
                            loading={loading}
                        />
                        <ChartLegend
                            items={taskChartItems}
                            loading={loading}
                        />
                    </div>

                    <div className="ctod-panel-insight">
                        <div>
                            <span>Average reported progress</span>
                            <strong>
                                {loading ? "—" : `${taskStats.averageProgress}%`}
                            </strong>
                        </div>
                        <div className="ctod-progress-track">
                            <span
                                style={{
                                    width: `${taskStats.averageProgress}%`,
                                }}
                            />
                        </div>
                    </div>
                </article>

                <article className="ctod-panel">
                    <div className="ctod-panel-heading">
                        <div>
                            <span className="ctod-section-eyebrow">
                                PEOPLE OPERATIONS
                            </span>
                            <h2>Today's attendance</h2>
                            <p>Company-wide attendance status for today.</p>
                        </div>
                        <span className="ctod-panel-icon">
                            <CalendarCheck size={20} />
                        </span>
                    </div>

                    <div className="ctod-chart-layout ctod-attendance-chart-layout">
                        <DonutChart
                            segments={attendanceChartItems}
                            total={attendanceChartTotal}
                            centerLabel="Present"
                            centerValue={`${attendancePercentage}%`}
                            loading={loading}
                        />
                        <ChartLegend
                            items={attendanceChartItems}
                            loading={loading}
                        />
                    </div>

                    <div className="ctod-attendance-total">
                        <span>Total workforce</span>
                        <strong>{loading ? "—" : attendanceStats.total}</strong>
                    </div>
                </article>
            </section>

            <section className="ctod-main-grid ctod-lower-grid">
                <article className="ctod-panel">
                    <div className="ctod-panel-heading">
                        <div>
                            <span className="ctod-section-eyebrow">
                                WORKFORCE DISTRIBUTION
                            </span>
                            <h2>Employees by department</h2>
                            <p>Compare team sizes across the company.</p>
                        </div>
                        <span className="ctod-panel-icon">
                            <Building2 size={20} />
                        </span>
                    </div>

                    {loading ? (
                        <div className="ctod-inline-state">
                            <RefreshCw size={18} className="ctod-spinning" />
                            Loading departments...
                        </div>
                    ) : departmentPerformance.length === 0 ? (
                        <div className="ctod-empty-state">
                            No department records available yet.
                        </div>
                    ) : (
                        <div className="ctod-department-chart">
                            {departmentPerformance.slice(0, 8).map((department) => {
                                const maxCount = Math.max(
                                    ...departmentPerformance.map((item) => item.count),
                                    1
                                );
                                const width = (department.count / maxCount) * 100;

                                return (
                                    <div
                                        className="ctod-department-bar-row"
                                        key={department.name}
                                    >
                                        <div className="ctod-department-bar-heading">
                                            <strong title={department.name}>
                                                {department.name}
                                            </strong>
                                            <span>
                                                {department.count}{" "}
                                                {department.count === 1
                                                    ? "employee"
                                                    : "employees"}
                                            </span>
                                        </div>
                                        <div className="ctod-department-bar-track">
                                            <span style={{ width: `${width}%` }} />
                                        </div>
                                        <div className="ctod-department-meta">
                                            <span>
                                                {department.taskCount
                                                    ? `${department.progress}% average task progress`
                                                    : "No task progress data"}
                                            </span>
                                            {department.taskCount > 0 && (
                                                <span>
                                                    {department.completed} completed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </article>

                <article className="ctod-panel">
                    <div className="ctod-panel-heading">
                        <div>
                            <span className="ctod-section-eyebrow">
                                TIME TRACKING
                            </span>
                            <h2>Planned vs logged hours</h2>
                            <p>Compare assigned time with reported work hours.</p>
                        </div>
                        <span className="ctod-panel-icon">
                            <Clock3 size={20} />
                        </span>
                    </div>

                    <div className="ctod-hours-grid">
                        <div className="ctod-hours-card">
                            <span className="ctod-hours-icon ctod-hours-planned">
                                <CalendarCheck size={19} />
                            </span>
                            <small>Planned hours</small>
                            <strong>
                                {loading ? "—" : formatHours(taskStats.plannedMinutes)}
                            </strong>
                        </div>
                        <div className="ctod-hours-card">
                            <span className="ctod-hours-icon ctod-hours-logged">
                                <Activity size={19} />
                            </span>
                            <small>Logged hours</small>
                            <strong>
                                {loading ? "—" : formatHours(taskStats.actualMinutes)}
                            </strong>
                        </div>
                    </div>

                    <div className="ctod-hours-comparison">
                        <div className="ctod-hours-comparison-heading">
                            <span>Logged time vs planned time</span>
                            <strong>
                                {loading
                                    ? "—"
                                    : taskStats.plannedMinutes > 0
                                        ? `${loggedVsPlanned}%`
                                        : "No plan"}
                            </strong>
                        </div>
                        <div className="ctod-hours-track">
                            <span
                                className={
                                    loggedVsPlanned > 100
                                        ? "ctod-hours-over"
                                        : ""
                                }
                                style={{
                                    width: `${taskStats.plannedMinutes > 0
                                        ? Math.min(100, loggedVsPlanned)
                                        : 0
                                        }%`,
                                }}
                            />
                        </div>
                        <p>
                            {taskStats.plannedMinutes <= 0
                                ? "Planned-hour data will appear when assignments include planned hours."
                                : taskStats.actualMinutes > taskStats.plannedMinutes
                                    ? "Logged hours are above the total planned hours."
                                    : "Compare logged hours with the total planned time."}
                        </p>
                    </div>

                    <div className="ctod-hours-note">
                        <ShieldCheck size={17} />
                        <span>
                            Hours reflect the time-entry records returned by the
                            task API.
                        </span>
                    </div>
                </article>
            </section>

            <section className="ctod-panel ctod-recent-panel">
                <div className="ctod-panel-heading">
                    <div>
                        <span className="ctod-section-eyebrow">
                            RECENT ACTIVITY
                        </span>
                        <h2>Recent company tasks</h2>
                        <p>Recently updated tasks across the company.</p>
                    </div>
                    <span className="ctod-panel-icon">
                        <ListTodo size={20} />
                    </span>
                </div>

                {loading ? (
                    <div className="ctod-inline-state">
                        <RefreshCw size={18} className="ctod-spinning" />
                        Loading tasks...
                    </div>
                ) : recentTasks.length === 0 ? (
                    <div className="ctod-empty-state">
                        No tasks are available to display.
                    </div>
                ) : (
                    <div className="ctod-recent-table-wrap">
                        <table className="ctod-recent-table">
                            <thead>
                                <tr>
                                    <th>Task</th>
                                    <th>Department</th>
                                    <th>Deadline</th>
                                    <th>Assignments</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTasks.map((task, index) => {
                                    const assignments = getAssignments(task);
                                    const statuses = assignments.map((assignment) =>
                                        getTaskStatus(task, assignment)
                                    );

                                    const status = statuses.includes("Overdue")
                                        ? "Overdue"
                                        : statuses.length > 0 &&
                                            statuses.every(
                                                (item) => item === "Completed"
                                            )
                                            ? "Completed"
                                            : statuses.includes("In Progress")
                                                ? "In Progress"
                                                : getTaskStatus(task, null);

                                    return (
                                        <tr
                                            key={
                                                getId(task._id || task.id) ||
                                                `${task.title}-${index}`
                                            }
                                        >
                                            <td>
                                                <div className="ctod-task-name-cell">
                                                    <span className="ctod-task-table-icon">
                                                        <BriefcaseBusiness size={17} />
                                                    </span>
                                                    <div>
                                                        <strong>
                                                            {task.title || "Untitled task"}
                                                        </strong>
                                                        <small>
                                                            {task.type || "Company task"}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{task.department || "Company-wide"}</td>
                                            <td>{formatDate(task.deadline)}</td>
                                            <td>{assignments.length}</td>
                                            <td>
                                                <span
                                                    className={`ctod-task-status ctod-task-status-${normalize(
                                                        status
                                                    ).replace(/\s+/g, "-")}`}
                                                >
                                                    <i />
                                                    {status}
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

            <footer className="ctod-footer-note">
                <ShieldCheck size={17} />
                <span>
                    Company-wide executive overview · Figures reflect data
                    available from connected backend APIs.
                </span>
            </footer>
        </main>
    );
}