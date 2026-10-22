
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Download,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    XCircle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../api/api";
import "./CTOCompanyAttendance.css";
import PageHeader from "../../components/PageHeader";

const getLocalDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getLocalMonth = () => getLocalDate().slice(0, 7);

const normalize = (value) =>
    String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const formatTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getEmployeeId = (record) => {
    const employee = record?.employeeId;

    if (employee && typeof employee === "object") {
        return String(employee._id || employee.id || "");
    }

    return String(
        employee ||
        record?.userId?._id ||
        record?.userId?.id ||
        record?.userId ||
        record?.user?._id ||
        record?.user?.id ||
        record?.user ||
        record?.employee?._id ||
        record?.employee?.id ||
        record?.employee ||
        record?.id ||
        record?._id ||
        ""
    );
};

const getEmployeeName = (record) => {
    const employee = record?.employeeId;
    const user = record?.user;
    const populatedEmployee = record?.employee;

    return (
        record?.employeeName ||
        record?.name ||
        (typeof employee === "object" && employee?.name) ||
        (typeof user === "object" && user?.name) ||
        (typeof populatedEmployee === "object" &&
            populatedEmployee?.name) ||
        "Unknown employee"
    );
};

const getRoleLabel = (role) => {
    const labels = {
        employee: "Employee",
        manager: "Manager",
        hr: "HR",
        ceo: "CEO",
        cto_md: "CTO / Managing Director",
        super_admin: "Super Admin",
    };

    return labels[normalize(role).replace(/\s+/g, "_")] || role || "—";
};

