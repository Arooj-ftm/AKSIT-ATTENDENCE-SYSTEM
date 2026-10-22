import { useCallback, useEffect, useMemo, useState } from "react";

import {
    CalendarCheck,
    CalendarDays,
    Clock3,
    CheckCircle2,
    RefreshCw,
    AlertCircle,
    Timer,
    LogIn,
    LogOut,
    FileText,
    Send,
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

const getId = (value) =>
    String(value?._id || value?.id || value || "");

const getRecordUserId = (record) =>
    getId(record?.userId || record?.user);

const formatTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDisplayDate = (value) => {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatDuration = (minutes) => {
    const safeMinutes = Math.max(0, Math.floor(minutes || 0));

    return `${Math.floor(safeMinutes / 60)}h ${safeMinutes % 60}m`;
};

const getDurationMinutes = (checkIn, checkOut) => {
    if (!checkIn) return 0;

    const start = new Date(checkIn).getTime();
    const end = checkOut
        ? new Date(checkOut).getTime()
        : Date.now();

    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

    return Math.max(0, Math.floor((end - start) / 60000));
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

const getResponseRequests = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.requests)) return data.requests;
    if (Array.isArray(data?.leaves)) return data.leaves;
    if (Array.isArray(data?.data)) return data.data;

    return [];
};

const getLeaveTypeLabel = (type) => {
    const labels = {
        annual: "Annual Leave",
        casual: "Casual Leave",
        sick: "Sick Leave",
        short: "Short Leave",
        emergency: "Emergency Leave",
        half_day: "Half-Day Leave",
    };

    return labels[type] || type || "Leave";
};

const getLeaveErrorMessage = (error, fallback) =>
    error?.message || fallback;

const getCalendarDayCount = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
    ) {
        return 0;
    }

    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
};

const getCertificateExtension = (fileName) =>
    String(fileName || "").split(".").pop().toLowerCase();

const validateCertificate = (file) => {
    if (!file) return "";

    const extension = getCertificateExtension(file.name);

    if (!ALLOWED_CERTIFICATE_EXTENSIONS.includes(extension)) {
        return "Medical certificate must be a PDF, DOC, or DOCX file.";
    }

    if (file.size > MAX_CERTIFICATE_SIZE) {
        return "Medical certificate must not exceed 5 MB.";
    }

    return "";
};

const getStatusLabel = (status) => {
    const normalized = String(status || "pending").toLowerCase();

    return normalized.replaceAll("_", " ");
};

