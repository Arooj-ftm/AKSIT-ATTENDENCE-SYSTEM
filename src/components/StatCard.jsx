import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import "./StatCard.css";

export default function StatCard({ icon: Icon, label, value, hint, tint = "blue", delay = 0, onClick, selected = false }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 1.1, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      whileHover={{ y: -3 }}
      className={`stat-card ${selected ? "selected" : ""}`}
    >
      <div className="stat-card-top">
        <p className="stat-card-label">{label}</p>
        <div className={`stat-card-icon stat-card-tint-${tint}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="stat-card-value">{n}</p>
      <p className="stat-card-hint">{hint}</p>
    </motion.button>
  );
}