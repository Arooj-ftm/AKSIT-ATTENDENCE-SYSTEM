import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CalendarCheck,
    CalendarDays,
    CalendarPlus,
    Clock3,
    CheckCircle2,
    LogIn,
    LogOut,
    RefreshCw,
    Timer,
    AlertCircle,
    Send,
    FileText,
    XCircle,
    Hourglass,
    ChevronDown,
    Paperclip,
    Trash2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./Attendance.css";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

const MAX_CERTIFICATE_SIZE = 5 * 1024 * 1024;

const ALLOWED_CERTIFICATE_EXTENSIONS = ["pdf", "doc", "docx"];

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getCurrentMonth = () => formatDate(new Date()).slice(0, 7);

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

    const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        weekday: "short",
    });
};

const getDurationMinutes = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return 0;
    }

    return Math.floor((end - start) / 60000);
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

const getLeaveTypeLabel = (type) => {
    const labels = {
        annual: "Annual Leave",
        casual: "Casual Leave",
        sick: "Sick Leave",
        emergency: "Emergency Leave",
        half_day: "Half-Day Leave",
        short: "Short Leave",
    };

    return labels[type] || type || "Leave";
};

const getLeaveStatusClass = (status) => {
    if (status === "approved") return "approved";
    if (status === "rejected") return "rejected";

    return "pending";
};

const getLeaveStatusLabel = (status) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";

    return "Pending";
};

const getErrorMessage = (error, fallback) =>
    error?.message || fallback;

const getLeaveArray = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.requests)) return data.requests;
    if (Array.isArray(data?.leaves)) return data.leaves;
    if (Array.isArray(data?.data)) return data.data;

    return [];
};

const createInitialLeaveForm = () => {
    const today = formatDate(new Date());

    return {
        leaveType: "casual",
        startDate: today,
        endDate: today,
        startTime: "10:00",
        endTime: "11:00",
        halfDayPeriod: "",
        balanceLeaveType: "casual",
        reason: "",
    };
};

const initialLeaveForm = createInitialLeaveForm();

function AttendanceAccordion({
    title,
    description,
    icon,
    badge,
    isOpen,
    onToggle,
    contentId,
    children,
}) {
    return (
        <section className="attendance-section">
            <button
                type="button"
                className="attendance-section-heading"
                style={{
                    width: "100%",
                    border: 0,
                    background: "transparent",
                    color: "inherit",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                }}
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={onToggle}
            >
                <div>
                    <h2>
                        {icon}
                        {title}
                    </h2>

                    {description && <p>{description}</p>}
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexShrink: 0,
                    }}
                >
                    {badge !== undefined && badge !== null && (
                        <span className="attendance-record-count">
                            {badge}
                        </span>
                    )}

                    <ChevronDown
                        size={21}
                        style={{
                            flexShrink: 0,
                            transition: "transform 0.2s ease",
                            transform: isOpen
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                        }}
                    />
                </div>
            </button>

            {isOpen && (
                <div id={contentId} style={{ padding: "0 22px 22px" }}>
                    {children}
                </div>
            )}
        </section>
    );
}

