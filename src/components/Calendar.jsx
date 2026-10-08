import { useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronLeft, ChevronRight, ChevronDown, Plus, Check, X, Clock,
    ListChecks, Plane, CalendarDays, Users, User, Briefcase,
} from "lucide-react";
import { ROLES, TYPES, ME, iso, monthGrid, seedEvents, derivedEvents } from "../data/calendarData";
import "./Calendar.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NEXT = { pending: "progress", progress: "done", done: "pending" };
const STATUS_LABEL = { pending: "Pending", progress: "In progress", done: "Completed" };
const LEAVE_LABEL = { pending: "Awaiting approval", approved: "Approved", rejected: "Rejected" };
const ADD_TYPES = { employee: ["task"], hr: ["interview", "meeting", "milestone"], ceo: ["milestone", "meeting"] };
const ROLE_ICON = { employee: User, hr: Users, ceo: Briefcase };

function RoleMenu({ role, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const Current = ROLE_ICON[role];
    return (
        <div className="cal-role" ref={ref}>
            <button type="button" className="cal-role-btn" onClick={() => setOpen(!open)}>
                <span className="cal-role-ico"><Current size={16} /></span>
                <span className="cal-role-text">
                    <small>Viewing as</small>
                    <b>{ROLES[role].label}</b>
                </span>
                <ChevronDown size={16} className={open ? "flip" : ""} />
            </button>

            {open && (
                <div className="cal-role-menu">
                    {Object.entries(ROLES).map(([key, r]) => {
                        const Icon = ROLE_ICON[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                className={`cal-role-opt ${key === role ? "on" : ""}`}
                                onClick={() => { onChange(key); setOpen(false); }}
                            >
                                <span className="cal-role-ico"><Icon size={16} /></span>
                                <span className="cal-role-opt-text"><b>{r.label}</b><small>{r.title}</small></span>
                                {key === role && <Check size={16} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ---------- Main calendar ---------- */
export default function Calendar({ team, extraEvents = [] }) {
    const now = new Date();
    const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());

    const [role, setRole] = useState("employee");
    const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
    const [mode, setMode] = useState("month");
    const [selected, setSelected] = useState(todayIso);
    const [events, setEvents] = useState(() => seedEvents(now));
    const [hidden, setHidden] = useState({});
    const [dept, setDept] = useState("All");
    const [panel, setPanel] = useState(null); // "add" | "leave" | null
    const [draft, setDraft] = useState({ title: "", date: todayIso, type: "task", from: todayIso, to: todayIso });
    const [toast, setToast] = useState("");

    const nameOf = (id) => team.find((e) => e.id === id)?.name || "Employee";
    const deptOf = (id) => team.find((e) => e.id === id)?.department;
    const departments = [...new Set(team.map((e) => e.department))];

    const notify = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2200);
    };

    const switchRole = (r) => {
        setRole(r);
        setPanel(null);
        setDept("All");
        setHidden({});
        setDraft((d) => ({ ...d, type: ADD_TYPES[r][0] }));
    };

    // Saare events: seed + wo jo employees ke data se khud banti hain
    const all = useMemo(() => [...events, ...extraEvents, ...derivedEvents(team, view.y, view.m)], [events, extraEvents, team, view]);
    // Role ke hisaab se kaun si events nazar aayengi
    const scoped = all.filter((e) => {
        if (!e.roles.includes(role)) return false;
        if (role === "employee" && e.empId && !e.public && e.empId !== ME) return false;
        if (role === "ceo" && dept !== "All" && e.empId && deptOf(e.empId) !== dept) return false;
        return true;
    });
    const visible = scoped.filter((e) => !hidden[e.type]);

    const byDate = {};
    visible.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
    Object.values(byDate).forEach((list) => list.sort((a, b) => (a.time || "99").localeCompare(b.time || "99")));

    const overdue = (e) => e.type === "task" && e.status !== "done" && e.date < todayIso;

    /* KPI cards (role ke hisaab se) */
    const monthKey = iso(view.y, view.m, 1).slice(0, 7);
    const inMonth = scoped.filter((e) => e.date.startsWith(monthKey));
    const tasks = inMonth.filter((e) => e.type === "task");
    const done = tasks.filter((e) => e.status === "done").length;
    const pctDone = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const pendingReqs = new Set(scoped.filter((e) => e.type === "leave" && e.status === "pending").map((e) => e.group)).size;
    const offToday = scoped.filter((e) => e.type === "leave" && e.status === "approved" && e.date === todayIso).length;
    const countOf = (t) => inMonth.filter((e) => e.type === t).length;

    const kpis = {
        employee: [
            { icon: ListChecks, label: "Tasks completed", value: `${done}/${tasks.length}`, hint: `${pctDone}% of this month`, bar: pctDone },
            { icon: Clock, label: "Overdue", value: tasks.filter(overdue).length, hint: "Tasks past their date" },
            { icon: Plane, label: "My leave requests", value: pendingReqs, hint: "Awaiting approval" },
            { icon: CalendarDays, label: "Meetings", value: countOf("meeting"), hint: "This month" },
        ],
        hr: [
            { icon: Plane, label: "Pending leave requests", value: pendingReqs, hint: "Need your decision" },
            { icon: Users, label: "Interviews", value: countOf("interview"), hint: "Scheduled this month" },
            { icon: User, label: "Off today", value: offToday, hint: "Approved leaves today" },
            { icon: CalendarDays, label: "Anniversaries", value: countOf("anniversary"), hint: "Work anniversaries this month" },
        ],
        ceo: [
            { icon: ListChecks, label: "Task completion", value: `${pctDone}%`, hint: `${done} of ${tasks.length} tasks done`, bar: pctDone },
            { icon: Plane, label: "Pending approvals", value: pendingReqs, hint: "Leave requests waiting" },
            { icon: CalendarDays, label: "Meetings & milestones", value: countOf("meeting") + countOf("milestone"), hint: "This month" },
            { icon: User, label: "Off today", value: offToday, hint: "Approved leaves today" },
        ],
    }[role];

    /* Actions */
    const cycle = (id) => setEvents((ev) => ev.map((e) => (e.id === id ? { ...e, status: NEXT[e.status] } : e)));
    const decide = (group, status) => {
        setEvents((ev) => ev.map((e) => (e.group === group ? { ...e, status } : e)));
        notify(status === "approved" ? "Leave request approved" : "Leave request rejected");
    };

    const submitAdd = (e) => {
        e.preventDefault();
        const type = role === "employee" ? "task" : draft.type;
        const roles = type === "meeting" ? ["employee", "hr", "ceo"] : type === "task" ? ["employee", "ceo"] : ["hr", "ceo"];
        const ev = {
            id: Date.now() + Math.random(), date: draft.date, title: draft.title.trim(), type, roles,
            ...(type === "task" ? { empId: ME, status: "pending" } : {}),
        };
        setEvents((prev) => [...prev, ev]);
        setSelected(draft.date);
        setDraft((d) => ({ ...d, title: "" }));
        setPanel(null);
        notify(`${TYPES[type].label} added to calendar`);
    };

    const submitLeave = (e) => {
        e.preventDefault();
        if (draft.to < draft.from) return notify("End date must be after start date");
        const group = `L${Date.now()}`;
        const out = [];
        const d = new Date(draft.from + "T00:00:00");
        const end = new Date(draft.to + "T00:00:00");
        while (d <= end && out.length < 14) {
            out.push({
                id: Date.now() + Math.random(), date: iso(d.getFullYear(), d.getMonth(), d.getDate()),
                title: `${nameOf(ME)} · Leave`, type: "leave", empId: ME, group, status: "pending",
                roles: ["employee", "hr", "ceo"],
            });
            d.setDate(d.getDate() + 1);
        }
        setEvents((prev) => [...prev, ...out]);
        setSelected(draft.from);
        setPanel(null);
        notify("Leave request sent to HR and CEO");
    };

    /* Navigation */
    const shift = (n) => {
        const d = new Date(view.y, view.m + n, 1);
        setView({ y: d.getFullYear(), m: d.getMonth() });
    };
    const goToday = () => {
        setView({ y: now.getFullYear(), m: now.getMonth() });
        setSelected(todayIso);
    };

    const grid = monthGrid(view.y, view.m);
    const dayList = byDate[selected] || [];
    const dayTasks = dayList.filter((e) => e.type === "task");
    const dayDone = dayTasks.filter((e) => e.status === "done").length;
    const selLabel = new Date(selected + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const types = [...new Set(scoped.map((e) => e.type))];
    const upcoming = visible
        .filter((e) => e.date >= todayIso)
        .sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")))
        .slice(0, 5);
    const agendaDays = Object.keys(byDate).filter((k) => k.startsWith(monthKey)).sort();
    const groupSize = (g) => events.filter((x) => x.group === g).length;
    const shortDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const renderItem = (e) => {
        const color = TYPES[e.type].color;
        const mine = role === "employee" && e.empId === ME;
        return (
            <div key={e.id} className={`cal-item cal-t-${color}`}>
                <span className="cal-item-bar" />
                <div className="cal-item-main">
                    <p className="cal-item-title">{e.title}</p>
                    <p className="cal-item-meta">
                        {TYPES[e.type].label}
                        {e.time ? ` · ${e.time}` : ""}
                        {e.type === "task" && role !== "employee" ? ` · ${nameOf(e.empId)}` : ""}
                    </p>

                    {e.type === "task" && (
                        mine ? (
                            <button type="button" onClick={() => cycle(e.id)} className={`cal-pill cal-pill-${e.status}`} title="Click to change status">
                                {STATUS_LABEL[e.status]}
                            </button>
                        ) : (
                            <span className={`cal-pill cal-pill-${e.status}`}>{STATUS_LABEL[e.status]}</span>
                        )
                    )}
                    {overdue(e) && <span className="cal-pill cal-pill-late">Overdue</span>}

                    {e.type === "leave" && (
                        <>
                            <span className={`cal-pill cal-pill-${e.status}`}>{LEAVE_LABEL[e.status]}</span>
                            {e.status === "pending" && role !== "employee" && (
                                <div className="cal-decide">
                                    <button type="button" className="cal-approve" onClick={() => decide(e.group, "approved")}><Check size={14} /> Approve</button>
                                    <button type="button" className="cal-reject" onClick={() => decide(e.group, "rejected")}><X size={14} /> Reject</button>
                                    <small>Applies to the full {groupSize(e.group)}-day request</small>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <main className="main cal-page" data-role={role}>
            {/* Hero */}
            <header className="cal-hero">
                <div>
                    <p className="cal-eyebrow">Calendar</p>
                    <h1 className="cal-title">{ROLES[role].title}</h1>
                    <p className="cal-sub">{ROLES[role].sub}</p>
                </div>
                <RoleMenu role={role} onChange={switchRole} />
            </header>

            {/* KPI strip */}
            <section className="cal-kpis">
                {kpis.map((k) => (
                    <div key={k.label} className="cal-kpi">
                        <div className="cal-kpi-top">
                            <p>{k.label}</p>
                            <span className="cal-kpi-ico"><k.icon size={18} /></span>
                        </div>
                        <b>{k.value}</b>
                        <small>{k.hint}</small>
                        {k.bar !== undefined && <div className="cal-bar"><i style={{ width: `${k.bar}%` }} /></div>}
                    </div>
                ))}
            </section>

            {/* Toolbar */}
            <section className="cal-toolbar">
                <div className="cal-nav">
                    <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
                    <h2>{MONTHS[view.m]} {view.y}</h2>
                    <button type="button" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
                    <button type="button" className="cal-today" onClick={goToday}>Today</button>
                </div>

                <div className="cal-tools">
                    {role === "ceo" && (
                        <select className="cal-select" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department filter">
                            <option value="All">All departments</option>
                            {departments.map((d) => <option key={d}>{d}</option>)}
                        </select>
                    )}
                    <div className="cal-seg">
                        <button type="button" className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>Month</button>
                        <button type="button" className={mode === "agenda" ? "on" : ""} onClick={() => setMode("agenda")}>Agenda</button>
                    </div>
                </div>
            </section>

            {/* Legend / filters */}
            <section className="cal-legend">
                {types.map((t) => (
                    <button
                        key={t} type="button"
                        className={`cal-legend-chip cal-t-${TYPES[t].color} ${hidden[t] ? "off" : ""}`}
                        onClick={() => setHidden((h) => ({ ...h, [t]: !h[t] }))}
                    >
                        <i /> {TYPES[t].label}
                    </button>
                ))}
            </section>

            <div className="cal-layout">
                {/* Left: calendar */}
                <section className="cal-card">
                    {mode === "month" ? (
                        <>
                            <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
                            <div className="cal-grid">
                                {grid.map((c) => {
                                    const list = byDate[c.iso] || [];
                                    return (
                                        <button
                                            key={c.iso} type="button"
                                            onClick={() => { setSelected(c.iso); setPanel(null); }}
                                            className={`cal-cell ${c.inMonth ? "" : "out"} ${c.iso === todayIso ? "today" : ""} ${c.iso === selected ? "sel" : ""}`}
                                        >
                                            <span className="cal-num">{c.date.getDate()}</span>
                                            <span className="cal-chips">
                                                {list.slice(0, 3).map((e) => (
                                                    <span
                                                        key={e.id} title={e.title}
                                                        className={`cal-chip cal-t-${TYPES[e.type].color} ${e.status === "done" ? "done" : ""} ${overdue(e) ? "late" : ""} ${e.type === "leave" && e.status === "pending" ? "pend" : ""}`}
                                                    >
                                                        {e.title}
                                                    </span>
                                                ))}
                                                {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="cal-agenda">
                            {agendaDays.length === 0 && <p className="cal-empty">Nothing scheduled this month.</p>}
                            {agendaDays.map((d) => (
                                <div key={d} className="cal-agenda-day">
                                    <button type="button" className="cal-agenda-date" onClick={() => setSelected(d)}>
                                        <b>{new Date(d + "T00:00:00").getDate()}</b>
                                        <small>{new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}</small>
                                    </button>
                                    <div className="cal-agenda-list">{byDate[d].map(renderItem)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Right: side panel */}
                <aside className="cal-side">
                    <div className="cal-card cal-panel">
                        <div className="cal-panel-head">
                            <div>
                                <h3>{selLabel}</h3>
                                <p className="muted">{dayList.length} {dayList.length === 1 ? "event" : "events"}</p>
                            </div>
                            <div className="cal-panel-actions">
                                {role === "employee" && (
                                    <button type="button" className="cal-ghost" onClick={() => { setDraft((d) => ({ ...d, from: selected, to: selected })); setPanel(panel === "leave" ? null : "leave"); }}>
                                        <Plane size={14} /> Leave
                                    </button>
                                )}
                                <button type="button" className="cal-solid" onClick={() => { setDraft((d) => ({ ...d, date: selected })); setPanel(panel === "add" ? null : "add"); }}>
                                    <Plus size={14} /> {role === "employee" ? "Task" : "Event"}
                                </button>
                            </div>
                        </div>

                        {panel === "add" && (
                            <form className="cal-form" onSubmit={submitAdd}>
                                <input required className="cal-input" placeholder={role === "employee" ? "Task title" : "Event title"}
                                    value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                                <div className="cal-form-row">
                                    <input required type="date" className="cal-input" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                                    {role !== "employee" && (
                                        <select className="cal-input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                                            {ADD_TYPES[role].map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
                                        </select>
                                    )}
                                </div>
                                <button type="submit" className="cal-solid cal-full">Save to calendar</button>
                            </form>
                        )}

                        {panel === "leave" && (
                            <form className="cal-form" onSubmit={submitLeave}>
                                <div className="cal-form-row">
                                    <label>From<input required type="date" className="cal-input" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
                                    <label>To<input required type="date" className="cal-input" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
                                </div>
                                <button type="submit" className="cal-solid cal-full">Send leave request</button>
                            </form>
                        )}

                        {role === "employee" && dayTasks.length > 0 && (
                            <div className="cal-day-progress">
                                <div><span>Day progress</span><b>{dayDone}/{dayTasks.length} done</b></div>
                                <div className="cal-bar"><i style={{ width: `${(dayDone / dayTasks.length) * 100}%` }} /></div>
                            </div>
                        )}

                        <div className="cal-items">
                            {dayList.length === 0 && <p className="cal-empty">No events on this day.</p>}
                            {dayList.map(renderItem)}
                        </div>
                    </div>

                    <div className="cal-card cal-panel">
                        <h3>Coming up</h3>
                        <div className="cal-upcoming">
                            {upcoming.length === 0 && <p className="cal-empty">Nothing coming up.</p>}
                            {upcoming.map((e) => (
                                <button key={e.id} type="button" className={`cal-up cal-t-${TYPES[e.type].color}`} onClick={() => { setSelected(e.date); const d = new Date(e.date + "T00:00:00"); setView({ y: d.getFullYear(), m: d.getMonth() }); }}>
                                    <i />
                                    <span><b>{e.title}</b><small>{shortDate(e.date)}{e.time ? ` · ${e.time}` : ""}</small></span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {toast && <div className="cal-toast"><Check size={16} /> {toast}</div>}
        </main>
    );
}