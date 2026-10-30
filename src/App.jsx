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
import PageHeader from "./components/PageHeader";
import Login from "./components/Login";
import SuperAdminDashboard from "./admin/SuperAdminDashboard";
import HREmployeeLeaves from "./hr/HREmployeeLeaves";
import CompanyAttendance from "./hr/CompanyAttendance";
import CTOAttendance from "./attendance/CTOAttendance";
import CTOCompanyAttendance from "./cto/md/CTOCompanyAttendance";
import CTOEmployees from "./cto/md/CTOEmployees";
import CTOTasks from "./cto/md/CTOTasks";
import Tasks from "./manager/Tasks";
import HRHolidays from "./hr/HRHolidays";
import CEOTasks from "./ceo/CEOTasks";
import CEOAttendance from "./attendance/CEOAttendance";
import EmployeeAttendance from "./attendance/EmployeeAttendance";
import HRAttendance from "./attendance/HRAttendance";
import ManagerAttendance from "./attendance/ManagerAttendance";
import EmployeeMonthlyReport from "./employee/EmployeeMonthlyReport";
import EmployeeTasks from "./employee/EmployeeTasks";
import EmployeeDashboard from "./employee/EmployeeDashboard";
import ManagerEmployees from "./manager/ManagerEmployees";
import EmployeeLeaves from "./manager/EmployeeLeaves";
import RoleSettings from "./components/RoleSettings";
import { useAuth } from "./context/AuthContext";
import CTOManagerProfiles from "./cto/md/CTOManagerProfiles";
import CTODashboard from "./cto/md/CTODashboard";
import CEODashboard from "./ceo/CEODashboard";
import CEOCompanyAttendance from "./ceo/CEOCompanyAttendance";
import CEOEmployees from "./ceo/CEOEmployees";
import CEOLeaveManagement from "./ceo/CEOLeaveManagement";

import "./App.css";
import "./PasswordChangeScreen.css";

const PAGE_TITLES = {
  Dashboard: "Dashboard",
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
  "Leave Management": "Leave Management",
  "Monthly Report": "Monthly Report",
  Holidays: "Holiday Management",
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
  "Leave Management",
  "Monthly Report",
  "Holidays",
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
  "Leave Management",
  "Monthly Report",
  "Holidays",
];

const MONTHLY_REPORT_ROLES = [
  "employee",
  "hr",
  "ceo",
  "cto_md",
  "super_admin",
  "superuser",
];

const COMPANY_ATTENDANCE_ROLES = [
  "hr",
  "ceo",
  "cto_md",
  "super_admin",
  "superuser",
];

