import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import "./Notifications.css";

export default function Notifications({ items, unread, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Dropdown ke bahar click karne par band ho jaye
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = () => {
    setOpen(!open);
    onOpen();
  };

  return (
    <div ref={ref} className="notif">
      <button onClick={toggle} aria-label="Notifications" className="notif-btn">
        <Bell size={17} />
        {unread && <span className="notif-unread" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="notif-menu"
          >
            <div className="notif-head">Notifications</div>
            <div className="notif-list">
              {items.length === 0 && <p className="notif-empty">You're all caught up.</p>}
              {items.map((n, i) => (
                <div key={i} className="notif-item">
                  <span className={`notif-dot notif-dot-${n.tone}`} />
                  <div className="notif-text">
                    <p className="notif-title">{n.title}</p>
                    <p className="notif-sub truncate">{n.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}