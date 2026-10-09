
import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  UserCheck,
  Plane,
  Building2,
  Laptop,
  Plus,
  X,
} from "lucide-react";

import { employees as initialEmployees } from "./data/employees";

import Sidebar from "./components/Sidebar";
import StatCard from "./components/StatCard";
import EmployeeCard from "./components/EmployeeCard";
import EmployeeModal from "./components/EmployeeModal";
import AddEmployeeModal from "./components/AddEmployeeModal";
import Notifications from "./components/Notifications";
import Charts from "./components/Charts";
import Calendar from "./components/Calendar";
import Settings from "./components/Settings";
import Tasks from "./components/Tasks";
import Documents from "./components/Documents";
import Attendance from "./components/Attendance";
import Login from "./components/Login";

import "./App.css";

export default function App() {
  /* =========================
     LOGIN
  ========================= */

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /* =========================
     TEAM
  ========================= */

  const [team, setTeam] = useState(initialEmployees);

  /* =========================
     DASHBOARD
  ========================= */

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  /* =========================
     SETTINGS
  ========================= */

  const [settingsRole, setSettingsRole] = useState("employee");
  const [settingsSection, setSettingsSection] = useState(null);

  /* =========================
     TASKS
  ========================= */

  const [tasksRole, setTasksRole] = useState("manager");

  /* =========================
     ATTENDANCE
  ========================= */

  const [attendanceRole, setAttendanceRole] = useState("employee");

  /* =========================
     CALENDAR / DOCUMENTS
  ========================= */

  const [interviewEvents, setInterviewEvents] = useState([]);

  /* =========================
     EMPLOYEE MODAL
  ========================= */

  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  /* =========================
     NOTIFICATIONS
  ========================= */

  const [notes, setNotes] = useState([]);
  const [unread, setUnread] = useState(true);

  /* =========================
     CURRENT PAGE
  ========================= */

  const [page, setPage] = useState("dashboard");

  /* =========================
     REFS
  ========================= */

  const mainRef = useRef(null);
  const teamRef = useRef(null);

  /* =========================
     DEPARTMENTS
  ========================= */

  const departments = [
    ...new Set(team.map((employee) => employee.department)),
  ];

  const depts = ["All", ...departments];

  /* =========================
     EMPLOYEE FILTER
  ========================= */

  const list = team.filter(
    (employee) =>
      (dept === "All" || employee.department === dept) &&
      (statusFilter === "All" || employee.status === statusFilter) &&
      (employee.name + employee.role)
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  /* =========================
     HELPERS
  ========================= */

  const count = (status) =>
    team.filter((employee) => employee.status === status).length;

  const pct = (number) =>
    team.length
      ? Math.round((number / team.length) * 100)
      : 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  /* =========================
     NOTIFICATIONS
  ========================= */

  const alerts = [
    ...notes,

    ...team
      .filter((employee) => employee.status === "On Leave")
      .map((employee) => ({
        title: `${employee.name} is on leave`,
        text: `${employee.role} · ${employee.department}`,
        tone: "amber",
      })),

    ...(count("Remote") > 0
      ? [
        {
          title: `${count("Remote")} employees working remotely`,
          text: "Use the Remote card to see who",
          tone: "sky",
        },
      ]
      : []),
  ];

  /* =========================
     SCROLL TO TEAM
  ========================= */

  const scrollToTeam = () =>
    setTimeout(() => {
      teamRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);

  /* =========================
     STATUS FILTER
  ========================= */

  const pickStatus = (status) => {
    setStatusFilter((current) =>
      current === status ? "All" : status
    );

    setDept("All");
    setQ("");

    scrollToTeam();
  };

  /* =========================
     RESET FILTERS
  ========================= */

  const resetAll = () => {
    setStatusFilter("All");
    setDept("All");
    setQ("");

    scrollToTeam();
  };

  /* =========================
     INTERVIEW
  ========================= */

  const addInterview = (event) => {
    setInterviewEvents((current) => [
      ...current.filter((item) => item.id !== event.id),
      event,
    ]);
  };

  /* =========================
     SIDEBAR NAVIGATION
  ========================= */

  const handleNav = (label) => {
    if (label === "Calendar") {
      setPage("calendar");
      return;
    }

    if (label === "Attendance") {
      setPage("attendance");
      return;
    }

    if (label === "Documents") {
      setPage("documents");
      return;
    }

    if (label === "Tasks & Projects") {
      setPage("tasks");
      return;
    }

    if (label === "Settings") {
      setSettingsSection(null);
      setPage("settings");
      return;
    }

    setPage("dashboard");

    setTimeout(() => {
      if (label === "Overview") {
        mainRef.current?.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }

      if (label === "Employees") {
        teamRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 120);
  };

  /* =========================
     SETTINGS SECTION
  ========================= */

  const handleSection = (id) => {
    setPage("settings");

    setSettingsSection({
      id,
      n: Date.now(),
    });
  };

  /* =========================
     TASK ROLE
  ========================= */

  const handleTasksRoleChange = (role) => {
    setTasksRole(role);
    setPage("tasks");
  };

  /* =========================
     ATTENDANCE ROLE
  ========================= */

  const handleAttendanceRoleChange = (role) => {
    setAttendanceRole(role);
  };

  /* =========================
     ADD EMPLOYEE
  ========================= */

  const addEmployee = (form) => {
    const id =
      team.length > 0
        ? Math.max(...team.map((employee) => employee.id)) + 1
        : 1;

    const first = form.name
      .trim()
      .split(" ")[0]
      .toLowerCase();

    const skills = form.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    const employee = {
      id,
      code: `AG-${1000 + id}`,
      name: form.name.trim(),
      role: form.role.trim(),
      department: form.department,
      status: form.status,
      city: form.city.trim(),

      joined: new Date().toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),

      skills: skills.length > 0 ? skills : ["New joiner"],

      salary: `$${Number(form.salary).toLocaleString()}`,

      email: `${first}@aksitglobal.com`,

      phone: `+92 30${id % 10} ${1234000 + id * 137}`,
    };

    setTeam((current) => [...current, employee]);

    setNotes((current) => [
      {
        title: `${employee.name} joined the team`,
        text: `${employee.role} · ${employee.department}`,
        tone: "blue",
      },
      ...current,
    ]);

    setUnread(true);
    setShowAdd(false);
    resetAll();
  };

  /* =========================
     SHOW LOGIN FIRST
  ========================= */

  if (!isLoggedIn) {
    return (
      <Login
        onLogin={() => {
          setIsLoggedIn(true);
        }}
      />
    );
  }

  /* =========================
     MAIN WEBSITE
  ========================= */

  return (
    <div className="app">
      <Sidebar
        onNavigate={handleNav}
        onSection={handleSection}
        settingsRole={settingsRole}
      />

      {page === "calendar" ? (
        <Calendar
          team={team}
          extraEvents={interviewEvents}
        />
      ) : page === "attendance" ? (
        <Attendance
          team={team}
          role={attendanceRole}
          onRoleChange={handleAttendanceRoleChange}
        />
      ) : page === "documents" ? (
        <Documents
          team={team}
          onInterview={addInterview}
        />
      ) : page === "tasks" ? (
        <Tasks
          team={team}
          role={tasksRole}
          onRoleChange={setTasksRole}
        />
      ) : page === "settings" ? (
        <Settings
          team={team}
          role={settingsRole}
          onRoleChange={setSettingsRole}
          section={settingsSection}
        />
      ) : (
        <main ref={mainRef} className="main">
          <header className="header">
            <div>
              <h1 className="header-title">Team overview</h1>
              <p className="header-date">{today}</p>
            </div>

            <div className="header-actions">
              <div className="search">
                <Search size={16} />

                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search by name or role"
                />
              </div>

              <Notifications
                items={alerts}
                unread={unread}
                onOpen={() => setUnread(false)}
              />

              <button
                onClick={() => setShowAdd(true)}
                className="add-btn"
              >
                <Plus size={16} />
                Add employee
              </button>
            </div>
          </header>

          <section className="stats">
            <StatCard
              icon={Users}
              label="Total employees"
              value={team.length}
              hint="Across the company"
              tint="blue"
              delay={0}
              onClick={resetAll}
              selected={
                statusFilter === "All" &&
                dept === "All" &&
                !q
              }
            />

            <StatCard
              icon={UserCheck}
              label="Active"
              value={count("Active")}
              hint={`${pct(count("Active"))}% working on site`}
              tint="green"
              delay={0.08}
              onClick={() => pickStatus("Active")}
              selected={statusFilter === "Active"}
            />

            <StatCard
              icon={Laptop}
              label="Remote"
              value={count("Remote")}
              hint={`${pct(count("Remote"))}% working remotely`}
              tint="sky"
              delay={0.16}
              onClick={() => pickStatus("Remote")}
              selected={statusFilter === "Remote"}
            />

            <StatCard
              icon={Plane}
              label="On leave"
              value={count("On Leave")}
              hint={`${pct(count("On Leave"))}% away from work`}
              tint="amber"
              delay={0.24}
              onClick={() => pickStatus("On Leave")}
              selected={statusFilter === "On Leave"}
            />

            <StatCard
              icon={Building2}
              label="Departments"
              value={departments.length}
              hint="Teams in the company"
              tint="indigo"
              delay={0.32}
              onClick={scrollToTeam}
            />
          </section>

          <Charts employees={team} />

          <section ref={teamRef} className="team">
            <div className="team-head">
              <div>
                <h2 className="team-title">Team members</h2>

                <div className="team-count">
                  <p className="muted">
                    Showing {list.length} of {team.length}
                  </p>

                  {statusFilter !== "All" && (
                    <button
                      onClick={() => setStatusFilter("All")}
                      className="clear-tag"
                    >
                      Status: {statusFilter}
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="chips">
                {depts.map((department) => (
                  <button
                    key={department}
                    onClick={() => setDept(department)}
                    className={`chip ${dept === department ? "on" : ""
                      }`}
                  >
                    {department}
                  </button>
                ))}
              </div>
            </div>

            {list.length === 0 && (
              <p className="team-empty">
                No one matches these filters. Clear a filter or try a
                different name.
              </p>
            )}

            <div className="team-grid">
              <AnimatePresence>
                {list.map((employee, index) => (
                  <EmployeeCard
                    key={employee.id}
                    emp={employee}
                    index={index}
                    onClick={() => setSelected(employee)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        </main>
      )}

      <EmployeeModal
        emp={selected}
        onClose={() => setSelected(null)}
      />

      <AddEmployeeModal
        open={showAdd}
        departments={departments}
        onClose={() => setShowAdd(false)}
        onSave={addEmployee}
      />
    </div>
  );
}