import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import "./Charts.css";

const colors = ["#2563eb", "#0ea5e9", "#6366f1", "#f59e0b", "#10b981", "#94a3b8"];
const tip = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px rgba(15,23,42,.08)" };

export default function Charts({ employees }) {
  // Department distribution
  const counts = {};
  employees.forEach((e) => (counts[e.department] = (counts[e.department] || 0) + 1));
  const dept = Object.entries(counts).map(([name, value]) => ({ name, value }));

  // Team growth: joining year ke hisaab se total
  const perYear = {};
  employees.forEach((e) => {
    const y = e.joined.split(" ")[1];
    perYear[y] = (perYear[y] || 0) + 1;
  });
  let running = 0;
  const growth = Object.keys(perYear).sort().map((year) => {
    running += perYear[year];
    return { year, total: running, joined: perYear[year] };
  });

  return (
    <div className="charts">
      <div className="chart-card">
        <div className="chart-head">
          <h3 className="chart-title">Team growth</h3>
          <p className="muted">Total employees by year of joining</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={growth} margin={{ left: -20, right: 8 }}>
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tip} formatter={(v) => [v, "Total team"]} />
            <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fill="url(#fill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">By department</h3>
        <p className="muted">Team distribution</p>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={dept} dataKey="value" innerRadius={45} outerRadius={68} paddingAngle={3} stroke="none">
              {dept.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={tip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          {dept.map((d, i) => (
            <div key={d.name} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: colors[i % colors.length] }} />
              {d.name} <span className="chart-legend-count">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}