export default function HRAttendance() {
    const auth = useAuth();
    const token = auth?.token;

    const currentUser =
        auth?.user ||
        auth?.currentUser ||
        auth?.employee ||
        auth?.profile ||
        null;

    const currentUserId = getId(currentUser?._id || currentUser?.id);
    const currentUserEmail = String(currentUser?.email || "").toLowerCase();

    const today = formatDate(new Date());
    const currentMonth = getCurrentMonth();

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [myLeaveRequests, setMyLeaveRequests] = useState([]);
    const [leaveHistoryLoading, setLeaveHistoryLoading] = useState(false);
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [leaveError, setLeaveError] = useState("");
    const [leaveNotice, setLeaveNotice] = useState("");

    const [medicalCertificate, setMedicalCertificate] = useState(null);

    const [leaveForm, setLeaveForm] = useState({
        leaveType: "casual",
        startDate: today,
        endDate: today,
        startTime: "",
        endTime: "",
        halfDayPeriod: "first_half",
        balanceLeaveType: "casual",
        reason: "",
    });

    const [leaveSectionOpen, setLeaveSectionOpen] = useState(true);
    const [historySectionOpen, setHistorySectionOpen] = useState(true);

    // Load attendance for the selected month.
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

            setRecords(Array.isArray(data?.records) ? data.records : []);
        } catch (err) {
            setError(err.message || "Unable to load attendance.");
        } finally {
            setLoading(false);
        }
    }, [token, selectedMonth]);

    // Load the HR user's own leave requests.
    const loadMyLeaveRequests = useCallback(async () => {
        if (!token) {
            setMyLeaveRequests([]);
            setLeaveHistoryLoading(false);
            return;
        }

        setLeaveHistoryLoading(true);

        try {
            const data = await apiRequest("/api/leaves/mine", {}, token);

            if (data?.success === false) {
                throw new Error(
                    data.message || "Unable to load leave history."
                );
            }

            setMyLeaveRequests(getResponseRequests(data));
            setLeaveError("");
        } catch (err) {
            setLeaveError(
                getLeaveErrorMessage(
                    err,
                    "Unable to load your leave history."
                )
            );
        } finally {
            setLeaveHistoryLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    useEffect(() => {
        loadMyLeaveRequests();
    }, [loadMyLeaveRequests]);

    const myRecords = useMemo(() => {
        return records
            .filter((record) => {
                const recordUserId = getRecordUserId(record);

                const recordEmail = String(
                    record?.user?.email || record?.email || ""
                ).toLowerCase();

                if (currentUserId && recordUserId) {
                    return recordUserId === currentUserId;
                }

                return Boolean(
                    currentUserEmail &&
                    recordEmail &&
                    currentUserEmail === recordEmail
                );
            })
            .sort((a, b) =>
                String(b.date).localeCompare(String(a.date))
            );
    }, [records, currentUserId, currentUserEmail]);

    const todayRecord = useMemo(
        () => myRecords.find((record) => record.date === today) || null,
        [myRecords, today]
    );

    const workingMinutes = todayRecord?.checkIn
        ? getDurationMinutes(todayRecord.checkIn, todayRecord.checkOut)
        : 0;

    const monthlyStats = useMemo(() => {
        const attendedDays = myRecords.filter(
            (record) => record.checkIn && record.status !== "on_leave"
        );

        const completedDays = attendedDays.filter(
            (record) => record.checkOut
        );

        const totalMinutes = attendedDays.reduce((total, record) => {
            // Do not count an unfinished historical shift up to the current time.
            if (!record.checkOut && record.date !== today) {
                return total;
            }

            return (
                total +
                getDurationMinutes(record.checkIn, record.checkOut)
            );
        }, 0);

        return {
            days: attendedDays.length,
            completed: completedDays.length,
            totalMinutes,
            onLeave: myRecords.filter(
                (record) => record.status === "on_leave"
            ).length,
        };
    }, [myRecords, today]);

    const handleAttendanceAction = async (action) => {
        if (!token || actionLoading) return;

        setActionLoading(true);
        setError("");
        setNotice("");

        try {
            const endpoint =
                action === "check-in"
                    ? "/api/attendance/check-in"
                    : "/api/attendance/check-out";

            const data = await apiRequest(
                endpoint,
                { method: "POST" },
                token
            );

            if (data?.success === false) {
                throw new Error(
                    data.message ||
                    `Unable to ${action === "check-in" ? "check in" : "check out"
                    }.`
                );
            }

            setNotice(
                action === "check-in"
                    ? "You have successfully checked in."
                    : "You have successfully checked out."
            );

            await loadAttendance();
        } catch (err) {
            setError(err.message || "Attendance action failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveFormChange = (event) => {
        const { name, value } = event.target;

        setLeaveForm((previous) => {
            const updated = { ...previous, [name]: value };

            if (name === "leaveType") {
                if (value !== "short") {
                    updated.startTime = "";
                    updated.endTime = "";
                }

                if (value === "half_day") {
                    updated.endDate = updated.startDate;
                    updated.startTime = "";
                    updated.endTime = "";
                }

                if (value !== "half_day") {
                    updated.halfDayPeriod = "first_half";
                    updated.balanceLeaveType = "casual";
                }
            }

            if (name === "startDate") {
                if (
                    updated.endDate < value ||
                    updated.leaveType === "half_day"
                ) {
                    updated.endDate = value;
                }
            }

            if (name === "endDate" && updated.leaveType === "half_day") {
                updated.endDate = updated.startDate;
            }

            if (
                name === "balanceLeaveType" &&
                !["annual", "casual", "sick"].includes(value)
            ) {
                updated.balanceLeaveType = "casual";
            }

            return updated;
        });
    };

    const handleCertificateChange = (event) => {
        const file = event.target.files?.[0] || null;

        setLeaveError("");
        setLeaveNotice("");

        const validationError = validateCertificate(file);

        if (validationError) {
            setMedicalCertificate(null);
            event.target.value = "";
            setLeaveError(validationError);
            return;
        }

        setMedicalCertificate(file);
    };

    const handleLeaveSubmit = async (event) => {
        event.preventDefault();

        if (!token || leaveSubmitting) return;

        setLeaveError("");
        setLeaveNotice("");

        const {
            leaveType,
            startDate,
            endDate,
            startTime,
            endTime,
            halfDayPeriod,
            balanceLeaveType,
            reason,
        } = leaveForm;

        if (!startDate || !endDate || endDate < startDate) {
            setLeaveError("Please select valid leave dates.");
            return;
        }

        if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
            setLeaveError(
                "Please submit separate leave requests for different calendar years."
            );
            return;
        }

        if (!reason.trim()) {
            setLeaveError("Please enter a reason for your leave.");
            return;
        }

        if (leaveType === "half_day" && startDate !== endDate) {
            setLeaveError("Half-Day Leave must be requested for a single day.");
            return;
        }

        if (
            leaveType === "half_day" &&
            !["first_half", "second_half"].includes(halfDayPeriod)
        ) {
            setLeaveError("Please select the half-day period.");
            return;
        }

        if (
            leaveType === "half_day" &&
            !["annual", "casual", "sick"].includes(balanceLeaveType)
        ) {
            setLeaveError(
                "Please select which leave balance should be used for your half-day."
            );
            return;
        }

        if (
            leaveType === "short" &&
            (!startTime || !endTime || endTime <= startTime)
        ) {
            setLeaveError("Please select a valid start time and end time.");
            return;
        }

        if (leaveType === "short") {
            const [startHour, startMinute] = startTime.split(":").map(Number);
            const [endHour, endMinute] = endTime.split(":").map(Number);

            const startMinutes = startHour * 60 + startMinute;
            const endMinutes = endHour * 60 + endMinute;
            const duration = endMinutes - startMinutes;

            if (duration > 120) {
                setLeaveError("Short Leave cannot exceed 120 minutes.");
                return;
            }
        }

        if (
            leaveType === "sick" &&
            getCalendarDayCount(startDate, endDate) >= 3 &&
            !medicalCertificate
        ) {
            setLeaveError(
                "A medical certificate is required for Sick Leave lasting 3 or more consecutive calendar days."
            );
            return;
        }

        const certificateError = validateCertificate(medicalCertificate);

        if (certificateError) {
            setLeaveError(certificateError);
            return;
        }

        setLeaveSubmitting(true);

        try {
            const payload = new FormData();

            payload.append("leaveType", leaveType);
            payload.append("startDate", startDate);
            payload.append("endDate", endDate);
            payload.append("reason", reason.trim());

            if (leaveType === "short") {
                payload.append("startTime", startTime);
                payload.append("endTime", endTime);
            }

            if (leaveType === "half_day") {
                payload.append("halfDayPeriod", halfDayPeriod);
                payload.append("balanceLeaveType", balanceLeaveType);
            }

            if (medicalCertificate) {
                payload.append("medicalCertificate", medicalCertificate);
            }

            const response = await fetch(`${API_BASE_URL}/api/leaves`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: payload,
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data?.success === false) {
                throw new Error(
                    data?.message || "Unable to submit your leave request."
                );
            }

            setLeaveNotice(
                "Your leave request has been submitted. It will be reviewed according to the company's approval process."
            );

            setLeaveForm({
                leaveType: "casual",
                startDate: today,
                endDate: today,
                startTime: "",
                endTime: "",
                halfDayPeriod: "first_half",
                balanceLeaveType: "casual",
                reason: "",
            });

            setMedicalCertificate(null);

            const fileInput = document.getElementById(
                "hr-medical-certificate"
            );

            if (fileInput) {
                fileInput.value = "";
            }

            await loadMyLeaveRequests();
        } catch (err) {
            setLeaveError(
                getLeaveErrorMessage(
                    err,
                    "Unable to submit your leave request."
                )
            );
        } finally {
            setLeaveSubmitting(false);
        }
    };

    const refreshAll = async () => {
        setError("");
        setNotice("");
        setLeaveError("");
        setLeaveNotice("");

        await Promise.all([
            loadAttendance(),
            loadMyLeaveRequests(),
        ]);
    };

    return (
        <main className="main attendance-page" data-role="hr">
            <PageHeader
                eyebrow="HR MANAGEMENT"
                title="Attendance & Leave"
                description="Manage your daily attendance, leave applications, and monthly working history from one place."
                icon={CalendarCheck}
                onRefresh={refreshAll}
                refreshing={
                    loading ||
                    actionLoading ||
                    leaveHistoryLoading ||
                    leaveSubmitting
                }
            />

            {(error || notice) && (
                <div
                    className={`attendance-alert ${error ? "attendance-alert-error" : ""
                        }`}
                    role={error ? "alert" : "status"}
                >
                    {error ? (
                        <AlertCircle size={18} />
                    ) : (
                        <CheckCircle2 size={18} />
                    )}
                    <span>{error || notice}</span>
                </div>
            )}

            {/* Personal attendance */}
            <section className="attendance-section">
                <div className="attendance-section-heading">
                    <div>
                        <h2>My Attendance Today</h2>
                        <p>
                            {formatDisplayDate(today)} · Scheduled hours: 9:00
                            AM – 5:00 PM
                        </p>
                    </div>

                    <span
                        className={`attendance-status ${getStatusClass(
                            todayRecord
                        )}`}
                    >
                        {getStatus(todayRecord)}
                    </span>
                </div>

                <div className="attendance-stats">
                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <LogIn size={20} />
                        </div>
                        <div>
                            <p>Check-in time</p>
                            <h3>{formatTime(todayRecord?.checkIn)}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <p>Check-out time</p>
                            <h3>{formatTime(todayRecord?.checkOut)}</h3>
                        </div>
                    </article>

                    <article className="attendance-stat-card">
                        <div className="attendance-stat-icon">
                            <Timer size={20} />
                        </div>
                        <div>
                            <p>Today's working time</p>
                            <h3>{formatDuration(workingMinutes)}</h3>
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
                            Boolean(todayRecord?.checkIn)
                        }
                    >
                        <LogIn size={16} />
                        {todayRecord?.checkIn ? "Checked In" : "Check In"}
                    </button>

                    <button
                        type="button"
                        className="attendance-secondary-btn"
                        onClick={() => handleAttendanceAction("check-out")}
                        disabled={
                            loading ||
                            actionLoading ||
                            !todayRecord?.checkIn ||
                            Boolean(todayRecord?.checkOut)
                        }
                    >
                        <LogOut size={16} />
                        {todayRecord?.checkOut ? "Checked Out" : "Check Out"}
                    </button>
                </div>
            </section>

            {/* Personal leave management */}
            <details
                className="attendance-section attendance-accordion"
                open={leaveSectionOpen}
                onToggle={(event) =>
                    setLeaveSectionOpen(event.currentTarget.open)
                }
            >
                <summary className="attendance-accordion-summary">
                    <div className="attendance-accordion-title">
                        <span className="attendance-accordion-icon">
                            <CalendarCheck size={22} />
                        </span>

                        <span>
                            <strong>My Leave Management</strong>
                            <small>
                                Submit leave requests and track their status
                            </small>
                        </span>
                    </div>

                    <CalendarCheck
                        className="attendance-accordion-chevron"
                        size={21}
                    />
                </summary>

                <div className="attendance-accordion-content">
                    {(leaveError || leaveNotice) && (
                        <div
                            className={`attendance-alert ${leaveError ? "attendance-alert-error" : ""
                                }`}
                            role={leaveError ? "alert" : "status"}
                        >
                            {leaveError ? (
                                <AlertCircle size={18} />
                            ) : (
                                <CheckCircle2 size={18} />
                            )}
                            <span>{leaveError || leaveNotice}</span>
                        </div>
                    )}

                    <section className="attendance-section hr-leave-section">
                        <div className="attendance-section-heading">
                            <div>
                                <h2>Apply for Leave</h2>
                                <p>
                                    Submit a personal leave request for review.
                                </p>
                            </div>
                        </div>

                        <form
                            className="hr-leave-form"
                            onSubmit={handleLeaveSubmit}
                        >
                            <div className="hr-leave-form-grid">
                                <label className="hr-leave-field">
                                    <span>Leave type</span>
                                    <select
                                        name="leaveType"
                                        value={leaveForm.leaveType}
                                        onChange={handleLeaveFormChange}
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
                                        <option value="short">
                                            Short Leave
                                        </option>
                                        <option value="emergency">
                                            Emergency Leave
                                        </option>
                                        <option value="half_day">
                                            Half-Day Leave
                                        </option>
                                    </select>
                                </label>

                                <label className="hr-leave-field">
                                    <span>Start date</span>
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={leaveForm.startDate}
                                        min={today}
                                        onChange={handleLeaveFormChange}
                                        required
                                    />
                                </label>

                                <label className="hr-leave-field">
                                    <span>End date</span>
                                    <input
                                        type="date"
                                        name="endDate"
                                        value={leaveForm.endDate}
                                        min={leaveForm.startDate || today}
                                        max={
                                            leaveForm.leaveType === "half_day"
                                                ? leaveForm.startDate
                                                : undefined
                                        }
                                        disabled={
                                            leaveForm.leaveType === "half_day"
                                        }
                                        onChange={handleLeaveFormChange}
                                        required
                                    />
                                </label>

                                {leaveForm.leaveType === "short" && (
                                    <>
                                        <label className="hr-leave-field">
                                            <span>Start time</span>
                                            <input
                                                type="time"
                                                name="startTime"
                                                value={leaveForm.startTime}
                                                onChange={handleLeaveFormChange}
                                                required
                                            />
                                        </label>

                                        <label className="hr-leave-field">
                                            <span>End time</span>
                                            <input
                                                type="time"
                                                name="endTime"
                                                value={leaveForm.endTime}
                                                onChange={handleLeaveFormChange}
                                                required
                                            />
                                        </label>
                                    </>
                                )}

                                {leaveForm.leaveType === "half_day" && (
                                    <>
                                        <label className="hr-leave-field">
                                            <span>Half-day period</span>
                                            <select
                                                name="halfDayPeriod"
                                                value={leaveForm.halfDayPeriod}
                                                onChange={handleLeaveFormChange}
                                                required
                                            >
                                                <option value="first_half">
                                                    First Half
                                                </option>
                                                <option value="second_half">
                                                    Second Half
                                                </option>
                                            </select>
                                        </label>

                                        <label className="hr-leave-field">
                                            <span>Use leave balance</span>
                                            <select
                                                name="balanceLeaveType"
                                                value={leaveForm.balanceLeaveType}
                                                onChange={handleLeaveFormChange}
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
                            </div>

                            {leaveForm.leaveType === "short" && (
                                <p className="hr-leave-hint">
                                    Short Leave cannot exceed 120 minutes and
                                    must follow your company's policy.
                                </p>
                            )}

                            {leaveForm.leaveType === "half_day" && (
                                <p className="hr-leave-hint">
                                    Half-Day Leave is for one day. Select the
                                    half-day period and the leave balance to use.
                                </p>
                            )}

                            {leaveForm.leaveType === "sick" && (
                                <div className="hr-leave-field">
                                    <span>
                                        Medical certificate (optional unless required)
                                    </span>

                                    <label
                                        className="hr-leave-certificate"
                                        htmlFor="hr-medical-certificate"
                                    >
                                        <Paperclip size={17} />
                                        <span>
                                            {medicalCertificate
                                                ? medicalCertificate.name
                                                : "Choose medical certificate"}
                                        </span>
                                        <input
                                            id="hr-medical-certificate"
                                            type="file"
                                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                            onChange={handleCertificateChange}
                                        />
                                    </label>

                                    {medicalCertificate && (
                                        <button
                                            type="button"
                                            className="attendance-secondary-btn"
                                            onClick={() => {
                                                setMedicalCertificate(null);

                                                const input =
                                                    document.getElementById(
                                                        "hr-medical-certificate"
                                                    );

                                                if (input) input.value = "";
                                            }}
                                        >
                                            <Trash2 size={15} />
                                            Remove certificate
                                        </button>
                                    )}

                                    <p className="hr-leave-hint">
                                        PDF, DOC, or DOCX, up to 5 MB. A
                                        certificate is required for Sick Leave
                                        lasting 3 or more consecutive calendar
                                        days.
                                    </p>
                                </div>
                            )}

                            <label className="hr-leave-field">
                                <span>Reason for leave</span>
                                <textarea
                                    name="reason"
                                    value={leaveForm.reason}
                                    onChange={handleLeaveFormChange}
                                    placeholder="Explain why you need leave..."
                                    rows={3}
                                    maxLength={1000}
                                    required
                                />
                            </label>

                            <div className="hr-leave-form-footer">
                                <span>
                                    Your request will follow the configured
                                    approval process.
                                </span>

                                <button
                                    type="submit"
                                    className="attendance-primary-btn"
                                    disabled={leaveSubmitting}
                                >
                                    {leaveSubmitting ? (
                                        <RefreshCw size={16} />
                                    ) : (
                                        <Send size={16} />
                                    )}

                                    {leaveSubmitting
                                        ? "Submitting..."
                                        : "Submit Request"}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="attendance-section hr-leave-section">
                        <div className="attendance-section-heading">
                            <div>
                                <h2>My Leave History</h2>
                                <p>
                                    Track the status of your submitted requests.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="attendance-secondary-btn"
                                onClick={loadMyLeaveRequests}
                                disabled={leaveHistoryLoading}
                            >
                                <RefreshCw
                                    size={16}
                                    className={
                                        leaveHistoryLoading
                                            ? "hr-attendance-refresh-icon is-spinning"
                                            : ""
                                    }
                                />
                                Refresh
                            </button>
                        </div>

                        {leaveHistoryLoading ? (
                            <div className="attendance-empty">
                                <RefreshCw size={22} />
                                <p>Loading your leave history...</p>
                            </div>
                        ) : myLeaveRequests.length === 0 ? (
                            <div className="attendance-empty">
                                <FileText size={24} />
                                <h3>No leave requests yet</h3>
                                <p>
                                    Your submitted requests will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="attendance-table-wrap">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th>Leave type</th>
                                            <th>Dates</th>
                                            <th>Reason</th>
                                            <th>Status</th>
                                            <th>Review details</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {myLeaveRequests.map(
                                            (request, index) => (
                                                <tr
                                                    key={
                                                        getId(
                                                            request._id ||
                                                            request.id
                                                        ) || index
                                                    }
                                                >
                                                    <td>
                                                        {getLeaveTypeLabel(
                                                            request.leaveType
                                                        )}

                                                        {request.leaveType ===
                                                            "short" &&
                                                            request.startTime &&
                                                            request.endTime && (
                                                                <small className="hr-leave-subtext">
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
                                                            "half_day" && (
                                                                <small className="hr-leave-subtext">
                                                                    {request.halfDayPeriod ===
                                                                        "second_half"
                                                                        ? "Second Half"
                                                                        : "First Half"}
                                                                    {request.balanceLeaveType
                                                                        ? ` · ${getLeaveTypeLabel(
                                                                            request.balanceLeaveType
                                                                        )} balance`
                                                                        : ""}
                                                                </small>
                                                            )}

                                                        {request.medicalCertificate && (
                                                            <small className="hr-leave-subtext">
                                                                Medical certificate attached
                                                            </small>
                                                        )}
                                                    </td>

                                                    <td>
                                                        {formatDisplayDate(
                                                            request.startDate
                                                        )}

                                                        {request.endDate !==
                                                            request.startDate && (
                                                                <small className="hr-leave-subtext">
                                                                    To{" "}
                                                                    {formatDisplayDate(
                                                                        request.endDate
                                                                    )}
                                                                </small>
                                                            )}
                                                    </td>

                                                    <td className="hr-leave-reason">
                                                        {request.reason || "—"}
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`hr-leave-status hr-leave-status-${String(
                                                                request.status ||
                                                                "pending"
                                                            ).toLowerCase()}`}
                                                        >
                                                            {getStatusLabel(
                                                                request.status
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {request.rejectionReason ||
                                                            (request.reviewedAt
                                                                ? `Reviewed ${formatDisplayDate(
                                                                    String(
                                                                        request.reviewedAt
                                                                    ).slice(
                                                                        0,
                                                                        10
                                                                    )
                                                                )}`
                                                                : "Awaiting review")}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </details>

            {/* Personal monthly attendance history */}
            <details
                className="attendance-section attendance-accordion"
                open={historySectionOpen}
                onToggle={(event) =>
                    setHistorySectionOpen(event.currentTarget.open)
                }
            >
                <summary className="attendance-accordion-summary">
                    <div className="attendance-accordion-title">
                        <span className="attendance-accordion-icon">
                            <CalendarDays size={22} />
                        </span>

                        <span>
                            <strong>Monthly Attendance History</strong>
                            <small>
                                Your attendance records and working hours by
                                month
                            </small>
                        </span>
                    </div>

                    <CalendarCheck
                        className="attendance-accordion-chevron"
                        size={21}
                    />
                </summary>

                <div className="attendance-accordion-content">
                    <section className="attendance-section">
                        <div className="attendance-section-heading">
                            <div>
                                <h2>My Monthly Summary</h2>
                                <p>
                                    Review your recorded attendance for the
                                    selected month.
                                </p>
                            </div>

                            <div className="attendance-month-picker">
                                <CalendarDays size={17} />
                                <input
                                    type="month"
                                    aria-label="Select attendance month"
                                    value={selectedMonth}
                                    max={currentMonth}
                                    onChange={(event) =>
                                        setSelectedMonth(event.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="attendance-stats">
                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <CalendarCheck size={20} />
                                </div>
                                <div>
                                    <p>Days checked in</p>
                                    <h3>{monthlyStats.days}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <p>Completed days</p>
                                    <h3>{monthlyStats.completed}</h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <p>Total working time</p>
                                    <h3>
                                        {formatDuration(
                                            monthlyStats.totalMinutes
                                        )}
                                    </h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <CalendarDays size={20} />
                                </div>
                                <div>
                                    <p>Days on leave</p>
                                    <h3>{monthlyStats.onLeave}</h3>
                                </div>
                            </article>
                        </div>

                        {loading ? (
                            <div className="attendance-empty">
                                <RefreshCw size={22} />
                                <p>Loading your monthly history...</p>
                            </div>
                        ) : myRecords.length === 0 ? (
                            <div className="attendance-empty">
                                <CalendarDays size={24} />
                                <h3>No attendance history</h3>
                                <p>
                                    No attendance records were found for this
                                    month.
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
                                            <th>Working time</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {myRecords.map((record, index) => (
                                            <tr
                                                key={
                                                    getId(
                                                        record._id || record.id
                                                    ) || index
                                                }
                                            >
                                                <td>
                                                    {formatDisplayDate(
                                                        record.date
                                                    )}
                                                </td>
                                                <td>
                                                    {formatTime(record.checkIn)}
                                                </td>
                                                <td>
                                                    {formatTime(
                                                        record.checkOut
                                                    )}
                                                </td>
                                                <td>
                                                    {record.checkIn
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
                                                        {getStatus(record)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </details>
        </main>
    );
}