import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CalendarCheck,
    CalendarDays,
    CheckCircle2,
    Users,
    Search,
    RefreshCw,
    AlertCircle,
    Timer,
    LogIn,
    LogOut,
    ChevronDown,
    Clock3,
    FileText,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./Attendance.css";

const formatDate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getCurrentMonth = () => formatDate().slice(0, 7);

const normalizeMonth = (value) => {
    const match = String(value || "")
        .trim()
        .match(/^(\d{4})-(\d{1,2})$/);

    if (!match) return getCurrentMonth();

    const month = Number(match[2]);

    if (month < 1 || month > 12) return getCurrentMonth();

    const normalized = `${match[1]}-${String(month).padStart(2, "0")}`;

    return normalized > getCurrentMonth()
        ? getCurrentMonth()
        : normalized;
};

const normalizeDate = (value, selectedMonth) => {
    const match = String(value || "")
        .trim()
        .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (!match) return `${selectedMonth}-01`;

    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
    ) {
        return `${selectedMonth}-01`;
    }

    const normalized = formatDate(date);

    if (!normalized.startsWith(`${selectedMonth}-`)) {
        return `${selectedMonth}-01`;
    }

    if (normalized > formatDate()) {
        return formatDate().startsWith(`${selectedMonth}-`)
            ? formatDate()
            : `${selectedMonth}-${String(
                new Date(
                    Number(selectedMonth.slice(0, 4)),
                    Number(selectedMonth.slice(5, 7)),
                    0
                ).getDate()
            ).padStart(2, "0")}`;
    }

    return normalized;
};

const getId = (value) => {
    if (value && typeof value === "object") {
        return String(value._id ?? value.id ?? "");
    }

    return String(value ?? "");
};

const getRecordUserId = (record) =>
    getId(record?.userId ?? record?.user);

const getRecordUserIdForEmployee = (employee) =>
    getId(employee?.user ?? employee);

const getEmployeeName = (employee) =>
    employee?.name ||
    employee?.user?.name ||
    employee?.fullName ||
    "Employee";

const getDepartment = (employee) =>
    employee?.department ||
    employee?.user?.department ||
    "—";

const getRole = (employee) =>
    employee?.designation ||
    employee?.role ||
    employee?.user?.designation ||
    employee?.user?.role ||
    "—";

const normalizeRole = (role) =>
    String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

const isAdminUser = (employee) => {
    const roles = [
        employee?.role,
        employee?.user?.role,
        employee?.designation,
        employee?.user?.designation,
    ].map(normalizeRole);

    return roles.some((role) =>
        [
            "admin",
            "super_admin",
            "superadmin",
            "super_user",
            "superuser",
        ].includes(role)
    );
};

const cleanAttendanceData = (data) => {
    const allEmployees = Array.isArray(data?.employees)
        ? data.employees
        : [];

    const allRecords = Array.isArray(data?.records)
        ? data.records
        : [];

    const adminIds = new Set();

    allEmployees.filter(isAdminUser).forEach((employee) => {
        const employeeId = getId(employee);
        const userId = getId(employee?.user);

        if (employeeId) adminIds.add(employeeId);
        if (userId) adminIds.add(userId);
    });

    const employees = allEmployees.filter(
        (employee) => !isAdminUser(employee)
    );

    const records = allRecords.filter((record) => {
        if (record?.user && typeof record.user === "object") {
            if (isAdminUser(record.user)) return false;
        }

        if (isAdminUser(record)) return false;

        const recordUserId = getRecordUserId(record);

        return !adminIds.has(recordUserId);
    });

    return { employees, records };
};

const formatTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDisplayDate = (dateString) => {
    if (!dateString) return "—";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const getRecordDate = (record) => {
    if (!record?.date) return "";

    const value = String(record.date);

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "" : formatDate(date);
};

const getDurationMinutes = (checkIn, checkOut, now = Date.now()) => {
    if (!checkIn) return 0;

    const start = new Date(checkIn).getTime();
    const end = checkOut ? new Date(checkOut).getTime() : now;

    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

    return Math.max(0, Math.floor((end - start) / 60000));
};

const formatDuration = (minutes) => {
    const safeMinutes = Math.max(0, Math.floor(minutes || 0));

    return `${Math.floor(safeMinutes / 60)}h ${safeMinutes % 60}m`;
};

const getMonthLabel = (month) => {
    if (!month) return "";

    const [year, monthNumber] = month.split("-").map(Number);

    return new Date(year, monthNumber - 1, 1).toLocaleDateString([], {
        month: "long",
        year: "numeric",
    });
};

const getStatus = (record) => {
    if (!record) return "Not checked in";
    if (record.status === "on_leave") return "On leave";
    if (record.checkIn && record.checkOut) return "Completed";
    if (record.checkIn) return "Checked in";

    return "Not checked in";
};

const getStatusClass = (record) => {
    if (!record) return "absent";
    if (record.status === "on_leave") return "leave";
    if (record.checkIn && record.checkOut) return "present";
    if (record.checkIn) return "working";

    return "absent";
};

const getLeaveTypeLabel = (type) => {
    const labels = {
        annual: "Annual Leave",
        casual: "Casual Leave",
        sick: "Sick Leave",
        emergency: "Emergency Leave",
        half_day: "Half Day",
        short: "Short Leave",
    };

    return labels[String(type || "").toLowerCase()] || "Leave";
};

const getLeaveOwner = (request) => {
    const owner = request?.userId ?? request?.user;

    return owner && typeof owner === "object" ? owner : {};
};

export default function CEOAttendance() {
    const { user, token } = useAuth();

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [selectedDate, setSelectedDate] = useState(formatDate);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [employees, setEmployees] = useState([]);
    const [records, setRecords] = useState([]);
    const [todayRecords, setTodayRecords] = useState([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [clockTick, setClockTick] = useState(Date.now());

    const [leaveRequests, setLeaveRequests] = useState([]);
    const [leaveLoading, setLeaveLoading] = useState(true);
    const [leaveActionId, setLeaveActionId] = useState("");
    const [leaveError, setLeaveError] = useState("");
    const [leaveNotice, setLeaveNotice] = useState("");

    const [openSections, setOpenSections] = useState({
        daily: false,
        monthly: false,
        leaves: false,
    });

    const today = formatDate();
    const currentMonth = getCurrentMonth();
    const currentUserId = getId(user);

    const toggleSection = (section) => {
        setOpenSections((previous) => ({
            ...previous,
            [section]: !previous[section],
        }));
    };

    const loadAttendance = useCallback(async () => {
        if (!token) {
            setEmployees([]);
            setRecords([]);
            setTodayRecords([]);
            setLoading(false);
            setError("Please log in to view attendance.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const selectedData = await apiRequest(
                `/api/attendance?month=${encodeURIComponent(selectedMonth)}`,
                {},
                token
            );

            if (selectedData?.success === false) {
                throw new Error(
                    selectedData.message || "Unable to load attendance."
                );
            }

            const selectedClean = cleanAttendanceData(selectedData);

            setEmployees(selectedClean.employees);
            setRecords(selectedClean.records);

            if (selectedMonth === currentMonth) {
                setTodayRecords(selectedClean.records);
            } else {
                const currentData = await apiRequest(
                    `/api/attendance?month=${encodeURIComponent(currentMonth)}`,
                    {},
                    token
                );

                if (currentData?.success === false) {
                    throw new Error(
                        currentData.message ||
                        "Unable to load today's attendance."
                    );
                }

                const currentClean = cleanAttendanceData(currentData);
                setTodayRecords(currentClean.records);
            }
        } catch (err) {
            setEmployees([]);
            setRecords([]);
            setTodayRecords([]);
            setError(err?.message || "Unable to load attendance.");
        } finally {
            setLoading(false);
        }
    }, [token, selectedMonth, currentMonth]);

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    const loadLeaveRequests = useCallback(async () => {
        if (!token) {
            setLeaveRequests([]);
            setLeaveLoading(false);
            setLeaveError("Please log in to view leave requests.");
            return;
        }

        setLeaveLoading(true);
        setLeaveError("");

        try {
            const data = await apiRequest(
                "/api/leaves?status=pending",
                {},
                token
            );

            if (data?.success === false) {
                throw new Error(
                    data.message || "Unable to load leave requests."
                );
            }

            const requests = Array.isArray(data?.requests)
                ? data.requests
                : [];

            setLeaveRequests(
                requests.filter((request) => {
                    const owner = getLeaveOwner(request);

                    const ownerRole = normalizeRole(
                        owner.role ?? owner.designation
                    );

                    const stage = normalizeRole(request.approvalStage);
                    const status = String(
                        request.status || "pending"
                    ).toLowerCase();

                    return (
                        ["hr", "cto_md"].includes(ownerRole) &&
                        stage === "ceo" &&
                        status === "pending"
                    );
                })
            );
        } catch (err) {
            setLeaveError(
                err?.message || "Unable to load leave requests."
            );
        } finally {
            setLeaveLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadLeaveRequests();
    }, [loadLeaveRequests]);

    // Shared PageHeader refresh: reload attendance and HR leave requests.
    const refreshAll = useCallback(async () => {
        setError("");
        setNotice("");
        setLeaveError("");
        setLeaveNotice("");

        await Promise.all([
            loadAttendance(),
            loadLeaveRequests(),
        ]);
    }, [loadAttendance, loadLeaveRequests]);

    const handleLeaveReview = async (requestId, status) => {
        if (!token || leaveActionId || !requestId) return;

        let rejectionReason = "";

        if (status === "rejected") {
            const enteredReason = window.prompt(
                "Please enter the reason for rejecting this leave request:"
            );

            if (enteredReason === null) return;

            rejectionReason = enteredReason.trim();

            if (!rejectionReason) {
                setLeaveError("A rejection reason is required.");
                return;
            }

            if (rejectionReason.length > 1000) {
                setLeaveError(
                    "Rejection reason cannot exceed 1000 characters."
                );
                return;
            }
        }

        setLeaveActionId(requestId);
        setLeaveError("");
        setLeaveNotice("");

        try {
            const result = await apiRequest(
                `/api/leaves/${encodeURIComponent(requestId)}/review`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status,
                        comment:
                            status === "rejected"
                                ? rejectionReason
                                : "",
                        rejectionReason,
                    }),
                },
                token
            );

            if (result?.success === false) {
                throw new Error(
                    result.message || "Unable to review leave request."
                );
            }

            const reviewedRequest = leaveRequests.find(
                (request) =>
                    String(request._id ?? request.id ?? "") ===
                    String(requestId)
            );

            const reviewedOwner = getLeaveOwner(reviewedRequest);
            const reviewedRole = normalizeRole(
                reviewedOwner.role ?? reviewedOwner.designation
            );

            const requesterLabel =
                reviewedRole === "cto_md"
                    ? "CTO / Managing Director"
                    : "HR";

            setLeaveNotice(
                status === "approved"
                    ? `${requesterLabel} leave request approved successfully.`
                    : `${requesterLabel} leave request rejected successfully.`
            );

            await Promise.all([
                loadLeaveRequests(),
                loadAttendance(),
            ]);
        } catch (err) {
            setLeaveError(
                err?.message || "Unable to review leave request."
            );
        } finally {
            setLeaveActionId("");
        }
    };

    const myTodayRecord = useMemo(
        () =>
            todayRecords.find(
                (record) =>
                    getRecordUserId(record) === currentUserId &&
                    getRecordDate(record) === today
            ) || null,
        [todayRecords, currentUserId, today]
    );

    useEffect(() => {
        if (!myTodayRecord?.checkIn || myTodayRecord?.checkOut) return;

        const interval = window.setInterval(() => {
            setClockTick(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, [myTodayRecord?.checkIn, myTodayRecord?.checkOut]);

    useEffect(() => {
        setSelectedDate((previous) => {
            if (previous.startsWith(`${selectedMonth}-`)) {
                if (previous > today) return today;
                return previous;
            }

            const firstDay = `${selectedMonth}-01`;

            return firstDay > today ? today : firstDay;
        });
    }, [selectedMonth, today]);

    const handleAttendanceAction = async (action) => {
        if (!token || actionLoading) return;

        setActionLoading(true);
        setError("");
        setNotice("");

        try {
            const result = await apiRequest(
                `/api/attendance/${action}`,
                {
                    method: "POST",
                    body: JSON.stringify({}),
                },
                token
            );

            if (result?.success === false) {
                throw new Error(
                    result.message ||
                    `Unable to ${action.replace("-", " ")}.`
                );
            }

            setNotice(
                action === "check-in"
                    ? "You have checked in successfully."
                    : "You have checked out successfully."
            );

            await loadAttendance();
        } catch (err) {
            setError(err?.message || "Attendance action failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const recordsForDate = useMemo(
        () => records.filter((record) => getRecordDate(record) === selectedDate),
        [records, selectedDate]
    );

    const recordByEmployee = useMemo(() => {
        const map = new Map();

        recordsForDate.forEach((record) => {
            const id = getRecordUserId(record);

            if (id) map.set(id, record);
        });

        return map;
    }, [recordsForDate]);

    const visibleEmployees = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return employees.filter((employee) => {
            const employeeId = getRecordUserIdForEmployee(employee);
            const record = recordByEmployee.get(employeeId);
            const status = getStatus(record);

            const matchesSearch =
                !normalizedSearch ||
                getEmployeeName(employee)
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                getDepartment(employee)
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                String(getRole(employee))
                    .toLowerCase()
                    .includes(normalizedSearch);

            const matchesStatus =
                statusFilter === "All" ||
                (statusFilter === "Present" &&
                    ["Checked in", "Completed"].includes(status)) ||
                (statusFilter === "Absent" &&
                    status === "Not checked in") ||
                (statusFilter === "On leave" &&
                    status === "On leave");

            return matchesSearch && matchesStatus;
        });
    }, [employees, recordByEmployee, search, statusFilter]);

    const dailyStats = useMemo(() => {
        let present = 0;
        let onLeave = 0;

        recordsForDate.forEach((record) => {
            if (record.status === "on_leave") {
                onLeave += 1;
            } else if (record.checkIn) {
                present += 1;
            }
        });

        return {
            present,
            onLeave,
            absent: Math.max(0, employees.length - present - onLeave),
        };
    }, [recordsForDate, employees.length]);

    const monthlyStats = useMemo(() => {
        const attendanceDays = new Set();
        let completedRecords = 0;
        let totalWorkingMinutes = 0;

        records.forEach((record) => {
            if (!record.checkIn || record.status === "on_leave") return;

            attendanceDays.add(getRecordDate(record));

            totalWorkingMinutes += getDurationMinutes(
                record.checkIn,
                record.checkOut,
                clockTick
            );

            if (record.checkOut) completedRecords += 1;
        });

        return {
            attendanceDays: attendanceDays.size,
            completedRecords,
            totalWorkingMinutes,
        };
    }, [records, clockTick]);

    const employeeMonthSummaries = useMemo(() => {
        const summaryMap = new Map();

        employees.forEach((employee) => {
            const employeeId = getRecordUserIdForEmployee(employee);

            const employeeRecords = records.filter(
                (record) =>
                    getRecordUserId(record) === employeeId &&
                    record.status !== "on_leave" &&
                    record.checkIn
            );

            const totalMinutes = employeeRecords.reduce(
                (total, record) =>
                    total +
                    getDurationMinutes(
                        record.checkIn,
                        record.checkOut,
                        clockTick
                    ),
                0
            );

            summaryMap.set(employeeId, {
                days: employeeRecords.length,
                totalMinutes,
            });
        });

        return summaryMap;
    }, [employees, records, clockTick]);

    const myWorkingMinutes = myTodayRecord?.checkIn
        ? getDurationMinutes(
            myTodayRecord.checkIn,
            myTodayRecord.checkOut,
            clockTick
        )
        : 0;

    const lastDayOfSelectedMonth = new Date(
        Number(selectedMonth.slice(0, 4)),
        Number(selectedMonth.slice(5, 7)),
        0
    ).getDate();

    const maxSelectedDate =
        selectedMonth === currentMonth
            ? today
            : `${selectedMonth}-${String(lastDayOfSelectedMonth).padStart(
                2,
                "0"
            )}`;

    const pendingLeaveCount = leaveRequests.length;

    const accordionButtonStyle = {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "18px 20px",
        border: "1px solid var(--border-color, #e5e7eb)",
        borderRadius: "12px",
        background: "var(--card-bg, #ffffff)",
        color: "inherit",
        cursor: "pointer",
        textAlign: "left",
    };

    const accordionIconStyle = (isOpen) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 180ms ease",
    });

    return (
        <main className="main attendance-page" data-role="ceo">
            <PageHeader
                eyebrow="EXECUTIVE DASHBOARD"
                title="Attendance Overview"
                description="Monitor company-wide attendance, review employee working hours, and manage HR leave approvals in one place."
                icon={CalendarCheck}
                onRefresh={refreshAll}
                refreshing={
                    loading ||
                    leaveLoading ||
                    actionLoading ||
                    Boolean(leaveActionId)
                }
            />

            {error && (
                <div
                    className="attendance-alert attendance-alert-error"
                    role="alert"
                >
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={loadAttendance}
                        disabled={loading}
                    >
                        Try again
                    </button>
                </div>
            )}

            {notice && (
                <div className="attendance-alert" role="status">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                </div>
            )}

            <section className="attendance-section">
                <div className="attendance-section-heading">
                    <div>
                        <h2>Today's Attendance</h2>
                        <p>{formatDisplayDate(today)}</p>
                    </div>

                    <span
                        className={`attendance-status ${myTodayRecord?.status === "on_leave"
                            ? "leave"
                            : myTodayRecord?.checkOut
                                ? "present"
                                : myTodayRecord?.checkIn
                                    ? "working"
                                    : "absent"
                            }`}
                    >
                        {getStatus(myTodayRecord)}
                    </span>
                </div>

                <div className="attendance-stats">
                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <LogIn size={20} />
                        </div>
                        <div>
                            <p>Check-in time</p>
                            <h3>{formatTime(myTodayRecord?.checkIn)}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <p>Check-out time</p>
                            <h3>{formatTime(myTodayRecord?.checkOut)}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <Timer size={20} />
                        </div>
                        <div>
                            <p>Today's working time</p>
                            <h3>{formatDuration(myWorkingMinutes)}</h3>
                        </div>
                    </article>
                </div>

                <div className="attendance-actions">
                    <button
                        type="button"
                        className="attendance-primary-btn"
                        onClick={() => handleAttendanceAction("check-in")}
                        disabled={
                            loading ||
                            actionLoading ||
                            Boolean(myTodayRecord?.checkIn) ||
                            myTodayRecord?.status === "on_leave"
                        }
                    >
                        <LogIn size={17} />
                        {actionLoading && !myTodayRecord?.checkIn
                            ? "Please wait..."
                            : "Check In"}
                    </button>

                    <button
                        type="button"
                        className="attendance-secondary-btn"
                        onClick={() => handleAttendanceAction("check-out")}
                        disabled={
                            loading ||
                            actionLoading ||
                            !myTodayRecord?.checkIn ||
                            Boolean(myTodayRecord?.checkOut) ||
                            myTodayRecord?.status === "on_leave"
                        }
                    >
                        <LogOut size={17} />
                        Check Out
                    </button>
                </div>
            </section>

            <section className="attendance-section">
                <div className="attendance-section-heading">
                    <div>
                        <h2>Company Attendance Summary</h2>
                        <p>
                            Monthly overview for {getMonthLabel(selectedMonth)}.
                        </p>
                    </div>

                    <div className="attendance-month-picker">
                        <CalendarDays size={17} />
                        <input
                            type="month"
                            aria-label="Select attendance month"
                            value={selectedMonth}
                            max={currentMonth}
                            onChange={(event) => {
                                if (event.target.value) {
                                    setSelectedMonth(
                                        normalizeMonth(event.target.value)
                                    );
                                }
                            }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="attendance-empty">
                        <RefreshCw size={22} />
                        <p>Loading company attendance...</p>
                    </div>
                ) : (
                    <>
                        <div className="attendance-stats">
                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p>Active employees</p>
                                    <h3>{employees.length}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <p>Present on selected day</p>
                                    <h3>{dailyStats.present}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <p>Not checked in</p>
                                    <h3>{dailyStats.absent}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <CalendarDays size={20} />
                                </div>
                                <div>
                                    <p>Days with attendance</p>
                                    <h3>{monthlyStats.attendanceDays}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <p>Completed records</p>
                                    <h3>{monthlyStats.completedRecords}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <p>Total company working time</p>
                                    <h3>
                                        {formatDuration(
                                            monthlyStats.totalWorkingMinutes
                                        )}
                                    </h3>
                                </div>
                            </article>
                        </div>

                        {dailyStats.onLeave > 0 && (
                            <p className="attendance-summary-note">
                                {dailyStats.onLeave} employee
                                {dailyStats.onLeave === 1 ? " is" : "s are"}{" "}
                                marked as on leave for the selected date.
                            </p>
                        )}
                    </>
                )}
            </section>

            <section className="attendance-section ceo-accordion-section">
                <button
                    type="button"
                    style={accordionButtonStyle}
                    onClick={() => toggleSection("daily")}
                    aria-expanded={openSections.daily}
                    aria-controls="ceo-daily-attendance-content"
                >
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <span className="attendance-stat-icon">
                            <CalendarDays size={20} />
                        </span>
                        <span>
                            <strong
                                style={{
                                    display: "block",
                                    fontSize: "16px",
                                }}
                            >
                                Daily Attendance Records
                            </strong>
                            <small
                                style={{
                                    display: "block",
                                    marginTop: "5px",
                                    opacity: 0.7,
                                }}
                            >
                                Search employees and review daily attendance
                                status.
                            </small>
                        </span>
                    </span>

                    <span style={accordionIconStyle(openSections.daily)}>
                        <ChevronDown size={21} />
                    </span>
                </button>

                {openSections.daily && (
                    <div
                        id="ceo-daily-attendance-content"
                        className="ceo-accordion-content"
                        style={{ paddingTop: "20px" }}
                    >
                        <div className="attendance-section-heading">
                            <div>
                                <h2>Attendance by Date</h2>
                                <p>
                                    Review employee attendance for{" "}
                                    {formatDisplayDate(selectedDate)}.
                                </p>
                            </div>

                            <div className="attendance-month-picker">
                                <CalendarDays size={17} />
                                <input
                                    type="date"
                                    aria-label="Select attendance date"
                                    value={selectedDate}
                                    min={`${selectedMonth}-01`}
                                    max={maxSelectedDate}
                                    onChange={(event) => {
                                        if (event.target.value) {
                                            setSelectedDate(
                                                normalizeDate(
                                                    event.target.value,
                                                    selectedMonth
                                                )
                                            );
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="attendance-filters">
                            <div className="attendance-search">
                                <Search size={16} />
                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search employee, role or department"
                                    aria-label="Search employees"
                                />
                            </div>

                            <select
                                aria-label="Filter attendance status"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="All">All statuses</option>
                                <option value="Present">
                                    Present / working
                                </option>
                                <option value="Absent">Not checked in</option>
                                <option value="On leave">On leave</option>
                            </select>
                        </div>

                        {loading ? (
                            <div className="attendance-empty">
                                <RefreshCw size={22} />
                                <p>Loading company attendance...</p>
                            </div>
                        ) : visibleEmployees.length === 0 ? (
                            <div className="attendance-empty">
                                <Search size={24} />
                                <h3>No matching employees</h3>
                                <p>
                                    Try changing the search or status filter.
                                </p>
                            </div>
                        ) : (
                            <div className="attendance-table-wrap">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th>Department</th>
                                            <th>Role</th>
                                            <th>Check-in</th>
                                            <th>Check-out</th>
                                            <th>Working time</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleEmployees.map(
                                            (employee, index) => {
                                                const employeeId =
                                                    getRecordUserIdForEmployee(
                                                        employee
                                                    );

                                                const record =
                                                    recordByEmployee.get(
                                                        employeeId
                                                    );

                                                return (
                                                    <tr
                                                        key={
                                                            employeeId || index
                                                        }
                                                    >
                                                        <td>
                                                            <div className="attendance-employee-cell">
                                                                <span className="attendance-avatar">
                                                                    {getEmployeeName(
                                                                        employee
                                                                    )
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase()}
                                                                </span>
                                                                <div>
                                                                    <strong>
                                                                        {getEmployeeName(
                                                                            employee
                                                                        )}
                                                                    </strong>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {getDepartment(
                                                                employee
                                                            )}
                                                        </td>
                                                        <td>
                                                            {getRole(employee)}
                                                        </td>
                                                        <td>
                                                            {formatTime(
                                                                record?.checkIn
                                                            )}
                                                        </td>
                                                        <td>
                                                            {formatTime(
                                                                record?.checkOut
                                                            )}
                                                        </td>
                                                        <td>
                                                            {record?.checkIn
                                                                ? formatDuration(
                                                                    getDurationMinutes(
                                                                        record.checkIn,
                                                                        record.checkOut,
                                                                        clockTick
                                                                    )
                                                                )
                                                                : "—"}
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`attendance-status ${getStatusClass(
                                                                    record
                                                                )}`}
                                                            >
                                                                {getStatus(
                                                                    record
                                                                )}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="attendance-section ceo-accordion-section">
                <button
                    type="button"
                    style={accordionButtonStyle}
                    onClick={() => toggleSection("monthly")}
                    aria-expanded={openSections.monthly}
                    aria-controls="ceo-monthly-hours-content"
                >
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <span className="attendance-stat-icon">
                            <Clock3 size={20} />
                        </span>
                        <span>
                            <strong
                                style={{
                                    display: "block",
                                    fontSize: "16px",
                                }}
                            >
                                Employee Monthly Working Hours
                            </strong>
                            <small
                                style={{
                                    display: "block",
                                    marginTop: "5px",
                                    opacity: 0.7,
                                }}
                            >
                                View each employee's monthly attendance and
                                hours.
                            </small>
                        </span>
                    </span>

                    <span style={accordionIconStyle(openSections.monthly)}>
                        <ChevronDown size={21} />
                    </span>
                </button>

                {openSections.monthly && (
                    <div
                        id="ceo-monthly-hours-content"
                        className="ceo-accordion-content"
                        style={{ paddingTop: "20px" }}
                    >
                        <div className="attendance-section-heading">
                            <div>
                                <h2>Monthly Employee Summary</h2>
                                <p>
                                    Employee-wise totals for{" "}
                                    {getMonthLabel(selectedMonth)}.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="attendance-empty">
                                <RefreshCw size={22} />
                                <p>Loading monthly summaries...</p>
                            </div>
                        ) : (
                            <div className="attendance-table-wrap">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th>Department</th>
                                            <th>Days checked in</th>
                                            <th>Total working hours</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map((employee, index) => {
                                            const employeeId =
                                                getRecordUserIdForEmployee(
                                                    employee
                                                );

                                            const summary =
                                                employeeMonthSummaries.get(
                                                    employeeId
                                                ) || {
                                                    days: 0,
                                                    totalMinutes: 0,
                                                };

                                            return (
                                                <tr
                                                    key={
                                                        employeeId || index
                                                    }
                                                >
                                                    <td>
                                                        {getEmployeeName(
                                                            employee
                                                        )}
                                                    </td>
                                                    <td>
                                                        {getDepartment(
                                                            employee
                                                        )}
                                                    </td>
                                                    <td>{summary.days}</td>
                                                    <td>
                                                        {formatDuration(
                                                            summary.totalMinutes
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {employees.length === 0 && (
                                            <tr>
                                                <td colSpan={4}>
                                                    No employee records
                                                    available.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="attendance-section ceo-accordion-section">
                <button
                    type="button"
                    style={accordionButtonStyle}
                    onClick={() => toggleSection("leaves")}
                    aria-expanded={openSections.leaves}
                    aria-controls="ceo-hr-leave-content"
                >
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <span className="attendance-stat-icon">
                            <FileText size={20} />
                        </span>
                        <span>
                            <strong
                                style={{
                                    display: "block",
                                    fontSize: "16px",
                                }}
                            >
                                HR & CTO / Managing Director Leave Approval                            </strong>
                            <small
                                style={{
                                    display: "block",
                                    marginTop: "5px",
                                    opacity: 0.7,
                                }}
                            >
                                Review HR and CTO / Managing Director leave requests awaiting CEO approval.
                            </small>
                        </span>
                    </span>

                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <span
                            className="attendance-status pending"
                            style={{ whiteSpace: "nowrap" }}
                        >
                            {pendingLeaveCount} pending
                        </span>
                        <span style={accordionIconStyle(openSections.leaves)}>
                            <ChevronDown size={21} />
                        </span>
                    </span>
                </button>

                {openSections.leaves && (
                    <div
                        id="ceo-hr-leave-content"
                        className="ceo-accordion-content"
                        style={{ paddingTop: "20px" }}
                    >
                        <div className="attendance-section-heading">
                            <div>
                                <h2>Pending Leave Requests</h2>                                <p>
                                    Review applications that have reached the
                                    CEO approval stage.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="attendance-secondary-btn"
                                onClick={loadLeaveRequests}
                                disabled={
                                    leaveLoading || Boolean(leaveActionId)
                                }
                            >
                                <RefreshCw
                                    size={16}
                                    className={
                                        leaveLoading ? "ceo-leave-spin" : ""
                                    }
                                />
                                Refresh
                            </button>
                        </div>

                        {leaveError && (
                            <div
                                className="attendance-alert attendance-alert-error"
                                role="alert"
                            >
                                <AlertCircle size={17} />
                                <span>{leaveError}</span>
                                <button
                                    type="button"
                                    onClick={loadLeaveRequests}
                                    disabled={leaveLoading}
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {leaveNotice && (
                            <div className="attendance-alert" role="status">
                                <CheckCircle2 size={17} />
                                <span>{leaveNotice}</span>
                            </div>
                        )}

                        {leaveLoading ? (
                            <div className="attendance-empty">
                                <RefreshCw
                                    size={22}
                                    className="ceo-leave-spin"
                                />
                                <p>Loading HR leave requests...</p>
                            </div>
                        ) : leaveRequests.length === 0 ? (
                            <div className="attendance-empty">
                                <CalendarCheck size={26} />
                                <h3>No pending leave requests</h3>
                                <p>
                                    HR and CTO / Managing Director leave applications will appear here when they reach the CEO approval stage.
                                </p>                                <p>
                                    HR leave applications will appear here when
                                    they reach the CEO approval stage.
                                </p>
                            </div>
                        ) : (
                            <div className="attendance-table-wrap">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th>Requester</th>                                            <th>Leave Type</th>
                                            <th>Dates</th>
                                            <th>Reason</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaveRequests.map((request) => {
                                            const owner = getLeaveOwner(request);
                                            const requestId = String(
                                                request._id ?? request.id ?? ""
                                            );

                                            const leaveType = String(
                                                request.leaveType || ""
                                            );

                                            const isShortLeave =
                                                leaveType.toLowerCase() ===
                                                "short";

                                            return (
                                                <tr key={requestId}>
                                                    <td>
                                                        <div className="attendance-employee-cell">
                                                            <span className="attendance-avatar">
                                                                {String(
                                                                    owner.name ||
                                                                    "H"
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>
                                                            <div>
                                                                <strong>
                                                                    {owner.name ||
                                                                        "HR Member"}
                                                                </strong>
                                                                <small>
                                                                    {normalizeRole(owner.role) === "cto_md"
                                                                        ? "CTO / Managing Director"
                                                                        : normalizeRole(owner.role) === "hr"
                                                                            ? "HR"
                                                                            : owner.role || "—"}
                                                                </small>
                                                                <small>{owner.email || "—"}</small>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span className="ceo-leave-type">
                                                            {getLeaveTypeLabel(
                                                                leaveType
                                                            )}
                                                        </span>
                                                        {isShortLeave && (
                                                            <small className="ceo-leave-time">
                                                                {request.startTime ||
                                                                    "—"}{" "}
                                                                –{" "}
                                                                {request.endTime ||
                                                                    "—"}
                                                            </small>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <div className="ceo-leave-dates">
                                                            <span>
                                                                {formatDisplayDate(
                                                                    request.startDate
                                                                )}
                                                            </span>
                                                            {request.endDate &&
                                                                request.endDate !==
                                                                request.startDate && (
                                                                    <span>
                                                                        to{" "}
                                                                        {formatDisplayDate(
                                                                            request.endDate
                                                                        )}
                                                                    </span>
                                                                )}
                                                        </div>
                                                    </td>

                                                    <td className="ceo-leave-reason">
                                                        {request.reason ||
                                                            "No reason provided"}
                                                    </td>

                                                    <td>
                                                        <span className="attendance-status pending">
                                                            Pending · CEO
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <div className="ceo-leave-actions">
                                                            <button
                                                                type="button"
                                                                className="ceo-leave-approve"
                                                                disabled={
                                                                    Boolean(
                                                                        leaveActionId
                                                                    ) ||
                                                                    !requestId
                                                                }
                                                                onClick={() =>
                                                                    handleLeaveReview(
                                                                        requestId,
                                                                        "approved"
                                                                    )
                                                                }
                                                            >
                                                                {leaveActionId ===
                                                                    requestId
                                                                    ? "Saving..."
                                                                    : "Approve"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="ceo-leave-reject"
                                                                disabled={
                                                                    Boolean(
                                                                        leaveActionId
                                                                    ) ||
                                                                    !requestId
                                                                }
                                                                onClick={() =>
                                                                    handleLeaveReview(
                                                                        requestId,
                                                                        "rejected"
                                                                    )
                                                                }
                                                            >
                                                                {leaveActionId ===
                                                                    requestId
                                                                    ? "Saving..."
                                                                    : "Reject"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}