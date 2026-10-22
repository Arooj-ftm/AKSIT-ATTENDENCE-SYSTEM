
import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import SuperAdminSettings from "./admin/SuperAdminSettings";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import SuperAdminDashboard from "./admin/SuperAdminDashboard";
import HREmployeeLeaves from "./hr/HREmployeeLeaves";
import CompanyAttendance from "./hr/CompanyAttendance";
import CTOAttendance from "./attendance/CTOAttendance";
import CTOCompanyAttendance from "./cto/md/CTOCompanyAttendance";
import CTOEmployees from "./cto/md/CTOEmployees";
import CTOTasks from "./cto/md/CTOTasks";
import Tasks from "./manager/Tasks";
import CEOTasks from "./ceo/CEOTasks";
import CEOAttendance from "./attendance/CEOAttendance";
import EmployeeAttendance from "./attendance/EmployeeAttendance";
import HRAttendance from "./attendance/HRAttendance";
import ManagerAttendance from "./attendance/ManagerAttendance";
import EmployeeTasks from "./employee/EmployeeTasks";
import ManagerEmployees from "./manager/ManagerEmployees";
import EmployeeLeaves from "./manager/EmployeeLeaves";
import RoleSettings from "./components/RoleSettings";
import { useAuth } from "./context/AuthContext";
import { apiRequest } from "./api/api";
import PageHeader from "./components/PageHeader";
import CTOManagerProfiles from "./cto/md/CTOManagerProfiles";
import CTODashboard from "./cto/md/CTODashboard";

import "./App.css";
import "./PasswordChangeScreen.css";

const PAGE_TITLES = {
  Dashboard: "CTO / Managing Director Dashboard",
  Attendance: "Attendance",
  Employees: "Employees",
  "Employee Leaves": "Employee Leaves",
  "Company Attendance": "Company Attendance",
  "Manager Profiles": "Manager Profiles",
  "Overall Progress": "Overall Progress",
  Calendar: "Calendar",
  "Tasks & Projects": "Tasks & Projects",
  Documents: "Documents",
  Settings: "Settings",
  "Admin Dashboard": "Super Admin Dashboard",
};

const AVAILABLE_PAGES = [
  "Dashboard",
  "Attendance",
  "Employees",
  "Employee Leaves",
  "Company Attendance",
  "Manager Profiles",
  "Overall Progress",
  "Calendar",
  "Tasks & Projects",
  "Documents",
  "Settings",
  "Admin Dashboard",
];

const PAGES_WITH_OWN_HEADER = [
  "Dashboard",
  "Attendance",
  "Employees",
  "Employee Leaves",
  "Company Attendance",
  "Manager Profiles",
  "Overall Progress",
  "Tasks & Projects",
  "Admin Dashboard",
];

