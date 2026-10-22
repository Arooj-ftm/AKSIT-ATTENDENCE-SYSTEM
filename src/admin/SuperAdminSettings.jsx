
import { useMemo, useState } from "react";
import {
    UserRound,
    ShieldCheck,
    KeyRound,
    Settings as SettingsIcon,
    Search,
    LockKeyhole,
    MonitorCog,
    ChevronRight,
    Eye,
    EyeOff,
    RefreshCw,
    Mail,
    UserCog,
    AlertCircle,
    CheckCircle2,
    Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import "./SuperAdminSettings.css";

const API_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const SETTINGS_SECTIONS = [
    {
        id: "profile",
        label: "Profile",
        description: "Your account information",
        icon: UserRound,
    },
    {
        id: "security",
        label: "Security",
        description: "Manage your password",
        icon: ShieldCheck,
    },
    {
        id: "password-reset",
        label: "Password Reset",
        description: "Reset another user's password",
        icon: KeyRound,
    },
    {
        id: "system",
        label: "System Settings",
        description: "Technical system information",
        icon: SettingsIcon,
    },
];

const ROLE_LABELS = {
    super_admin: "Super Admin",
    admin: "Admin",
    ceo: "CEO",
    hr: "HR",
    manager: "Manager",
    employee: "Employee",
};

export default function SuperAdminSettings() {
    const { user, token } = useAuth();

    const [activeSection, setActiveSection] = useState("profile");
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);

    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersLoaded, setUsersLoaded] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [temporaryPassword, setTemporaryPassword] = useState("");
    const [resetLoading, setResetLoading] = useState(false);

    const [notice, setNotice] = useState({
        type: "",
        message: "",
    });

    const currentRole = String(user?.role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    const isSuperAdmin = currentRole === "super_admin";

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();

        return users.filter((item) => {
            return (
                !query ||
                item.name?.toLowerCase().includes(query) ||
                item.email?.toLowerCase().includes(query) ||
                item.role?.toLowerCase().includes(query)
            );
        });
    }, [users, search]);

    const showNotice = (type, message) => {
        setNotice({ type, message });
    };

    const loadUsers = async () => {
        if (!token) {
            showNotice("error", "Your session is missing. Please log in again.");
            return;
        }

        setUsersLoading(true);
        setNotice({ type: "", message: "" });

        try {
            const response = await fetch(`${API_URL}/api/users`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load user accounts."
                );
            }

            const accountList = Array.isArray(data.users) ? data.users : [];

            setUsers(accountList);
            setUsersLoaded(true);

            // Keep the selected account in sync after refreshing.
            if (selectedUser) {
                const refreshedUser = accountList.find(
                    (item) =>
                        String(item.id || item._id) ===
                        String(selectedUser.id || selectedUser._id)
                );

                setSelectedUser(refreshedUser
                    ? {
                        ...refreshedUser,
                        id: refreshedUser.id || refreshedUser._id,
                    }
                    : null);
            }
        } catch (error) {
            showNotice(
                "error",
                error.message || "Unable to load user accounts."
            );
        } finally {
            setUsersLoading(false);
        }
    };

    const generateTemporaryPassword = () => {
        if (!window.crypto?.getRandomValues) {
            showNotice(
                "error",
                "Secure password generation is unavailable in this browser."
            );
            return;
        }

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

        const randomValues = new Uint32Array(20);
        window.crypto.getRandomValues(randomValues);

        const password = Array.from(
            randomValues,
            (value) => chars[value % chars.length]
        ).join("");

        setTemporaryPassword(password);
        setShowPassword(true);
        setNotice({ type: "", message: "" });
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();

        if (resetLoading) return;

        if (!token) {
            showNotice("error", "Your session is missing. Please log in again.");
            return;
        }

        if (!selectedUser?.id) {
            showNotice("error", "Please select an account first.");
            return;
        }

        if (temporaryPassword.length < 12) {
            showNotice(
                "error",
                "Generate a temporary password with at least 12 characters."
            );
            return;
        }

        setResetLoading(true);
        setNotice({ type: "", message: "" });

        try {
            const response = await fetch(
                `${API_URL}/api/users/${encodeURIComponent(
                    selectedUser.id
                )}/reset-password`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        password: temporaryPassword,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to reset this account's password."
                );
            }

            // Keep the temporary password visible so the Super Admin can
            // securely communicate it to the account owner.
            setUsers((previousUsers) =>
                previousUsers.map((item) =>
                    String(item.id || item._id) === String(selectedUser.id)
                        ? { ...item, mustChangePassword: true }
                        : item
                )
            );

            setSelectedUser((previous) => ({
                ...previous,
                mustChangePassword: true,
            }));

            showNotice(
                "success",
                data.message ||
                "Password reset successfully. Share the temporary password securely."
            );
        } catch (error) {
            showNotice(
                "error",
                error.message || "Unable to reset the password."
            );
        } finally {
            setResetLoading(false);
        }
    };

    if (!isSuperAdmin) {
        return (
            <main className="super-settings-page">
                <div className="ss-access-denied">
                    <ShieldCheck size={38} />
                    <h2>Access Restricted</h2>
                    <p>Only the Super Admin can access these settings.</p>
                </div>
            </main>
        );
    }

    const activeItem = SETTINGS_SECTIONS.find(
        (item) => item.id === activeSection
    );

    return (
        <main className="super-settings-page">
            <header className="ss-header">
                <div>
                    <div className="ss-eyebrow">
                        <SettingsIcon size={15} />
                        SYSTEM CONTROL
                    </div>

                    <h1>Settings</h1>

                    <p>
                        Manage your account security and essential system
                        configurations.
                    </p>
                </div>

                <div className="ss-header-badge">
                    <ShieldCheck size={17} />
                    <span>Super Admin</span>
                </div>
            </header>

            <div className="ss-layout">
                <aside className="ss-navigation">
                    <div className="ss-nav-heading">SETTINGS MENU</div>

                    {SETTINGS_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;

                        return (
                            <button
                                key={section.id}
                                type="button"
                                className={`ss-nav-item ${isActive ? "active" : ""
                                    }`}
                                onClick={() => {
                                    setActiveSection(section.id);
                                    setNotice({ type: "", message: "" });

                                    if (
                                        section.id === "password-reset" &&
                                        !usersLoaded &&
                                        !usersLoading
                                    ) {
                                        loadUsers();
                                    }
                                }}
                            >
                                <span className="ss-nav-icon">
                                    <Icon size={19} />
                                </span>

                                <span className="ss-nav-copy">
                                    <strong>{section.label}</strong>
                                    <small>{section.description}</small>
                                </span>

                                <ChevronRight
                                    size={16}
                                    className="ss-nav-chevron"
                                />
                            </button>
                        );
                    })}

                    <div className="ss-sidebar-note">
                        <LockKeyhole size={19} />
                        <strong>Protected area</strong>
                        <p>
                            These settings are restricted to your Super Admin
                            account.
                        </p>
                    </div>
                </aside>

                <section className="ss-content">
                    <div className="ss-section-heading">
                        <div>
                            <span className="ss-section-kicker">
                                ACCOUNT MANAGEMENT
                            </span>
                            <h2>{activeItem?.label}</h2>
                            <p>{activeItem?.description}</p>
                        </div>
                    </div>

                    {notice.message && (
                        <div
                            className={`ss-notice ss-notice-${notice.type}`}
                            role="status"
                        >
                            {notice.type === "error" ? (
                                <AlertCircle size={19} />
                            ) : notice.type === "success" ? (
                                <CheckCircle2 size={19} />
                            ) : (
                                <AlertCircle size={19} />
                            )}

                            <span>{notice.message}</span>
                        </div>
                    )}

                    {activeSection === "profile" && (
                        <div className="ss-card">
                            <div className="ss-card-heading">
                                <div className="ss-card-icon">
                                    <UserRound size={21} />
                                </div>

                                <div>
                                    <h3>Account Profile</h3>
                                    <p>
                                        Your current signed-in account details.
                                    </p>
                                </div>
                            </div>

                            <div className="ss-profile-summary">
                                <div className="ss-avatar">
                                    {(user?.name || user?.email || "S")
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div>
                                    <h3>{user?.name || "Super Admin"}</h3>
                                    <p>
                                        {user?.email || "No email available"}
                                    </p>
                                    <span className="ss-role-pill">
                                        Super Admin
                                    </span>
                                </div>
                            </div>

                            <div className="ss-fields-grid">
                                <div className="ss-field">
                                    <label>Full Name</label>
                                    <div className="ss-readonly-field">
                                        <UserRound size={17} />
                                        <span>
                                            {user?.name || "Not available"}
                                        </span>
                                    </div>
                                </div>

                                <div className="ss-field">
                                    <label>Email Address</label>
                                    <div className="ss-readonly-field">
                                        <Mail size={17} />
                                        <span>
                                            {user?.email || "Not available"}
                                        </span>
                                    </div>
                                </div>

                                <div className="ss-field">
                                    <label>Account Role</label>
                                    <div className="ss-readonly-field">
                                        <ShieldCheck size={17} />
                                        <span>
                                            {ROLE_LABELS[currentRole] ||
                                                currentRole}
                                        </span>
                                    </div>
                                </div>

                                <div className="ss-field">
                                    <label>Access Level</label>
                                    <div className="ss-readonly-field">
                                        <LockKeyhole size={17} />
                                        <span>System Administration</span>
                                    </div>
                                </div>
                            </div>

                            <div className="ss-info-strip">
                                <AlertCircle size={18} />
                                <p>
                                    Profile details are read-only here. Account
                                    information changes should be handled
                                    through the authorized account management
                                    workflow.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeSection === "security" && (
                        <div className="ss-card">
                            <div className="ss-card-heading">
                                <div className="ss-card-icon">
                                    <ShieldCheck size={21} />
                                </div>

                                <div>
                                    <h3>Password &amp; Security</h3>
                                    <p>
                                        Keep your Super Admin account secure.
                                    </p>
                                </div>
                            </div>

                            <div className="ss-security-row">
                                <div className="ss-security-icon">
                                    <KeyRound size={21} />
                                </div>

                                <div className="ss-security-copy">
                                    <strong>Change your password</strong>
                                    <p>
                                        Update your own password using your
                                        current password.
                                    </p>
                                </div>

                                <span className="ss-coming-soon">
                                    Backend required
                                </span>
                            </div>

                            <div className="ss-info-strip">
                                <LockKeyhole size={18} />
                                <p>
                                    Your own password-change form will be
                                    connected separately. Passwords must never
                                    be stored or displayed as plain text.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeSection === "password-reset" && (
                        <div className="ss-card">
                            <div className="ss-card-heading">
                                <div className="ss-card-icon">
                                    <KeyRound size={21} />
                                </div>

                                <div>
                                    <h3>Reset User Password</h3>
                                    <p>
                                        Issue a temporary password to an
                                        authorized account.
                                    </p>
                                </div>
                            </div>

                            <div className="ss-info-strip">
                                <ShieldCheck size={18} />
                                <p>
                                    Only Super Admin can reset another user's
                                    password. The account is marked to require
                                    a password change, but login enforcement
                                    must also be implemented in the backend.
                                </p>
                            </div>

                            <div className="ss-field ss-user-search">
                                <label htmlFor="ss-user-search">
                                    Search employee or account
                                </label>

                                <div className="ss-search-box">
                                    <Search size={18} />

                                    <input
                                        id="ss-user-search"
                                        type="search"
                                        placeholder="Search by name, email or role..."
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                    />

                                    <button
                                        type="button"
                                        className="ss-icon-button"
                                        onClick={loadUsers}
                                        disabled={usersLoading}
                                        aria-label="Refresh user list"
                                        title="Refresh user list"
                                    >
                                        <RefreshCw
                                            size={17}
                                            className={
                                                usersLoading ? "ss-spin" : ""
                                            }
                                        />
                                    </button>
                                </div>
                            </div>

                            {!usersLoaded && (
                                <button
                                    type="button"
                                    className="ss-secondary-button"
                                    onClick={loadUsers}
                                    disabled={usersLoading}
                                >
                                    <Users size={17} />
                                    {usersLoading
                                        ? "Loading accounts..."
                                        : "Load Accounts"}
                                </button>
                            )}

                            {usersLoaded && (
                                <div className="ss-user-list">
                                    {filteredUsers.length === 0 ? (
                                        <div className="ss-empty-state">
                                            <Search size={25} />
                                            <p>No matching accounts found.</p>
                                        </div>
                                    ) : (
                                        filteredUsers.map((item) => {
                                            const itemId = String(
                                                item.id || item._id
                                            );

                                            return (
                                                <button
                                                    type="button"
                                                    key={itemId}
                                                    className={`ss-user-option ${String(
                                                        selectedUser?.id ||
                                                        ""
                                                    ) === itemId
                                                        ? "selected"
                                                        : ""
                                                        }`}
                                                    onClick={() => {
                                                        setSelectedUser({
                                                            ...item,
                                                            id: itemId,
                                                        });
                                                        setTemporaryPassword("");
                                                        setShowPassword(false);
                                                        setNotice({
                                                            type: "",
                                                            message: "",
                                                        });
                                                    }}
                                                >
                                                    <span className="ss-user-avatar">
                                                        {(
                                                            item.name ||
                                                            item.email ||
                                                            "?"
                                                        )
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </span>

                                                    <span className="ss-user-info">
                                                        <strong>
                                                            {item.name ||
                                                                "Unnamed user"}
                                                        </strong>
                                                        <small>
                                                            {item.email}
                                                        </small>
                                                    </span>

                                                    <span className="ss-user-role">
                                                        {ROLE_LABELS[
                                                            item.role
                                                        ] || item.role}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {selectedUser && (
                                <form
                                    className="ss-reset-form"
                                    onSubmit={handleResetPassword}
                                >
                                    <div className="ss-selected-account">
                                        <UserCog size={19} />
                                        <div>
                                            <strong>
                                                {selectedUser.name}
                                            </strong>
                                            <span>
                                                {selectedUser.email}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="ss-field">
                                        <label htmlFor="ss-temporary-password">
                                            New Temporary Password
                                        </label>

                                        <div className="ss-password-input">
                                            <input
                                                id="ss-temporary-password"
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                autoComplete="new-password"
                                                value={temporaryPassword}
                                                onChange={(event) => {
                                                    setTemporaryPassword(
                                                        event.target.value
                                                    );
                                                    setNotice({
                                                        type: "",
                                                        message: "",
                                                    });
                                                }}
                                                placeholder="Generate a secure password"
                                                minLength={12}
                                                required
                                            />

                                            <button
                                                type="button"
                                                className="ss-icon-button"
                                                onClick={() =>
                                                    setShowPassword(
                                                        (value) => !value
                                                    )
                                                }
                                                aria-label={
                                                    showPassword
                                                        ? "Hide password"
                                                        : "Show password"
                                                }
                                            >
                                                {showPassword ? (
                                                    <EyeOff size={18} />
                                                ) : (
                                                    <Eye size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="ss-secondary-button"
                                        onClick={generateTemporaryPassword}
                                        disabled={resetLoading}
                                    >
                                        <RefreshCw size={17} />
                                        Generate Temporary Password
                                    </button>

                                    <button
                                        type="submit"
                                        className="ss-primary-button"
                                        disabled={
                                            resetLoading ||
                                            temporaryPassword.length < 12
                                        }
                                    >
                                        <KeyRound size={17} />
                                        {resetLoading
                                            ? "Resetting Password..."
                                            : "Reset Password"}
                                    </button>

                                    <p className="ss-form-hint">
                                        After a successful reset, share the
                                        temporary password securely with the
                                        account owner. Never share it publicly
                                        or send it through an insecure channel.
                                    </p>
                                </form>
                            )}
                        </div>
                    )}

                    {activeSection === "system" && (
                        <div className="ss-card">
                            <div className="ss-card-heading">
                                <div className="ss-card-icon">
                                    <MonitorCog size={21} />
                                </div>

                                <div>
                                    <h3>System Information</h3>
                                    <p>
                                        Basic information about this
                                        application.
                                    </p>
                                </div>
                            </div>

                            <div className="ss-system-list">
                                <div className="ss-system-row">
                                    <span>Application</span>
                                    <strong>AKSIT GLOBAL HR</strong>
                                </div>

                                <div className="ss-system-row">
                                    <span>Current account</span>
                                    <strong>
                                        {user?.email || "Not available"}
                                    </strong>
                                </div>

                                <div className="ss-system-row">
                                    <span>Access level</span>
                                    <strong>Super Admin</strong>
                                </div>

                                <div className="ss-system-row">
                                    <span>Account management</span>
                                    <strong>Protected</strong>
                                </div>
                            </div>

                            <div className="ss-info-strip">
                                <AlertCircle size={18} />
                                <p>
                                    Technical configuration options will be
                                    added only when their backend behavior and
                                    security requirements are defined.
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
