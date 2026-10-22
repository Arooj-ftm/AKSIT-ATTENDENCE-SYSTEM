
import { useState } from "react";
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
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import "./Sidebar.css";

const items = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    roles: ["cto_md"],
  },
  {
    icon: CalendarCheck,
    label: "Attendance",
  },
  {
    icon: Users,
    label: "Employees",
    roles: ["manager", "cto_md"],
  },
  {
    icon: CalendarCheck,
    label: "Employee Leaves",
    roles: ["manager", "hr"],
  },
  {
    icon: CalendarDays,
    label: "Company Attendance",
    roles: ["hr", "cto_md"],
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
    roles: ["cto_md"],
  },
  {
    icon: ChartNoAxesCombined,
    label: "Overall Progress",
    roles: ["cto_md"],
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
  superuser: "Super Admin",
  admin: "Admin",
  cto_md: "CTO / Managing Director",
  hr: "HR",
  ceo: "CEO",
  manager: "Manager",
  employee: "Employee",
};

export default function Sidebar({
  onNavigate,
  onSection,
  settingsRole,
  onLogout,
}) {
  const { user, logout: authLogout } = useAuth();

  const currentRole = String(
    settingsRole || user?.role || "employee"
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const currentName = user?.name || "User";
  const currentEmail = user?.email || "";
  const roleLabel = ROLE_LABELS[currentRole] || "Employee";

  const defaultPage =
    currentRole === "cto_md"
      ? "Dashboard"
      : currentRole === "super_admin" ||
        currentRole === "superuser"
        ? "Admin Dashboard"
        : "Attendance";

  const [active, setActive] = useState(defaultPage);
  const [logoOk, setLogoOk] = useState(true);

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
            Aksit Global
          </span>
        )}
      </div>

      <p className="sidebar-label">Menu</p>

      <nav className="sidebar-nav">
        {filteredItems.map(({ icon: Icon, label }) => (
          <button
            type="button"
            key={label}
            onClick={() => go(label)}
            className={`sidebar-link ${active === label ? "active" : ""
              }`}
          >
            {active === label && (
              <motion.div
                layoutId="active"
                className="sidebar-pill"
              />
            )}

            {active === label && (
              <motion.span
                layoutId="bar"
                className="sidebar-bar"
              />
            )}

            <Icon size={18} />
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
            <LogOut size={18} />
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
