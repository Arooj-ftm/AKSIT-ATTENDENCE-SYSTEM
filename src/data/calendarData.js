// Calendar ka sample data aur helper functions.
// Role ke hisaab se kaun kya dekhe ga, ye "roles" array se tay hota hai.

export const ROLES = {
    employee: { label: "Employee", title: "My workspace", sub: "Your tasks, leaves and company events" },
    hr: { label: "HR", title: "People operations", sub: "Leave requests, interviews and team milestones" },
    ceo: { label: "CEO", title: "Company command view", sub: "Progress, approvals and milestones across departments" },
};

export const TYPES = {
    task: { label: "Task", color: "blue" },
    leave: { label: "Leave", color: "amber" },
    meeting: { label: "Meeting", color: "indigo" },
    holiday: { label: "Holiday", color: "green" },
    interview: { label: "Interview", color: "purple" },
    anniversary: { label: "Anniversary", color: "pink" },
    milestone: { label: "Milestone", color: "teal" },
};

export const ME = 2; // Demo employee: Ali Raza (employees.js ki id 2)
const ALL = ["employee", "hr", "ceo"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n) => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// 6 hafton ka grid, Monday se shuru
export function monthGrid(y, m) {
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
        const date = new Date(y, m, 1 - offset + i);
        return { date, iso: iso(date.getFullYear(), date.getMonth(), date.getDate()), inMonth: date.getMonth() === m };
    });
}

// Current month ke sample events
export function seedEvents(now = new Date()) {
    const y = now.getFullYear();
    const m = now.getMonth();
    let id = 1;
    const ev = (d, title, type, extra = {}) => ({ id: id++, date: iso(y, m, d), title, type, ...extra });

    return [
        // Company-wide (sab ko dikhte hain)
        ev(12, "Office closed: company off-site day", "holiday", { roles: ALL }),
        ev(20, "Town hall with CEO", "meeting", { time: "15:00", roles: ALL }),
        ev(25, "Month-end review", "meeting", { time: "11:00", roles: ALL }),

        // Employee (Ali Raza) ke tasks: employee aur CEO dekhte hain
        ev(1, "Update employee data", "task", { empId: 2, status: "pending", roles: ["employee", "ceo"] }),
        ev(2, "Fix sidebar layout bug", "task", { empId: 2, status: "done", roles: ["employee", "ceo"] }),
        ev(5, "Build employee filter", "task", { empId: 2, status: "progress", roles: ["employee", "ceo"] }),
        ev(8, "Code review: Charts", "task", { empId: 2, status: "pending", roles: ["employee", "ceo"] }),
        ev(15, "Dashboard demo to manager", "task", { empId: 2, status: "pending", time: "14:00", roles: ["employee", "ceo"] }),
        ev(18, "Write project README", "task", { empId: 2, status: "pending", roles: ["employee", "ceo"] }),
        ev(22, "Sprint retro prep", "task", { empId: 2, status: "pending", roles: ["employee", "ceo"] }),

        // Doosre employees ke tasks: sirf CEO ko
        ev(3, "Launch campaign assets", "task", { empId: 7, status: "progress", roles: ["ceo"] }),
        ev(6, "Migrate staging to AWS", "task", { empId: 6, status: "done", roles: ["ceo"] }),
        ev(9, "Client proposal draft", "task", { empId: 10, status: "pending", roles: ["ceo"] }),
        ev(11, "Payroll processing", "task", { empId: 14, status: "done", roles: ["ceo"] }),
        ev(14, "User research report", "task", { empId: 9, status: "progress", roles: ["ceo"] }),
        ev(17, "Release v2.1 testing", "task", { empId: 8, status: "pending", roles: ["ceo"] }),
        ev(21, "Brand guidelines refresh", "task", { empId: 15, status: "pending", roles: ["ceo"] }),
        ev(24, "Q3 board report", "task", { empId: 3, status: "pending", roles: ["ceo"] }),

        // Leaves: employee ko sirf apni, HR aur CEO ko sab
        ev(9, "Ali Raza · Leave", "leave", { empId: 2, group: "L1", status: "pending", roles: ALL }),
        ev(10, "Ali Raza · Leave", "leave", { empId: 2, group: "L1", status: "pending", roles: ALL }),
        ev(16, "Maryam Iqbal · Leave", "leave", { empId: 11, group: "L2", status: "approved", roles: ALL }),
        ev(23, "Hira Shah · Leave", "leave", { empId: 9, group: "L3", status: "pending", roles: ALL }),
        ev(24, "Hira Shah · Leave", "leave", { empId: 9, group: "L3", status: "pending", roles: ALL }),

        // HR aur CEO
        ev(6, "New joiner orientation", "milestone", { time: "10:30", roles: ["hr", "ceo"] }),
        ev(7, "Interview: Rabia Anwar (Network Engineer)", "interview", { time: "11:00", roles: ["hr", "ceo"] }),
        ev(13, "Interview: Kamran Ali (UI Designer)", "interview", { time: "14:30", roles: ["hr", "ceo"] }),
        ev(19, "Interview: Sana Tariq (QA Engineer)", "interview", { time: "16:00", roles: ["hr", "ceo"] }),
        ev(21, "Probation review: Bilal Hussain", "milestone", { roles: ["hr", "ceo"] }),
        ev(27, "Appraisal cycle opens", "milestone", { roles: ["hr", "ceo"] }),

        // Sirf CEO
        ev(26, "Product launch milestone", "milestone", { roles: ["ceo"] }),
        ev(28, "Board meeting", "meeting", { time: "10:00", roles: ["ceo"] }),
    ];
}

// Har mahine ke liye khud ban'ne wale events: employees ke data se
export function derivedEvents(team, y, m) {
    const out = [];
    const days = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= days; d++) {
        if (new Date(y, m, d).getDay() === 1) {
            out.push({ id: `sync-${y}-${m}-${d}`, date: iso(y, m, d), title: "Weekly team sync", type: "meeting", time: "10:00", roles: ALL });
        }
    }

    team.forEach((emp) => {
        const [mon, yr] = emp.joined.split(" ");
        if (MONTH_ABBR.indexOf(mon) === m && Number(yr) < y) {
            const day = ((emp.id * 5) % 27) + 1; // sample din (joining ka asli din data mein nahi hai)
            out.push({
                id: `ann-${emp.id}-${y}`, date: iso(y, m, day), type: "anniversary",
                title: `${emp.name} · ${y - Number(yr)} yr anniversary`,
                empId: emp.id, public: true, roles: ALL,
            });
        }
    });
    return out;
}