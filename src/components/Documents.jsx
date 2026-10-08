import { useEffect, useRef, useState } from "react";
import {
    Mail, Inbox, RefreshCw, Search, FileText, Check, X, CalendarDays,
    RotateCcw, UserCheck, ChevronDown, Link2, Zap, Download,
} from "lucide-react";
import Avatar from "./Avatar";
import {
    STAGES, STAGE_ORDER, REJECT_REASONS, MODES, DOC_TYPES, INBOX, seedApplicants,
    classify, roleFromSubject, docKind, initialEmpDocs, blankDocs, today, sampleCv,
} from "../data/documentsData";

import { jsPDF } from "jspdf";
import "./Documents.css";

const TABS = [["candidate", "Candidates"], ["intern", "Interns"], ["employee", "Employees"]];
const HINTS = { new: "Waiting for review", shortlisted: "Approved by HR", interview: "Interview scheduled", rejected: "Not moving forward" };
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const docLabel = (k) => DOC_TYPES.find(([key]) => key === k)?.[1] || "Document";


/* ---------- CV PDF download (jsPDF) ---------- */
const NAVY = [15, 27, 51];
const BLUE = [30, 58, 138];
const GREY = [100, 116, 139];
const longDate = (d) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Not set";

// Logo ko public/logo.png se parhna (na mile to PDF bina logo ke banegi)
async function loadLogo() {
    try {
        const res = await fetch("/logo.png");
        if (!res.ok) return null;
        const blob = await res.blob();
        const data = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
        const dims = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = reject;
            img.src = data;
        });
        return { data, fmt: data.startsWith("data:image/jpeg") ? "JPEG" : "PNG", ...dims };
    } catch {
        return null;
    }
}