const getStatus = (record) => {
    if (!record) return "Absent";

    const raw = normalize(
        record.status ||
        record.attendanceStatus ||
        record.dayStatus
    );

    if (
        raw.includes("leave") ||
        raw === "on holiday" ||
        raw === "holiday"
    ) {
        return raw.includes("holiday") ? "Holiday" : "On Leave";
    }

    if (
        raw === "absent" ||
        raw === "not present"
    ) {
        return "Absent";
    }

    if (
        raw === "late" ||
        raw === "late arrival"
    ) {
        return "Late";
    }

    if (
        raw === "half day" ||
        raw === "halfday"
    ) {
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

    if (
        record.checkIn ||
        record.checkInTime ||
        record.checkOut ||
        record.checkOutTime
    ) {
        return "Present";
    }

    return "Absent";
};

const getCheckIn = (record) =>
    record?.checkIn ||
    record?.checkInTime ||
    record?.checkInAt ||
    record?.clockIn ||
    null;

const getCheckOut = (record) =>
    record?.checkOut ||
    record?.checkOutTime ||
    record?.checkOutAt ||
    record?.clockOut ||
    null;

const getWorkedTime = (record) => {
    if (!record) return "—";

    const minutes =
        Number(record.workedMinutes) ||
        Number(record.totalWorkedMinutes) ||
        Number(record.durationMinutes);

    if (minutes > 0) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        return `${hours}h ${remainingMinutes}m`;
    }

    const checkIn = getCheckIn(record);
    const checkOut = getCheckOut(record);

    if (checkIn && checkOut) {
        const start = new Date(checkIn).getTime();
        const end = new Date(checkOut).getTime();

        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
            const totalMinutes = Math.floor((end - start) / 60000);

            return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60
                }m`;
        }
    }

    return checkIn ? "In progress" : "—";
};

const isWorkingDay = (dateString) => {
    if (!dateString) return true;

    const date = new Date(`${dateString}T00:00:00`);
    const day = date.getDay();

    return day !== 0 && day !== 6;
};

export default function CTOCompanyAttendance() {
    const { user, token } = useAuth();

    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [selectedMonth, setSelectedMonth] = useState(getLocalMonth());
    const [viewMode, setViewMode] = useState("daily");

    const loadAttendance = useCallback(
        async (showRefresh = false) => {
            if (!token) {
                setError("Your session has expired. Please log in again.");
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
                const params = new URLSearchParams();

                params.set("date", selectedDate);
                params.set("month", selectedMonth);
                params.set("view", viewMode);

                if (department !== "all") {
                    params.set("department", department);
                }

                const response = await apiRequest(
                    `/api/cto-md/company-attendance?${params.toString()}`,
                    { method: "GET" },
                    token
                );

                const responseRecords =
                    response.records ||
                    response.attendance ||
                    response.rows ||
                    [];

                setRecords(
                    Array.isArray(responseRecords)
                        ? responseRecords
                        : []
                );

                setSummary(response.summary || null);
            } catch (err) {
                setError(
                    err.message ||
                    "Unable to load company attendance."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [token, selectedDate, selectedMonth, viewMode, department]
    );

    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    const departments = useMemo(() => {
        const values = records
            .map((record) => {
                const employee = record.employeeId;
                const user = record.user;
                const populatedEmployee = record.employee;

                return (
                    record.department ||
                    (typeof employee === "object" && employee?.department) ||
                    (typeof user === "object" && user?.department) ||
                    (typeof populatedEmployee === "object" &&
                        populatedEmployee?.department) ||
                    ""
                );
            })
            .filter(Boolean);

        return [...new Set(values)].sort((a, b) =>
            a.localeCompare(b)
        );
    }, [records]);

    const normalizedRecords = useMemo(
        () =>
            records.map((record) => {
                const employee = record.employeeId;
                const user = record.user;
                const populatedEmployee = record.employee;

                const employeeRole =
                    record.role ||
                    (typeof employee === "object" && employee?.role) ||
                    (typeof user === "object" && user?.role) ||
                    (typeof populatedEmployee === "object" &&
                        populatedEmployee?.role) ||
                    "employee";

                return {
                    ...record,
                    _employeeId: getEmployeeId(record),
                    _name: getEmployeeName(record),
                    _email:
                        record.email ||
                        (typeof employee === "object" && employee?.email) ||
                        (typeof user === "object" && user?.email) ||
                        (typeof populatedEmployee === "object" &&
                            populatedEmployee?.email) ||
                        "",
                    _department:
                        record.department ||
                        (typeof employee === "object" && employee?.department) ||
                        (typeof user === "object" && user?.department) ||
                        (typeof populatedEmployee === "object" &&
                            populatedEmployee?.department) ||
                        "Unassigned",
                    _designation:
                        record.designation ||
                        (typeof employee === "object" && employee?.designation) ||
                        (typeof user === "object" && user?.designation) ||
                        (typeof populatedEmployee === "object" &&
                            populatedEmployee?.designation) ||
                        "",
                    _role: employeeRole,
                    _status: getStatus(record),
                    _checkIn: getCheckIn(record),
                    _checkOut: getCheckOut(record),
                };
            }),
        [records]
    );

    const filteredRecords = useMemo(() => {
        const query = search.trim().toLowerCase();

        return normalizedRecords.filter((record) => {
            const matchesSearch =
                !query ||
                [
                    record._name,
                    record._email,
                    record._department,
                    record._designation,
                    getRoleLabel(record._role),
                ].some((value) =>
                    String(value || "").toLowerCase().includes(query)
                );

            const matchesDepartment =
                department === "all" ||
                record._department === department;

            const matchesStatus =
                statusFilter === "all" ||
                normalize(record._status) === normalize(statusFilter);

            return matchesSearch && matchesDepartment && matchesStatus;
        });
    }, [normalizedRecords, search, department, statusFilter]);

    const stats = useMemo(() => {
        const counts = {
            total: normalizedRecords.length,
            present: 0,
            absent: 0,
            late: 0,
            onLeave: 0,
            halfDay: 0,
        };

        normalizedRecords.forEach((record) => {
            switch (record._status) {
                case "Present":
                    counts.present += 1;
                    break;
                case "Absent":
                    counts.absent += 1;
                    break;
                case "Late":
                    counts.late += 1;
                    break;
                case "On Leave":
                    counts.onLeave += 1;
                    break;
                case "Half Day":
                    counts.halfDay += 1;
                    break;
                default:
                    break;
            }
        });

        return {
            total: Number(summary?.totalEmployees ?? counts.total),
            present: Number(summary?.present ?? counts.present),
            absent: Number(summary?.absent ?? counts.absent),
            late: Number(summary?.late ?? counts.late),
            onLeave: Number(summary?.onLeave ?? summary?.onLeaveCount ?? counts.onLeave),
            halfDay: Number(summary?.halfDay ?? counts.halfDay),
        };
    }, [normalizedRecords, summary]);

    const exportCsv = () => {
        const columns = [
            "Employee Name",
            "Email",
            "Role",
            "Department",
            "Designation",
            "Status",
            "Check In",
            "Check Out",
            "Worked Time",
        ];

        const rows = filteredRecords.map((record) => [
            record._name,
            record._email,
            getRoleLabel(record._role),
            record._department,
            record._designation,
            record._status,
            record._checkIn ? formatTime(record._checkIn) : "",
            record._checkOut ? formatTime(record._checkOut) : "",
            getWorkedTime(record),
        ]);

        const escapeCsv = (value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`;

        const csv = [columns, ...rows]
            .map((row) => row.map(escapeCsv).join(","))
            .join("\r\n");

        const blob = new Blob(["\uFEFF", csv], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `company-attendance-${viewMode === "daily" ? selectedDate : selectedMonth}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const currentRole = normalize(user?.role);

    if (currentRole !== "cto md" && currentRole !== "cto_md") {
        return (
            <main className="cto-company-attendance-page">
                <section className="ctoca-access-denied">
                    <ShieldCheck size={34} />
                    <h2>Access restricted</h2>
                    <p>
                        Company-wide attendance is available to CTO /
                        Managing Director accounts only.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="cto-company-attendance-page">
            <PageHeader
                eyebrow="AKSIT GLOBAL · PEOPLE OPERATIONS"
                title="Company Attendance"
                description="Company-wide attendance records across all departments, teams and operational roles."
                icon={CalendarDays}
                onRefresh={() => loadAttendance(true)}
                refreshing={refreshing}
                actions={
                    <button
                        type="button"
                        className="ctoca-button ctoca-button-primary"
                        onClick={exportCsv}
                        disabled={loading || filteredRecords.length === 0}
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                }
                className="ctoca-shared-header"
            />
            {error && (
                <div className="ctoca-alert" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                        type="button"
                        aria-label="Dismiss error"
                        onClick={() => setError("")}
                    >
                        <XCircle size={17} />
                    </button>
                </div>
            )}

            <section className="ctoca-stats-grid">
                <article className="ctoca-stat-card">
                    <div className="ctoca-stat-top">
                        <span className="ctoca-stat-icon ctoca-blue">
                            <Users size={21} />
                        </span>
                        <span className="ctoca-stat-caption">Workforce</span>
                    </div>
                    <strong>{loading ? "—" : stats.total}</strong>
                    <p>Total Employees</p>
                    <span className="ctoca-stat-note">
                        Company-wide records
                    </span>
                </article>

                <article className="ctoca-stat-card">
                    <div className="ctoca-stat-top">
                        <span className="ctoca-stat-icon ctoca-green">
                            <CheckCircle2 size={21} />
                        </span>
                        <span className="ctoca-stat-caption">Attendance</span>
                    </div>
                    <strong>{loading ? "—" : stats.present}</strong>
                    <p>Present Today</p>
                    <span className="ctoca-stat-note">
                        Employees marked present
                    </span>
                </article>

                <article className="ctoca-stat-card">
                    <div className="ctoca-stat-top">
                        <span className="ctoca-stat-icon ctoca-orange">
                            <Clock3 size={21} />
                        </span>
                        <span className="ctoca-stat-caption">Punctuality</span>
                    </div>
                    <strong>{loading ? "—" : stats.late}</strong>
                    <p>Late Arrivals</p>
                    <span className="ctoca-stat-note">
                        Marked late in attendance records
                    </span>
                </article>

                <article className="ctoca-stat-card">
                    <div className="ctoca-stat-top">
                        <span className="ctoca-stat-icon ctoca-purple">
                            <Activity size={21} />
                        </span>
                        <span className="ctoca-stat-caption">Availability</span>
                    </div>
                    <strong>{loading ? "—" : stats.onLeave}</strong>
                    <p>On Approved Leave</p>
                    <span className="ctoca-stat-note">
                        Leave records for the selected date
                    </span>
                </article>
            </section>

            <section className="ctoca-panel">
                <div className="ctoca-panel-heading">
                    <div>
                        <h2>Attendance Register</h2>
                        <p>
                            Review employee attendance, working times and
                            daily status.
                        </p>
                    </div>

                    <span className="ctoca-count-pill">
                        {filteredRecords.length} records
                    </span>
                </div>

                <div className="ctoca-toolbar">
                    <div className="ctoca-view-switch" aria-label="Attendance view">
                        <button
                            type="button"
                            className={viewMode === "daily" ? "active" : ""}
                            onClick={() => setViewMode("daily")}
                        >
                            Daily view
                        </button>
                        <button
                            type="button"
                            className={viewMode === "monthly" ? "active" : ""}
                            onClick={() => setViewMode("monthly")}
                        >
                            Monthly view
                        </button>
                    </div>

                    {viewMode === "daily" ? (
                        <label className="ctoca-date-filter">
                            <CalendarDays size={16} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(event) =>
                                    setSelectedDate(event.target.value)
                                }
                                max={getLocalDate()}
                                aria-label="Attendance date"
                            />
                        </label>
                    ) : (
                        <label className="ctoca-date-filter">
                            <CalendarDays size={16} />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(event) =>
                                    setSelectedMonth(event.target.value)
                                }
                                aria-label="Attendance month"
                            />
                        </label>
                    )}
                </div>

                <div className="ctoca-filters">
                    <label className="ctoca-search">
                        <Search size={17} />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search employee, email, role..."
                        />
                    </label>

                    <select
                        value={department}
                        onChange={(event) => setDepartment(event.target.value)}
                        aria-label="Filter by department"
                    >
                        <option value="all">All departments</option>
                        {departments.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        aria-label="Filter by attendance status"
                    >
                        <option value="all">All statuses</option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Late">Late</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Half Day">Half Day</option>
                    </select>
                </div>

                <div className="ctoca-summary-strip">
                    <div>
                        <span className="ctoca-summary-dot present" />
                        Present <strong>{stats.present}</strong>
                    </div>
                    <div>
                        <span className="ctoca-summary-dot absent" />
                        Absent <strong>{stats.absent}</strong>
                    </div>
                    <div>
                        <span className="ctoca-summary-dot late" />
                        Late <strong>{stats.late}</strong>
                    </div>
                    <div>
                        <span className="ctoca-summary-dot leave" />
                        On Leave <strong>{stats.onLeave}</strong>
                    </div>
                    <div>
                        <span className="ctoca-summary-dot half" />
                        Half Day <strong>{stats.halfDay}</strong>
                    </div>
                </div>

                {loading ? (
                    <div className="ctoca-state">
                        <RefreshCw size={25} className="ctoca-spinning" />
                        <p>Loading company attendance...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="ctoca-state">
                        <CalendarDays size={29} />
                        <h3>No attendance records found</h3>
                        <p>
                            Try another date, department or search term.
                        </p>
                        {!error && (
                            <small>
                                The API must return all company employees,
                                including those without an attendance record.
                            </small>
                        )}
                    </div>
                ) : (
                    <div className="ctoca-table-wrap">
                        <table className="ctoca-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>Check In</th>
                                    <th>Check Out</th>
                                    <th>Working Time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRecords.map((record, index) => (
                                    <tr
                                        key={
                                            record._employeeId ||
                                            record._id ||
                                            `${record._name}-${index}`
                                        }
                                    >
                                        <td>
                                            <div className="ctoca-employee-cell">
                                                <div className="ctoca-avatar">
                                                    {record._name
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                                <div className="ctoca-employee-info">
                                                    <strong>{record._name}</strong>
                                                    <span>
                                                        {record._email || "No email"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <span className="ctoca-role">
                                                {getRoleLabel(record._role)}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="ctoca-department">
                                                <strong>
                                                    {record._department}
                                                </strong>
                                                {record._designation && (
                                                    <span>{record._designation}</span>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            <span className="ctoca-time">
                                                {record._checkIn
                                                    ? formatTime(record._checkIn)
                                                    : "—"}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="ctoca-time">
                                                {record._checkOut
                                                    ? formatTime(record._checkOut)
                                                    : "—"}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="ctoca-worked">
                                                {getWorkedTime(record)}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className={`ctoca-status ctoca-status-${normalize(
                                                    record._status
                                                ).replace(/\s+/g, "-")}`}
                                            >
                                                <span />
                                                {record._status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <footer className="ctoca-panel-footer">
                    <span>
                        Showing {filteredRecords.length} of {normalizedRecords.length} records
                    </span>
                    <span>
                        {viewMode === "daily"
                            ? `Date: ${formatDate(selectedDate)}`
                            : `Month: ${selectedMonth}`}
                    </span>
                </footer>
            </section>

            <section className="ctoca-security-note">
                <ShieldCheck size={21} />
                <div>
                    <strong>Company-wide visibility</strong>
                    <p>
                        This page is for reviewing company attendance.
                        Personal check-in and check-out actions remain on the
                        CTO's separate My Attendance page.
                    </p>
                </div>
            </section>
        </main>
    );
}
