import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import "./AddEmployeeModal.css";

const empty = { name: "", role: "", department: "", city: "", status: "Active", salary: "", skills: "" };

export default function AddEmployeeModal({ open, departments, onClose, onSave }) {
  const [f, setF] = useState(empty);
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...f, department: f.department || departments[0] });
    setF(empty);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="overlay"
        >
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="form"
          >
            <div className="form-head">
              <div>
                <h2 className="form-title">Add employee</h2>
                <p className="muted">The new profile appears in the team list right away.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="form-close">
                <X size={16} />
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">Full name
                <input required value={f.name} onChange={set("name")} placeholder="e.g. Rabia Anwar" className="form-input" />
              </label>
              <label className="form-field">Job title
                <input required value={f.role} onChange={set("role")} placeholder="e.g. Network Engineer" className="form-input" />
              </label>
              <label className="form-field">Department
                <select value={f.department || departments[0]} onChange={set("department")} className="form-input">
                  {departments.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="form-field">Status
                <select value={f.status} onChange={set("status")} className="form-input">
                  <option>Active</option><option>Remote</option><option>On Leave</option>
                </select>
              </label>
              <label className="form-field">City
                <input required value={f.city} onChange={set("city")} placeholder="e.g. Islamabad" className="form-input" />
              </label>
              <label className="form-field">Monthly salary (USD)
                <input required type="number" min="0" value={f.salary} onChange={set("salary")} placeholder="e.g. 2500" className="form-input" />
              </label>
            </div>

            <label className="form-field form-field-wide">Skills (separate with commas)
              <input value={f.skills} onChange={set("skills")} placeholder="e.g. Cisco, Firewalls, Linux" className="form-input" />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save employee</button>
              <button type="button" onClick={onClose} className="btn btn-light">Cancel</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}