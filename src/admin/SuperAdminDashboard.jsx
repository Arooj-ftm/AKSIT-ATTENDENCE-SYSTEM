
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock3,
    LoaderCircle,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import "./SuperAdminDashboard.css";

const ROLES = [
    { value: "employee", label: "Employee" },
    { value: "manager", label: "Manager" },
    { value: "hr", label: "HR" },
    { value: "ceo", label: "CEO" },
    { value: "cto_md", label: "CTO / Managing Director" },
    { value: "super_admin", label: "Super Admin" },
];

const EMPTY_FORM = {
    name: "",
    email: "",
    password: "",
    role: "employee",
    department: "",
    designation: "",
    joiningDate: "",
};

const normalizeRole = (role) =>
    String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

export default function SuperAdminDashboard() {
    const { user, token } = useAuth();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [createdAccount, setCreatedAccount] = useState(null);

    const loadUsers = useCallback(
        async (showRefresh = false) => {
            if (!token) {
                setError("Your session is missing. Please log in again.");
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
                const response = await apiRequest(
                    "/api/users",
                    { method: "GET" },
                    token
                );

                setUsers(
                    Array.isArray(response.users)
                        ? response.users
                        : []
                );
            } catch (err) {
                setError(
                    err.message ||
                    "Unable to load user accounts. Please try again."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [token]
    );

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const roleCounts = useMemo(() => {
        return users.reduce(
            (counts, account) => {
                const role = normalizeRole(account.role);

                counts.total += 1;

                if (role === "super_admin") {
                    counts.super_admin += 1;
                } else if (counts[role] !== undefined) {
                    counts[role] += 1;
                }

                if (account.isActive !== false) {
                    counts.active += 1;
                }

                return counts;
            },
            {
                total: 0,
                active: 0,
                super_admin: 0,
                cto_md: 0,
                hr: 0,
                ceo: 0,
                manager: 0,
                employee: 0,
            }
        );
    }, [users]);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return users.filter((account) => {
            const matchesRole =
                roleFilter === "all" ||
                normalizeRole(account.role) === roleFilter;

            const matchesSearch =
                !query ||
                [
                    account.name,
                    account.email,
                    account.department,
                    account.designation,
                    account.role,
                ].some((value) =>
                    String(value || "").toLowerCase().includes(query)
                );

            return matchesRole && matchesSearch;
        });
    }, [users, search, roleFilter]);

    const updateForm = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const closeCreateForm = () => {
        if (creating) return;

        setShowCreateForm(false);
        setForm(EMPTY_FORM);
        setCreatedAccount(null);
    };

    const createAccount = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");
        setCreatedAccount(null);

        if (!form.name.trim() || !form.email.trim()) {
            setError("Name and email are required.");
            return;
        }

        if (form.password.length < 12) {
            setError(
                "Temporary password must contain at least 12 characters."
            );
            return;
        }

        if (form.joiningDate) {
            const selectedDate = new Date(`${form.joiningDate}T00:00:00`);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (
                Number.isNaN(selectedDate.getTime()) ||
                selectedDate > today
            ) {
                setError("Joining date cannot be in the future.");
                return;
            }
        }

        setCreating(true);

        try {
            const response = await apiRequest(
                "/api/users",
                {
                    method: "POST",
                    body: JSON.stringify({
                        name: form.name.trim(),
                        email: form.email.trim().toLowerCase(),
                        password: form.password,
                        role: form.role,
                        department: form.department.trim(),
                        designation: form.designation.trim(),
                        joiningDate: form.joiningDate || null,
                    }),
                },
                token
            );

            setCreatedAccount(response.user || null);
            setSuccess(
                response.message || "Account created successfully."
            );

            setForm(EMPTY_FORM);
            await loadUsers(true);
        } catch (err) {
            setError(
                err.message || "Unable to create the account."
            );
        } finally {
            setCreating(false);
        }
    };

    const roleLabel = (role) =>
        ROLES.find((item) => item.value === normalizeRole(role))
            ?.label || role || "Unknown";

    const currentRole = normalizeRole(user?.role);

    // The backend also enforces this permission.
    if (currentRole !== "super_admin") {
        return (
            <main className="super-admin-page">
                <section className="sa-access-denied">
                    <ShieldCheck size={34} />
                    <h2>Access restricted</h2>
                    <p>
                        This dashboard is only available to Super Admin
                        accounts.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="super-admin-page">
            <header className="sa-header">
                <div className="sa-heading">
                    <div className="sa-heading-icon">
                        <ShieldCheck size={25} />
                    </div>

                    <div>
                        <p className="sa-eyebrow">
                            AKSIT GLOBAL · SYSTEM CONTROL
                        </p>
                        <h1>Super Admin Dashboard</h1>
                        <p className="sa-subtitle">
                            Manage accounts and monitor the system from
                            one secure workspace.
                        </p>
                    </div>
                </div>

                <div className="sa-header-actions">
                    <button
                        type="button"
                        className="sa-button sa-button-secondary"
                        onClick={() => loadUsers(true)}
                        disabled={loading || refreshing}
                    >
                        <RefreshCw
                            size={16}
                            className={refreshing ? "sa-spinning" : ""}
                        />
                        Refresh
                    </button>

                    <button
                        type="button"
                        className="sa-button sa-button-primary"
                        onClick={() => {
                            setError("");
                            setSuccess("");
                            setCreatedAccount(null);
                            setShowCreateForm(true);
                        }}
                    >
                        <Plus size={17} />
                        Create Account
                    </button>
                </div>
            </header>

            {error && (
                <div className="sa-alert sa-alert-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button
                        type="button"
                        aria-label="Dismiss error"
                        onClick={() => setError("")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {success && !showCreateForm && (
                <div className="sa-alert sa-alert-success" role="status">
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                    <button
                        type="button"
                        aria-label="Dismiss message"
                        onClick={() => setSuccess("")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="sa-stats-grid">
                <article className="sa-stat-card">
                    <div className="sa-stat-icon sa-icon-blue">
                        <Users size={21} />
                    </div>
                    <p>Total Accounts</p>
                    <strong>{loading ? "—" : roleCounts.total}</strong>
                    <span>Registered system users</span>
                </article>

                <article className="sa-stat-card">
                    <div className="sa-stat-icon sa-icon-green">
                        <CheckCircle2 size={21} />
                    </div>
                    <p>Active Accounts</p>
                    <strong>{loading ? "—" : roleCounts.active}</strong>
                    <span>Accounts not marked inactive</span>
                </article>

                <article className="sa-stat-card">
                    <div className="sa-stat-icon sa-icon-purple">
                        <ShieldCheck size={21} />
                    </div>
                    <p>Super Admins</p>
                    <strong>
                        {loading ? "—" : roleCounts.super_admin}
                    </strong>
                    <span>System control accounts</span>
                </article>

                <article className="sa-stat-card">
                    <div className="sa-stat-icon sa-icon-orange">
                        <Activity size={21} />
                    </div>
                    <p>Company Roles</p>
                    <strong>
                        {loading
                            ? "—"
                            : roleCounts.employee +
                            roleCounts.manager +
                            roleCounts.hr +
                            roleCounts.ceo +
                            roleCounts.cto_md}
                    </strong>
                    <span>
                        Employee, Manager, HR, CEO and CTO / Managing Director
                    </span>
                </article>
            </section>

            <section className="sa-panel">
                <div className="sa-panel-heading">
                    <div>
                        <h2>User Management</h2>
                        <p>
                            Create accounts and review registered users.
                        </p>
                    </div>

                    <span className="sa-count-pill">
                        {filteredUsers.length} accounts
                    </span>
                </div>

                <div className="sa-toolbar">
                    <label className="sa-search">
                        <Search size={17} />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search name, email or department..."
                        />
                    </label>

                    <select
                        className="sa-role-filter"
                        value={roleFilter}
                        onChange={(event) =>
                            setRoleFilter(event.target.value)
                        }
                        aria-label="Filter accounts by role"
                    >
                        <option value="all">All roles</option>
                        {ROLES.map((role) => (
                            <option
                                key={role.value}
                                value={role.value}
                            >
                                {role.label}
                            </option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="sa-state">
                        <LoaderCircle
                            size={25}
                            className="sa-spinning"
                        />
                        <p>Loading user accounts...</p>
                    </div>
                ) : (
                    <div className="sa-table-wrap">
                        <table className="sa-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>Account Status</th>
                                    <th>Created</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredUsers.map((account) => (
                                    <tr key={account.id || account._id}>
                                        <td>
                                            <div className="sa-user-cell">
                                                <div className="sa-avatar">
                                                    {String(account.name || "U")
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                                <div className="sa-user-info">
                                                    <strong>
                                                        {account.name}
                                                    </strong>
                                                    <span>
                                                        {account.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <span
                                                className={`sa-role-badge sa-role-${normalizeRole(
                                                    account.role
                                                )}`}
                                            >
                                                {roleLabel(account.role)}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="sa-department-cell">
                                                <span>
                                                    {account.department || "—"}
                                                </span>
                                                {account.designation && (
                                                    <small>
                                                        {account.designation}
                                                    </small>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            <div className="sa-status-cell">
                                                <span
                                                    className={`sa-status-dot ${account.isActive === false
                                                        ? "inactive"
                                                        : "active"
                                                        }`}
                                                />
                                                {account.isActive === false
                                                    ? "Inactive"
                                                    : "Active"}
                                                {account.mustChangePassword && (
                                                    <span
                                                        className="sa-password-note"
                                                        title="Password change required at first login"
                                                    >
                                                        <Clock3 size={13} />
                                                        First login
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            {formatDate(account.createdAt)}
                                        </td>
                                    </tr>
                                ))}

                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="sa-empty-cell">
                                            No accounts match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="sa-notice">
                <ShieldCheck size={20} />
                <div>
                    <strong>Protected operational data</strong>
                    <p>
                        This dashboard manages accounts only. Attendance,
                        leave decisions, task assignments and employee work
                        progress remain controlled by their authorized
                        operational roles.
                    </p>
                </div>
            </section>

            {showCreateForm && (
                <div
                    className="sa-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeCreateForm();
                        }
                    }}
                >
                    <section
                        className="sa-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sa-create-title"
                    >
                        <header className="sa-modal-header">
                            <div>
                                <p className="sa-eyebrow">
                                    ACCOUNT MANAGEMENT
                                </p>
                                <h2 id="sa-create-title">
                                    Create New Account
                                </h2>
                                <p>
                                    Choose a role and set a temporary
                                    password.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="sa-icon-button"
                                onClick={closeCreateForm}
                                disabled={creating}
                                aria-label="Close form"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        {success && (
                            <div
                                className="sa-alert sa-alert-success"
                                role="status"
                            >
                                <CheckCircle2 size={18} />
                                <span>{success}</span>
                            </div>
                        )}

                        {createdAccount && (
                            <div className="sa-created-summary">
                                <strong>Account created</strong>
                                <span>{createdAccount.name}</span>
                                <span>{createdAccount.email}</span>
                                <span>
                                    Role: {roleLabel(createdAccount.role)}
                                </span>
                                <span>
                                    The user must change their password
                                    after logging in.
                                </span>
                            </div>
                        )}

                        <form className="sa-form" onSubmit={createAccount}>
                            <label className="sa-field">
                                <span>Full name *</span>
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={updateForm}
                                    placeholder="Enter full name"
                                    autoComplete="name"
                                    required
                                    maxLength={100}
                                />
                            </label>

                            <label className="sa-field">
                                <span>Email address *</span>
                                <input
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={updateForm}
                                    placeholder="name@company.com"
                                    autoComplete="off"
                                    required
                                    maxLength={254}
                                />
                            </label>

                            <label className="sa-field">
                                <span>Account role *</span>
                                <select
                                    name="role"
                                    value={form.role}
                                    onChange={updateForm}
                                    required
                                >
                                    {ROLES.map((role) => (
                                        <option
                                            key={role.value}
                                            value={role.value}
                                        >
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="sa-form-row">
                                <label className="sa-field">
                                    <span>Department</span>
                                    <input
                                        name="department"
                                        value={form.department}
                                        onChange={updateForm}
                                        placeholder="e.g. IT"
                                        maxLength={100}
                                    />
                                </label>

                                <label className="sa-field">
                                    <span>Designation</span>
                                    <input
                                        name="designation"
                                        value={form.designation}
                                        onChange={updateForm}
                                        placeholder="e.g. Software Engineer"
                                        maxLength={100}
                                    />
                                </label>


                                <label className="sa-field">
                                    <span>Joining Date</span>
                                    <input
                                        name="joiningDate"
                                        type="date"
                                        value={form.joiningDate}
                                        onChange={updateForm}
                                        max={new Date().toLocaleDateString("en-CA")}
                                    />
                                    <small>
                                        Enter the employee's actual company joining date.
                                    </small>
                                </label>
                            </div>

                            <label className="sa-field">
                                <span>Temporary password *</span>
                                <input
                                    name="password"
                                    type="password"
                                    value={form.password}
                                    onChange={updateForm}
                                    placeholder="At least 12 characters"
                                    autoComplete="new-password"
                                    minLength={12}
                                    required
                                />
                                <small>
                                    Use a strong temporary password and
                                    share it securely with the user.
                                </small>
                            </label>

                            <div className="sa-form-security">
                                <ShieldCheck size={18} />
                                <span>
                                    The password is hashed by the backend.
                                    First-login password change is required.
                                </span>
                            </div>

                            <footer className="sa-modal-actions">
                                <button
                                    type="button"
                                    className="sa-button sa-button-secondary"
                                    onClick={closeCreateForm}
                                    disabled={creating}
                                >
                                    Close
                                </button>

                                <button
                                    type="submit"
                                    className="sa-button sa-button-primary"
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <>
                                            <LoaderCircle
                                                size={17}
                                                className="sa-spinning"
                                            />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={17} />
                                            Create Account
                                        </>
                                    )}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}
