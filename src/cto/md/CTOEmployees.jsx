
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Building2,
    BriefcaseBusiness,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Mail,
    RefreshCw,
    Search,
    Users,
    X,
    UserRound,
} from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../api/api";
import "./CTOEmployees.css";

const AVATAR_THEMES = ["blue", "violet", "teal", "rose", "amber", "indigo"];

function getInitials(name = "") {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "U";
}

function getAvatarTheme(name = "") {
    const total = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return AVATAR_THEMES[total % AVATAR_THEMES.length];
}

function getEmployeeStatus(status) {
    const normalized = String(status || "Active").toLowerCase();

    if (normalized === "active") return "Active";
    if (normalized === "on leave") return "On Leave";
    if (normalized === "remote") return "Remote";
    if (normalized === "inactive") return "Inactive";

    return status || "Unknown";
}

function getStatusClass(status) {
    return getEmployeeStatus(status)
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function getEmployeeCode(id = "") {
    return id ? `EMP-${String(id).slice(-6).toUpperCase()}` : "Not assigned";
}

function formatDate(date) {
    if (!date) return "Not provided";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "Not provided";
    }

    return parsedDate.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function CTOEmployees() {
    const { token } = useAuth();

    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("all");
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchEmployees = useCallback(async () => {
        if (!token) {
            setEmployees([]);
            setError("Your session could not be verified. Please log in again.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await apiRequest(
                "/api/cto-md/employees",
                {},
                token
            );

            if (response?.success === false) {
                throw new Error(
                    response.message || "Unable to load company employees."
                );
            }

            setEmployees(Array.isArray(response?.employees) ? response.employees : []);
        } catch (requestError) {
            setError(
                requestError.message || "Unable to load company employees."
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    useEffect(() => {
        if (!selectedEmployee) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setSelectedEmployee(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedEmployee]);

    const departments = useMemo(() => {
        return [
            ...new Set(
                employees
                    .map((employee) => String(employee.department || "").trim())
                    .filter(Boolean)
            ),
        ].sort((a, b) => a.localeCompare(b));
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        const query = search.trim().toLowerCase();

        return employees.filter((employee) => {
            const searchableText = [
                employee.name,
                employee.email,
                employee.designation,
                employee.department,
                employee.id,
                employee.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch = !query || searchableText.includes(query);

            const matchesDepartment =
                department === "all" ||
                String(employee.department || "").trim() === department;

            return matchesSearch && matchesDepartment;
        });
    }, [employees, search, department]);

    const departmentCounts = useMemo(() => {
        return employees.reduce((counts, employee) => {
            const key = String(employee.department || "").trim() || "Unassigned";
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
    }, [employees]);


    const employeeStats = useMemo(() => {
        const active = employees.filter(
            (employee) => getEmployeeStatus(employee.status) === "Active"
        ).length;

        const inactive = employees.filter(
            (employee) => getEmployeeStatus(employee.status) === "Inactive"
        ).length;

        return {
            total: employees.length,
            active,
            inactive,
            departments: departments.length,
        };
    }, [employees, departments]);

    const clearFilters = () => {
        setSearch("");
        setDepartment("all");
    };

    return (
        <main className="cto-employees-page">
            <PageHeader
                eyebrow="COMPANY-WIDE DIRECTORY"
                title="Employees"
                description="View employee profiles and explore teams across the entire company."
                icon={Users}
                action={
                    <button
                        type="button"
                        className="cto-employees-refresh"
                        onClick={fetchEmployees}
                        disabled={loading}
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? "cto-spinning" : ""}
                        />
                        <span>{loading ? "Refreshing..." : "Refresh"}</span>
                    </button>
                }
            />

            <section className="cto-employees-stats-grid" aria-label="Employee statistics">
                <article className="cto-employees-stat-card">
                    <div className="cto-employees-stat-icon cto-stat-total">
                        <Users size={21} />
                    </div>
                    <div className="cto-employees-stat-copy">
                        <span>Total employees</span>
                        <strong>{loading ? "—" : employeeStats.total}</strong>
                        <small>Across the company</small>
                    </div>
                </article>

                <article className="cto-employees-stat-card">
                    <div className="cto-employees-stat-icon cto-stat-active">
                        <CheckCircle2 size={21} />
                    </div>
                    <div className="cto-employees-stat-copy">
                        <span>Active employees</span>
                        <strong>{loading ? "—" : employeeStats.active}</strong>
                        <small>Currently active</small>
                    </div>
                </article>

                <article className="cto-employees-stat-card">
                    <div className="cto-employees-stat-icon cto-stat-inactive">
                        <AlertCircle size={21} />
                    </div>
                    <div className="cto-employees-stat-copy">
                        <span>Inactive employees</span>
                        <strong>{loading ? "—" : employeeStats.inactive}</strong>
                        <small>Not currently active</small>
                    </div>
                </article>

                <article className="cto-employees-stat-card">
                    <div className="cto-employees-stat-icon cto-stat-departments">
                        <Building2 size={21} />
                    </div>
                    <div className="cto-employees-stat-copy">
                        <span>Departments</span>
                        <strong>{loading ? "—" : employeeStats.departments}</strong>
                        <small>With employee records</small>
                    </div>
                </article>
            </section>

            <section className="cto-employees-content">
                <div className="cto-employees-toolbar">
                    <div className="cto-employees-toolbar-heading">
                        <h2>Company directory</h2>
                        <p>
                            {loading
                                ? "Loading employee records..."
                                : `Showing ${filteredEmployees.length} of ${employees.length} employees`}
                        </p>
                    </div>

                    <div className="cto-employees-filters">
                        <label className="cto-employees-search">
                            <Search size={17} />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name, email, role..."
                                aria-label="Search employees"
                            />

                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    aria-label="Clear search"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </label>

                        <label className="cto-employees-department-filter">
                            <Building2 size={16} />

                            <select
                                value={department}
                                onChange={(event) => setDepartment(event.target.value)}
                                aria-label="Filter by department"
                            >
                                <option value="all">All departments</option>
                                {departments.map((name) => (
                                    <option key={name} value={name}>
                                        {name} ({departmentCounts[name] || 0})
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                {error && (
                    <div className="cto-employees-error" role="alert">
                        <AlertCircle size={20} />

                        <div>
                            <strong>Unable to load employees</strong>
                            <p>{error}</p>

                            <button type="button" onClick={fetchEmployees}>
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {loading && !error && (
                    <div className="cto-employees-state" role="status">
                        <RefreshCw size={28} className="cto-spinning" />
                        <strong>Loading company directory</strong>
                        <p>Fetching employee records from the server.</p>
                    </div>
                )}

                {!loading && !error && filteredEmployees.length === 0 && (
                    <div className="cto-employees-state">
                        <div className="cto-employees-empty-icon">
                            <Users size={26} />
                        </div>

                        <strong>
                            {employees.length === 0
                                ? "No active employees found"
                                : "No matching employees"}
                        </strong>

                        <p>
                            {employees.length === 0
                                ? "Active employee records will appear here when available."
                                : "Try another search term or change the department filter."}
                        </p>

                        {(search || department !== "all") && (
                            <button
                                type="button"
                                className="cto-employees-clear"
                                onClick={clearFilters}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {!loading && !error && filteredEmployees.length > 0 && (
                    <div className="cto-employees-grid">
                        {filteredEmployees.map((employee) => {
                            const status = getEmployeeStatus(employee.status);
                            const theme = getAvatarTheme(employee.name);

                            return (
                                <article
                                    key={employee.id}
                                    className={`cto-employee-card cto-employee-card-${theme}`}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`View ${employee.name}'s profile`}
                                    onClick={() => setSelectedEmployee(employee)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedEmployee(employee);
                                        }
                                    }}
                                >
                                    <div className="cto-employee-card-accent" />

                                    <div className="cto-employee-card-top">
                                        <div className="cto-employee-avatar">
                                            {getInitials(employee.name)}
                                        </div>

                                        <span
                                            className={`cto-employee-status cto-employee-status-${getStatusClass(status)}`}
                                        >
                                            <span className="cto-employee-status-dot" />
                                            {status}
                                        </span>
                                    </div>

                                    <div className="cto-employee-card-identity">
                                        <h3>{employee.name || "Unnamed employee"}</h3>

                                        <p className="cto-employee-designation">
                                            <BriefcaseBusiness size={14} />
                                            <span>
                                                {employee.designation || "Designation not provided"}
                                            </span>
                                        </p>
                                    </div>

                                    <div className="cto-employee-card-meta">
                                        <span className="cto-employee-id">
                                            {getEmployeeCode(employee.id)}
                                        </span>

                                        <span className="cto-employee-department">
                                            <Building2 size={13} />
                                            {employee.department || "Unassigned"}
                                        </span>
                                    </div>

                                    <div className="cto-employee-card-contact">
                                        <div className="cto-employee-contact-row">
                                            <span className="cto-employee-contact-icon">
                                                <Mail size={15} />
                                            </span>
                                            <span className="cto-employee-contact-value">
                                                {employee.email || "Email not provided"}
                                            </span>
                                        </div>

                                        <div className="cto-employee-contact-row">
                                            <span className="cto-employee-contact-icon">
                                                <CalendarDays size={15} />
                                            </span>
                                            <span className="cto-employee-contact-value">
                                                Joined {formatDate(employee.joiningDate)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="cto-employee-card-footer">
                                        <span>View employee profile</span>
                                        <span className="cto-employee-card-arrow">
                                            <ChevronRight size={17} />
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {selectedEmployee && (
                <div
                    className="cto-employee-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedEmployee(null);
                        }
                    }}
                >
                    <section
                        className="cto-employee-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cto-employee-modal-title"
                    >
                        <header className="cto-employee-modal-header">
                            <div className="cto-employee-modal-heading">
                                <span>EMPLOYEE PROFILE</span>
                                <h2 id="cto-employee-modal-title">
                                    {selectedEmployee.name || "Employee"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedEmployee(null)}
                                aria-label="Close employee profile"
                            >
                                <X size={19} />
                            </button>
                        </header>

                        <div className="cto-employee-profile-hero">
                            <div
                                className={`cto-employee-avatar cto-employee-avatar-${getAvatarTheme(selectedEmployee.name)}`}
                            >
                                {getInitials(selectedEmployee.name)}
                            </div>

                            <div>
                                <strong>
                                    {selectedEmployee.designation || "Designation not provided"}
                                </strong>
                                <span>
                                    {selectedEmployee.department || "Department not assigned"}
                                </span>

                                <span
                                    className={`cto-employee-status cto-employee-status-${getStatusClass(selectedEmployee.status)}`}
                                >
                                    <span className="cto-employee-status-dot" />
                                    {getEmployeeStatus(selectedEmployee.status)}
                                </span>
                            </div>
                        </div>

                        <div className="cto-employee-modal-body">
                            <div className="cto-employee-detail">
                                <span>Employee ID</span>
                                <strong>{getEmployeeCode(selectedEmployee.id)}</strong>
                            </div>

                            <div className="cto-employee-detail">
                                <span>Department</span>
                                <strong>{selectedEmployee.department || "Not assigned"}</strong>
                            </div>

                            <div className="cto-employee-detail cto-employee-detail-email">
                                <span>Email address</span>
                                <strong className="cto-employee-detail-with-icon">
                                    <Mail size={15} />
                                    {selectedEmployee.email || "Not provided"}
                                </strong>
                            </div>

                            <div className="cto-employee-detail">
                                <span>Designation</span>
                                <strong>
                                    {selectedEmployee.designation || "Not provided"}
                                </strong>
                            </div>

                            <div className="cto-employee-detail">
                                <span>Joining date</span>
                                <strong>{formatDate(selectedEmployee.joiningDate)}</strong>
                            </div>

                            <div className="cto-employee-detail">
                                <span>Employment status</span>
                                <strong>{getEmployeeStatus(selectedEmployee.status)}</strong>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="cto-employee-modal-close"
                            onClick={() => setSelectedEmployee(null)}
                        >
                            <CheckCircle2 size={16} />
                            Close profile
                        </button>
                    </section>
                </div>
            )}
        </main>
    );
}
