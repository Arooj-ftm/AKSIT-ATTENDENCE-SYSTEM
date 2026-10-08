const base = [
  ["Ayesha Khan", "Senior UI Designer", "Design", "Active", 3200, "Islamabad", "Mar 2021", ["Figma", "UI/UX", "Branding"]],
  ["Ali Raza", "Frontend Developer", "Engineering", "On Leave", 2800, "Lahore", "Aug 2022", ["React", "Tailwind", "JavaScript"]],
  ["Sara Malik", "Product Manager", "Product", "Active", 4100, "Karachi", "Jan 2020", ["Roadmap", "Agile", "Strategy"]],
  ["Hamza Tariq", "Backend Engineer", "Engineering", "Active", 3500, "Rawalpindi", "Jun 2021", ["Node.js", "SQL", "APIs"]],
  ["Fatima Noor", "HR Manager", "HR", "Active", 2900, "Islamabad", "Feb 2019", ["Hiring", "Policy", "Culture"]],
  ["Usman Ahmed", "DevOps Engineer", "Engineering", "Remote", 3700, "Dubai", "Nov 2021", ["AWS", "Docker", "CI/CD"]],
  ["Zainab Ali", "Marketing Lead", "Marketing", "Active", 3300, "Lahore", "Apr 2020", ["SEO", "Campaigns", "Content"]],
  ["Bilal Hussain", "QA Engineer", "Engineering", "Active", 2400, "Rawalpindi", "Sep 2023", ["Testing", "Cypress", "Jira"]],
  ["Hira Shah", "UX Researcher", "Design", "Remote", 2700, "London", "May 2022", ["Research", "Interviews", "Miro"]],
  ["Omar Farooq", "Sales Executive", "Sales", "Active", 2500, "Karachi", "Jul 2022", ["CRM", "Negotiation", "Leads"]],
  ["Maryam Iqbal", "Data Analyst", "Product", "On Leave", 3000, "Islamabad", "Oct 2021", ["Python", "Power BI", "SQL"]],
  ["Danish Mirza", "Mobile Developer", "Engineering", "Active", 3400, "Lahore", "Dec 2020", ["Flutter", "Dart", "Firebase"]],
  ["Noor Fatima", "Content Strategist", "Marketing", "Remote", 2300, "Riyadh", "Mar 2023", ["Writing", "Social Media", "Brand"]],
  ["Saad Qureshi", "Finance Officer", "HR", "Active", 2800, "Karachi", "Jan 2022", ["Payroll", "Excel", "Audit"]],
  ["Iqra Javed", "Brand Designer", "Design", "Active", 2900, "Islamabad", "Aug 2021", ["Illustrator", "Motion", "Identity"]],
];

export const employees = base.map(([name, role, department, status, salary, city, joined, skills], i) => ({
  id: i + 1,
  code: `AG-${1001 + i}`,
  name, role, department, status, city, joined, skills,
  salary: `$${salary.toLocaleString()}`,
  email: `${name.split(" ")[0].toLowerCase()}@aksitglobal.com`,
  phone: `+92 30${i % 10} ${1234000 + i * 137}`
}));

