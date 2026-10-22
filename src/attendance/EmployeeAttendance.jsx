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
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./Attendance.css";

const MAX_CERTIFICATE_SIZE = 5 * 1024 * 1024;

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

    const date = new Date(`${dateString}T00:00:00`);
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

const getApprovalStageLabel = (request) => {
    if (request.status === "approved") return "Completed";
    if (request.status === "rejected") return "Rejected";

    const stages = {
        manager: "Awaiting Manager",
        hr: "Awaiting HR",
        ceo: "Awaiting CEO",
        completed: "Completed",
    };

    return stages[request.approvalStage] || "Awaiting Review";
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

const initialLeaveForm = {
    leaveType: "casual",
    startDate: formatDate(new Date()),
    endDate: formatDate(new Date()),
    startTime: "10:00",
    endTime: "11:00",
    halfDayPeriod: "",
    balanceLeaveType: "casual",
    reason: "",
};

export default function EmployeeAttendance() {
    const { token } = useAuth();

    const [liveMinutes, setLiveMinutes] = useState(0);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [medicalCertificate, setMedicalCertificate] = useState(null);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [leaveLoading, setLeaveLoading] = useState(true);
    const [leaveSaving, setLeaveSaving] = useState(false);
    const [leaveError, setLeaveError] = useState("");
    const [leaveNotice, setLeaveNotice] = useState("");
    const [leaveForm, setLeaveForm] = useState(initialLeaveForm);

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
                throw new Error(data.message || "Unable to load attendance.");
            }

            setRecords(Array.isArray(data?.records) ? data.records : []);
        } catch (err) {
            setError(
                getErrorMessage(err, "Unable to load attendance history.")
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
            const data = await apiRequest("/api/leaves/mine", {}, token);

            if (data?.success === false) {
                throw new Error(
                    data.message || "Unable to load leave requests."
                );
            }

            setLeaveRequests(getLeaveArray(data));
        } catch (err) {
            setLeaveError(
                getErrorMessage(err, "Unable to load leave requests.")
            );
            setLeaveRequests([]);
        } finally {
            setLeaveLoading(false);
        }
    }, [token]);

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
        () => records.find((record) => record.date === today) || null,
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
            (record) => record.checkIn && record.status !== "on_leave"
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
            if (!record.checkIn || record.status === "on_leave") return total;

            return total + getDurationMinutes(record.checkIn, record.checkOut);
        }, 0);

        return { presentDays, completedDays, leaveDays, totalMinutes };
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
                String(b.createdAt || b.startDate || "").localeCompare(
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
            setNotice("Select the current month to record today's attendance.");
            return;
        }

        if (action === "in" && checkedIn) {
            setNotice("You have already checked in today.");
            return;
        }

        if (action === "out" && (!checkedIn || checkedOut)) {
            setNotice("You cannot check out until you have checked in.");
            return;
        }

        if (onLeave) {
            setNotice(
                "Your attendance is marked On Leave. You cannot check in or out."
            );
            return;
        }

        setSaving(true);
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
                getErrorMessage(err, "Attendance could not be saved.")
            );
        } finally {
            setSaving(false);
        }
    };

    const updateLeaveForm = (field, value) => {
        if (field === "leaveType" && value !== "sick") {
            setMedicalCertificate(null);
        }

        setLeaveForm((previous) => {
            const updated = { ...previous, [field]: value };

            if (field === "leaveType") {
                if (value !== "half_day") {
                    updated.halfDayPeriod = "";
                    updated.balanceLeaveType = "casual";
                }

                if (value === "short" || value === "half_day") {
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

    const handleCertificateChange = (event) => {
        const file = event.target.files?.[0] || null;

        setLeaveError("");
        setLeaveNotice("");

        if (!file) {
            setMedicalCertificate(null);
            return;
        }

        const allowedExtensions = /\.(pdf|doc|docx)$/i;

        if (!allowedExtensions.test(file.name)) {
            setMedicalCertificate(null);
            event.target.value = "";
            setLeaveError("Please select a PDF, DOC, or DOCX certificate.");
            return;
        }

        if (file.size > MAX_CERTIFICATE_SIZE) {
            setMedicalCertificate(null);
            event.target.value = "";
            setLeaveError("Medical certificate must not exceed 5 MB.");
            return;
        }

        setMedicalCertificate(file);
    };

    const handleLeaveSubmit = async (event) => {
        event.preventDefault();

        if (!token || leaveSaving) return;

        setLeaveError("");
        setLeaveNotice("");

        if (!leaveForm.startDate || !leaveForm.endDate) {
            setLeaveError("Please select the leave start and end dates.");
            return;
        }

        if (leaveForm.startDate < today) {
            setLeaveError("Leave start date cannot be in the past.");
            return;
        }

        if (leaveForm.endDate < leaveForm.startDate) {
            setLeaveError("End date cannot be before the start date.");
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
                setLeaveError("Please select a valid short-leave time range.");
                return;
            }

            const [startHour, startMinute] = leaveForm.startTime
                .split(":")
                .map(Number);
            const [endHour, endMinute] = leaveForm.endTime
                .split(":")
                .map(Number);

            const duration =
                endHour * 60 +
                endMinute -
                (startHour * 60 + startMinute);

            if (duration > 120) {
                setLeaveError("Short Leave cannot exceed 2 hours.");
                return;
            }
        }

        if (isHalfDay && !leaveForm.halfDayPeriod) {
            setLeaveError("Please select first half or second half.");
            return;
        }

        if (
            isHalfDay &&
            !["annual", "casual", "sick"].includes(
                leaveForm.balanceLeaveType
            )
        ) {
            setLeaveError("Please select a valid leave balance type.");
            return;
        }

        if (!leaveForm.reason.trim()) {
            setLeaveError("Please enter a reason for your leave.");
            return;
        }

        setLeaveSaving(true);

        try {
            const payload = {
                leaveType: leaveForm.leaveType,
                startDate: leaveForm.startDate,
                endDate: leaveForm.endDate,
                reason: leaveForm.reason.trim(),
                ...(isShortLeave
                    ? {
                        startTime: leaveForm.startTime,
                        endTime: leaveForm.endTime,
                    }
                    : {}),
                ...(isHalfDay
                    ? {
                        halfDayPeriod: leaveForm.halfDayPeriod,
                        balanceLeaveType: leaveForm.balanceLeaveType,
                    }
                    : {}),
            };

            let requestBody;

            if (isSickLeave && medicalCertificate) {
                requestBody = new FormData();

                Object.entries(payload).forEach(([key, value]) => {
                    requestBody.append(key, String(value));
                });

                requestBody.append(
                    "medicalCertificate",
                    medicalCertificate
                );
            } else {
                requestBody = JSON.stringify(payload);
            }

            const data = await apiRequest(
                "/api/leaves",
                {
                    method: "POST",
                    body: requestBody,
                },
                token
            );

            if (data?.success === false) {
                throw new Error(
                    data.message || "Unable to submit your leave request."
                );
            }

            setLeaveNotice(
                data?.message || "Your leave request has been submitted."
            );

            setMedicalCertificate(null);
            setLeaveForm({
                ...initialLeaveForm,
                startDate: today,
                endDate: today,
            });

            await loadLeaveRequests();
            await loadAttendance();
        } catch (err) {
            setLeaveError(
                getErrorMessage(err, "Unable to submit your leave request.")
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

    const accordionButtonStyle = {
        width: "100%",
        border: 0,
        background: "transparent",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
    };

    return (
        <main className="main attendance-page" data-role="employee">
            <PageHeader
                eyebrow="EMPLOYEE PORTAL"
                title="My Attendance"
                description="Manage your daily attendance, leave applications, and monthly working history from one place."
                icon={CalendarCheck}
                onRefresh={refreshAll}
                refreshing={
                    loading || saving || leaveLoading || leaveSaving
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
                            onLeave
                        }
                    >
                        <LogIn size={17} />
                        {saving && !checkedIn ? "Saving..." : "Check In"}
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
                            onLeave
                        }
                    >
                        <LogOut size={17} />
                        Check Out
                    </button>

                    {!isCurrentMonth && (
                        <span className="attendance-helper-text">
                            Select the current month to record today's attendance.
                        </span>
                    )}
                </div>
            </section>

            <section className="attendance-section leave-management-section">
                <button
                    type="button"
                    className="attendance-section-heading"
                    style={accordionButtonStyle}
                    aria-expanded={leaveSectionOpen}
                    aria-controls="employee-leave-content"
                    onClick={() => setLeaveSectionOpen((open) => !open)}
                >
                    <div>
                        <h2>
                            <CalendarPlus size={21} />
                            Leave Management
                        </h2>
                        <p>
                            Apply for leave and track your requests and approval
                            status.
                        </p>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <span className="attendance-record-count">
                            {leaveStats.pending} Pending
                        </span>
                        <ChevronDown
                            size={21}
                            style={{
                                flexShrink: 0,
                                transition: "transform 0.2s ease",
                                transform: leaveSectionOpen
                                    ? "rotate(180deg)"
                                    : "rotate(0deg)",
                            }}
                        />
                    </div>
                </button>

                {leaveSectionOpen && (
                    <div
                        id="employee-leave-content"
                        style={{ padding: "0 22px 22px" }}
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
                                Your request will follow the configured approval
                                workflow.
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
                                        <option value="sick">Sick Leave</option>
                                        <option value="emergency">
                                            Emergency Leave
                                        </option>
                                        <option value="half_day">
                                            Half-Day Leave
                                        </option>
                                        <option value="short">Short Leave</option>
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
                                                value={leaveForm.halfDayPeriod}
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
                                            <span>Deduct Balance From</span>
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
                                    Select the half of the working day and the
                                    balance from which the leave should be
                                    deducted.
                                </p>
                            )}

                            {isSickLeave && (
                                <label className="leave-field">
                                    <span>
                                        Medical Certificate (PDF, DOC, DOCX)
                                    </span>
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleCertificateChange}
                                        disabled={leaveSaving}
                                    />
                                    <small>
                                        {medicalCertificate
                                            ? `Selected: ${medicalCertificate.name}`
                                            : "A certificate is required by the server when consecutive sick leave reaches 3 calendar days. Maximum 5 MB."}
                                    </small>
                                </label>
                            )}

                            <label className="leave-field leave-reason-field">
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
                                    Your request remains pending until the
                                    authorized reviewers respond.
                                </p>

                                <button
                                    type="submit"
                                    className="attendance-primary-btn"
                                    disabled={leaveSaving || !token}
                                >
                                    {leaveSaving ? (
                                        <RefreshCw
                                            size={16}
                                            className="attendance-spin"
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
                                        Track submitted requests and their
                                        current review stage.
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
                                                ? "attendance-spin"
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
                                        Your submitted requests will appear
                                        here.
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
                                                <th>Approval Stage</th>
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
                                                                        {
                                                                            request.startTime
                                                                        }{" "}
                                                                        –{" "}
                                                                        {
                                                                            request.endTime
                                                                        }
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

                                                            {request
                                                                .medicalCertificateFile
                                                                ?.originalName && (
                                                                    <small className="leave-table-subtext">
                                                                        Certificate
                                                                        attached
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
                                                            {request.reason ||
                                                                "—"}
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

                                                        <td>
                                                            <span
                                                                className={`leave-request-status ${getLeaveStatusClass(
                                                                    request.status
                                                                )}`}
                                                            >
                                                                {getApprovalStageLabel(
                                                                    request
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
                                                                    ? `Approved${request
                                                                        .reviewedBy
                                                                        ?.name
                                                                        ? ` by ${request.reviewedBy.name}`
                                                                        : ""
                                                                    }`
                                                                    : request.managerDecision ===
                                                                        "approved"
                                                                        ? "Manager approved; awaiting next reviewer"
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
                    </div>
                )}
            </section>

            <section className="attendance-section">
                <button
                    type="button"
                    className="attendance-section-heading"
                    style={accordionButtonStyle}
                    aria-expanded={historySectionOpen}
                    aria-controls="employee-monthly-history"
                    onClick={() =>
                        setHistorySectionOpen((open) => !open)
                    }
                >
                    <div>
                        <h2>
                            <CalendarDays size={21} />
                            Monthly Attendance History
                        </h2>
                        <p>
                            View your attendance records and total working hours
                            by month.
                        </p>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <span className="attendance-record-count">
                            {records.length} Records
                        </span>
                        <ChevronDown
                            size={21}
                            style={{
                                flexShrink: 0,
                                transition: "transform 0.2s ease",
                                transform: historySectionOpen
                                    ? "rotate(180deg)"
                                    : "rotate(0deg)",
                            }}
                        />
                    </div>
                </button>

                {historySectionOpen && (
                    <div id="employee-monthly-history">
                        <div className="attendance-section-heading">
                            <div>
                                <h2>{getMonthLabel(selectedMonth)}</h2>
                                <p>
                                    Choose a month to view its recorded
                                    attendance.
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
                                        {formatDuration(
                                            monthlyStats.totalMinutes
                                        )}
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
                                        {sortedRecords.map(
                                            (record, index) => (
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
                                                    <td>
                                                        {formatTime(
                                                            record.checkIn
                                                        )}
                                                    </td>
                                                    <td>
                                                        {formatTime(
                                                            record.checkOut
                                                        )}
                                                    </td>
                                                    <td>
                                                        {record.checkIn &&
                                                            record.status !==
                                                            "on_leave"
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
                                                            {getRecordStatus(
                                                                record
                                                            )}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        )}
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