export default function ManagerAttendance() {
    const { token } = useAuth();

    const [liveMinutes, setLiveMinutes] = useState(0);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [attendanceAction, setAttendanceAction] = useState("");

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [leaveRequests, setLeaveRequests] = useState([]);
    const [leaveLoading, setLeaveLoading] = useState(true);
    const [leaveSaving, setLeaveSaving] = useState(false);
    const [leaveError, setLeaveError] = useState("");
    const [leaveNotice, setLeaveNotice] = useState("");

    const [leaveForm, setLeaveForm] = useState(initialLeaveForm);
    const [medicalCertificate, setMedicalCertificate] = useState(null);

    const [leaveSectionOpen, setLeaveSectionOpen] = useState(false);
    const [historySectionOpen, setHistorySectionOpen] = useState(false);

    const today = formatDate(new Date());
    const currentMonth = getCurrentMonth();
    const isCurrentMonth = selectedMonth === currentMonth;

    const isShortLeave = leaveForm.leaveType === "short";
    const isHalfDay = leaveForm.leaveType === "half_day";
    const isSickLeave = leaveForm.leaveType === "sick";

    const loadAttendance = useCallback(async () => {
        if (!token) {
            setRecords([]);
            setLoading(false);
            setError("Please log in to view your attendance.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const data = await apiRequest(
                `/api/attendance?month=${encodeURIComponent(selectedMonth)}`,
                {},
                token
            );

            if (data?.success === false) {
                throw new Error(
                    data.message || "Unable to load attendance."
                );
            }

            setRecords(
                Array.isArray(data?.records) ? data.records : []
            );
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    "Unable to load your attendance history."
                )
            );
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, [token, selectedMonth]);

    const loadLeaveRequests = useCallback(async () => {
        if (!token) {
            setLeaveRequests([]);
            setLeaveLoading(false);
            setLeaveError("Please log in to view your leave requests.");
            return;
        }

        setLeaveLoading(true);
        setLeaveError("");

        try {
            const data = await apiRequest(
                "/api/leaves/mine",
                {},
                token
            );

            if (data?.success === false) {
                throw new Error(
                    data.message || "Unable to load leave requests."
                );
            }

            setLeaveRequests(getLeaveArray(data));
        } catch (err) {
            setLeaveError(
                getErrorMessage(
                    err,
                    "Unable to load your leave requests."
                )
            );
            setLeaveRequests([]);
        } finally {
            setLeaveLoading(false);
        }
    }, [token]);

    // Shared PageHeader refreshes both attendance and leave data.
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

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    useEffect(() => {
        loadLeaveRequests();
    }, [loadLeaveRequests]);

    const todayRecord = useMemo(
        () =>
            records.find(
                (record) => String(record.date).slice(0, 10) === today
            ) || null,
        [records, today]
    );

    const checkedIn = Boolean(todayRecord?.checkIn);
    const checkedOut = Boolean(todayRecord?.checkOut);
    const onLeave = todayRecord?.status === "on_leave";

    useEffect(() => {
        if (!todayRecord?.checkIn) {
            setLiveMinutes(0);
            return;
        }

        const calculateDuration = () => {
            const start = new Date(todayRecord.checkIn).getTime();

            if (!Number.isFinite(start)) {
                setLiveMinutes(0);
                return;
            }

            if (todayRecord.checkOut) {
                const end = new Date(todayRecord.checkOut).getTime();

                setLiveMinutes(
                    Number.isFinite(end) && end > start
                        ? Math.floor((end - start) / 60000)
                        : 0
                );

                return;
            }

            setLiveMinutes(
                Math.max(0, Math.floor((Date.now() - start) / 60000))
            );
        };

        calculateDuration();

        if (todayRecord.checkOut) return;

        const intervalId = setInterval(calculateDuration, 1000);

        return () => clearInterval(intervalId);
    }, [todayRecord?.checkIn, todayRecord?.checkOut]);

    const monthlyStats = useMemo(() => {
        const presentDays = records.filter(
            (record) =>
                record.checkIn && record.status !== "on_leave"
        ).length;

        const completedDays = records.filter(
            (record) =>
                record.checkIn &&
                record.checkOut &&
                record.status !== "on_leave"
        ).length;

        const leaveDays = records.filter(
            (record) => record.status === "on_leave"
        ).length;

        const totalMinutes = records.reduce((total, record) => {
            if (!record.checkIn || record.status === "on_leave") {
                return total;
            }

            return (
                total +
                getDurationMinutes(record.checkIn, record.checkOut)
            );
        }, 0);

        return {
            presentDays,
            completedDays,
            leaveDays,
            totalMinutes,
        };
    }, [records]);

    const sortedRecords = useMemo(
        () =>
            [...records].sort((a, b) =>
                String(b.date).localeCompare(String(a.date))
            ),
        [records]
    );

    const sortedLeaveRequests = useMemo(
        () =>
            [...leaveRequests].sort((a, b) =>
                String(
                    b.createdAt || b.startDate || ""
                ).localeCompare(
                    String(a.createdAt || a.startDate || "")
                )
            ),
        [leaveRequests]
    );

    const leaveStats = useMemo(
        () => ({
            pending: leaveRequests.filter(
                (item) => item.status === "pending"
            ).length,
            approved: leaveRequests.filter(
                (item) => item.status === "approved"
            ).length,
            rejected: leaveRequests.filter(
                (item) => item.status === "rejected"
            ).length,
        }),
        [leaveRequests]
    );

    const handleAttendanceAction = async (action) => {
        if (!token || saving) return;

        if (!isCurrentMonth) {
            setNotice(
                "Select the current month to record today's attendance."
            );
            return;
        }

        if (action === "in" && checkedIn) {
            setNotice("You have already checked in today.");
            return;
        }

        if (action === "out" && (!checkedIn || checkedOut)) {
            setNotice(
                "You cannot check out until you have checked in."
            );
            return;
        }

        if (onLeave) {
            setNotice(
                "Your attendance is marked On Leave. You cannot check in or out."
            );
            return;
        }

        setSaving(true);
        setAttendanceAction(action);
        setError("");
        setNotice("");

        try {
            const endpoint =
                action === "in"
                    ? "/api/attendance/check-in"
                    : "/api/attendance/check-out";

            const data = await apiRequest(
                endpoint,
                {
                    method: "POST",
                    body: JSON.stringify({}),
                },
                token
            );

            if (data?.success === false) {
                throw new Error(
                    data.message || "Attendance could not be saved."
                );
            }

            setNotice(
                data?.message ||
                (action === "in"
                    ? "Check-in saved successfully."
                    : "Check-out saved successfully.")
            );

            await loadAttendance();
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    "Attendance could not be saved."
                )
            );
        } finally {
            setSaving(false);
            setAttendanceAction("");
        }
    };

    const updateLeaveForm = (field, value) => {
        if (field === "leaveType" && value !== "sick") {
            setMedicalCertificate(null);
        }

        setLeaveForm((previous) => {
            const updated = {
                ...previous,
                [field]: value,
            };

            if (field === "leaveType") {
                if (value !== "half_day") {
                    updated.halfDayPeriod = "";
                    updated.balanceLeaveType = "casual";
                }

                if (
                    value === "short" ||
                    value === "half_day"
                ) {
                    updated.endDate = updated.startDate;
                }
            }

            if (
                field === "startDate" &&
                (updated.leaveType === "short" ||
                    updated.leaveType === "half_day")
            ) {
                updated.endDate = value;
            }

            if (
                field === "startDate" &&
                updated.leaveType !== "short" &&
                updated.leaveType !== "half_day" &&
                updated.endDate < value
            ) {
                updated.endDate = value;
            }

            return updated;
        });
    };

    const handleMedicalCertificateChange = (event) => {
        const file = event.target.files?.[0] || null;

        setLeaveError("");
        setLeaveNotice("");

        if (!file) {
            setMedicalCertificate(null);
            return;
        }

        const extension = file.name.split(".").pop()?.toLowerCase();

        if (!ALLOWED_CERTIFICATE_EXTENSIONS.includes(extension)) {
            setMedicalCertificate(null);
            event.target.value = "";
            setLeaveError(
                "Medical certificate must be a PDF, DOC, or DOCX file."
            );
            return;
        }

        if (file.size > MAX_CERTIFICATE_SIZE) {
            setMedicalCertificate(null);
            event.target.value = "";
            setLeaveError(
                "Medical certificate cannot be larger than 5 MB."
            );
            return;
        }

        setMedicalCertificate(file);
    };

    const handleLeaveSubmit = async (event) => {
        event.preventDefault();

        if (!token) {
            setLeaveError("Please log in to submit a leave request.");
            return;
        }

        if (leaveSaving) return;

        setLeaveError("");
        setLeaveNotice("");

        if (!leaveForm.startDate || !leaveForm.endDate) {
            setLeaveError(
                "Please select the leave start and end dates."
            );
            return;
        }

        if (leaveForm.startDate < today) {
            setLeaveError("Leave start date cannot be in the past.");
            return;
        }

        if (leaveForm.endDate < leaveForm.startDate) {
            setLeaveError(
                "End date cannot be before the start date."
            );
            return;
        }

        if (
            (isShortLeave || isHalfDay) &&
            leaveForm.startDate !== leaveForm.endDate
        ) {
            setLeaveError(
                "Short Leave and Half-Day Leave must be for one day only."
            );
            return;
        }

        if (isShortLeave) {
            if (
                !leaveForm.startTime ||
                !leaveForm.endTime ||
                leaveForm.endTime <= leaveForm.startTime
            ) {
                setLeaveError(
                    "Please select a valid short-leave time range."
                );
                return;
            }

            const [startHour, startMinute] =
                leaveForm.startTime.split(":").map(Number);

            const [endHour, endMinute] =
                leaveForm.endTime.split(":").map(Number);

            const duration =
                endHour * 60 +
                endMinute -
                (startHour * 60 + startMinute);

            if (duration > 120) {
                setLeaveError(
                    "Short Leave cannot exceed 2 hours."
                );
                return;
            }
        }

        if (isHalfDay && !leaveForm.halfDayPeriod) {
            setLeaveError(
                "Please select first half or second half."
            );
            return;
        }

        if (
            isHalfDay &&
            !["annual", "casual", "sick"].includes(
                leaveForm.balanceLeaveType
            )
        ) {
            setLeaveError(
                "Please select a valid leave balance to deduct from."
            );
            return;
        }

        if (!leaveForm.reason.trim()) {
            setLeaveError(
                "Please enter a reason for your leave."
            );
            return;
        }

        if (
            medicalCertificate &&
            medicalCertificate.size > MAX_CERTIFICATE_SIZE
        ) {
            setLeaveError(
                "Medical certificate cannot be larger than 5 MB."
            );
            return;
        }

        setLeaveSaving(true);

        try {
            const formData = new FormData();

            formData.append("leaveType", leaveForm.leaveType);
            formData.append("startDate", leaveForm.startDate);
            formData.append("endDate", leaveForm.endDate);
            formData.append("reason", leaveForm.reason.trim());

            if (isShortLeave) {
                formData.append("startTime", leaveForm.startTime);
                formData.append("endTime", leaveForm.endTime);
            }

            if (isHalfDay) {
                formData.append(
                    "halfDayPeriod",
                    leaveForm.halfDayPeriod
                );
                formData.append(
                    "balanceLeaveType",
                    leaveForm.balanceLeaveType
                );
            }

            if (isSickLeave && medicalCertificate) {
                formData.append(
                    "medicalCertificate",
                    medicalCertificate
                );
            }

            /*
             * Do not manually set Content-Type for FormData.
             * The browser adds the multipart boundary automatically.
             */
            let response;

            try {
                response = await fetch(`${API_BASE_URL}/api/leaves`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                });
            } catch {
                throw new Error(
                    "Backend is not connecting. Please check that your server is running."
                );
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data?.success === false) {
                throw new Error(
                    data?.message ||
                    "Unable to submit your leave request."
                );
            }

            setLeaveNotice(
                data?.message ||
                "Your leave request has been submitted."
            );

            setLeaveForm(createInitialLeaveForm());
            setMedicalCertificate(null);

            await Promise.all([
                loadLeaveRequests(),
                loadAttendance(),
            ]);
        } catch (err) {
            setLeaveError(
                getErrorMessage(
                    err,
                    "Unable to submit your leave request."
                )
            );
        } finally {
            setLeaveSaving(false);
        }
    };

    const getRecordStatus = (record) => {
        if (record.status === "on_leave") return "On Leave";
        if (record.checkIn && record.checkOut) return "Completed";
        if (record.checkIn) return "Checked In";

        return "No Check-in";
    };

    const getStatusClass = (record) => {
        if (record.status === "on_leave") return "leave";
        if (record.checkIn && record.checkOut) return "present";
        if (record.checkIn) return "working";

        return "absent";
    };

    return (
        <main
            className="main attendance-page"
            data-role="manager"
        >
            <PageHeader
                eyebrow="TIME & ATTENDANCE"
                title="Attendance"
                description="Track your daily attendance, manage leave applications, and review your monthly working history in one place."
                icon={CalendarCheck}
                onRefresh={refreshAll}
                refreshing={
                    loading ||
                    saving ||
                    leaveLoading ||
                    leaveSaving
                }
            />

            {error && (
                <div
                    className="attendance-alert attendance-alert-error"
                    role="alert"
                >
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {notice && (
                <div
                    className="attendance-alert attendance-alert-success"
                    role="status"
                >
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
                        className={`attendance-status ${onLeave
                                ? "leave"
                                : checkedOut
                                    ? "present"
                                    : checkedIn
                                        ? "working"
                                        : "absent"
                            }`}
                    >
                        {onLeave
                            ? "On Leave"
                            : checkedOut
                                ? "Completed"
                                : checkedIn
                                    ? "Checked In"
                                    : "Not Checked In"}
                    </span>
                </div>

                <div className="attendance-stats">
                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <LogIn size={20} />
                        </div>
                        <div>
                            <p>Check-in Time</p>
                            <h3>{formatTime(todayRecord?.checkIn)}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <p>Check-out Time</p>
                            <h3>{formatTime(todayRecord?.checkOut)}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <Timer size={20} />
                        </div>
                        <div>
                            <p>Today's Working Time</p>
                            <h3>
                                {todayRecord?.checkIn
                                    ? formatDuration(liveMinutes)
                                    : "0h 0m"}
                            </h3>
                        </div>
                    </article>
                </div>

                <div className="attendance-actions">
                    <button
                        type="button"
                        className="attendance-primary-btn"
                        onClick={() => handleAttendanceAction("in")}
                        disabled={
                            loading ||
                            saving ||
                            !isCurrentMonth ||
                            checkedIn ||
                            onLeave ||
                            !token
                        }
                    >
                        <LogIn size={17} />
                        {saving && attendanceAction === "in"
                            ? "Saving..."
                            : "Check In"}
                    </button>

                    <button
                        type="button"
                        className="attendance-secondary-btn"
                        onClick={() => handleAttendanceAction("out")}
                        disabled={
                            loading ||
                            saving ||
                            !isCurrentMonth ||
                            !checkedIn ||
                            checkedOut ||
                            onLeave ||
                            !token
                        }
                    >
                        <LogOut size={17} />
                        {saving && attendanceAction === "out"
                            ? "Saving..."
                            : "Check Out"}
                    </button>

                    {!isCurrentMonth && (
                        <span className="attendance-helper-text">
                            Select the current month to record today's
                            attendance.
                        </span>
                    )}
                </div>
            </section>

            <AttendanceAccordion
                title="Leave Management"
                description="Apply for leave and track your requests and approval status."
                icon={<CalendarPlus size={21} />}
                badge={`${leaveStats.pending} Pending`}
                isOpen={leaveSectionOpen}
                onToggle={() =>
                    setLeaveSectionOpen((open) => !open)
                }
                contentId="manager-leave-content"
            >
                {leaveError && (
                    <div
                        className="attendance-alert attendance-alert-error"
                        role="alert"
                    >
                        <AlertCircle size={18} />
                        <span>{leaveError}</span>
                    </div>
                )}

                {leaveNotice && (
                    <div
                        className="attendance-alert attendance-alert-success"
                        role="status"
                    >
                        <CheckCircle2 size={18} />
                        <span>{leaveNotice}</span>
                    </div>
                )}

                <div style={{ paddingTop: 12 }}>
                    <h3
                        style={{
                            margin: "0 0 6px",
                            color: "#202b40",
                            fontSize: 16,
                        }}
                    >
                        Apply for Leave
                    </h3>

                    <p
                        style={{
                            margin: "0 0 18px",
                            color: "#8b94a5",
                            fontSize: 12,
                        }}
                    >
                        Submit your request for review by HR.
                    </p>
                </div>

                <form
                    className="leave-application-form"
                    onSubmit={handleLeaveSubmit}
                >
                    <div className="leave-form-grid">
                        <label className="leave-field">
                            <span>Leave Type</span>
                            <select
                                value={leaveForm.leaveType}
                                onChange={(event) =>
                                    updateLeaveForm(
                                        "leaveType",
                                        event.target.value
                                    )
                                }
                                disabled={leaveSaving}
                                required
                            >
                                <option value="annual">
                                    Annual Leave
                                </option>
                                <option value="casual">
                                    Casual Leave
                                </option>
                                <option value="sick">
                                    Sick Leave
                                </option>
                                <option value="emergency">
                                    Emergency Leave
                                </option>
                                <option value="half_day">
                                    Half-Day Leave
                                </option>
                                <option value="short">
                                    Short Leave
                                </option>
                            </select>
                        </label>

                        <label className="leave-field">
                            <span>Start Date</span>
                            <input
                                type="date"
                                value={leaveForm.startDate}
                                min={today}
                                onChange={(event) =>
                                    updateLeaveForm(
                                        "startDate",
                                        event.target.value
                                    )
                                }
                                disabled={leaveSaving}
                                required
                            />
                        </label>

                        <label className="leave-field">
                            <span>End Date</span>
                            <input
                                type="date"
                                value={leaveForm.endDate}
                                min={leaveForm.startDate || today}
                                onChange={(event) =>
                                    updateLeaveForm(
                                        "endDate",
                                        event.target.value
                                    )
                                }
                                disabled={
                                    leaveSaving ||
                                    isShortLeave ||
                                    isHalfDay
                                }
                                required
                            />
                        </label>

                        {isHalfDay && (
                            <>
                                <label className="leave-field">
                                    <span>Half-Day Period</span>
                                    <select
                                        value={
                                            leaveForm.halfDayPeriod || ""
                                        }
                                        onChange={(event) =>
                                            updateLeaveForm(
                                                "halfDayPeriod",
                                                event.target.value
                                            )
                                        }
                                        disabled={leaveSaving}
                                        required
                                    >
                                        <option value="">
                                            Select period
                                        </option>
                                        <option value="first_half">
                                            First Half
                                        </option>
                                        <option value="second_half">
                                            Second Half
                                        </option>
                                    </select>
                                </label>

                                <label className="leave-field">
                                    <span>Deduct Leave Balance From</span>
                                    <select
                                        value={
                                            leaveForm.balanceLeaveType
                                        }
                                        onChange={(event) =>
                                            updateLeaveForm(
                                                "balanceLeaveType",
                                                event.target.value
                                            )
                                        }
                                        disabled={leaveSaving}
                                        required
                                    >
                                        <option value="annual">
                                            Annual Leave
                                        </option>
                                        <option value="casual">
                                            Casual Leave
                                        </option>
                                        <option value="sick">
                                            Sick Leave
                                        </option>
                                    </select>
                                </label>
                            </>
                        )}

                        {isShortLeave && (
                            <>
                                <label className="leave-field">
                                    <span>Start Time</span>
                                    <input
                                        type="time"
                                        value={leaveForm.startTime}
                                        onChange={(event) =>
                                            updateLeaveForm(
                                                "startTime",
                                                event.target.value
                                            )
                                        }
                                        disabled={leaveSaving}
                                        required
                                    />
                                </label>

                                <label className="leave-field">
                                    <span>End Time</span>
                                    <input
                                        type="time"
                                        value={leaveForm.endTime}
                                        onChange={(event) =>
                                            updateLeaveForm(
                                                "endTime",
                                                event.target.value
                                            )
                                        }
                                        disabled={leaveSaving}
                                        required
                                    />
                                </label>
                            </>
                        )}
                    </div>

                    {isShortLeave && (
                        <p className="leave-form-hint">
                            Short Leave is for one day and cannot exceed
                            two hours.
                        </p>
                    )}

                    {isHalfDay && (
                        <p className="leave-form-hint">
                            Select the first or second half of the working
                            day and choose which leave balance should be
                            used.
                        </p>
                    )}

                    {isSickLeave && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 14,
                                border: "1px solid #e1e7f0",
                                borderRadius: 10,
                                background: "#f8fafc",
                            }}
                        >
                            <label className="leave-field">
                                <span>
                                    Medical Certificate (Optional)
                                </span>

                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={
                                        handleMedicalCertificateChange
                                    }
                                    disabled={leaveSaving}
                                />
                            </label>

                            <p
                                className="leave-form-hint"
                                style={{ marginBottom: 0 }}
                            >
                                Sick leave covering 3 or more consecutive
                                calendar days requires a medical
                                certificate. Accepted formats: PDF, DOC,
                                DOCX. Maximum file size: 5 MB.
                            </p>

                            {medicalCertificate && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        flexWrap: "wrap",
                                        marginTop: 12,
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            overflowWrap: "anywhere",
                                            color: "#344054",
                                            fontSize: 13,
                                        }}
                                    >
                                        <Paperclip size={16} />
                                        {medicalCertificate.name}
                                    </span>

                                    <button
                                        type="button"
                                        className="attendance-secondary-btn"
                                        onClick={() =>
                                            setMedicalCertificate(null)
                                        }
                                        disabled={leaveSaving}
                                    >
                                        <Trash2 size={15} />
                                        Remove file
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <label
                        className="leave-field leave-reason-field"
                        style={{ marginTop: 16 }}
                    >
                        <span>Reason for Leave</span>
                        <textarea
                            value={leaveForm.reason}
                            onChange={(event) =>
                                updateLeaveForm(
                                    "reason",
                                    event.target.value
                                )
                            }
                            placeholder="Explain why you need leave..."
                            rows={4}
                            maxLength={1000}
                            disabled={leaveSaving}
                            required
                        />
                        <small>
                            {leaveForm.reason.length}/1000 characters
                        </small>
                    </label>

                    <div className="leave-form-footer">
                        <p>
                            <AlertCircle size={15} />
                            Your request remains pending until HR reviews
                            it.
                        </p>

                        <button
                            type="submit"
                            className="attendance-primary-btn"
                            disabled={leaveSaving || !token}
                        >
                            {leaveSaving ? (
                                <RefreshCw
                                    size={16}
                                    className="attendance-spinning"
                                />
                            ) : (
                                <Send size={16} />
                            )}
                            {leaveSaving
                                ? "Submitting..."
                                : "Submit Leave Request"}
                        </button>
                    </div>
                </form>

                <div style={{ marginTop: 30 }}>
                    <div
                        className="attendance-section-heading"
                        style={{ padding: "12px 0" }}
                    >
                        <div>
                            <h2>
                                <FileText size={20} />
                                My Leave Requests
                            </h2>
                            <p>
                                Track your submitted requests and their
                                review status.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="attendance-secondary-btn"
                            onClick={loadLeaveRequests}
                            disabled={leaveLoading}
                        >
                            <RefreshCw
                                size={15}
                                className={
                                    leaveLoading
                                        ? "attendance-spinning"
                                        : ""
                                }
                            />
                            Refresh
                        </button>
                    </div>

                    <div
                        className="attendance-stats"
                        style={{ padding: "0 0 18px" }}
                    >
                        <article className="attendance-stat-card">
                            <div className="attendance-stat-icon">
                                <Hourglass size={20} />
                            </div>
                            <div>
                                <p>Pending Requests</p>
                                <h3>{leaveStats.pending}</h3>
                            </div>
                        </article>

                        <article className="attendance-stat-card">
                            <div className="attendance-stat-icon green">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p>Approved Requests</p>
                                <h3>{leaveStats.approved}</h3>
                            </div>
                        </article>

                        <article className="attendance-stat-card">
                            <div className="attendance-stat-icon red">
                                <XCircle size={20} />
                            </div>
                            <div>
                                <p>Rejected Requests</p>
                                <h3>{leaveStats.rejected}</h3>
                            </div>
                        </article>
                    </div>

                    {leaveLoading ? (
                        <div className="attendance-loading">
                            <span className="attendance-spinner" />
                            Loading your leave requests...
                        </div>
                    ) : sortedLeaveRequests.length === 0 ? (
                        <div className="attendance-empty">
                            <CalendarPlus size={24} />
                            <h3>No Leave Requests Yet</h3>
                            <p>
                                Your submitted requests will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="attendance-table-wrap">
                            <table className="attendance-table leave-requests-table">
                                <thead>
                                    <tr>
                                        <th>Leave Type</th>
                                        <th>Dates</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Reviewer Feedback</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {sortedLeaveRequests.map(
                                        (request, index) => (
                                            <tr
                                                key={
                                                    request._id ||
                                                    request.id ||
                                                    `${request.startDate}-${index}`
                                                }
                                            >
                                                <td>
                                                    <strong>
                                                        {getLeaveTypeLabel(
                                                            request.leaveType
                                                        )}
                                                    </strong>

                                                    {request.leaveType ===
                                                        "short" &&
                                                        request.startTime &&
                                                        request.endTime && (
                                                            <small className="leave-table-subtext">
                                                                {request.startTime}{" "}
                                                                –{" "}
                                                                {request.endTime}
                                                            </small>
                                                        )}

                                                    {request.leaveType ===
                                                        "half_day" &&
                                                        request.halfDayPeriod && (
                                                            <small className="leave-table-subtext">
                                                                {request.halfDayPeriod ===
                                                                    "first_half"
                                                                    ? "First Half"
                                                                    : "Second Half"}
                                                            </small>
                                                        )}

                                                    {request.leaveType ===
                                                        "half_day" &&
                                                        request.balanceLeaveType && (
                                                            <small className="leave-table-subtext">
                                                                Deducted from:{" "}
                                                                {getLeaveTypeLabel(
                                                                    request.balanceLeaveType
                                                                )}
                                                            </small>
                                                        )}

                                                    {request.medicalCertificate && (
                                                        <small className="leave-table-subtext">
                                                            Medical certificate attached
                                                        </small>
                                                    )}
                                                </td>

                                                <td>
                                                    {formatDisplayDate(
                                                        request.startDate
                                                    )}

                                                    {request.endDate &&
                                                        request.endDate !==
                                                        request.startDate && (
                                                            <small className="leave-table-subtext">
                                                                to{" "}
                                                                {formatDisplayDate(
                                                                    request.endDate
                                                                )}
                                                            </small>
                                                        )}
                                                </td>

                                                <td className="leave-reason-cell">
                                                    {request.reason || "—"}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`leave-request-status ${getLeaveStatusClass(
                                                            request.status
                                                        )}`}
                                                    >
                                                        {getLeaveStatusLabel(
                                                            request.status
                                                        )}
                                                    </span>
                                                </td>

                                                <td className="leave-reason-cell">
                                                    {request.status ===
                                                        "rejected"
                                                        ? request.rejectionReason ||
                                                        "No reason provided"
                                                        : request.status ===
                                                            "approved"
                                                            ? `Approved${request.reviewedBy?.name
                                                                ? ` by ${request.reviewedBy.name}`
                                                                : ""
                                                            }`
                                                            : "Awaiting review"}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </AttendanceAccordion>

            <AttendanceAccordion
                title="Monthly Attendance History"
                description="View your attendance records and total working hours by month."
                icon={<CalendarDays size={21} />}
                badge={`${records.length} Records`}
                isOpen={historySectionOpen}
                onToggle={() =>
                    setHistorySectionOpen((open) => !open)
                }
                contentId="manager-monthly-history"
            >
                <div className="attendance-section-heading">
                    <div>
                        <h2>{getMonthLabel(selectedMonth)}</h2>
                        <p>
                            Choose a month to view its recorded attendance.
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
                                setSelectedMonth(event.target.value);
                                setNotice("");
                                setError("");
                            }}
                        />
                    </div>
                </div>

                <div className="attendance-stats">
                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <CalendarCheck size={20} />
                        </div>
                        <div>
                            <p>Days Checked In</p>
                            <h3>{monthlyStats.presentDays}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon green">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p>Completed Days</p>
                            <h3>{monthlyStats.completedDays}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <CalendarDays size={20} />
                        </div>
                        <div>
                            <p>Approved Leave Days</p>
                            <h3>{monthlyStats.leaveDays}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <Clock3 size={20} />
                        </div>
                        <div>
                            <p>Total Working Hours</p>
                            <h3>
                                {formatDuration(monthlyStats.totalMinutes)}
                            </h3>
                        </div>
                    </article>
                </div>

                {loading ? (
                    <div className="attendance-loading">
                        <span className="attendance-spinner" />
                        Loading attendance history...
                    </div>
                ) : sortedRecords.length === 0 ? (
                    <div className="attendance-empty">
                        <CalendarDays size={24} />
                        <h3>No Attendance Records</h3>
                        <p>
                            There are no attendance records for{" "}
                            {getMonthLabel(selectedMonth)}.
                        </p>
                    </div>
                ) : (
                    <div className="attendance-table-wrap">
                        <table className="attendance-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Working Time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {sortedRecords.map((record, index) => (
                                    <tr
                                        key={
                                            record._id ||
                                            `${record.date}-${index}`
                                        }
                                    >
                                        <td>
                                            <span className="attendance-date-cell">
                                                {formatDisplayDate(
                                                    record.date
                                                )}
                                            </span>
                                        </td>

                                        <td>{formatTime(record.checkIn)}</td>
                                        <td>{formatTime(record.checkOut)}</td>

                                        <td>
                                            {record.checkIn &&
                                                record.status !== "on_leave"
                                                ? formatDuration(
                                                    getDurationMinutes(
                                                        record.checkIn,
                                                        record.checkOut
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
                                                {getRecordStatus(record)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AttendanceAccordion>
        </main>
    );
}
