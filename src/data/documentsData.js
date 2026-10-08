const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => fmt(new Date());
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const dayThisMonth = (day) => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(day)}`; };

export const STAGES = {
    new: { label: "New", tone: "blue" },
    shortlisted: { label: "Shortlisted", tone: "green" },
    interview: { label: "Interview", tone: "purple" },
    hired: { label: "Hired", tone: "teal" },
    rejected: { label: "Rejected", tone: "red" },
};
export const STAGE_ORDER = ["new", "shortlisted", "interview", "hired", "rejected"];
export const REJECT_REASONS = ["Skills do not match", "Not enough experience", "Position already filled", "Salary expectations", "Other"];
export const MODES = ["Onsite", "Video call", "Phone call"];

export const DOC_TYPES = [
    ["cv", "CV / Resume"],
    ["cnic", "CNIC copy"],
    ["contract", "Signed contract"],
    ["degree", "Degree certificate"],
    ["experience", "Experience letter"],
];
export const blankDocs = () => Object.fromEntries(DOC_TYPES.map(([k]) => [k, false]));

// Har employee ke liye sample document checklist (CV hamesha maujood)
export const initialEmpDocs = (team) =>
    Object.fromEntries(
        team.map((e, i) => [e.id, Object.fromEntries(DOC_TYPES.map(([k], j) => [k, k === "cv" ? true : (i * 7 + j * 3) % 5 !== 0]))])
    );

// Pehle se maujood applicants
export function seedApplicants() {
    let n = 0;
    const mk = (name, role, type, stage, extra = {}) => {
        n += 1;
        const [first, last] = name.toLowerCase().split(" ");
        return {
            id: n, name, role, type, stage, email: `${first}.${last}@gmail.com`,
            file: `${name.replace(" ", "_")}_CV.pdf`, size: `${150 + n * 17} KB`, received: ago((n % 6) + 1),
            subject: type === "intern" ? `Internship application – ${role.replace(" Intern", "")}` : `Application for ${role}`,
            note: "", fresh: false, ...extra,
        };
    };
    return [
        mk("Rabia Anwar", "Network Engineer", "candidate", "interview", { interview: { date: dayThisMonth(7), time: "11:00", mode: "Onsite", interviewer: "Fatima Noor" } }),
        mk("Kamran Ali", "UI Designer", "candidate", "interview", { interview: { date: dayThisMonth(13), time: "14:30", mode: "Video call", interviewer: "Ayesha Khan" } }),
        mk("Sana Tariq", "QA Engineer", "candidate", "interview", { interview: { date: dayThisMonth(19), time: "16:00", mode: "Video call", interviewer: "Bilal Hussain" } }),
        mk("Usama Sheikh", "Backend Developer", "candidate", "shortlisted"),
        mk("Hina Raza", "Marketing Executive", "candidate", "new"),
        mk("Mehwish Akram", "Data Analyst", "candidate", "new"),
        mk("Talha Mehmood", "Sales Executive", "candidate", "rejected", { reason: "Skills do not match" }),
        mk("Zoya Khan", "Graphic Design Intern", "intern", "new"),
        mk("Hassan Ali", "Web Development Intern", "intern", "shortlisted"),
        mk("Areeba Iqbal", "Content Writing Intern", "intern", "rejected", { reason: "Position already filled" }),
        mk("Danyal Ahmed", "Frontend Intern", "intern", "hired", { started: "Started Sep 1" }),
        mk("Minahil Shah", "HR Intern", "intern", "hired", { started: "Started Sep 1" }),
    ];
}

// Simulated inbox: jab "Sync" dabaya jaye to ye emails ek ek karke aati hain
export const INBOX = [
    { id: 1, name: "Sidra Nawaz", email: "sidra.nawaz@gmail.com", subject: "Application for Sales Executive", file: "Sidra_Nawaz_Resume.pdf", size: "186 KB" },
    { id: 2, name: "Abdullah Farooq", email: "abdullah.f@outlook.com", subject: "Internship application – Web Development", file: "Abdullah_CV.pdf", size: "204 KB" },
    { id: 3, name: "Ali Raza", email: "ali@aksitglobal.com", subject: "Updated CV", file: "Ali_Raza_CV_2026.pdf", size: "231 KB" },
    { id: 4, name: "Mariam Tariq", email: "mariam.t@gmail.com", subject: "Application for Product Designer", file: "Mariam_Tariq_CV.pdf", size: "178 KB" },
    { id: 5, name: "Hamza Javed", email: "hamza.javed@yahoo.com", subject: "Summer Internship – Data Analytics", file: "Hamza_Javed_CV.pdf", size: "162 KB" },
    { id: 6, name: "Saad Qureshi", email: "saad@aksitglobal.com", subject: "Degree certificate", file: "Saad_Degree_Certificate.pdf", size: "540 KB" },
    { id: 7, name: "Noor Ahmed", email: "noor.ahmed@gmail.com", subject: "Application for HR Executive", file: "Noor_Ahmed_CV.pdf", size: "190 KB" },
];

// Email kis category mein jayegi, ye faisla yahan hota hai
export function classify(mail, team) {
    const emp = team.find((e) => e.email.toLowerCase() === mail.email.toLowerCase());
    if (emp) return { category: "employee", empId: emp.id, rule: "Sender is a current employee" };
    if (/intern/i.test(mail.subject)) return { category: "intern", rule: 'Subject contains "intern"' };
    return { category: "candidate", rule: "CV from an external sender" };
}

// Subject se role nikalna: "Application for Sales Executive" se "Sales Executive"
export function roleFromSubject(subject, isIntern) {
    const m = subject.match(/(?:\bfor\s+|\s[–-]\s+)(.+)$/i);
    const base = m ? m[1].trim() : "General application";
    return isIntern && !/intern/i.test(base) ? `${base} Intern` : base;
}

// File ke naam se document ki qism
export function docKind(file) {
    if (/degree|certificate/i.test(file)) return "degree";
    if (/cnic/i.test(file)) return "cnic";
    if (/contract/i.test(file)) return "contract";
    if (/experience/i.test(file)) return "experience";
    return "cv";
}




// Demo ke liye sample CV ki tafseel (role ke hisaab se)
const CV_BANK = [
    {
        match: /network|devops|infra/i,
        pitch: "Hands-on with routing, security and monitoring in busy office networks.",
        skills: ["Cisco routing and switching", "Firewalls and VPN", "Linux administration", "Network monitoring", "AWS basics"],
        jobs: [["Network Engineer", "BrightWave Technologies", "2022 to 2025"], ["Junior Network Administrator", "Meridian Telecom", "2020 to 2022"]],
        edu: "BS Telecommunication Engineering",
    },
    {
        match: /design|ui|ux|brand|graphic/i,
        pitch: "Designs clean interfaces and works closely with developers and clients.",
        skills: ["Figma", "UI and UX design", "Design systems", "Prototyping", "Brand identity"],
        jobs: [["UI Designer", "PixelCraft Studio", "2022 to 2025"], ["Graphic Designer", "Northline Media", "2020 to 2022"]],
        edu: "BS Design",
    },
    {
        match: /qa|test/i,
        pitch: "Careful tester who writes clear bug reports and automates repeat checks.",
        skills: ["Manual testing", "Cypress", "Test planning", "Jira", "API testing"],
        jobs: [["QA Engineer", "Orbit Software", "2022 to 2025"], ["Test Analyst", "Vertex Solutions", "2020 to 2022"]],
        edu: "BS Software Engineering",
    },
    {
        match: /data|analyst/i,
        pitch: "Turns raw numbers into simple reports that managers can act on.",
        skills: ["SQL", "Excel", "Power BI", "Python", "Reporting"],
        jobs: [["Data Analyst", "InsightWorks", "2022 to 2025"], ["Reporting Assistant", "Crescent Finance", "2020 to 2022"]],
        edu: "BS Statistics",
    },
    {
        match: /market|content|sales/i,
        pitch: "Plans campaigns, writes for different audiences and follows up on leads.",
        skills: ["Campaign planning", "Social media", "SEO", "Copywriting", "CRM tools"],
        jobs: [["Marketing Executive", "BlueOcean Agency", "2022 to 2025"], ["Sales Associate", "Trident Retail", "2020 to 2022"]],
        edu: "BBA Marketing",
    },
    {
        match: /hr|recruit/i,
        pitch: "Supports hiring, onboarding and keeping employee records in order.",
        skills: ["Recruitment", "Onboarding", "Policy writing", "HR records", "Communication"],
        jobs: [["HR Executive", "PeopleFirst Consulting", "2022 to 2025"], ["HR Assistant", "Summit Group", "2020 to 2022"]],
        edu: "MBA Human Resources",
    },
    {
        match: /./,
        pitch: "Reliable team member who learns quickly and delivers on time.",
        skills: ["JavaScript", "React", "Node.js", "SQL", "Git"],
        jobs: [["Software Developer", "CloudNest", "2022 to 2025"], ["Junior Developer", "CodeBridge", "2020 to 2022"]],
        edu: "BS Computer Science",
    },
];

export function sampleCv(a) {
    const intern = a.type === "intern";
    const hit = CV_BANK.find((x) => x.match.test(a.role)) || CV_BANK[CV_BANK.length - 1];
    const years = 1 + (a.id % 5);
    return {
        summary: intern
            ? `Motivated student applying for the ${a.role} role. Keen to learn, work in a team and build real project experience.`
            : `${years} years of experience relevant to the ${a.role} position. ${hit.pitch}`,
        skills: hit.skills,
        jobs: intern
            ? [["Final year project", "University", "Last year"], ["Personal portfolio project", "Self-directed", "Last year"]]
            : hit.jobs,
        education: intern ? "Currently completing a bachelor's degree" : hit.edu,
    };
}