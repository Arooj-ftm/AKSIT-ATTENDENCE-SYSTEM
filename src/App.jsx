import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Users, UserCheck, Plane, Building2, Laptop, Plus, X } from "lucide-react";
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
import Documents from "./components/Documents";
import "./App.css";

export default function App() {
  const [team, setTeam] = useState(initialEmployees);
  const [q, setQ] = useState("");
  const [settingsRole, setSettingsRole] = useState("employee");
  const [settingsSection, setSettingsSection] = useState(null);
  const [dept, setDept] = useState("All");
  const [interviewEvents, setInterviewEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [notes, setNotes] = useState([]);
  const [unread, setUnread] = useState(true);

  // Kaunsa page dikhana hai: "dashboard" ya "calendar"
  const [page, setPage] = useState("dashboard");

  const mainRef = useRef(null);
  const teamRef = useRef(null);

  const departments = [...new Set(team.map((e) => e.department))];
  const depts = ["All", ...departments];

  const list = team.filter(
    (e) =>
      (dept === "All" || e.department === dept) &&
      (statusFilter === "All" || e.status === statusFilter) &&
      (e.name + e.role).toLowerCase().includes(q.toLowerCase())
  );
  const count = (s) => team.filter((e) => e.status === s).length;
  const pct = (n) => Math.round((n / team.length) * 100);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const alerts = [
    ...notes,
    ...team.filter((e) => e.status === "On Leave").map((e) => ({
      title: `${e.name} is on leave`, text: `${e.role} · ${e.department}`, tone: "amber",
    })),
    ...(count("Remote") > 0
      ? [{ title: `${count("Remote")} employees working remotely`, text: "Use the Remote card to see who", tone: "sky" }]
      : []),
  ];

  const scrollToTeam = () =>
    setTimeout(() => teamRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  const pickStatus = (s) => {
    setStatusFilter((cur) => (cur === s ? "All" : s));
    setDept("All");
    setQ("");
    scrollToTeam();
  };

  const resetAll = () => {
    setStatusFilter("All");
    setDept("All");
    setQ("");
    scrollToTeam();
  };

  const addInterview = (ev) =>
    setInterviewEvents((list) => [...list.filter((x) => x.id !== ev.id), ev]);
  const handleNav = (label) => {
    if (label === "Calendar") {
      setPage("calendar");
      return;
    }
    if (label === "Documents") {
      setPage("documents");
      return;
    }
    if (label === "Settings") {
      setSettingsSection(null);
      setPage("settings");
      return;
    }
    setPage("dashboard");
    // Dashboard dobara draw hota hai, is liye thora ruk kar scroll karte hain
    setTimeout(() => {
      if (label === "Overview") mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      if (label === "Employees") teamRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const handleSection = (id) => {
    setPage("settings");
    setSettingsSection({ id, n: Date.now() });
  };

  const addEmployee = (f) => {
    const id = Math.max(...team.map((e) => e.id)) + 1;
    const first = f.name.trim().split(" ")[0].toLowerCase();
    const skills = f.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const emp = {
      id,
      code: `AG-${1000 + id}`,
      name: f.name.trim(),
      role: f.role.trim(),
      department: f.department,
      status: f.status,
      city: f.city.trim(),
      joined: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      skills: skills.length ? skills : ["New joiner"],
      salary: `$${Number(f.salary).toLocaleString()}`,
      email: `${first}@aksitglobal.com`,
      phone: `+92 30${id % 10} ${1234000 + id * 137}`,
    };
    setTeam([...team, emp]);
    setNotes([{ title: `${emp.name} joined the team`, text: `${emp.role} · ${emp.department}`, tone: "blue" }, ...notes]);
    setUnread(true);
    setShowAdd(false);
    resetAll();
  };

  return (
    <div className="app">
      <Sidebar onNavigate={handleNav} onSection={handleSection} settingsRole={settingsRole} />
      {page === "calendar" ? (
        <Calendar team={team} extraEvents={interviewEvents} />
      ) : page === "documents" ? (
        <Documents team={team} onInterview={addInterview} />
      ) : page === "settings" ? (
        <Settings team={team} role={settingsRole} onRoleChange={setSettingsRole} section={settingsSection} />
      ) : page === "settings" ? (
        <Settings team={team} role={settingsRole} onRoleChange={setSettingsRole} section={settingsSection} />) : (
        <main ref={mainRef} className="main">
          <header className="header">
            <div>
              <h1 className="header-title">Team overview</h1>
              <p className="header-date">{today}</p>
            </div>
            <div className="header-actions">
              <div className="search">
                <Search size={16} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role" />
              </div>
              <Notifications items={alerts} unread={unread} onOpen={() => setUnread(false)} />
              <button onClick={() => setShowAdd(true)} className="add-btn">
                <Plus size={16} /> Add employee
              </button>
            </div>
          </header>

          <section className="stats">
            <StatCard icon={Users} label="Total employees" value={team.length} hint="Across the company"
              tint="blue" delay={0}
              onClick={resetAll} selected={statusFilter === "All" && dept === "All" && !q} />
            <StatCard icon={UserCheck} label="Active" value={count("Active")} hint={`${pct(count("Active"))}% working on site`}
              tint="green" delay={0.08}
              onClick={() => pickStatus("Active")} selected={statusFilter === "Active"} />
            <StatCard icon={Laptop} label="Remote" value={count("Remote")} hint={`${pct(count("Remote"))}% working remotely`}
              tint="sky" delay={0.16}
              onClick={() => pickStatus("Remote")} selected={statusFilter === "Remote"} />
            <StatCard icon={Plane} label="On leave" value={count("On Leave")} hint={`${pct(count("On Leave"))}% away from work`}
              tint="amber" delay={0.24}
              onClick={() => pickStatus("On Leave")} selected={statusFilter === "On Leave"} />
            <StatCard icon={Building2} label="Departments" value={departments.length} hint="Teams in the company"
              tint="indigo" delay={0.32} onClick={scrollToTeam} />
          </section>

          <Charts employees={team} />

          <section ref={teamRef} className="team">
            <div className="team-head">
              <div>
                <h2 className="team-title">Team members</h2>
                <div className="team-count">
                  <p className="muted">Showing {list.length} of {team.length}</p>
                  {statusFilter !== "All" && (
                    <button onClick={() => setStatusFilter("All")} className="clear-tag">
                      Status: {statusFilter} <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="chips">
                {depts.map((d) => (
                  <button key={d} onClick={() => setDept(d)} className={`chip ${dept === d ? "on" : ""}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {list.length === 0 && (
              <p className="team-empty">No one matches these filters. Clear a filter or try a different name.</p>
            )}

            <div className="team-grid">
              <AnimatePresence>
                {list.map((e, i) => (
                  <EmployeeCard key={e.id} emp={e} index={i} onClick={() => setSelected(e)} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        </main>
      )}

      <EmployeeModal emp={selected} onClose={() => setSelected(null)} />
      <AddEmployeeModal open={showAdd} departments={departments} onClose={() => setShowAdd(false)} onSave={addEmployee} />
    </div>
  );
}