function getSavedTheme() {
  try {
    return localStorage.getItem("app-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function PasswordChangeScreen({ user, onChangePassword, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        "Your new password must be different from your current password."
      );
      return;
    }

    setSubmitting(true);

    try {
      await onChangePassword({
        currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setSuccess(
        "Password changed successfully. Opening your workspace..."
      );
    } catch (requestError) {
      setError(
        requestError.message || "Unable to change your password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = submitting || Boolean(success);

  return (
    <main className="password-change-page">
      <div
        className="password-change-decoration password-change-decoration-one"
        aria-hidden="true"
      />

      <div
        className="password-change-decoration password-change-decoration-two"
        aria-hidden="true"
      />

      <section className="password-change-card">
        <div className="password-change-brand">
          <img
            src="/logo.png"
            alt="Company logo"
            className="password-change-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <span className="password-change-brand-label">
            WORKSPACE
          </span>
        </div>

        <div className="password-change-heading">
          <span className="password-change-eyebrow">
            ACCOUNT SECURITY
          </span>

          <h1>Change your password</h1>

          <p>
            Welcome, {user?.name || user?.email || "User"}.
            Before continuing to your workspace, please create
            a new password to keep your account secure.
          </p>
        </div>

        <div className="password-change-notice">
          <ShieldCheck size={19} aria-hidden="true" />

          <p>
            You are using a temporary password. Set a new
            password to continue.
          </p>
        </div>

        <form
          className="password-change-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <label htmlFor="current-password">
            Current password
          </label>

          <div className="password-change-input-wrap">
            <Lock size={18} aria-hidden="true" />

            <input
              id="current-password"
              name="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Enter current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setError("");
              }}
              required
              disabled={isDisabled}
            />

            <button
              type="button"
              className="password-change-toggle"
              onClick={() =>
                setShowCurrentPassword((current) => !current)
              }
              aria-label={
                showCurrentPassword
                  ? "Hide current password"
                  : "Show current password"
              }
              disabled={isDisabled}
            >
              {showCurrentPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          <label htmlFor="new-password">
            New password
          </label>

          <div className="password-change-input-wrap">
            <Lock size={18} aria-hidden="true" />

            <input
              id="new-password"
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              placeholder="Create a new password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setError("");
              }}
              minLength={12}
              required
              disabled={isDisabled}
            />

            <button
              type="button"
              className="password-change-toggle"
              onClick={() =>
                setShowNewPassword((current) => !current)
              }
              aria-label={
                showNewPassword
                  ? "Hide new password"
                  : "Show new password"
              }
              disabled={isDisabled}
            >
              {showNewPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          <p className="password-change-hint">
            Use at least 12 characters for your new password.
          </p>

          <label htmlFor="confirm-password">
            Confirm new password
          </label>

          <div className="password-change-input-wrap">
            <Lock size={18} aria-hidden="true" />

            <input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
              minLength={12}
              required
              disabled={isDisabled}
            />

            <button
              type="button"
              className="password-change-toggle"
              onClick={() =>
                setShowConfirmPassword((current) => !current)
              }
              aria-label={
                showConfirmPassword
                  ? "Hide confirmation password"
                  : "Show confirmation password"
              }
              disabled={isDisabled}
            >
              {showConfirmPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {error && (
            <div
              className="password-change-message password-change-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="password-change-message password-change-success"
              role="status"
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            className="password-change-submit"
            disabled={isDisabled}
          >
            {submitting ? (
              "Changing password..."
            ) : success ? (
              "Password changed"
            ) : (
              <>
                Change password
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="password-change-footer">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Secure company workspace</span>
        </div>

        <button
          type="button"
          className="password-change-logout"
          onClick={onLogout}
          disabled={submitting}
        >
          Log out of your account
        </button>
      </section>

      <p className="password-change-copyright">
        © {new Date().getFullYear()} Your Company. All rights reserved.
      </p>
    </main>
  );
}

export default function App() {
  const {
    user,
    loading,
    acceptSession,
    logout,
    changePassword,
  } = useAuth();

  const [page, setPage] = useState("Attendance");
  const [settingsSection, setSettingsSection] = useState("profile");
  const [theme, setTheme] = useState(getSavedTheme);

  const currentRole = String(user?.role || "employee")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const mustChangePassword = user?.mustChangePassword === true;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;

    try {
      localStorage.setItem("app-theme", theme);
    } catch {
      // The selected theme still applies during this session.
    }
  }, [theme]);

  const handleThemeChange = (nextTheme) => {
    if (nextTheme !== "light" && nextTheme !== "dark") {
      return;
    }

    setTheme(nextTheme);
  };

  useEffect(() => {
    if (user && !mustChangePassword) {
      if (
        currentRole === "super_admin" ||
        currentRole === "superuser"
      ) {
        setPage("Admin Dashboard");
      } else if (currentRole === "cto_md") {
        setPage("Dashboard");
      } else {
        setPage("Attendance");
      }
    }
  }, [user, currentRole, mustChangePassword]);

  const canAccessPage = (label) => {
    if (!AVAILABLE_PAGES.includes(label)) {
      return false;
    }

    switch (label) {
      case "Dashboard":
      case "Manager Profiles":
      case "Overall Progress":
        return currentRole === "cto_md";

      case "Employees":
        return ["manager", "cto_md"].includes(currentRole);

      case "Employee Leaves":
        return ["manager", "hr"].includes(currentRole);

      case "Company Attendance":
        return ["hr", "ceo", "cto_md"].includes(currentRole);

      case "Tasks & Projects":
        return [
          "employee",
          "manager",
          "hr",
          "ceo",
          "admin",
          "super_admin",
          "superuser",
          "cto_md",
        ].includes(currentRole);

      case "Admin Dashboard":
        return ["super_admin", "superuser"].includes(currentRole);

      default:
        return true;
    }
  };

  const handleNav = (label) => {
    if (!canAccessPage(label)) {
      return;
    }

    if (label === "Settings") {
      setSettingsSection("profile");
    }

    setPage(label);
  };

  const handleSettingsSection = (section) => {
    setSettingsSection(section);
  };

  const renderAttendancePage = () => {
    switch (currentRole) {
      case "employee":
        return <EmployeeAttendance role={currentRole} />;

      case "manager":
        return <ManagerAttendance role={currentRole} />;

      case "hr":
        return <HRAttendance role={currentRole} />;

      case "cto_md":
        return <CTOAttendance />;

      case "ceo":
      case "admin":
      case "super_admin":
      case "superuser":
        return <CEOAttendance role={currentRole} />;

      default:
        return (
          <div className="attendance-app-message" role="alert">
            Your account role is not recognized. Please contact
            your system administrator.
          </div>
        );
    }
  };

  const renderPage = () => {
    switch (page) {
      case "Dashboard":
        if (currentRole === "cto_md") {
          return <CTODashboard />;
        }

        return (
          <div className="attendance-app-message">
            <h2>Dashboard</h2>
            <p>This dashboard is not available for this role.</p>
          </div>
        );

      case "Manager Profiles":
        if (currentRole === "cto_md") {
          return <CTOManagerProfiles />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>
              This page is only available to the CTO / Managing Director.
            </p>
          </div>
        );

      case "Overall Progress":
        if (currentRole === "cto_md") {
          return (
            <div className="attendance-app-message">
              <h2>Overall Progress</h2>
              <p>This page has not been connected yet.</p>
            </div>
          );
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>This page is only available to the CTO / Managing Director.</p>
          </div>
        );

      case "Admin Dashboard":
        if (
          ["super_admin", "superuser"].includes(currentRole)
        ) {
          return <SuperAdminDashboard />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>
              The Super Admin Dashboard is only available to
              Super Admin.
            </p>
          </div>
        );

      case "Attendance":
        return renderAttendancePage();

      case "Tasks & Projects":
        switch (currentRole) {
          case "employee":
            return <EmployeeTasks />;

          case "manager":
            return <Tasks />;

          case "hr":
            return (
              <div className="attendance-app-message">
                <h2>HR Tasks &amp; Projects</h2>
                <p>
                  The HR task monitoring page has not been
                  connected yet.
                </p>
              </div>
            );

          case "cto_md":
            return <CTOTasks />;

          case "ceo":
          case "admin":
          case "super_admin":
          case "superuser":
            return <CEOTasks />;

          default:
            return (
              <div className="attendance-app-message" role="alert">
                Your account role is not recognized.
              </div>
            );
        }

      case "Settings":
        if (
          currentRole === "super_admin" ||
          currentRole === "superuser"
        ) {
          return <SuperAdminSettings />;
        }

        return (
          <RoleSettings
            role={currentRole}
            section={settingsSection}
            theme={theme}
            onThemeChange={handleThemeChange}
          />
        );

      case "Employees":
        if (currentRole === "manager") {
          return <ManagerEmployees />;
        }

        if (currentRole === "cto_md") {
          return <CTOEmployees />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>
              Employees is only available to managers and the
              CTO / Managing Director.
            </p>
          </div>
        );

      case "Employee Leaves":
        if (currentRole === "hr") {
          return <HREmployeeLeaves />;
        }

        if (currentRole === "manager") {
          return <EmployeeLeaves />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have access to this page.</p>
          </div>
        );

      case "Company Attendance":
        if (currentRole === "hr") {
          return <CompanyAttendance />;
        }

        if (currentRole === "cto_md") {
          return <CTOCompanyAttendance />;
        }

        if (currentRole === "ceo") {
          return <CEOAttendance role={currentRole} />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>
              Company-wide attendance is only available to
              authorized roles.
            </p>
          </div>
        );

      default:
        return (
          <div className="attendance-app-message">
            <h2>{PAGE_TITLES[page] || page}</h2>
            <p>This page has not been connected yet.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="app-loading" role="status">
        Loading your account...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={acceptSession} />;
  }

  if (mustChangePassword) {
    return (
      <PasswordChangeScreen
        user={user}
        onChangePassword={changePassword}
        onLogout={logout}
      />
    );
  }

  const settingsHasOwnHeader =
    page === "Settings" && currentRole !== "super_admin";

  const showGlobalHeader =
    !PAGES_WITH_OWN_HEADER.includes(page) &&
    !settingsHasOwnHeader;

  return (
    <div className="app" data-theme={theme}>
      <Sidebar
        onNavigate={handleNav}
        onSection={handleSettingsSection}
        settingsRole={currentRole}
        onLogout={logout}
      />

      <main className="main">
        {showGlobalHeader && (
          <header className="header">
            <div>
              <h1 className="header-title">
                {PAGE_TITLES[page] || page}
              </h1>

              <p className="header-date">
                {user.name || user.email || "User"} · {currentRole}
              </p>
            </div>
          </header>
        )}

        <section className="app-page-content">
          {renderPage()}
        </section>
      </main>
    </div>
  );
}