const ADMIN_ROLES = ["super_admin", "superuser"];

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
    if (!user || mustChangePassword) {
      return;
    }

    if (ADMIN_ROLES.includes(currentRole)) {
      setPage("Admin Dashboard");
    } else if (
      ["employee", "cto_md", "ceo"].includes(currentRole)
    ) {
      setPage("Dashboard");
    } else {
      setPage("Attendance");
    }
  }, [user, currentRole, mustChangePassword]);

  const canAccessPage = (label) => {
    if (!AVAILABLE_PAGES.includes(label)) {
      return false;
    }

    switch (label) {
      case "Dashboard":
        return ["employee", "cto_md", "ceo"].includes(currentRole);

      case "Manager Profiles":
      case "Overall Progress":
        return currentRole === "cto_md";

      case "Employees":
        return ["manager", "cto_md", "ceo"].includes(currentRole);

      case "Company Attendance":
        return COMPANY_ATTENDANCE_ROLES.includes(currentRole);

      case "Holidays":
        return currentRole === "hr";

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
        return ADMIN_ROLES.includes(currentRole);

      case "Leave Management":
        return currentRole === "ceo";

      case "Monthly Report":
        return MONTHLY_REPORT_ROLES.includes(currentRole);

      default:
        return true;
    }
  };

  const handleNav = (label) => {
    if (!canAccessPage(label)) {
      return;
    }

    setPage(label);
  };

  const handleSettingsSection = (section) => {
    setSettingsSection(section);
    setPage("Settings");
  };

  const renderAttendancePage = () => {
    if (currentRole === "employee") {
      return <EmployeeAttendance role={currentRole} />;
    }

    if (currentRole === "manager") {
      return <ManagerAttendance role={currentRole} />;
    }

    if (currentRole === "hr") {
      return <HRAttendance role={currentRole} />;
    }

    if (currentRole === "cto_md") {
      return <CTOAttendance role={currentRole} />;
    }

    if (
      ["ceo", "admin", "super_admin", "superuser"].includes(currentRole)
    ) {
      return <CEOAttendance role={currentRole} />;
    }

    return (
      <div className="attendance-app-message" role="alert">
        <h2>Access Denied</h2>
        <p>You do not have access to this page.</p>
      </div>
    );
  };

  const renderPage = () => {
    if (!canAccessPage(page)) {
      return (
        <div className="attendance-app-message" role="alert">
          <h2>Access Denied</h2>
          <p>You do not have permission to access this page.</p>
        </div>
      );
    }

    switch (page) {
      case "Dashboard":
        if (currentRole === "employee") {
          return <EmployeeDashboard onNavigate={handleNav} />;
        }

        if (currentRole === "ceo") {
          return <CEODashboard />;
        }

        if (currentRole === "cto_md") {
          return <CTODashboard />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>This dashboard is not available for this role.</p>
          </div>
        );

      case "Attendance":
        return renderAttendancePage();

      case "Employees":
        if (currentRole === "cto_md") {
          return <CTOEmployees />;
        }

        if (currentRole === "ceo") {
          return <CEOEmployees />;
        }

        if (currentRole === "manager") {
          return <ManagerEmployees />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have access to this page.</p>
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
        if (currentRole === "cto_md") {
          return <CTOCompanyAttendance />;
        }

        if (currentRole === "ceo") {
          return <CEOCompanyAttendance />;
        }

        if (["hr", "super_admin", "superuser"].includes(currentRole)) {
          return <CompanyAttendance />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have access to this page.</p>
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
              Manager Profiles are only available to the CTO / Managing Director.
            </p>
          </div>
        );

      case "Overall Progress":
        if (currentRole === "cto_md") {
          return <CTOTasks />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>
              Overall Progress is only available to the CTO / Managing Director.
            </p>
          </div>
        );

      case "Tasks & Projects":
        if (currentRole === "employee") {
          return <EmployeeTasks />;
        }

        if (currentRole === "manager") {
          return <Tasks />;
        }

        if (currentRole === "cto_md") {
          return <CTOTasks />;
        }

        if (
          ["ceo", "admin", "super_admin", "superuser"].includes(currentRole)
        ) {
          return <CEOTasks />;
        }

        if (currentRole === "hr") {
          return (
            <div className="attendance-app-message">
              <h2>Task Monitoring</h2>
              <p>Task monitoring is not configured for this page yet.</p>
            </div>
          );
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have access to this page.</p>
          </div>
        );

      case "Monthly Report":
        if (MONTHLY_REPORT_ROLES.includes(currentRole)) {
          return <EmployeeMonthlyReport />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have access to this page.</p>
          </div>
        );

      case "Holidays":
        if (currentRole === "hr") {
          return <HRHolidays />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>Holiday Management is only available to HR.</p>
          </div>
        );

      case "Leave Management":
        if (currentRole === "ceo") {
          return <CEOLeaveManagement />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>Leave Management is only available to the CEO.</p>
          </div>
        );

      case "Admin Dashboard":
        if (ADMIN_ROLES.includes(currentRole)) {
          return <SuperAdminDashboard />;
        }

        return (
          <div className="attendance-app-message" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have access to this page.</p>
          </div>
        );

      case "Settings":
        if (ADMIN_ROLES.includes(currentRole)) {
          return <SuperAdminSettings />;
        }

        return (
          <RoleSettings
            role={currentRole}
            section={settingsSection}
            onSectionChange={setSettingsSection}
            theme={theme}
            onThemeChange={handleThemeChange}
          />
        );

      case "Calendar":
        return (
          <div className="attendance-app-message">
            <h2>Calendar</h2>
            <p>Calendar content is not configured in this App.jsx.</p>
          </div>
        );

      case "Documents":
        return (
          <div className="attendance-app-message">
            <h2>Documents</h2>
            <p>Documents content is not configured in this App.jsx.</p>
          </div>
        );

      default:
        return (
          <div className="attendance-app-message">
            <h2>Page Not Found</h2>
            <p>The selected page is not available.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <p>Loading your workspace...</p>
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
    page === "Settings" && !ADMIN_ROLES.includes(currentRole);

  const showGlobalHeader =
    !PAGES_WITH_OWN_HEADER.includes(page) &&
    !settingsHasOwnHeader;

  const headerTitle =
    page === "Dashboard" && currentRole === "ceo"
      ? "CEO Dashboard"
      : page === "Dashboard" && currentRole === "cto_md"
        ? "CTO / Managing Director Dashboard"
        : PAGE_TITLES[page] || page;

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
          <PageHeader
            eyebrow={`${currentRole.replace(/_/g, " ").toUpperCase()} WORKSPACE`}
            title={headerTitle}
            description={`${user.name || user.email || "User"} · ${currentRole.replace(/_/g, " ")}`}
          />
        )}

        <section className="app-page-content">
          {renderPage()}
        </section>
      </main>
    </div>
  );
}
