import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Phone, Briefcase, Wallet, MapPin, CalendarDays } from "lucide-react";
import Avatar from "./Avatar";
import "./EmployeeModal.css";

export default function EmployeeModal({ emp, onClose }) {
  return (
    <AnimatePresence>
      {emp && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="overlay"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="profile"
          >
            <div className="profile-banner" />
            <button onClick={onClose} aria-label="Close" className="profile-close">
              <X size={16} />
            </button>

            <div className="profile-body">
              <div className="profile-avatar">
                <Avatar name={emp.name} id={emp.id} size="lg" />
              </div>
              <h2 className="profile-name">{emp.name}</h2>
              <p className="profile-role">{emp.role} · {emp.code}</p>

              <div className="profile-details">
                {[[Mail, emp.email], [Phone, emp.phone], [Briefcase, emp.department], [MapPin, emp.city],
                [CalendarDays, "Joined " + emp.joined], [Wallet, emp.salary + " / month"]].map(([Icon, t]) => (
                  <div key={t} className="profile-detail">
                    <Icon size={16} /> {t}
                  </div>
                ))}
              </div>

              <p className="profile-label">Skills</p>
              <div className="profile-skills">
                {emp.skills.map((s) => <span key={s} className="profile-skill">{s}</span>)}
              </div>

              <div className="profile-actions">
                <button className="btn btn-primary">Send message</button>
                <button className="btn btn-light">Schedule call</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}