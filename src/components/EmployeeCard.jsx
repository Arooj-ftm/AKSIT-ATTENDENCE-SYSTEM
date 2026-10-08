import { motion } from "framer-motion";
import { Mail, MapPin, ChevronRight } from "lucide-react";
import Avatar from "./Avatar";
import "./EmployeeCard.css";

const badge = { Active: "badge-active", "On Leave": "badge-leave", Remote: "badge-remote" };

export default function EmployeeCard({ emp, index, onClick }) {
  const shown = emp.skills.slice(0, 2);
  const extra = emp.skills.length - shown.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.03, duration: 0.35 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="emp-card"
    >
      <div className="emp-card-top">
        <Avatar name={emp.name} id={emp.id} size="md" />
        <span className={`emp-card-badge ${badge[emp.status]}`}>{emp.status}</span>
      </div>

      <h3 className="emp-card-name">{emp.name}</h3>
      <p className="emp-card-role">{emp.role}</p>
      <p className="emp-card-code">{emp.code} · {emp.department}</p>

      <div className="emp-card-skills">
        {shown.map((s) => <span key={s} className="emp-card-skill">{s}</span>)}
        {extra > 0 && <span className="emp-card-skill emp-card-skill-more">+{extra}</span>}
      </div>

      <div className="emp-card-info">
        <p><MapPin size={14} /> {emp.city}</p>
        <p className="truncate"><Mail size={14} /> {emp.email}</p>
      </div>

      <div className="emp-card-view">View profile <ChevronRight size={14} /></div>
    </motion.div>
  );
}