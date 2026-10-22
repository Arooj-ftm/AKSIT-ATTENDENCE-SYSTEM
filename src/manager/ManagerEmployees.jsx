
import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    Building2,
    BriefcaseBusiness,
    CheckCircle2,
    ChevronRight,
    Mail,
    RefreshCw,
    Search,
    Users,
    X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import "./ManagerEmployees.css";
import PageHeader from "../components/PageHeader";

const getInitials = (name = "") => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return "EM";

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getEmployeeStatus = (status) => {
    const normalized = String(status || "").trim().toLowerCase();

    if (["active", "enabled", "working"].includes(normalized)) {
        return "Active";
    }

    if (["on leave", "on_leave", "leave"].includes(normalized)) {
        return "On Leave";
    }

    if (["remote", "work from home", "work_from_home"].includes(normalized)) {
        return "Remote";
    }

    if (["inactive", "disabled"].includes(normalized)) {
        return "Inactive";
    }

    return status ? String(status).replace(/_/g, " ") : "Unknown";
};

const getEmployeeCode = (id) => {
    if (id === undefined || id === null || id === "") {
        return "N/A";
    }

    return String(id).slice(-6).toUpperCase();
};

const getAvatarTheme = (name = "") => {
    const themes = [
        "blue",
        "violet",
        "teal",
        "rose",
        "amber",
        "indigo",
    ];

    const total = Array.from(String(name)).reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0
    );

    return themes[total % themes.length];
};

