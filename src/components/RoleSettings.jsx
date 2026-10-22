import { useEffect, useState } from "react";
import {
    UserRound,
    ShieldCheck,
    Mail,
    BriefcaseBusiness,
    CheckCircle2,
    AlertCircle,
    Sun,
    Moon,
    Palette,
    Save,
    RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PageHeader from "./PageHeader";
import "./RoleSettings.css";

const ROLE_INFO = {
    employee: {
        label: "Employee",
        accessTitle: "Personal workspace",
        accessDescription:
            "Access is limited to the features assigned to your employee account.",
    },
    manager: {
        label: "Manager",
        accessTitle: "Team management",
        accessDescription:
            "Your team management access follows the permissions assigned to your account.",
    },
    hr: {
        label: "HR",
        accessTitle: "HR workspace",
        accessDescription:
            "Your HR access follows the permissions assigned to your account.",
    },
    ceo: {
        label: "CEO",
        accessTitle: "Executive access",
        accessDescription:
            "Your company-level access follows the permissions assigned to your account.",
    },
    cto_md: {
        label: "CTO / Managing Director",
        accessTitle: "Company-wide access",
        accessDescription:
            "Your company-wide access follows the permissions assigned to your account.",
    },
    admin: {
        label: "Admin",
        accessTitle: "Administrative access",
        accessDescription:
            "Your access follows the permissions assigned to your account.",
    },
    superuser: {
        label: "Super Admin",
        accessTitle: "System administration",
        accessDescription:
            "System-wide controls are managed through Super Admin Settings.",
    },
    super_admin: {
        label: "Super Admin",
        accessTitle: "System administration",
        accessDescription:
            "System-wide controls are managed through Super Admin Settings.",
    },
};

const SECTION_INFO = {
    profile: {
        label: "Profile",
        description: "Manage your name and email address.",
        icon: UserRound,
    },
    appearance: {
        label: "Appearance",
        description: "Choose the theme for your workspace.",
        icon: Palette,
    },
    role: {
        label: "Role & Permissions",
        description: "Review your account role and workspace access.",
        icon: BriefcaseBusiness,
    },
};

export default function RoleSettings({
    role = "employee",
    section = "profile",
    theme: themeProp,
    onThemeChange,
}) {
    const { user, updateProfile } = useAuth();

    const normalizedRole = String(role || user?.role || "employee")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    const roleInfo = ROLE_INFO[normalizedRole] || ROLE_INFO.employee;
    const activeSection = SECTION_INFO[section] ? section : "profile";
    const ActiveIcon = SECTION_INFO[activeSection].icon;

    const [name, setName] = useState(user?.name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [internalTheme, setInternalTheme] = useState(() => {
        try {
            return localStorage.getItem("app-theme") === "dark"
                ? "dark"
                : "light";
        } catch {
            return "light";
        }
    });

    const theme = themeProp === "dark" || themeProp === "light"
        ? themeProp
        : internalTheme;

    const [notice, setNotice] = useState({
        type: "",
        message: "",
    });

    useEffect(() => {
        setName(user?.name || "");
        setEmail(user?.email || "");
    }, [user?.name, user?.email]);

    useEffect(() => {
        setNotice({ type: "", message: "" });
    }, [activeSection]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;

        try {
            localStorage.setItem("app-theme", theme);
        } catch {
            // Theme still applies for the current session if storage is unavailable.
        }
    }, [theme]);

    const handleThemeChange = (nextTheme) => {
        if (typeof onThemeChange === "function") {
            onThemeChange(nextTheme);
        } else {
            setInternalTheme(nextTheme);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        window.location.reload();
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        setNotice({ type: "", message: "" });

        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (trimmedName.length < 2 || trimmedName.length > 80) {
            setNotice({
                type: "error",
                message: "Name must contain between 2 and 80 characters.",
            });
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setNotice({
                type: "error",
                message: "Please enter a valid email address.",
            });
            return;
        }

        if (trimmedName === user?.name && normalizedEmail === user?.email) {
            setNotice({
                type: "success",
                message: "Your profile is already up to date.",
            });
            return;
        }

        if (typeof updateProfile !== "function") {
            setNotice({
                type: "error",
                message:
                    "Profile update is not available. Please check AuthContext configuration.",
            });
            return;
        }

        setSaving(true);

        try {
            await updateProfile({
                name: trimmedName,
                email: normalizedEmail,
            });

            setNotice({
                type: "success",
                message: "Your profile has been updated successfully.",
            });
        } catch (error) {
            setNotice({
                type: "error",
                message: error.message || "Unable to update your profile.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <main
            className="role-settings-page"
            data-role={normalizedRole}
        >
            <section className="role-settings-workspace">
                <PageHeader
                    eyebrow="ACCOUNT MANAGEMENT"
                    title={SECTION_INFO[activeSection].label}
                    description={SECTION_INFO[activeSection].description}
                    icon={ActiveIcon}
                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                />

                {notice.message && (
                    <div
                        className={`role-settings-notice role-settings-notice-${notice.type}`}
                        role={notice.type === "error" ? "alert" : "status"}
                    >
                        {notice.type === "success" ? (
                            <CheckCircle2 size={19} />
                        ) : (
                            <AlertCircle size={19} />
                        )}
                        <span>{notice.message}</span>
                    </div>
                )}

                {activeSection === "profile" && (
                    <div className="role-settings-card">
                        <div className="role-settings-profile">
                            <div className="role-settings-avatar">
                                {(user?.name || user?.email || "U")
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="role-settings-profile-copy">
                                <h3>{user?.name || "User"}</h3>
                                <p>{user?.email || "No email available"}</p>
                                <span>{roleInfo.label}</span>
                            </div>
                        </div>

                        <form
                            className="role-settings-profile-form"
                            onSubmit={handleProfileSubmit}
                        >
                            <div className="role-settings-fields">
                                <div className="role-settings-field">
                                    <label htmlFor="rs-profile-name">
                                        Full name
                                    </label>
                                    <div className="role-settings-input-wrap">
                                        <UserRound size={17} />
                                        <input
                                            id="rs-profile-name"
                                            type="text"
                                            autoComplete="name"
                                            value={name}
                                            onChange={(event) =>
                                                setName(event.target.value)
                                            }
                                            minLength={2}
                                            maxLength={80}
                                            required
                                            disabled={saving}
                                        />
                                    </div>
                                </div>

                                <div className="role-settings-field">
                                    <label htmlFor="rs-profile-email">
                                        Email address
                                    </label>
                                    <div className="role-settings-input-wrap">
                                        <Mail size={17} />
                                        <input
                                            id="rs-profile-email"
                                            type="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(event) =>
                                                setEmail(event.target.value)
                                            }
                                            required
                                            disabled={saving}
                                        />
                                    </div>
                                </div>

                                <div className="role-settings-field">
                                    <label>Account role</label>
                                    <div className="role-settings-readonly">
                                        <ShieldCheck size={17} />
                                        <span>{roleInfo.label}</span>
                                    </div>
                                </div>

                                <div className="role-settings-field">
                                    <label>Account status</label>
                                    <div className="role-settings-readonly">
                                        <ShieldCheck size={17} />
                                        <span>
                                            {user?.isActive === false
                                                ? "Inactive"
                                                : "Active"}
                                        </span>
                                    </div>
                                </div>

                                <div className="role-settings-field">
                                    <label>Department</label>
                                    <div className="role-settings-readonly">
                                        <BriefcaseBusiness size={17} />
                                        <span>
                                            {user?.department || "Not assigned"}
                                        </span>
                                    </div>
                                </div>

                                <div className="role-settings-field">
                                    <label>Designation</label>
                                    <div className="role-settings-readonly">
                                        <BriefcaseBusiness size={17} />
                                        <span>
                                            {user?.designation || "Not assigned"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="role-settings-form-actions">
                                <button
                                    className="role-settings-primary-button"
                                    type="submit"
                                    disabled={saving}
                                >
                                    <Save size={17} />
                                    {saving ? "Saving profile..." : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeSection === "appearance" && (
                    <div className="role-settings-card">
                        <div className="role-settings-card-heading">
                            <div className="role-settings-section-icon">
                                <Palette size={21} />
                            </div>
                            <div>
                                <h3>Workspace appearance</h3>
                                <p>
                                    Select how the application should look.
                                    Your selection is saved in this browser.
                                </p>
                            </div>
                        </div>

                        <div className="role-settings-theme-options">
                            <button
                                type="button"
                                className={`role-settings-theme-option ${theme === "light" ? "is-selected" : ""
                                    }`}
                                aria-pressed={theme === "light"}
                                onClick={() => handleThemeChange("light")}
                            >
                                <span className="role-settings-theme-preview light-preview">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                                <span className="role-settings-theme-copy">
                                    <strong>
                                        <Sun size={17} />
                                        Light mode
                                    </strong>
                                    <small>Bright background and dark text</small>
                                </span>
                                {theme === "light" && (
                                    <CheckCircle2
                                        className="role-settings-theme-check"
                                        size={19}
                                    />
                                )}
                            </button>

                            <button
                                type="button"
                                className={`role-settings-theme-option ${theme === "dark" ? "is-selected" : ""
                                    }`}
                                aria-pressed={theme === "dark"}
                                onClick={() => handleThemeChange("dark")}
                            >
                                <span className="role-settings-theme-preview dark-preview">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                                <span className="role-settings-theme-copy">
                                    <strong>
                                        <Moon size={17} />
                                        Dark mode
                                    </strong>
                                    <small>Darker surfaces and softer text</small>
                                </span>
                                {theme === "dark" && (
                                    <CheckCircle2
                                        className="role-settings-theme-check"
                                        size={19}
                                    />
                                )}
                            </button>
                        </div>

                        <div className="role-settings-info">
                            <Palette size={18} />
                            <p>
                                Theme preference is stored locally in this
                                browser. Application-wide dark styling also
                                depends on the shared application CSS.
                            </p>
                        </div>
                    </div>
                )}

                {activeSection === "role" && (
                    <div className="role-settings-card">
                        <div className="role-settings-card-heading">
                            <div className="role-settings-section-icon">
                                <BriefcaseBusiness size={21} />
                            </div>
                            <div>
                                <h3>{roleInfo.accessTitle}</h3>
                                <p>{roleInfo.accessDescription}</p>
                            </div>
                        </div>

                        <div className="role-settings-permission-row">
                            <span>Signed-in account</span>
                            <strong>{user?.email || "Not available"}</strong>
                        </div>

                        <div className="role-settings-permission-row">
                            <span>Assigned role</span>
                            <strong>{roleInfo.label}</strong>
                        </div>

                        <div className="role-settings-permission-row">
                            <span>Department</span>
                            <strong>{user?.department || "Not assigned"}</strong>
                        </div>

                        <div className="role-settings-permission-row">
                            <span>Designation</span>
                            <strong>{user?.designation || "Not assigned"}</strong>
                        </div>

                        <div className="role-settings-info">
                            <ShieldCheck size={18} />
                            <p>
                                Permissions are controlled by the application
                                backend. This page displays your assigned
                                access; it cannot grant additional permissions
                                or change your role.
                            </p>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
