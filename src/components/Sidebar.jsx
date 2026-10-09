
import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  CalendarDays,
  CalendarCheck,
  Settings,
  LifeBuoy,
  ClipboardList,
} from "lucide-react";

import Avatar from "./Avatar";
import "./Sidebar.css";

const items = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: Users, label: "Employees" },
  { icon: BarChart3, label: "Analytics" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: ClipboardList, label: "Tasks & Projects" },
  { icon: FileText, label: "Documents" },
  { icon: Settings, label: "Settings" },
];

const ROLE_SECTION = {
  employee: "Leave balance",
  manager: "Team management",
  hr: "Policies & holidays",
  ceo: "Roles & permissions",
  admin: "System administration",
};

export default function Sidebar({
  onNavigate,
  onSection,
  settingsRole = "employee",
}) {
  const [active, setActive] = useState("Overview");
  const [sub, setSub] = useState("profile");
  const [logoOk, setLogoOk] = useState(true);

  const go = (label) => {
    setActive(label);

    if (label === "Settings") {
      setSub("profile");
    }

    onNavigate?.(label);
  };

  const goSection = (id) => {
    setSub(id);
    onSection?.(id);
  };

  const subs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "notifications", label: "Notifications" },
    {
      id: "role",
      label: ROLE_SECTION[settingsRole] || "Role & permissions",
    },
  ];

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
          <span className="sidebar-fallback">Aksit Global</span>
        )}
      </div>

      <p className="sidebar-label">Menu</p>

      <nav className="sidebar-nav">
        {items.map(({ icon: Icon, label }) => (
          <Fragment key={label}>
            <button
              type="button"
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

            {label === "Settings" && active === "Settings" && (
              <motion.div
                className="sidebar-sub"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.25 }}
              >
                {subs.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => goSection(item.id)}
                    className={`sidebar-sub-link ${sub === item.id ? "active" : ""
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </Fragment>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button type="button" className="sidebar-link">
          <LifeBuoy size={18} />
          <span>Help center</span>
        </button>

        <div className="sidebar-admin">
          <Avatar name="Admin User" size="sm" id={0} />

          <div className="sidebar-admin-text">
            <p className="sidebar-admin-name truncate">
              Admin User
            </p>
            <p className="sidebar-admin-mail truncate">
              admin@aksitglobal.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}