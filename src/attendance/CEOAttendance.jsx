import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CalendarCheck,
    CalendarDays,
    CheckCircle2,
    RefreshCw,
    AlertCircle,
    Timer,
    LogIn,
    LogOut,
    Clock3,
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

const getId = (value) => {
    if (value && typeof value === "object") {
        return String(value._id ?? value.id ?? "");
    }

    return String(value ?? "");
};

const getRecordUserId = (record) =>
    getId(record?.userId ?? record?.user);

const getRecordDate = (record) => {
    if (!record?.date) return "";

    const value = String(record.date);

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "" : formatDate(date);
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
    if (record.status === "on_leave" || record.status === "leave") {
        return "On leave";
    }
    if (record.checkIn && record.checkOut) return "Completed";
    if (record.checkIn) return "Checked in";

    return "Not checked in";
};

const getStatusClass = (record) => {
    if (!record) return "absent";
    if (record.status === "on_leave" || record.status === "leave") {
        return "leave";
    }
    if (record.checkIn && record.checkOut) return "present";
    if (record.checkIn) return "working";

    return "absent";
};

const normalizeMonth = (value) => {
    const match = String(value || "")
        .trim()
        .match(/^(\d{4})-(\d{1,2})$/);

    if (!match) return getCurrentMonth();

    const monthNumber = Number(match[2]);

    if (monthNumber < 1 || monthNumber > 12) {
        return getCurrentMonth();
    }

    const normalized =
        `${match[1]}-${String(monthNumber).padStart(2, "0")}`;

    return normalized > getCurrentMonth()
        ? getCurrentMonth()
        : normalized;
};

