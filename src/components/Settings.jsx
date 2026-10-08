import { useEffect, useRef, useState } from "react";
import {
    User, Users, Briefcase, ShieldCheck, Eye, EyeOff, Check, X, Camera,
    Monitor, Smartphone, LogOut, Plus, Minus, Trash2, ChevronDown, Download,
} from "lucide-react";
import Avatar from "./Avatar";
import "./Settings.css";

const SET_ROLES = {
    employee: { label: "Employee", title: "My settings", sub: "Your profile, security and leave balance" },
    hr: { label: "HR", title: "HR settings", sub: "Profile, security, leave policies and holidays" },
    ceo: { label: "CEO", title: "Admin settings", sub: "Profile, security, roles and permissions" },
};
const ROLE_ICON = { employee: User, hr: Users, ceo: Briefcase };
const PERSON_ID = { employee: 2, hr: 5, ceo: 0 };

const NOTIFS = {
    employee: [
        ["task", "Task reminders", "Before one of your tasks is due"],
        ["leave", "Leave status updates", "When your request is approved or rejected"],
        ["meet", "Meeting alerts", "15 minutes before a meeting"],
        ["news", "Company announcements", "Holidays and policy news"],
    ],
    hr: [
        ["req", "New leave requests", "When an employee applies for leave"],
        ["int", "Interview reminders", "Before each scheduled interview"],
        ["ann", "Work anniversaries", "Team milestones this week"],
        ["pol", "Policy changes", "When a company policy is updated"],
    ],
    ceo: [
        ["appr", "Approvals needed", "Requests waiting for your decision"],
        ["week", "Weekly performance summary", "Every Monday morning"],
        ["mile", "Milestone alerts", "Launches and board meetings"],
        ["crit", "Critical alerts", "Low attendance or overdue deadlines"],
    ],
};

const LEAVES = [
    { name: "Annual", total: 14, used: 3, color: "blue" },
    { name: "Sick", total: 8, used: 1, color: "amber" },
    { name: "Casual", total: 6, used: 2, color: "green" },
];

const PERMS = [
    ["View own tasks and leaves", [true, true, true]],
    ["View all employees", [false, true, true]],
    ["Add and edit employees", [false, true, true]],
    ["Approve leave requests", [false, true, true]],
    ["Edit company settings", [false, false, true]],
    ["View audit log", [false, false, true]],
    ["Manage roles", [false, false, true]],
];

const AUDIT = [
    ["Fatima Noor approved a leave request", "Today · 10:42"],
    ["Ali Raza submitted a leave request", "Today · 09:15"],
    ["Roles and permissions were reviewed", "Yesterday · 17:30"],
    ["New access request received from Rabia Anwar", "Yesterday · 11:05"],
    ["Weekly summary was sent to leadership", "Monday · 08:00"],
];

/* ---------- Small reusable pieces ---------- */
function Switch({ on, onChange, disabled, label }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
            onClick={onChange} className={`set-switch ${on ? "on" : ""}`}>
            <i />
        </button>
    );
}

function Stepper({ value, onChange, min = 0, max = 60, unit = "days" }) {
    return (
        <div className="set-stepper">
            <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))}><Minus size={14} /></button>
            <b>{value} <small>{unit}</small></b>
            <button type="button" aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))}><Plus size={14} /></button>
        </div>
    );
}