async function makeCvPdf(list) {
    const sorted = [...list].sort((a, b) =>
        ((a.interview?.date || "") + (a.interview?.time || "")).localeCompare((b.interview?.date || "") + (b.interview?.time || ""))
    );
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const M = 15;
    const CW = W - M * 2;
    const logo = await loadLogo();
    const generated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const header = (title) => {
        if (logo) {
            const h = 12;
            const w = Math.min(h * (logo.w / logo.h), 55);
            try { doc.addImage(logo.data, logo.fmt, M, 8, w, h); } catch { /* logo chhor do */ }
        }
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY);
        doc.text(title, W - M, 13, { align: "right" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY);
        doc.text(`Prepared by HR  |  ${generated}`, W - M, 18, { align: "right" });
        doc.setDrawColor(...BLUE); doc.setLineWidth(0.7); doc.line(M, 24, W - M, 24);
        return 33;
    };

    const section = (label, y) => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...BLUE);
        doc.text(label.toUpperCase(), M, y);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(M, y + 2, W - M, y + 2);
        return y + 8;
    };

    const para = (text, y, size = 10) => {
        doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(text, CW);
        doc.text(lines, M, y);
        return y + lines.length * (size * 0.45) + 2;
    };

    /* ----- Page 1: summary table ----- */
    let y = header("Candidate CVs");
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
    doc.text("Candidate summary", M, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GREY);
    doc.text(`${sorted.length} ${sorted.length === 1 ? "person" : "people"}. Each CV follows on its own page.`, M, y); y += 8;

    const cols = [["#", 8], ["Candidate", 62], ["Type", 22], ["Interview", 50], ["Interviewer", 38]];
    doc.setFillColor(...NAVY); doc.rect(M, y, CW, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    let x = M + 2;
    cols.forEach(([label, w]) => { doc.text(label, x, y + 5.4); x += w; });
    y += 8;

    sorted.forEach((a, i) => {
        if (y > 268) { doc.addPage(); y = header("Candidate CVs"); }
        const when = a.interview ? `${fmtDate(a.interview.date)}, ${a.interview.time} (${a.interview.mode})` : "Not scheduled";
        x = M + 2;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
        doc.text(String(i + 1), x, y + 7); x += cols[0][1];
        doc.setFont("helvetica", "bold"); doc.text(a.name, x, y + 5.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY);
        doc.text(doc.splitTextToSize(a.role, cols[1][1] - 4)[0], x, y + 10);
        doc.setFontSize(9); doc.setTextColor(30, 41, 59); x += cols[1][1];
        doc.text(a.type === "intern" ? "Intern" : "Candidate", x, y + 7); x += cols[2][1];
        doc.text(doc.splitTextToSize(when, cols[3][1] - 3), x, y + 5.5); x += cols[3][1];
        doc.text(doc.splitTextToSize(a.interview?.interviewer || "-", cols[4][1] - 3), x, y + 7);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(M, y + 12, W - M, y + 12);
        y += 12;
    });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text("Confidential. For internal hiring use only.", M, y + 8);

    /* ----- Har candidate ka CV page ----- */
    sorted.forEach((a) => {
        doc.addPage();
        const cv = sampleCv(a);
        const intern = a.type === "intern";
        y = header("Candidate CV");
        const top = y;

        doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY);
        doc.text(a.name, M, y); y += 7;
        doc.setFontSize(12); doc.setTextColor(...BLUE);
        doc.text(`Applying for: ${a.role}`, M, y); y += 5.5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY);
        doc.text(`${a.email}  |  Applied ${fmtDate(a.received)}`, M, y);

        const tag = intern ? "Internship applicant" : "Job applicant";
        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        const tw = doc.getTextWidth(tag) + 8;
        doc.setFillColor(239, 246, 255); doc.roundedRect(W - M - tw, top - 5, tw, 7, 3.5, 3.5, "F");
        doc.setTextColor(29, 78, 216); doc.text(tag, W - M - tw / 2, top - 0.4, { align: "center" });

        // Interview ki patti
        y += 7;
        doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 20, 2.5, 2.5, "F");
        const items = [
            ["INTERVIEW DATE", longDate(a.interview?.date)],
            ["TIME", a.interview?.time || "Not set"],
            ["MODE", a.interview?.mode || "Not set"],
            ["INTERVIEWER", a.interview?.interviewer || "Not set"],
        ];
        const colW = CW / 4;
        items.forEach(([label, val], i) => {
            const cx = M + 5 + i * colW;
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(147, 197, 253);
            doc.text(label, cx, y + 7);
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
            doc.text(doc.splitTextToSize(val, colW - 6), cx, y + 13);
        });
        y += 30;

        y = section("Summary", y);
        y = para(cv.summary, y) + 3;

        y = section("Skills", y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        let cx = M;
        cv.skills.forEach((s) => {
            const w = doc.getTextWidth(s) + 8;
            if (cx + w > W - M) { cx = M; y += 9; }
            doc.setFillColor(239, 246, 255); doc.roundedRect(cx, y - 4.5, w, 7, 3.5, 3.5, "F");
            doc.setTextColor(29, 78, 216); doc.text(s, cx + 4, y);
            cx += w + 3;
        });
        y += 11;

        y = section(intern ? "Projects" : "Experience", y);
        cv.jobs.forEach(([title, place, when]) => {
            doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
            doc.text(title, M, y);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY);
            doc.text(`${place}  |  ${when}`, M, y + 4.5);
            y += 11;
        });
        y += 1;

        y = section("Education", y);
        y = para(cv.education, y) + 3;

        y = section("HR notes", y);
        const noteLines = doc.splitTextToSize(a.note || "No notes added.", CW - 8);
        const nh = noteLines.length * 4.4 + 6;
        doc.setFillColor(248, 250, 252); doc.rect(M, y - 3, CW, nh, "F");
        doc.setFillColor(...BLUE); doc.rect(M, y - 3, 1.2, nh, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
        doc.text(noteLines, M + 5, y + 1.5);
        y += nh + 5;

        // Interviewer ke likhne ki jagah
        y = section("Interviewer notes", y);
        doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
        doc.roundedRect(M, y - 3, CW, 38, 2, 2);
        doc.setDrawColor(226, 232, 240);
        for (let i = 1; i <= 5; i++) doc.line(M + 3, y - 3 + i * 6.3, W - M - 3, y - 3 + i * 6.3);
        y += 44;

        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
        doc.text("Score:", M, y);
        let sx = M + 14;
        [1, 2, 3, 4, 5].forEach((n) => {
            doc.setDrawColor(100, 116, 139); doc.rect(sx, y - 3.5, 4, 4);
            doc.text(String(n), sx + 5.5, y);
            sx += 13;
        });
        doc.text("Decision:", M + 90, y);
        let dx = M + 108;
        ["Hire", "Hold", "Reject"].forEach((d) => {
            doc.rect(dx, y - 3.5, 4, 4);
            doc.text(d, dx + 5.5, y);
            dx += 22;
        });

        doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text("Demo: CV details are sample data based on the applied role.", M, 287);
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const file = sorted.length === 1
        ? `CV_${sorted[0].name.replace(/\s+/g, "_")}.pdf`
        : `Interview_CVs_${stamp}.pdf`;
    doc.save(file);
    return file;
}