export default function CEOAttendance() {
    const { user, token } = useAuth();

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [records, setRecords] = useState([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [clockTick, setClockTick] = useState(Date.now());

    const today = formatDate();
    const currentMonth = getCurrentMonth();
    const currentUserId = getId(user);

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
                    data.message || "Unable to load your attendance."
                );
            }

            const allRecords = Array.isArray(data?.records)
                ? data.records
                : [];

            // Only keep the logged-in CEO's own attendance records.
            const myRecords = allRecords.filter(
                (record) =>
                    getRecordUserId(record) === currentUserId
            );

            myRecords.sort((a, b) =>
                getRecordDate(b).localeCompare(getRecordDate(a))
            );

            setRecords(myRecords);
        } catch (err) {
            setRecords([]);
            setError(
                err?.message || "Unable to load your attendance."
            );
        } finally {
            setLoading(false);
        }
    }, [token, selectedMonth, currentUserId]);

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    const refreshAll = useCallback(async () => {
        setNotice("");
        setError("");
        await loadAttendance();
    }, [loadAttendance]);

    const myTodayRecord = useMemo(
        () =>
            records.find(
                (record) => getRecordDate(record) === today
            ) || null,
        [records, today]
    );

    useEffect(() => {
        if (!myTodayRecord?.checkIn || myTodayRecord?.checkOut) {
            return undefined;
        }

        const interval = window.setInterval(() => {
            setClockTick(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, [myTodayRecord?.checkIn, myTodayRecord?.checkOut]);

    const myWorkingMinutes = myTodayRecord?.checkIn
        ? getDurationMinutes(
            myTodayRecord.checkIn,
            myTodayRecord.checkOut,
            clockTick
        )
        : 0;

    const monthlyStats = useMemo(() => {
        let completedRecords = 0;
        let totalWorkingMinutes = 0;

        const attendanceDays = new Set();

        records.forEach((record) => {
            if (!record.checkIn) return;

            attendanceDays.add(getRecordDate(record));

            totalWorkingMinutes += getDurationMinutes(
                record.checkIn,
                record.checkOut,
                clockTick
            );

            if (record.checkOut) {
                completedRecords += 1;
            }
        });

        return {
            attendanceDays: attendanceDays.size,
            completedRecords,
            totalWorkingMinutes,
        };
    }, [records, clockTick]);

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
            setError(
                err?.message || "Attendance action failed."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const isOnLeave =
        myTodayRecord?.status === "on_leave" ||
        myTodayRecord?.status === "leave";

    return (
        <main className="main attendance-page" data-role="ceo">
            <PageHeader
                eyebrow="EXECUTIVE DASHBOARD"
                title="My Attendance"
                description="Manage your own daily attendance, track working hours, and review your monthly attendance history."
                icon={CalendarCheck}
                onRefresh={refreshAll}
                refreshing={loading || actionLoading}
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
                        className={`attendance-status ${getStatusClass(
                            myTodayRecord
                        )}`}
                    >
                        {getStatus(myTodayRecord)}
                    </span>
                </div>

                {loading && !myTodayRecord ? (
                    <div className="attendance-empty">
                        <RefreshCw size={22} />
                        <p>Loading your attendance...</p>
                    </div>
                ) : (
                    <>
                        <div className="attendance-stats">
                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <LogIn size={20} />
                                </div>
                                <div>
                                    <p>Check-in time</p>
                                    <h3>
                                        {formatTime(myTodayRecord?.checkIn)}
                                    </h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <LogOut size={20} />
                                </div>
                                <div>
                                    <p>Check-out time</p>
                                    <h3>
                                        {formatTime(myTodayRecord?.checkOut)}
                                    </h3>
                                </div>
                            </article>

                            <article className="attendance-stat-card">
                                <div className="attendance-stat-icon">
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <p>Today's working time</p>
                                    <h3>
                                        {formatDuration(myWorkingMinutes)}
                                    </h3>
                                </div>
                            </article>
                        </div>

                        <div className="attendance-actions">
                            <button
                                type="button"
                                className="attendance-primary-btn"
                                onClick={() =>
                                    handleAttendanceAction("check-in")
                                }
                                disabled={
                                    loading ||
                                    actionLoading ||
                                    Boolean(myTodayRecord?.checkIn) ||
                                    isOnLeave
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
                                onClick={() =>
                                    handleAttendanceAction("check-out")
                                }
                                disabled={
                                    loading ||
                                    actionLoading ||
                                    !myTodayRecord?.checkIn ||
                                    Boolean(myTodayRecord?.checkOut) ||
                                    isOnLeave
                                }
                            >
                                <LogOut size={17} />
                                Check Out
                            </button>
                        </div>
                    </>
                )}
            </section>

            <section className="attendance-section">
                <div className="attendance-section-heading">
                    <div>
                        <h2>My Monthly Summary</h2>
                        <p>
                            Your attendance overview for{" "}
                            {getMonthLabel(selectedMonth)}.
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
                        <p>Loading your monthly summary...</p>
                    </div>
                ) : (
                    <div className="attendance-stats">
                        <article className="attendance-stat-card">
                            <div className="attendance-stat-icon">
                                <CalendarDays size={20} />
                            </div>
                            <div>
                                <p>Days checked in</p>
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
                                <Clock3 size={20} />
                            </div>
                            <div>
                                <p>Total working time</p>
                                <h3>
                                    {formatDuration(
                                        monthlyStats.totalWorkingMinutes
                                    )}
                                </h3>
                            </div>
                        </article>
                    </div>
                )}
            </section>

            <section className="attendance-section">
                <div className="attendance-section-heading">
                    <div>
                        <h2>My Attendance History</h2>
                        <p>
                            Daily check-in, check-out, and working time for{" "}
                            {getMonthLabel(selectedMonth)}.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="attendance-empty">
                        <RefreshCw size={22} />
                        <p>Loading attendance history...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div className="attendance-empty">
                        <CalendarCheck size={26} />
                        <h3>No attendance records</h3>
                        <p>
                            No attendance records were found for{" "}
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
                                    <th>Working time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {records.map((record, index) => (
                                    <tr
                                        key={
                                            record._id ||
                                            `${getRecordDate(record)}-${index}`
                                        }
                                    >
                                        <td>
                                            {formatDisplayDate(
                                                getRecordDate(record)
                                            )}
                                        </td>

                                        <td>
                                            {formatTime(record.checkIn)}
                                        </td>

                                        <td>
                                            {formatTime(record.checkOut)}
                                        </td>

                                        <td>
                                            {record.checkIn
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
        </main>
    );
}