export default function ManagerEmployees() {
    const { token, user } = useAuth();

    const [employees, setEmployees] = useState([]);
    const [department, setDepartment] = useState(user?.department || "");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const loadEmployees = useCallback(async () => {
        if (!token) {
            setError("Your login session is missing. Please log in again.");
            setEmployees([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const data = await apiRequest(
                "/api/manager/employees",
                {},
                token
            );

            setEmployees(
                Array.isArray(data?.employees) ? data.employees : []
            );

            setDepartment(data?.department || user?.department || "");
        } catch (err) {
            setError(err?.message || "Unable to load employees.");
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, [token, user?.department]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const filteredEmployees = employees.filter((employee) => {
        const query = search.trim().toLowerCase();

        if (!query) return true;

        return [
            employee.name,
            employee.email,
            employee.designation,
            employee.department,
            employee.id,
            employee.status,
        ].some((value) =>
            String(value ?? "").toLowerCase().includes(query)
        );
    });

    const openEmployeeProfile = (employee) => {
        setSelectedEmployee(employee);
    };

    const handleCardKeyDown = (event, employee) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEmployeeProfile(employee);
        }
    };

    return (
        <main className="manager-employees-page">
            <PageHeader
                eyebrow="TEAM MANAGEMENT"
                title="Employees"
                description="Get to know your team and view employee profiles in one place."
                icon={Users}
                onRefresh={loadEmployees}
                refreshing={loading}
            />

            <section className="manager-employees-summary">
                <div className="manager-employees-summary-icon">
                    <Users size={24} />
                </div>

                <div className="manager-employees-summary-copy">
                    <span>Department employees</span>
                    <strong>{employees.length}</strong>
                    <small>
                        {department || "Department not assigned"}
                    </small>
                </div>

                <div className="manager-employees-summary-department">
                    <Building2 size={18} />
                    <span>{department || "No department"}</span>
                </div>
            </section>

            <section className="manager-employees-content">
                <div className="manager-employees-toolbar">
                    <div className="manager-employees-toolbar-heading">
                        <h2>Your team</h2>
                        <p>
                            {loading
                                ? "Loading employee records..."
                                : `${filteredEmployees.length} ${filteredEmployees.length === 1
                                    ? "employee"
                                    : "employees"
                                } found`}
                        </p>
                    </div>

                    <label className="manager-employees-search">
                        <Search size={17} />

                        <input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search name, email or role..."
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
                </div>

                {error && (
                    <div className="manager-employees-error" role="alert">
                        <AlertCircle size={21} />

                        <div>
                            <strong>Could not load employees</strong>
                            <p>{error}</p>

                            <button
                                type="button"
                                onClick={loadEmployees}
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {loading && !error && (
                    <div className="manager-employees-state">
                        <RefreshCw
                            size={27}
                            className="manager-employees-spinning"
                        />
                        <strong>Loading your team</strong>
                        <p>
                            Please wait while employee records are loaded.
                        </p>
                    </div>
                )}

                {!loading &&
                    !error &&
                    filteredEmployees.length > 0 && (
                        <div className="manager-employees-grid">
                            {filteredEmployees.map((employee, index) => {
                                const name =
                                    employee.name || "Unnamed employee";

                                const status = getEmployeeStatus(
                                    employee.status
                                );

                                const theme = getAvatarTheme(name);

                                return (
                                    <article
                                        key={
                                            employee.id ??
                                            `${name}-${index}`
                                        }
                                        className={`manager-employee-card manager-employee-card-${theme}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`View profile of ${name}`}
                                        onClick={() =>
                                            openEmployeeProfile(employee)
                                        }
                                        onKeyDown={(event) =>
                                            handleCardKeyDown(
                                                event,
                                                employee
                                            )
                                        }
                                        style={{
                                            animationDelay: `${Math.min(
                                                index * 55,
                                                440
                                            )}ms`,
                                        }}
                                    >
                                        <div className="manager-employee-card-accent" />

                                        <div className="manager-employee-card-top">
                                            <div
                                                className={`manager-employee-avatar manager-employee-avatar-${theme}`}
                                            >
                                                {getInitials(name)}
                                            </div>

                                            <span
                                                className={`manager-employee-status manager-employee-status-${status
                                                    .toLowerCase()
                                                    .replace(/\s+/g, "-")}`}
                                            >
                                                <span className="manager-employee-status-dot" />
                                                {status}
                                            </span>
                                        </div>

                                        <div className="manager-employee-card-identity">
                                            <h3 title={name}>{name}</h3>

                                            <p className="manager-employee-designation">
                                                <BriefcaseBusiness size={14} />
                                                <span>
                                                    {employee.designation ||
                                                        "Employee"}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="manager-employee-card-meta">
                                            <span className="manager-employee-id">
                                                ID:{" "}
                                                {getEmployeeCode(employee.id)}
                                            </span>

                                            <span className="manager-employee-department">
                                                <Building2 size={13} />
                                                {employee.department ||
                                                    department ||
                                                    "Unassigned"}
                                            </span>
                                        </div>

                                        <div className="manager-employee-card-contact">
                                            <div className="manager-employee-contact-row">
                                                <span className="manager-employee-contact-icon">
                                                    <Mail size={15} />
                                                </span>

                                                <span
                                                    className="manager-employee-contact-value"
                                                    title={employee.email || ""}
                                                >
                                                    {employee.email ||
                                                        "No email provided"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="manager-employee-card-footer">
                                            <span>View profile</span>
                                            <span className="manager-employee-card-arrow">
                                                <ChevronRight size={17} />
                                            </span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                {!loading &&
                    !error &&
                    filteredEmployees.length === 0 && (
                        <div className="manager-employees-state">
                            <div className="manager-employees-empty-icon">
                                <Users size={26} />
                            </div>

                            <strong>
                                {search
                                    ? "No matching employees"
                                    : "No employees found"}
                            </strong>

                            <p>
                                {search
                                    ? "Try another name, email or designation."
                                    : department
                                        ? "There are no employee records in this department yet."
                                        : "Your account does not have a department assigned. Please contact Super Admin."}
                            </p>

                            {search && (
                                <button
                                    type="button"
                                    className="manager-employees-clear"
                                    onClick={() => setSearch("")}
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    )}
            </section>

            {selectedEmployee && (
                <div
                    className="manager-employee-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedEmployee(null);
                        }
                    }}
                >
                    <section
                        className="manager-employee-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="manager-employee-modal-title"
                    >
                        <div className="manager-employee-modal-header">
                            <div className="manager-employee-modal-heading">
                                <span>EMPLOYEE PROFILE</span>
                                <h2 id="manager-employee-modal-title">
                                    {selectedEmployee.name ||
                                        "Unnamed employee"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedEmployee(null)}
                                aria-label="Close employee profile"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="manager-employee-profile-hero">
                            <div
                                className={`manager-employee-avatar manager-employee-avatar-${getAvatarTheme(
                                    selectedEmployee.name
                                )}`}
                            >
                                {getInitials(selectedEmployee.name)}
                            </div>

                            <div>
                                <strong>
                                    {selectedEmployee.designation ||
                                        "Employee"}
                                </strong>
                                <span>
                                    {selectedEmployee.department ||
                                        "Department not assigned"}
                                </span>
                            </div>
                        </div>

                        <div className="manager-employee-modal-body">
                            <div className="manager-employee-detail">
                                <span>Designation</span>
                                <strong>
                                    {selectedEmployee.designation ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div className="manager-employee-detail">
                                <span>Department</span>
                                <strong>
                                    {selectedEmployee.department ||
                                        "Not assigned"}
                                </strong>
                            </div>

                            <div className="manager-employee-detail">
                                <span>Employment status</span>
                                <strong>
                                    {getEmployeeStatus(
                                        selectedEmployee.status
                                    )}
                                </strong>
                            </div>

                            <div className="manager-employee-detail manager-employee-detail-email">
                                <span>Email address</span>
                                <strong className="manager-employee-detail-with-icon">
                                    <Mail size={15} />
                                    {selectedEmployee.email ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div className="manager-employee-detail">
                                <span>Employee ID</span>
                                <strong>
                                    {getEmployeeCode(selectedEmployee.id)}
                                </strong>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="manager-employee-modal-close"
                            onClick={() => setSelectedEmployee(null)}
                        >
                            Close profile
                            <CheckCircle2 size={16} />
                        </button>
                    </section>
                </div>
            )}
        </main>
    );
}