export default function Documents({ team = [], onInterview = () => { } }) {
    const [cat, setCat] = useState("candidate");
    const [apps, setApps] = useState(seedApplicants);
    const [queue, setQueue] = useState(INBOX);
    const [mail, setMail] = useState({ connected: false, provider: "", address: "", last: null, auto: false });
    const [cf, setCf] = useState({ open: false, provider: "", address: "hr@aksitglobal.com", busy: false });
    const [syncing, setSyncing] = useState(false);
    const [activity, setActivity] = useState([]);
    const [filter, setFilter] = useState("all");
    const [q, setQ] = useState("");
    const [modal, setModal] = useState(null);
    const defaultInterviewer = team.find((e) => e.department === "HR")?.name || team[0]?.name || "";
    const [sched, setSched] = useState({ date: "", time: "10:00", mode: MODES[0], interviewer: defaultInterviewer });
    const [rej, setRej] = useState({ reason: REJECT_REASONS[0] });
    const [empDocs, setEmpDocs] = useState(() => initialEmpDocs(team));
    const [open, setOpen] = useState(null);
    const [requested, setRequested] = useState({});
    const [toast, setToast] = useState("");

    const notify = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2600);
    };

    /* ---------- Email connect ---------- */
    const connect = () => {
        setCf((c) => ({ ...c, busy: true }));
        setTimeout(() => {
            setMail({ connected: true, provider: cf.provider, address: cf.address, last: null, auto: false });
            setCf({ open: false, provider: "", address: "hr@aksitglobal.com", busy: false });
            notify(`${cf.provider} inbox connected`);
        }, 1200);
    };
    const disconnect = () => {
        setMail({ connected: false, provider: "", address: "", last: null, auto: false });
        notify("Inbox disconnected");
    };

    /* ---------- Import emails: sort karke sahi category mein daalna ---------- */
    const importMails = (n, silent = false) => {
        if (!queue.length) {
            if (!silent) notify("Inbox is up to date. No new emails.");
            return;
        }
        const batch = queue.slice(0, n);
        const stamp = Date.now();
        const newApps = [];
        const logs = [];
        const empUpdates = {};

        batch.forEach((m) => {
            const r = classify(m, team);
            if (r.category === "employee") {
                const kind = docKind(m.file);
                empUpdates[r.empId] = [...(empUpdates[r.empId] || []), kind];
                logs.push({ id: stamp + m.id, text: `${m.name}'s ${docLabel(kind)} linked to their profile`, tag: "Employees" });
            } else {
                newApps.push({
                    id: 100 + m.id, name: m.name, email: m.email, role: roleFromSubject(m.subject, r.category === "intern"),
                    type: r.category, stage: "new", file: m.file, size: m.size, received: today(),
                    subject: m.subject || "(no subject)", note: "", fresh: true,
                });
                logs.push({ id: stamp + m.id, text: `${m.name}'s CV saved under ${r.category === "intern" ? "Interns" : "Candidates"}`, tag: r.rule });
            }
        });

        setQueue((list) => list.slice(batch.length));
        setApps((prev) => [...newApps, ...prev.map((a) => ({ ...a, fresh: false }))]);
        setEmpDocs((prev) => {
            const next = { ...prev };
            Object.entries(empUpdates).forEach(([id, kinds]) => {
                next[id] = { ...(next[id] || blankDocs()), ...Object.fromEntries(kinds.map((k) => [k, "email"])) };
            });
            return next;
        });
        setActivity((a) => [...logs.reverse(), ...a].slice(0, 6));
        setMail((m) => ({ ...m, last: new Date() }));

        const c = newApps.filter((a) => a.type === "candidate").length;
        const i = newApps.filter((a) => a.type === "intern").length;
        const e = Object.keys(empUpdates).length;
        const parts = [c && `${c} candidate`, i && `${i} intern`, e && `${e} employee document`].filter(Boolean);
        notify(`${batch.length} new ${batch.length === 1 ? "email" : "emails"} imported: ${parts.join(", ")}`);
    };

    const latest = useRef(null);
    latest.current = importMails;
    useEffect(() => {
        if (!mail.connected || !mail.auto) return;
        const t = setInterval(() => latest.current(1, true), 12000);
        return () => clearInterval(t);
    }, [mail.connected, mail.auto]);

    const syncNow = () => {
        setSyncing(true);
        setTimeout(() => { importMails(3); setSyncing(false); }, 1100);
    };

    /* ---------- Applicant actions ---------- */
    const update = (id, patch) => setApps((list) => list.map((a) => (a.id === id ? { ...a, fresh: false, ...patch } : a)));
    const target = modal ? apps.find((a) => a.id === modal.id) : null;

    const openSchedule = (a) => {
        setSched({
            date: a.interview?.date || "", time: a.interview?.time || "10:00",
            mode: a.interview?.mode || MODES[0], interviewer: a.interview?.interviewer || defaultInterviewer,
        });
        setModal({ type: "schedule", id: a.id });
    };
    const saveSchedule = (e) => {
        e.preventDefault();
        update(target.id, { stage: "interview", interview: { ...sched } });
        onInterview({
            id: `int-${target.id}`, date: sched.date, time: sched.time, type: "interview",
            title: `Interview: ${target.name} (${target.role})`, roles: ["hr", "ceo"],
        });
        setModal(null);
        notify("Interview scheduled and added to the HR calendar");
    };
    const saveReject = (e) => {
        e.preventDefault();
        update(target.id, { stage: "rejected", reason: rej.reason, interview: undefined });
        setModal(null);
        notify(`${target.name} marked as rejected`);
    };

    /* ---------- PDF export  ---------- */
    const exportPdf = async (people) => {
        if (!people.length) {
            notify("No candidates in the interview stage yet");
            return;
        }
        notify("Preparing PDF...");
        try {
            const file = await makeCvPdf(people);
            notify(`${file} downloaded`);
        } catch (err) {
            console.error(err);
            notify("Could not create the PDF. Please try again.");
        }
    };

    /* ---------- Derived data ---------- */
    const list = apps.filter((a) => a.type === cat);
    const interviewing = apps.filter((a) => a.stage === "interview");
    const count = (s) => list.filter((a) => a.stage === s).length;
    const shown = list.filter((a) => (filter === "all" || a.stage === filter) && (a.name + a.role).toLowerCase().includes(q.toLowerCase()));
    const empList = team.filter((e) => (e.name + e.role + e.department).toLowerCase().includes(q.toLowerCase()));
    const docsOf = (e) => empDocs[e.id] || blankDocs();
    const have = (e) => DOC_TYPES.filter(([k]) => docsOf(e)[k]).length;
    const complete = team.filter((e) => have(e) === DOC_TYPES.length).length;
    const missing = team.reduce((n, e) => n + (DOC_TYPES.length - have(e)), 0);
    const viaEmail = team.reduce((n, e) => n + DOC_TYPES.filter(([k]) => docsOf(e)[k] === "email").length, 0);

    const stats = cat === "employee"
        ? [
            { label: "Employees", value: team.length, hint: "With a document folder" },
            { label: "Fully documented", value: complete, hint: `All ${DOC_TYPES.length} documents received` },
            { label: "Missing documents", value: missing, hint: "Still to collect" },
            { label: "Linked from email", value: viaEmail, hint: "Added automatically" },
        ]
        : ["new", "shortlisted", "interview", "rejected"].map((s) => ({ label: STAGES[s].label, value: count(s), hint: HINTS[s], stage: s }));

    const tabCount = (k) => (k === "employee" ? team.length : apps.filter((a) => a.type === k).length);
    const freshIn = (k) => apps.some((a) => a.type === k && a.fresh);

    return (
        <main className="main doc-page">
            {/* Hero */}
            <header className="doc-hero">
                <div>
                    <p className="doc-eyebrow">HR portal</p>
                    <h1 className="doc-title">Documents and recruitment</h1>
                    <p className="doc-sub">CVs from email, hiring decisions and employee documents in one place</p>
                </div>
                <span className="doc-badge-hero"><Inbox size={15} /> {queue.length} emails waiting</span>
            </header>

            {/* Email connection */}
            <section className="doc-card doc-mail">
                {!mail.connected ? (
                    <>
                        <div className="doc-mail-ico"><Mail size={22} /></div>
                        <div className="doc-mail-text">
                            <h3>Connect your recruitment inbox</h3>
                            <p>CVs and documents that arrive by email are saved here and sorted into Candidates, Interns and Employees.</p>
                        </div>
                        {!cf.open ? (
                            <div className="doc-providers">
                                <button type="button" className="doc-btn solid" onClick={() => setCf({ ...cf, open: true, provider: "Gmail" })}>Connect Gmail</button>
                            </div>
                        ) : (
                            <form className="doc-cf" onSubmit={(e) => { e.preventDefault(); connect(); }}>
                                <input required type="email" value={cf.address} onChange={(e) => setCf({ ...cf, address: e.target.value })} aria-label="Inbox address" />
                                <button type="submit" className="doc-btn solid" disabled={cf.busy}>{cf.busy ? "Connecting..." : `Connect ${cf.provider}`}</button>
                                <button type="button" className="doc-btn" onClick={() => setCf({ ...cf, open: false })}>Cancel</button>
                            </form>
                        )}
                    </>
                ) : (
                    <>
                        <div className="doc-mail-main">
                            <p className="doc-live"><i /> Connected · {mail.provider} · {mail.address}</p>
                            <small>{mail.last ? `Last synced ${mail.last.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : "Not synced yet"} · {queue.length} emails waiting in the inbox</small>
                            <div className="doc-mail-actions">
                                <button type="button" className="doc-btn solid" onClick={syncNow} disabled={syncing}>
                                    <RefreshCw size={14} className={syncing ? "spin" : ""} /> {syncing ? "Syncing..." : "Sync now"}
                                </button>
                                <label className="doc-auto"><Zap size={14} /> Auto-sync
                                    <button type="button" role="switch" aria-checked={mail.auto} aria-label="Auto-sync"
                                        className={`doc-switch ${mail.auto ? "on" : ""}`} onClick={() => setMail({ ...mail, auto: !mail.auto })}><i /></button>
                                </label>
                                <button type="button" className="doc-btn" onClick={disconnect}>Disconnect</button>
                            </div>
                        </div>
                        <div className="doc-activity">
                            <b>Latest imports</b>
                            {activity.length === 0 && <small>Nothing imported yet. Press Sync now.</small>}
                            {activity.map((a) => (
                                <p key={a.id}><Link2 size={13} /> <span>{a.text}<small>{a.tag}</small></span></p>
                            ))}
                        </div>
                    </>
                )}
            </section>


            {/* Tabs */}
            <div className="doc-tabs">
                {TABS.map(([k, label]) => (
                    <button key={k} type="button" className={`doc-tab ${cat === k ? "on" : ""}`} onClick={() => { setCat(k); setFilter("all"); }}>
                        {label} <span>{tabCount(k)}</span>{freshIn(k) && <i className="doc-dot" />}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <section className="doc-stats">
                {stats.map((s) => (
                    s.stage ? (
                        <button key={s.label} type="button" className={`doc-stat ${filter === s.stage ? "sel" : ""}`} onClick={() => setFilter(filter === s.stage ? "all" : s.stage)}>
                            <p>{s.label}</p><b>{s.value}</b><small>{s.hint}</small>
                        </button>
                    ) : (
                        <div key={s.label} className="doc-stat static"><p>{s.label}</p><b>{s.value}</b><small>{s.hint}</small></div>
                    )
                ))}
            </section>

            {/* Toolbar */}
            <div className="doc-toolbar">
                <div className="doc-search"><Search size={16} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={cat === "employee" ? "Search employees" : "Search by name or role"} />
                </div>
                {cat !== "employee" && (
                    <button type="button" className="doc-btn solid" disabled={!interviewing.length} onClick={() => exportPdf(interviewing)}>
                        <Download size={14} /> Export CVs for interview (PDF) · {interviewing.length}
                    </button>
                )}
                {cat !== "employee" && (
                    <div className="doc-chips">
                        <button type="button" className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All {list.length}</button>
                        {STAGE_ORDER.map((s) => (
                            <button key={s} type="button" className={`chip ${filter === s ? "on" : ""}`} onClick={() => setFilter(s)}>{STAGES[s].label} {count(s)}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* Applicants */}
            {cat !== "employee" && (
                <div className="doc-list">
                    {shown.length === 0 && <p className="doc-empty">Nobody here yet. Sync your inbox to import new CVs.</p>}
                    {shown.map((a) => (
                        <div key={a.id} className={`doc-row ${a.fresh ? "fresh" : ""}`}>
                            <div className="doc-who">
                                <Avatar name={a.name} id={a.id} size="sm" />
                                <div><b>{a.name} {a.fresh && <em className="doc-new">New email</em>}</b><small>{a.role}</small></div>
                            </div>
                            <button type="button" className="doc-file" onClick={() => setModal({ type: "view", id: a.id })}>
                                <FileText size={16} /><span><b>{a.file}</b><small>{a.size} · {fmtDate(a.received)}</small></span>
                            </button>
                            <div className="doc-status">
                                <span className={`doc-badge doc-t-${STAGES[a.stage].tone}`}>{STAGES[a.stage].label}</span>
                                {a.stage === "interview" && a.interview && <small>{fmtDate(a.interview.date)} · {a.interview.time} · {a.interview.mode}</small>}
                                {a.stage === "rejected" && a.reason && <small>{a.reason}</small>}
                                {a.stage === "hired" && a.started && <small>{a.started}</small>}
                            </div>
                            <div className="doc-actions">
                                {a.stage === "new" && (
                                    <>
                                        <button type="button" className="doc-btn ok" onClick={() => { update(a.id, { stage: "shortlisted" }); notify(`${a.name} shortlisted`); }}><Check size={14} /> Shortlist</button>
                                        <button type="button" className="doc-btn bad" onClick={() => { setRej({ reason: REJECT_REASONS[0] }); setModal({ type: "reject", id: a.id }); }}><X size={14} /> Reject</button>
                                    </>
                                )}
                                {a.stage === "shortlisted" && (
                                    <>
                                        <button type="button" className="doc-btn solid" onClick={() => openSchedule(a)}><CalendarDays size={14} /> Schedule interview</button>
                                        <button type="button" className="doc-btn bad" onClick={() => { setRej({ reason: REJECT_REASONS[0] }); setModal({ type: "reject", id: a.id }); }}><X size={14} /> Reject</button>
                                    </>
                                )}
                                {a.stage === "interview" && (
                                    <>
                                        <button type="button" className="doc-btn ok" onClick={() => { update(a.id, { stage: "hired", started: "Offer stage" }); notify(`${a.name} marked as hired`); }}><UserCheck size={14} /> Hire</button>
                                        <button type="button" className="doc-btn" onClick={() => openSchedule(a)}><CalendarDays size={14} /> Reschedule</button>
                                        <button type="button" className="doc-btn bad" onClick={() => { setRej({ reason: REJECT_REASONS[0] }); setModal({ type: "reject", id: a.id }); }}><X size={14} /> Reject</button>
                                        <button type="button" className="doc-btn" onClick={() => exportPdf([a])}><Download size={14} /> CV PDF</button>
                                    </>
                                )}
                                {a.stage === "rejected" && (
                                    <button type="button" className="doc-btn" onClick={() => { update(a.id, { stage: "new", reason: undefined }); notify(`${a.name} moved back to New`); }}><RotateCcw size={14} /> Restore</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Employees */}
            {cat === "employee" && (
                <div className="doc-list">
                    {empList.map((e) => {
                        const d = docsOf(e);
                        const n = have(e);
                        const isOpen = open === e.id;
                        return (
                            <div key={e.id} className="doc-emp">
                                <button type="button" className="doc-emp-head" onClick={() => setOpen(isOpen ? null : e.id)}>
                                    <Avatar name={e.name} id={e.id} size="sm" />
                                    <span className="doc-emp-who"><b>{e.name}</b><small>{e.role} · {e.department}</small></span>
                                    <span className="doc-emp-prog">
                                        <span className="doc-bar"><i style={{ width: `${(n / DOC_TYPES.length) * 100}%` }} /></span>
                                        <small>{n}/{DOC_TYPES.length} documents</small>
                                    </span>
                                    <ChevronDown size={18} className={isOpen ? "flip" : ""} />
                                </button>
                                {isOpen && (
                                    <div className="doc-checks">
                                        {DOC_TYPES.map(([k, label]) => (
                                            <div key={k} className="doc-check">
                                                <span className={`doc-tick ${d[k] ? "on" : ""}`}>{d[k] ? <Check size={13} /> : <X size={13} />}</span>
                                                <span>{label}</span>
                                                {d[k] === "email" && <em className="doc-via"><Link2 size={12} /> via email</em>}
                                                {!d[k] && (requested[`${e.id}.${k}`]
                                                    ? <em className="doc-req">Requested</em>
                                                    : <button type="button" className="doc-link" onClick={() => { setRequested((r) => ({ ...r, [`${e.id}.${k}`]: true })); notify(`Email request sent to ${e.email} (demo)`); }}>Request by email</button>)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {modal?.type === "view" && target && (
                <div className="overlay" onClick={() => setModal(null)}>
                    <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="doc-modal-head">
                            <div><h3>{target.name}</h3><p>{target.role}</p></div>
                            <button type="button" className="doc-x" aria-label="Close" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <div className="doc-filecard"><FileText size={22} /><div><b>{target.file}</b><small>{target.size} · PDF · received {fmtDate(target.received)}</small></div></div>
                        <dl className="doc-facts">
                            <div><dt>From</dt><dd>{target.email}</dd></div>
                            <div><dt>Subject</dt><dd>{target.subject}</dd></div>
                            <div><dt>Category</dt><dd>{target.type === "intern" ? "Interns" : "Candidates"}</dd></div>
                            <div><dt>Status</dt><dd>{STAGES[target.stage].label}</dd></div>
                        </dl>
                        <label className="doc-label">HR notes
                            <textarea rows={3} placeholder="Add a private note about this applicant" value={target.note} onChange={(e) => update(target.id, { note: e.target.value })} />
                        </label>
                        <p className="doc-hint">Demo: the file itself is not stored. Only its details are kept.</p>
                        <div className="doc-modal-actions">
                            {target.stage === "interview" && (
                                <button type="button" className="doc-btn solid" onClick={() => exportPdf([target])}><Download size={14} /> Export CV as PDF</button>
                            )}                            <button type="button" className="doc-btn" onClick={() => setModal(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {modal?.type === "schedule" && target && (
                <div className="overlay" onClick={() => setModal(null)}>
                    <form className="doc-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveSchedule}>
                        <div className="doc-modal-head">
                            <div><h3>Schedule interview</h3><p>{target.name} · {target.role}</p></div>
                            <button type="button" className="doc-x" aria-label="Close" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <div className="doc-form">
                            <label>Date<input required type="date" min={today()} value={sched.date} onChange={(e) => setSched({ ...sched, date: e.target.value })} /></label>
                            <label>Time<input required type="time" value={sched.time} onChange={(e) => setSched({ ...sched, time: e.target.value })} /></label>
                            <label>Mode<select value={sched.mode} onChange={(e) => setSched({ ...sched, mode: e.target.value })}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
                            <label>Interviewer<select value={sched.interviewer} onChange={(e) => setSched({ ...sched, interviewer: e.target.value })}>{team.map((m) => <option key={m.id}>{m.name}</option>)}</select></label>
                        </div>
                        <p className="doc-hint">This interview will also appear in the HR and CEO calendar.</p>
                        <div className="doc-modal-actions">
                            <button type="submit" className="btn btn-primary">Schedule</button>
                            <button type="button" className="btn btn-light" onClick={() => setModal(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {modal?.type === "reject" && target && (
                <div className="overlay" onClick={() => setModal(null)}>
                    <form className="doc-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveReject}>
                        <div className="doc-modal-head">
                            <div><h3>Reject applicant</h3><p>{target.name} · {target.role}</p></div>
                            <button type="button" className="doc-x" aria-label="Close" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <div className="doc-form one">
                            <label>Reason<select value={rej.reason} onChange={(e) => setRej({ reason: e.target.value })}>{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
                        </div>
                        <div className="doc-modal-actions">
                            <button type="submit" className="btn btn-primary">Confirm rejection</button>
                            <button type="button" className="btn btn-light" onClick={() => setModal(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {toast && <div className="doc-toast"><Check size={16} /> {toast}</div>}
        </main>
    );
}