
import { useMemo, useState } from "react";
import {
    CalendarCheck,
    Clock3,
    CheckCircle2,
    XCircle,
    Users,
    Timer,
    LogIn,
    LogOut,
    Search,
    CalendarDays,
    TrendingUp,
    AlertCircle,
} from "lucide-react";
import "./Attendance.css";

const ROLE_OPTIONS = [
    { value: "employee", label: "Employee" },
    { value: "hr", label: "HR" },
    { value: "manager", label: "Manager" },
    { value: "ceo", label: "CEO" },
];

const ROLE_TITLES = {
    employee: "My Attendance",
    hr: "Company Attendance",
    manager: "Team Attendance",
    ceo: "Attendance Overview",
};

const formatDate = (date) =>
    date.toLocaleDateString("en-CA");

const formatTime = (date) =>
    date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

const isSameDay = (first, second) =>
    formatDate(first) === formatDate(second);

export default function Attendance({
    team = [],
    role = "employee",
    onRoleChange,
}) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
    const [records, setRecords] = useState({});
    const [notice, setNotice] = useState("");

    const todayKey = formatDate(new Date());
    const isToday = selectedDate === todayKey;

    const getRecord = (employeeId) =>
        records[`${selectedDate}_${employeeId}`] || null;

    const getEmployeeStatus = (employee) => {
        const record = getRecord(employee.id);

        if (record?.checkIn && record?.checkOut) return "Present";
        if (record?.checkIn) return "Checked in";

        if (employee.status === "On Leave") return "On leave";

        // Demo status for employees without a check-in record.
        if (employee.status === "Remote") return "Remote";

        return "Not checked in";
    };

    const filteredTeam = useMemo(() => {
        return team.filter((employee) => {
            const matchesSearch = `${employee.name} ${employee.role} ${employee.department}`
                .toLowerCase()
                .includes(search.toLowerCase());

            const status = getEmployeeStatus(employee);

            const matchesStatus =
                statusFilter === "All" ||
                (statusFilter === "Present" &&
                    ["Present", "Checked in", "Remote"].includes(status)) ||
                (statusFilter === "Absent" &&
                    ["Not checked in"].includes(status)) ||
                (statusFilter === "On leave" && status === "On leave");

            return matchesSearch && matchesStatus;
        });
    }, [team, search, statusFilter, records, selectedDate]);

    const presentCount = team.filter((employee) =>
        ["Present", "Checked in", "Remote"].includes(
            getEmployeeStatus(employee)
        )
    ).length;

    const leaveCount = team.filter(
        (employee) => getEmployeeStatus(employee) === "On leave"
    ).length;

    const absentCount = Math.max(
        0,
        team.length - presentCount - leaveCount
    );

    const myRecord = getRecord("current-user");
    const myCheckIn = myRecord?.checkIn || null;
    const myCheckOut = myRecord?.checkOut || null;

    const updateMyRecord = (action) => {
        if (!isToday) {
            setNotice("Check-in aur check-out sirf aaj ki date par kar sakte hain.");
            return;
        }

        const now = new Date();

        setRecords((current) => {
            const key = `${todayKey}_current-user`;
            const previous = current[key] || {};

            if (action === "in") {
                if (previous.checkIn) return current;

                return {
                    ...current,
                    [key]: {
                        ...previous,
                        checkIn: now.toISOString(),
                    },
                };
            }

            if (!previous.checkIn || previous.checkOut) return current;

            return {
                ...current,
                [key]: {
                    ...previous,
                    checkOut: now.toISOString(),
                },
            };
        });

        setNotice(
            action === "in"
                ? `Check-in saved at ${formatTime(now)}.`
                : `Check-out saved at ${formatTime(now)}.`
        );
    };

    const getDuration = () => {
        if (!myCheckIn) return "—";

        const start = new Date(myCheckIn).getTime();
        const end = myCheckOut
            ? new Date(myCheckOut).getTime()
            : Date.now();

        const minutes = Math.max(0, Math.floor((end - start) / 60000));
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        return `${hours}h ${remainingMinutes}m`;
    };

    const employeeView = role === "employee";

    return (
        <main className="main attendance-page" data-role={role}>
            <header className="attendance-hero">
                <div className="attendance-hero-top">
                    <div className="attendance-hero-copy">
                        <span className="attendance-eyebrow">
                            <CalendarCheck size={15} />
                            Attendance management
                        </span>

                        <h1>{ROLE_TITLES[role] || "Attendance"}</h1>

                        <p>
                            Track working hours, review attendance and manage daily records.
                        </p>
                    </div>

                    <div className="attendance-role-control">
                        <label htmlFor="attendance-role">View as</label>
                        <select
                            id="attendance-role"
                            value={role}
                            onChange={(event) => onRoleChange?.(event.target.value)}
                        >
                            {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="attendance-hero-footer">
                    <span>
                        <CalendarDays size={15} />
                        {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                            "en-US",
                            {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            }
                        )}
                    </span>

                    <label className="attendance-date-picker">
                        <span>Date</span>
                        <input
                            type="date"
                            value={selectedDate}
                            max={todayKey}
                            onChange={(event) => {
                                setSelectedDate(event.target.value);
                                setNotice("");
                            }}
                        />
                    </label>
                </div>
            </header>

            {notice && (
                <div className="attendance-notice" role="status">
                    <CheckCircle2 size={17} />
                    <span>{notice}</span>
                    <button
                        type="button"
                        aria-label="Dismiss message"
                        onClick={() => setNotice("")}
                    >
                        ×
                    </button>
                </div>
            )}

            {employeeView ? (
                <>
                    <section className="attendance-stats">
                        <article className="attendance-stat">
                            <div className="attendance-stat-icon blue">
                                <Clock3 size={20} />
                            </div>
                            <div>
                                <p>Today's check-in</p>
                                <h2>{myCheckIn ? formatTime(new Date(myCheckIn)) : "—"}</h2>
                                <span>{myCheckIn ? "Check-in recorded" : "Not checked in yet"}</span>
                            </div>
                        </article>

                        <article className="attendance-stat">
                            <div className="attendance-stat-icon green">
                                <LogOut size={20} />
                            </div>
                            <div>
                                <p>Today's check-out</p>
                                <h2>{myCheckOut ? formatTime(new Date(myCheckOut)) : "—"}</h2>
                                <span>{myCheckOut ? "Check-out recorded" : "Pending"}</span>
                            </div>
                        </article>

                        <article className="attendance-stat">
                            <div className="attendance-stat-icon purple">
                                <Timer size={20} />
                            </div>
                            <div>
                                <p>Time worked</p>
                                <h2>{getDuration()}</h2>
                                <span>{myCheckIn && !myCheckOut ? "Session in progress" : "Today's duration"}</span>
                            </div>
                        </article>
                    </section>

                    <section className="attendance-card attendance-punch-card">
                        <div className="attendance-section-heading">
                            <div>
                                <h2>Daily time clock</h2>
                                <p>Record your start and end time for today.</p>
                            </div>
                            <span className={`attendance-status-pill ${myCheckOut ? "done" : myCheckIn ? "working" : "pending"}`}>
                                {myCheckOut ? "Day completed" : myCheckIn ? "Currently working" : "Not started"}
                            </span>
                        </div>

                        {!isToday && (
                            <div className="attendance-inline-warning">
                                <AlertCircle size={17} />
                                Historical dates are view-only. Select today to record your attendance.
                            </div>
                        )}

                        <div className="attendance-punch-actions">
                            <button
                                type="button"
                                className="attendance-action-btn primary"
                                onClick={() => updateMyRecord("in")}
                                disabled={!isToday || Boolean(myCheckIn)}
                            >
                                <LogIn size={18} />
                                {myCheckIn ? "Checked in" : "Check in"}
                            </button>

                            <button
                                type="button"
                                className="attendance-action-btn secondary"
                                onClick={() => updateMyRecord("out")}
                                disabled={!isToday || !myCheckIn || Boolean(myCheckOut)}
                            >
                                <LogOut size={18} />
                                {myCheckOut ? "Checked out" : "Check out"}
                            </button>
                        </div>

                        <p className="attendance-demo-note">
                            Demo mode: these records are stored in page state only and are not yet connected to a backend.
                        </p>
                    </section>

                    <section className="attendance-card">
                        <div className="attendance-section-heading">
                            <div>
                                <h2>Attendance history</h2>
                                <p>Your recorded activity for the selected date.</p>
                            </div>
                        </div>

                        <div className="attendance-history-grid">
                            <div>
                                <span>Check-in</span>
                                <strong>
                                    {myCheckIn ? formatTime(new Date(myCheckIn)) : "Not recorded"}
                                </strong>
                            </div>
                            <div>
                                <span>Check-out</span>
                                <strong>
                                    {myCheckOut ? formatTime(new Date(myCheckOut)) : "Not recorded"}
                                </strong>
                            </div>
                            <div>
                                <span>Working duration</span>
                                <strong>{getDuration()}</strong>
                            </div>
                        </div>
                    </section>
                </>
            ) : (
                <>
                    <section className="attendance-stats">
                        <article className="attendance-stat">
                            <div className="attendance-stat-icon blue">
                                <Users size={20} />
                            </div>
                            <div>
                                <p>Total employees</p>
                                <h2>{team.length}</h2>
                                <span>Company team size</span>
                            </div>
                        </article>

                        <article className="attendance-stat">
                            <div className="attendance-stat-icon green">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p>Present / working</p>
                                <h2>{presentCount}</h2>
                                <span>
                                    {team.length
                                        ? `${Math.round((presentCount / team.length) * 100)}% of employees`
                                        : "No employees"}
                                </span>
                            </div>
                        </article>

                        <article className="attendance-stat">
                            <div className="attendance-stat-icon amber">
                                <CalendarCheck size={20} />
                            </div>
                            <div>
                                <p>On leave</p>
                                <h2>{leaveCount}</h2>
                                <span>Employees on leave</span>
                            </div>
                        </article>

                        <article className="attendance-stat">
                            <div className="attendance-stat-icon red">
                                <XCircle size={20} />
                            </div>
                            <div>
                                <p>Not checked in</p>
                                <h2>{absentCount}</h2>
                                <span>Needs attendance review</span>
                            </div>
                        </article>
                    </section>

                    <section className="attendance-card">
                        <div className="attendance-section-heading attendance-table-heading">
                            <div>
                                <h2>
                                    {role === "manager"
                                        ? "Team attendance records"
                                        : "Employee attendance records"}
                                </h2>
                                <p>
                                    {role === "hr"
                                        ? "Review and filter company-wide attendance."
                                        : role === "manager"
                                            ? "Monitor attendance status across the team."
                                            : "Company-wide attendance snapshot and status overview."}
                                </p>
                            </div>
                            <span className="attendance-record-count">
                                {filteredTeam.length} records
                            </span>
                        </div>

                        <div className="attendance-filters">
                            <div className="attendance-search">
                                <Search size={16} />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search employee, role or department"
                                />
                            </div>

                            <select
                                aria-label="Filter attendance by status"
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                            >
                                <option value="All">All statuses</option>
                                <option value="Present">Present / working</option>
                                <option value="Absent">Not checked in</option>
                                <option value="On leave">On leave</option>
                            </select>
                        </div>

                        <div className="attendance-table-wrap">
                            <table className="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Department</th>
                                        <th>Check-in</th>
                                        <th>Check-out</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTeam.map((employee) => {
                                        const record = getRecord(employee.id);
                                        const status = getEmployeeStatus(employee);

                                        return (
                                            <tr key={employee.id}>
                                                <td>
                                                    <div className="attendance-employee-cell">
                                                        <span className="attendance-initials">
                                                            {employee.name
                                                                .split(" ")
                                                                .map((part) => part[0])
                                                                .slice(0, 2)
                                                                .join("")
                                                                .toUpperCase()}
                                                        </span>
                                                        <span>
                                                            <strong>{employee.name}</strong>
                                                            <small>{employee.role}</small>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>{employee.department || "—"}</td>
                                                <td>
                                                    {record?.checkIn
                                                        ? formatTime(new Date(record.checkIn))
                                                        : "—"}
                                                </td>
                                                <td>
                                                    {record?.checkOut
                                                        ? formatTime(new Date(record.checkOut))
                                                        : "—"}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`attendance-table-status ${status
                                                            .toLowerCase()
                                                            .replaceAll(" ", "-")}`}
                                                    >
                                                        {status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filteredTeam.length === 0 && (
                                <div className="attendance-empty">
                                    No employee records match these filters.
                                </div>
                            )}
                        </div>

                        <p className="attendance-demo-note">
                            Demo view: employee check-in records are not yet shared with this company table. Backend integration can connect individual and team records later.
                        </p>
                    </section>

                    <section className="attendance-card attendance-insight">
                        <div className="attendance-insight-icon">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h3>Attendance insights</h3>
                            <p>
                                {team.length
                                    ? `${presentCount} of ${team.length} employees are currently categorized as present or working in this demo view.`
                                    : "Add employees to start viewing attendance insights."}
                                {" "}Real-time check-in reporting will be available after backend integration.
                            </p>
                        </div>
                    </section>
                </>
            )}
        </main>
    );
}