function Ring({ total, used, color }) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const left = total - used;
    return (
        <svg width="84" height="84" viewBox="0 0 84 84" className="set-ring">
            <circle cx="42" cy="42" r={r} className="set-ring-bg" />
            <circle cx="42" cy="42" r={r} className={`set-ring-fg set-c-${color}`}
                strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} transform="rotate(-90 42 42)" />
            <text x="42" y="48" textAnchor="middle" className="set-ring-num">{left}</text>
        </svg>
    );
}

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
        <div className="set-role" ref={ref}>
            <button type="button" className="set-role-btn" onClick={() => setOpen(!open)}>
                <span className="set-role-ico"><Current size={16} /></span>
                <span className="set-role-text"><small>Viewing as</small><b>{SET_ROLES[role].label}</b></span>
                <ChevronDown size={16} className={open ? "flip" : ""} />
            </button>
            {open && (
                <div className="set-role-menu">
                    {Object.entries(SET_ROLES).map(([key, r]) => {
                        const Icon = ROLE_ICON[key];
                        return (
                            <button key={key} type="button" className={`set-role-opt ${key === role ? "on" : ""}`}
                                onClick={() => { onChange(key); setOpen(false); }}>
                                <span className="set-role-ico"><Icon size={16} /></span>
                                <span className="set-role-opt-text"><b>{r.label}</b><small>{r.title}</small></span>
                                {key === role && <Check size={16} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ---------- Settings page ---------- */
export default function Settings({ team = [], role = "employee", onRoleChange = () => { }, section = null }) {
    const year = new Date().getFullYear();
    const pick = (id) => team.find((e) => e.id === id);

    const [toast, setToast] = useState(null);

    // Har section ka ref, taake sidebar se click par wahan scroll ho sake
    const refs = {
        profile: useRef(null),
        security: useRef(null),
        notifications: useRef(null),
        role: useRef(null),
    };
    useEffect(() => {
        if (section?.id) refs[section.id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [section]);

    // Profile (har role ka apna form)
    const [forms, setForms] = useState(() => {
        const make = (p, fallback) => ({
            name: p?.name || fallback.name, email: p?.email || fallback.email, phone: p?.phone || fallback.phone,
            title: p?.role || fallback.title, department: p?.department || fallback.department, city: p?.city || fallback.city, bio: "",
        });
        const none = { name: "", email: "", phone: "", title: "", department: "", city: "" };
        return {
            employee: make(pick(2), { ...none, name: "Ali Raza", email: "ali@aksitglobal.com", phone: "+92 301 0000000", title: "Frontend Developer", department: "Engineering", city: "Lahore" }),
            hr: make(pick(5), { ...none, name: "Fatima Noor", email: "fatima@aksitglobal.com", phone: "+92 304 0000000", title: "HR Manager", department: "HR", city: "Islamabad" }),
            ceo: make(null, { name: "Imran Siddiqui", email: "ceo@aksitglobal.com", phone: "+92 300 0000000", title: "Chief Executive Officer", department: "Management", city: "Islamabad" }),
        };
    });
    const [saved, setSaved] = useState(forms);
    const [photos, setPhotos] = useState({});

    // Security
    const [pw, setPw] = useState({ cur: "", next: "", conf: "" });
    const [showPw, setShowPw] = useState(false);
    const [twoFA, setTwoFA] = useState(false);
    const [sessions, setSessions] = useState([
        { id: 1, device: "Chrome on Windows", place: "Office network", time: "Active now", current: true, mobile: false },
        { id: 2, device: "Safari on iPhone", place: "Mobile data", time: "2 hours ago", current: false, mobile: true },
        { id: 3, device: "Edge on Windows", place: "Home network", time: "Yesterday", current: false, mobile: false },
    ]);

    // Notifications
    const [notif, setNotif] = useState({});
    const [quiet, setQuiet] = useState(false);

    // Role section ka data
    const [policy, setPolicy] = useState({ annual: 14, sick: 8, casual: 6, ceoAfter: 5 });
    const [hours, setHours] = useState({ start: "09:00", end: "18:00" });
    const [holidays, setHolidays] = useState([
        { id: 1, name: "Company off-site day", date: `${year}-10-12` },
        { id: 2, name: "Annual dinner", date: `${year}-12-18` },
        { id: 3, name: "Year-end closure", date: `${year}-12-31` },
    ]);
    const [newHol, setNewHol] = useState({ name: "", date: "" });
    const [perms, setPerms] = useState(PERMS);

    const notify = (msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 2400);
    };

    const switchRole = (r) => {
        onRoleChange(r);
        setPw({ cur: "", next: "", conf: "" });
    };

    const form = forms[role];
    const dirty = JSON.stringify(form) !== JSON.stringify(saved[role]);
    const setField = (k, v) => setForms((f) => ({ ...f, [role]: { ...f[role], [k]: v } }));
    const saveProfile = () => { setSaved((s) => ({ ...s, [role]: forms[role] })); notify("Profile saved"); };
    const resetProfile = () => setForms((f) => ({ ...f, [role]: saved[role] }));
    const onPhoto = (e) => {
        const file = e.target.files?.[0];
        if (file) setPhotos((p) => ({ ...p, [role]: URL.createObjectURL(file) }));
    };

    // Password strength
    const rules = [
        ["At least 8 characters", pw.next.length >= 8],
        ["One uppercase letter", /[A-Z]/.test(pw.next)],
        ["One number", /\d/.test(pw.next)],
        ["One symbol", /[^A-Za-z0-9]/.test(pw.next)],
    ];
    const score = rules.filter((r) => r[1]).length;
    const strength = ["", "Weak", "Fair", "Good", "Strong"][score];
    const submitPw = (e) => {
        e.preventDefault();
        if (!pw.cur) return notify("Enter your current password", false);
        if (score < 3) return notify("Choose a stronger password", false);
        if (pw.next !== pw.conf) return notify("Passwords do not match", false);
        setPw({ cur: "", next: "", conf: "" });
        notify("Password updated");
    };

    const getN = (key) => notif[key] || { email: true, app: true };
    const toggleN = (key, ch) => setNotif((n) => ({ ...n, [key]: { ...getN(key), [ch]: !getN(key)[ch] } }));

    const addHoliday = (e) => {
        e.preventDefault();
        setHolidays((h) => [...h, { id: Date.now(), name: newHol.name.trim(), date: newHol.date }]
            .sort((a, b) => a.date.localeCompare(b.date)));
        setNewHol({ name: "", date: "" });
        notify("Holiday added to the company calendar");
    };
    const togglePerm = (i, j) =>
        setPerms((p) => p.map((row, x) => (x === i ? [row[0], row[1].map((v, y) => (y === j ? !v : v))] : row)));

    const photo = photos[role];

    return (
        <main className="main set-page" data-role={role}>
            <header className="set-hero">
                <div>
                    <p className="set-eyebrow">Settings</p>
                    <h1 className="set-title">{SET_ROLES[role].title}</h1>
                    <p className="set-sub">{SET_ROLES[role].sub}</p>
                </div>
                <RoleMenu role={role} onChange={switchRole} />
            </header>

            <div className="set-stack">
                {/* 1. PROFILE */}
                <section ref={refs.profile} className="set-card set-body">
                    <div className="set-head"><h2>Profile</h2><p>Your personal and work details.</p></div>
                    <div className="set-avatar-row">
                        {photo
                            ? <img src={photo} alt="" className="set-photo set-photo-lg" />
                            : <Avatar name={form.name || "User"} id={PERSON_ID[role]} size="lg" />}
                        <div>
                            <label className="set-btn set-btn-ghost set-file">
                                <Camera size={15} /> Change photo
                                <input type="file" accept="image/*" onChange={onPhoto} hidden />
                            </label>
                            <p className="set-hint">JPG or PNG. The preview resets on refresh in this demo.</p>
                        </div>
                    </div>
                    <div className="set-grid">
                        {[["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["title", "Designation"], ["department", "Department"], ["city", "City"]].map(([k, label]) => (
                            <label key={k} className="set-field">{label}
                                <input className="set-input" value={form[k]} onChange={(e) => setField(k, e.target.value)} />
                            </label>
                        ))}
                    </div>
                    <label className="set-field set-wide">About
                        <textarea className="set-input" rows={3} placeholder="A short line about you" value={form.bio} onChange={(e) => setField("bio", e.target.value)} />
                    </label>
                    <div className="set-actions">
                        <button type="button" className="set-btn set-btn-primary" disabled={!dirty} onClick={saveProfile}>Save changes</button>
                        <button type="button" className="set-btn set-btn-ghost" disabled={!dirty} onClick={resetProfile}>Discard</button>
                        {dirty && <span className="set-unsaved">Unsaved changes</span>}
                    </div>
                </section>

                {/* 2. SECURITY */}
                <section ref={refs.security} className="set-card set-body">
                    <div className="set-head"><h2>Security</h2><p>Keep your account safe.</p></div>

                    <form className="set-block set-first" onSubmit={submitPw}>
                        <h3>Change password</h3>
                        <label className="set-field">Current password
                            <input className="set-input" type={showPw ? "text" : "password"} value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
                        </label>
                        <div className="set-grid set-gap">
                            <label className="set-field">New password
                                <input className="set-input" type={showPw ? "text" : "password"} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                            </label>
                            <label className="set-field">Confirm password
                                <input className="set-input" type={showPw ? "text" : "password"} value={pw.conf} onChange={(e) => setPw({ ...pw, conf: e.target.value })} />
                            </label>
                        </div>

                        <div className="set-meter">
                            {[1, 2, 3, 4].map((n) => <i key={n} className={n <= score ? `on s${score}` : ""} />)}
                            <span>{strength}</span>
                        </div>
                        <ul className="set-rules">
                            {rules.map(([text, ok]) => (
                                <li key={text} className={ok ? "ok" : ""}>{ok ? <Check size={13} /> : <X size={13} />} {text}</li>
                            ))}
                        </ul>
                        {pw.conf && pw.next !== pw.conf && <p className="set-error">Passwords do not match yet.</p>}

                        <div className="set-actions">
                            <button type="submit" className="set-btn set-btn-primary">Update password</button>
                            <button type="button" className="set-btn set-btn-ghost" onClick={() => setShowPw(!showPw)}>
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />} {showPw ? "Hide" : "Show"}
                            </button>
                        </div>
                    </form>

                    <div className="set-block">
                        <div className="set-row">
                            <div><h3>Two-factor authentication</h3><p className="set-hint">Ask for a code when you sign in on a new device.</p></div>
                            <Switch on={twoFA} onChange={() => { setTwoFA(!twoFA); notify(twoFA ? "Two-factor turned off" : "Two-factor turned on"); }} label="Two-factor authentication" />
                        </div>
                        {twoFA && <p className="set-pill-info"><ShieldCheck size={15} /> Codes will come from your authenticator app.</p>}
                    </div>

                    <div className="set-block">
                        <div className="set-row">
                            <h3>Active sessions</h3>
                            {sessions.length > 1 && (
                                <button type="button" className="set-link" onClick={() => { setSessions((s) => s.filter((x) => x.current)); notify("Logged out of other devices"); }}>Log out of all others</button>
                            )}
                        </div>
                        {sessions.map((s) => (
                            <div key={s.id} className="set-session">
                                <span className="set-session-ico">{s.mobile ? <Smartphone size={18} /> : <Monitor size={18} />}</span>
                                <div>
                                    <b>{s.device} {s.current && <em className="set-badge">This device</em>}</b>
                                    <small>{s.place} · {s.time}</small>
                                </div>
                                {!s.current && (
                                    <button type="button" className="set-icon-btn" aria-label="Log out this device"
                                        onClick={() => { setSessions((x) => x.filter((y) => y.id !== s.id)); notify("Device logged out"); }}>
                                        <LogOut size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. NOTIFICATIONS */}
                <section ref={refs.notifications} className="set-card set-body">
                    <div className="set-head"><h2>Notifications</h2><p>Choose what you hear about, and where.</p></div>
                    <div className="set-matrix">
                        <div className="set-matrix-head"><span /><span>Email</span><span>In-app</span></div>
                        {NOTIFS[role].map(([id, title, desc]) => {
                            const key = `${role}.${id}`;
                            return (
                                <div key={id} className="set-matrix-row">
                                    <div><b>{title}</b><small>{desc}</small></div>
                                    <Switch on={getN(key).email} onChange={() => toggleN(key, "email")} label={`${title} by email`} />
                                    <Switch on={getN(key).app} onChange={() => toggleN(key, "app")} label={`${title} in-app`} />
                                </div>
                            );
                        })}
                    </div>
                    <div className="set-block set-row">
                        <div><h3>Quiet hours</h3><p className="set-hint">Pause notifications from 8 PM to 8 AM.</p></div>
                        <Switch on={quiet} onChange={() => setQuiet(!quiet)} label="Quiet hours" />
                    </div>
                    <div className="set-actions">
                        <button type="button" className="set-btn set-btn-primary" onClick={() => notify("Notification preferences saved")}>Save preferences</button>
                    </div>
                </section>

                {/* 4. ROLE SECTION (role ke hisaab se badalta hai) */}
                <section ref={refs.role} className="set-card set-body">
                    {role === "employee" && (
                        <>
                            <div className="set-head"><h2>Leave balance</h2><p>Days you have left this year.</p></div>
                            <div className="set-leaves">
                                {LEAVES.map((l) => (
                                    <div key={l.name} className="set-leave">
                                        <Ring total={l.total} used={l.used} color={l.color} />
                                        <div><b>{l.name} leave</b><small>{l.total - l.used} left</small><small>{l.used} of {l.total} used</small></div>
                                    </div>
                                ))}
                            </div>
                            <div className="set-block">
                                <h3>Recent leaves</h3>
                                {[["Annual leave", "Sep 12 to 13", "Approved"], ["Sick leave", "Aug 4", "Approved"], ["Casual leave", "Jul 21", "Approved"]].map(([t, d, s]) => (
                                    <div key={t} className="set-line"><span><b>{t}</b><small>{d}</small></span><em className="set-badge ok">{s}</em></div>
                                ))}
                            </div>
                            <div className="set-actions">
                                <button type="button" className="set-btn set-btn-primary" onClick={() => notify("Open the Calendar page to request leave")}>Request leave</button>
                            </div>
                        </>
                    )}

                    {role === "hr" && (
                        <>
                            <div className="set-head"><h2>Policies and holidays</h2><p>Rules that apply to the whole company.</p></div>
                            <div className="set-block set-first">
                                <h3>Yearly leave allowance</h3>
                                {[["annual", "Annual leave"], ["sick", "Sick leave"], ["casual", "Casual leave"]].map(([k, label]) => (
                                    <div key={k} className="set-row"><span>{label}</span><Stepper value={policy[k]} onChange={(v) => setPolicy({ ...policy, [k]: v })} /></div>
                                ))}
                                <div className="set-row"><span>Leaves longer than this need CEO approval</span><Stepper value={policy.ceoAfter} min={1} max={30} onChange={(v) => setPolicy({ ...policy, ceoAfter: v })} /></div>
                            </div>
                            <div className="set-block">
                                <h3>Working hours</h3>
                                <div className="set-grid">
                                    <label className="set-field">Start<input className="set-input" type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></label>
                                    <label className="set-field">End<input className="set-input" type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></label>
                                </div>
                            </div>
                            <div className="set-block">
                                <h3>Company holidays</h3>
                                {holidays.map((h) => (
                                    <div key={h.id} className="set-line">
                                        <span><b>{h.name}</b><small>{new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</small></span>
                                        <button type="button" className="set-icon-btn" aria-label="Remove holiday" onClick={() => setHolidays((x) => x.filter((y) => y.id !== h.id))}><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                <form className="set-add" onSubmit={addHoliday}>
                                    <input required className="set-input" placeholder="Holiday name" value={newHol.name} onChange={(e) => setNewHol({ ...newHol, name: e.target.value })} />
                                    <input required type="date" className="set-input" value={newHol.date} onChange={(e) => setNewHol({ ...newHol, date: e.target.value })} />
                                    <button type="submit" className="set-btn set-btn-ghost"><Plus size={15} /> Add</button>
                                </form>
                            </div>
                            <div className="set-actions">
                                <button type="button" className="set-btn set-btn-primary" onClick={() => notify("Policies saved")}>Save policies</button>
                            </div>
                        </>
                    )}

                    {role === "ceo" && (
                        <>
                            <div className="set-head"><h2>Roles and permissions</h2><p>Decide what each role can see and do.</p></div>
                            <div className="set-perms">
                                <div className="set-perm-head"><span>Permission</span><span>Employee</span><span>HR</span><span>CEO</span></div>
                                {perms.map(([label, vals], i) => (
                                    <div key={label} className="set-perm-row">
                                        <span>{label}</span>
                                        {vals.map((v, j) => (
                                            <Switch key={j} on={v} disabled={j === 2} onChange={() => togglePerm(i, j)} label={`${label} for ${["Employee", "HR", "CEO"][j]}`} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <p className="set-hint">The CEO column is locked so the owner can never lose access.</p>

                            <div className="set-block">
                                <div className="set-row">
                                    <h3>Audit log</h3>
                                    <button type="button" className="set-link" onClick={() => notify("Audit log exported")}><Download size={14} /> Export</button>
                                </div>
                                {AUDIT.map(([t, d]) => (
                                    <div key={t} className="set-line"><span><b>{t}</b><small>{d}</small></span></div>
                                ))}
                            </div>
                            <div className="set-actions">
                                <button type="button" className="set-btn set-btn-primary" onClick={() => notify("Permissions saved")}>Save permissions</button>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {toast && (
                <div className={`set-toast ${toast.ok ? "" : "bad"}`}>
                    {toast.ok ? <Check size={16} /> : <X size={16} />} {toast.msg}
                </div>
            )}
        </main>
    );
}