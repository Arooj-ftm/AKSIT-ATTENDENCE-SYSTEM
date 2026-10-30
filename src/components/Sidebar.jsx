
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  CalendarCheck,
  ClipboardList,
  LogOut,
  CalendarDays,
  ShieldCheck,
  Settings as SettingsIcon,
  LayoutDashboard,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileText,
  CalendarRange,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import "./Sidebar.css";

const items = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    roles: ["employee", "cto_md", "ceo", "super_admin"],
  },
  {
    icon: CalendarCheck,
    label: "Attendance",
  },
  {
    icon: FileText,
    label: "Monthly Report",
    roles: [
      "employee",
      "hr",
      "ceo",
      "cto_md",
      "super_admin",
      "superuser",
    ],
  },
  {
    icon: Users,
    label: "Employees",
    roles: ["manager", "cto_md", "ceo", "super_admin"],
  },
  {
    icon: CalendarCheck,
    label: "Employee Leaves",
    roles: ["manager", "hr", "super_admin"],
  },
  {
    icon: CalendarRange,
    label: "Holidays",
    roles: ["hr"],
  },
  {
    icon: ClipboardCheck,
    label: "Leave Management",
    roles: ["ceo", "super_admin"],
  },
  {
    icon: CalendarDays,
    label: "Company Attendance",
    roles: [
      "hr",
      "ceo",
      "cto_md",
      "super_admin",
      "superuser",
    ],
  },
  {
    icon: ClipboardList,
    label: "Tasks & Projects",
    roles: [
      "employee",
      "manager",
      "hr",
      "ceo",
      "admin",
      "super_admin",
      "superuser",
      "cto_md",
    ],
  },
  {
    icon: BriefcaseBusiness,
    label: "Manager Profiles",
    roles: ["cto_md", "super_admin"],
  },
  {
    icon: ChartNoAxesCombined,
    label: "Overall Progress",
    roles: ["cto_md", "super_admin"],
  },
  {
    icon: ShieldCheck,
    label: "Admin Dashboard",
    roles: ["super_admin", "superuser"],
  },
  {
    icon: SettingsIcon,
    label: "Settings",
  },
];

const ROLE_LABELS = {
  super_admin: "Super Admin",
  superuser: "Superuser",
  admin: "Admin",
  cto_md: "CTO / Managing Director",
  hr: "HR",
  ceo: "CEO",
  manager: "Manager",
  employee: "Employee",
};

function normalizeRole(role) {
  return String(role || "employee")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getDefaultPage(role) {
  if (["employee", "cto_md", "ceo"].includes(role)) {
    return "Dashboard";
  }

  if (["super_admin", "superuser"].includes(role)) {
    return "Admin Dashboard";
  }

  return "Attendance";
}

export default function Sidebar({
  onNavigate,
  onSection,
  settingsRole,
  onLogout,
  activePage,
}) {
  const { user, logout: authLogout } = useAuth();

  const currentRole = normalizeRole(
    settingsRole || user?.role || "employee"
  );

  const isSuperAdmin = currentRole === "super_admin";

  const currentName = user?.name || "User";
  const currentEmail = user?.email || "";
  const roleLabel = ROLE_LABELS[currentRole] || "Employee";

  const [active, setActive] = useState(
    activePage || getDefaultPage(currentRole)
  );

  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    setActive(activePage || getDefaultPage(currentRole));
  }, [activePage, currentRole, user?.id, user?._id]);

  const filteredItems = items.filter((item) => {
    if (item.roles && !item.roles.includes(currentRole)) {
      return false;
    }

    return true;
  });

  const go = (label) => {
    setActive(label);

    if (label === "Settings") {
      onSection?.("profile");
    }

    onNavigate?.(label);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      authLogout?.();
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        {logoOk ? (
          <img
            src="/logo.png"
            alt="Aksit Global"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span className="sidebar-fallback">
            AKSIT GLOBAL
          </span>
        )}
      </div>

      {isSuperAdmin && (
        <div
          className="sidebar-readonly-notice"
          title="You can view company information but cannot make operational changes."
        >
          <ShieldCheck size={16} aria-hidden="true" />

          <div>
            <strong>Read-Only Mode</strong>
            <span>View access only</span>
          </div>
        </div>
      )}

      <nav className="sidebar-nav" aria-label="Main navigation">
        {filteredItems.map(({ icon: Icon, label }) => (
          <button
            type="button"
            key={label}
            onClick={() => go(label)}
            className={`sidebar-link ${
              active === label ? "active" : ""
            }`}
            aria-current={
              active === label ? "page" : undefined
            }
          >
            {active === label && (
              <motion.div
                layoutId="active"
                className="sidebar-pill"
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 30,
                }}
              />
            )}

            {active === label && (
              <motion.span
                layoutId="bar"
                className="sidebar-bar"
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 30,
                }}
              />
            )}

            <Icon size={18} aria-hidden="true" />

            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-bottom-actions">
          <button
            type="button"
            className="sidebar-link sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>

        <div className="sidebar-admin">
          <Avatar
            name={currentName}
            size="sm"
            id={user?.id || user?._id || 0}
          />

          <div className="sidebar-admin-text">
            <p className="sidebar-admin-name truncate">
              {currentName}
            </p>

            <p className="sidebar-admin-mail truncate">
              {currentEmail}
            </p>

            <p className="sidebar-admin-mail truncate">
              {roleLabel}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
