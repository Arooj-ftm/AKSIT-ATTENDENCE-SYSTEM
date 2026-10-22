import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    Users,
    UserCheck,
    UserX,
    Clock3,
    Search,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    CalendarCheck,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import "./CompanyAttendance.css";
import PageHeader from "../components/PageHeader";

const getLocalDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const normalizeRole = (role) =>
    String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

const isSystemAdmin = (role) =>
    [
        "admin",
        "super_admin",
        "superadmin",
        "super_user",
        "superuser",
    ].includes(normalizeRole(role));

const getUserId = (record) => {
    const user = record?.userId ?? record?.user;

    if (user && typeof user === "object") {
        return String(user._id ?? user.id ?? "");
    }

    return String(user ?? "");
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

const formatDate = (value) => {
    if (!value) return "";

    const [year, month, day] = String(value).split("-").map(Number);

    if (!year || !month || !day) return value;

    return new Date(year, month - 1, day).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const formatRole = (role) => {
    if (!role) return "—";

    return String(role)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getAttendanceStatus = (record, selectedDate, today) => {
    const rawStatus = String(record?.status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    if (
        [
            "on_leave",
            "leave",
            "approved_leave",
            "on_approved_leave",
        ].includes(rawStatus)
    ) {
        return { label: "On Leave", className: "leave" };
    }

    if (record?.checkIn && record?.checkOut) {
        return { label: "Completed", className: "present" };
    }

    if (record?.checkIn) {
        return { label: "Checked In", className: "working" };
    }

    if (selectedDate > today) {
        return { label: "Upcoming", className: "neutral" };
    }

    return { label: "Absent", className: "absent" };
};

export default function CompanyAttendance() {
    const { token } = useAuth();

    const [selectedDate, setSelectedDate] = useState(getLocalDate);
    const [employees, setEmployees] = useState([]);
    const [records, setRecords] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const today = getLocalDate();

    const loadAttendance = useCallback(
        async (showRefresh = false) => {
            if (!token) {
                setError("Please log in again to view company attendance.");
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (!selectedDate) {
                setError("Please select an attendance date.");
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            try {
                const data = await apiRequest(
                    `/api/attendance?date=${encodeURIComponent(selectedDate)}`,
                    {},
                    token
                );

                if (!data || typeof data !== "object") {
                    throw new Error("Invalid attendance response from server.");
                }

                setEmployees(
                    Array.isArray(data.employees) ? data.employees : []
                );

                setRecords(
                    Array.isArray(data.records) ? data.records : []
                );
            } catch (err) {
                setError(
                    err?.message ||
                    "Unable to load company attendance. Please try again."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [token, selectedDate]
    );

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    const allAttendanceRows = useMemo(() => {
        const recordMap = new Map();

        records.forEach((record) => {
            const id = getUserId(record);

            if (id) {
                recordMap.set(id, record);
            }
        });

        return employees
            .filter((employee) => !isSystemAdmin(employee.role))
            .map((employee) => {
                const id = String(employee._id ?? employee.id ?? "");
                const record = recordMap.get(id) || null;

                return {
                    ...employee,
                    id,
                    record,
                    status: getAttendanceStatus(
                        record,
                        selectedDate,
                        today
                    ),
                };
            });
    }, [employees, records, selectedDate, today]);

    const attendanceRows = useMemo(() => {
        const query = search.trim().toLowerCase();

        return allAttendanceRows.filter((employee) => {
            const matchesSearch =
                !query ||
                [
                    employee.name,
                    employee.email,
                    employee.department,
                    employee.designation,
                ].some((value) =>
                    String(value || "").toLowerCase().includes(query)
                );

            const matchesStatus =
                statusFilter === "all" ||
                employee.status.className === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [allAttendanceRows, search, statusFilter]);

    const stats = useMemo(() => {
        const all = allAttendanceRows;

        return {
            total: all.length,
            completed: all.filter(
                (item) => item.status.label === "Completed"
            ).length,
            working: all.filter(
                (item) => item.status.label === "Checked In"
            ).length,
            leave: all.filter(
                (item) => item.status.label === "On Leave"
            ).length,
            absent: all.filter(
                (item) => item.status.label === "Absent"
            ).length,
        };
    }, [allAttendanceRows]);

    const isFutureDate = selectedDate > today;

    return (
        <main
            className="main attendance-page company-attendance-page"
            data-role="hr"
        >
            <PageHeader
                eyebrow="HR MANAGEMENT"
                title="Company Attendance"
                description="Monitor employee attendance and daily working status across the company."
                icon={CalendarCheck}
                onRefresh={() => loadAttendance(true)}
                refreshing={loading || refreshing}
            />

            {error && (
                <div className="company-attendance-error" role="alert">
                    <AlertCircle size={19} />

                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => loadAttendance(true)}
                        disabled={refreshing}
                    >
                        Try again
                    </button>
                </div>
            )}

            <section className="attendance-stats company-attendance-stats">
                <article className="attendance-stat-card">
                    <div className="company-stat-icon total">
                        <Users size={21} />
                    </div>
                    <div>
                        <p>Total Employees</p>
                        <h3>{loading ? "—" : stats.total}</h3>
                    </div>
                </article>

                <article className="attendance-stat-card">
                    <div className="company-stat-icon present">
                        <UserCheck size={21} />
                    </div>
                    <div>
                        <p>Completed</p>
                        <h3>{loading ? "—" : stats.completed}</h3>
                    </div>
                </article>

                <article className="attendance-stat-card">
                    <div className="company-stat-icon working">
                        <Clock3 size={21} />
                    </div>
                    <div>
                        <p>Currently Working</p>
                        <h3>{loading ? "—" : stats.working}</h3>
                    </div>
                </article>

                <article className="attendance-stat-card">
                    <div className="company-stat-icon leave">
                        <CalendarDays size={21} />
                    </div>
                    <div>
                        <p>On Leave</p>
                        <h3>{loading ? "—" : stats.leave}</h3>
                    </div>
                </article>

                <article className="attendance-stat-card">
                    <div className="company-stat-icon absent">
                        <UserX size={21} />
                    </div>
                    <div>
                        <p>Absent</p>
                        <h3>{loading ? "—" : stats.absent}</h3>
                    </div>
                </article>
            </section>

            <section className="attendance-section company-attendance-section">
                <div className="company-attendance-toolbar">
                    <div>
                        <h2 className="attendance-section-heading">
                            Employee Attendance Records
                        </h2>

                        <p className="company-attendance-subtitle">
                            {selectedDate === today
                                ? "Attendance for today"
                                : `Attendance for ${formatDate(selectedDate)}`}
                        </p>
                    </div>

                    <label className="company-attendance-date">
                        <CalendarDays size={17} />

                        <span className="company-attendance-date-label">
                            Date
                        </span>

                        <input
                            type="date"
                            value={selectedDate}
                            max="9999-12-31"
                            onChange={(event) => {
                                const value = event.target.value;

                                if (value) {
                                    setSelectedDate(value);
                                }
                            }}
                            aria-label="Select attendance date"
                        />
                    </label>
                </div>

                <div className="company-attendance-filters">
                    <label className="company-attendance-search">
                        <Search size={18} />

                        <input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search name, email or department..."
                            aria-label="Search employees"
                        />
                    </label>

                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                        aria-label="Filter attendance status"
                        className="company-attendance-status-filter"
                    >
                        <option value="all">All statuses</option>
                        <option value="present">Completed</option>
                        <option value="working">Checked In</option>
                        <option value="leave">On Leave</option>
                        <option value="absent">Absent</option>
                        <option value="neutral">Upcoming</option>
                    </select>
                </div>

                {loading ? (
                    <div className="attendance-loading">
                        <RefreshCw
                            size={22}
                            className="company-attendance-spinning"
                        />
                        <span>Loading company attendance...</span>
                    </div>
                ) : (
                    <div className="attendance-table-wrap company-attendance-table-wrap">
                        <table className="attendance-table company-attendance-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Department</th>
                                    <th>Role</th>
                                    <th>Check In</th>
                                    <th>Check Out</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {attendanceRows.map((employee) => (
                                    <tr
                                        key={
                                            employee.id ||
                                            employee.email ||
                                            employee.name
                                        }
                                    >
                                        <td>
                                            <div className="company-employee-cell">
                                                <div className="company-employee-avatar">
                                                    {String(employee.name || "E")
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <div className="company-employee-info">
                                                    <strong>
                                                        {employee.name ||
                                                            "Unnamed Employee"}
                                                    </strong>

                                                    <span>
                                                        {employee.email || "—"}
                                                    </span>

                                                    {employee.designation && (
                                                        <small>
                                                            {employee.designation}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td>{employee.department || "—"}</td>
                                        <td>{formatRole(employee.role)}</td>

                                        <td>
                                            {formatTime(
                                                employee.record?.checkIn
                                            )}
                                        </td>

                                        <td>
                                            {formatTime(
                                                employee.record?.checkOut
                                            )}
                                        </td>

                                        <td>
                                            <span
                                                className={`attendance-status ${employee.status.className}`}
                                            >
                                                <span className="company-status-dot" />
                                                {employee.status.label}
                                            </span>
                                        </td>
                                    </tr>
                                ))}

                                {attendanceRows.length === 0 && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="attendance-empty">
                                                <Users size={30} />
                                                <strong>No employees found</strong>
                                                <span>
                                                    Try changing the search,
                                                    date or status filter.
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && !error && (
                    <div className="company-attendance-footer">
                        <CheckCircle2 size={16} />

                        <span>
                            Showing {attendanceRows.length} of{" "}
                            {allAttendanceRows.length} employees
                            {isFutureDate &&
                                " · Future-date attendance is marked as upcoming."}
                        </span>
                    </div>
                )}
            </section>
        </main>
    );
}
