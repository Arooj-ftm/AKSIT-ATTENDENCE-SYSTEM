import { useCallback, useEffect, useState } from "react";
import {
    CalendarRange,
    CalendarDays,
    Plus,
    Pencil,
    Trash2,
    RefreshCw,
    Search,
    X,
    AlertCircle,
    CheckCircle2,
    CalendarCheck,
    CalendarOff,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import PageHeader from "../components/PageHeader";
import "./HRHolidays.css";

const getCurrentYear = () => new Date().getFullYear();

const createEmptyForm = () => ({
    name: "",
    date: "",
    type: "public",
    description: "",
    isWorkingDay: false,
});

const formatDate = (value) => {
    if (!value) return "—";

    const [year, month, day] = value.split("-").map(Number);

    if (!year || !month || !day) return value;

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const getHolidayId = (holiday) =>
    String(holiday?._id || holiday?.id || "");

export default function HRHolidays() {
    const { token } = useAuth();

    const [holidays, setHolidays] = useState([]);
    const [year, setYear] = useState(getCurrentYear);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState("");
    const [form, setForm] = useState(createEmptyForm);

    const loadHolidays = useCallback(
        async (showRefresh = false) => {
            if (!token) {
                setError("Your session has expired. Please log in again.");
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            try {
                const response = await apiRequest(
                    `/api/holidays?year=${encodeURIComponent(year)}`,
                    {},
                    token
                );

                const list = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.holidays)
                      ? response.holidays
                      : Array.isArray(response?.data)
                        ? response.data
                        : Array.isArray(response?.data?.holidays)
                          ? response.data.holidays
                          : null;

                if (!list) {
                    throw new Error(
                        "Unexpected response from the holidays API."
                    );
                }

                setHolidays(list);
            } catch (err) {
                setError(err?.message || "Unable to load holidays.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [token, year]
    );

    useEffect(() => {
        loadHolidays();
    }, [loadHolidays]);

    const resetForm = () => {
        setForm(createEmptyForm());
        setEditingId("");
        setIsFormOpen(false);
    };

    const openAddForm = () => {
        setError("");
        setNotice("");
        setForm(createEmptyForm());
        setEditingId("");
        setIsFormOpen(true);
    };

    const openEditForm = (holiday) => {
        setError("");
        setNotice("");
        setEditingId(getHolidayId(holiday));

        setForm({
            name: holiday.name || "",
            date: holiday.date || "",
            type: holiday.type || "public",
            description: holiday.description || "",
            isWorkingDay: holiday.isWorkingDay === true,
        });

        setIsFormOpen(true);
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;

        setForm((current) => ({
            ...current,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setNotice("");

        if (!token) {
            setError("Your session has expired. Please log in again.");
            return;
        }

        if (!form.name.trim() || !form.date) {
            setError("Holiday name and date are required.");
            return;
        }

        const selectedYear = Number(form.date.slice(0, 4));

        const payload = {
            name: form.name.trim(),
            date: form.date,
            type: form.type,
            description: form.description.trim(),
            isWorkingDay: Boolean(form.isWorkingDay),
        };

        setSaving(true);

        try {
            const endpoint = editingId
                ? `/api/holidays/${encodeURIComponent(editingId)}`
                : "/api/holidays";

            await apiRequest(
                endpoint,
                {
                    method: editingId ? "PATCH" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                },
                token
            );

            setNotice(
                editingId
                    ? "Holiday updated successfully."
                    : "Holiday added successfully."
            );

            setIsFormOpen(false);
            setEditingId("");
            setForm(createEmptyForm());

            if (selectedYear !== year) {
                setYear(selectedYear);
            } else {
                await loadHolidays(true);
            }
        } catch (err) {
            setError(
                err?.message ||
                    `Unable to ${editingId ? "update" : "add"} holiday.`
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (holiday) => {
        const id = getHolidayId(holiday);

        if (!id) {
            setError("This holiday does not have a valid record ID.");
            return;
        }

        if (
            !window.confirm(
                `Delete "${holiday.name}" on ${formatDate(holiday.date)}?`
            )
        ) {
            return;
        }

        setError("");
        setNotice("");
        setDeletingId(id);

        try {
            await apiRequest(
                `/api/holidays/${encodeURIComponent(id)}`,
                { method: "DELETE" },
                token
            );

            setNotice("Holiday deleted successfully.");
            await loadHolidays(true);
        } catch (err) {
            setError(err?.message || "Unable to delete holiday.");
        } finally {
            setDeletingId("");
        }
    };

    const filteredHolidays = holidays
        .filter((holiday) => {
            const query = search.trim().toLowerCase();

            if (!query) return true;

            return [
                holiday.name,
                holiday.description,
                holiday.type,
                holiday.date,
                holiday.isWorkingDay ? "working day" : "holiday",
            ].some((value) =>
                String(value || "").toLowerCase().includes(query)
            );
        })
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const nonWorkingCount = holidays.filter(
        (holiday) => holiday.isWorkingDay !== true
    ).length;

    const workingDayCount = holidays.filter(
        (holiday) => holiday.isWorkingDay === true
    ).length;

    return (
        <main className="hr-holidays-page" data-role="hr">
            <PageHeader
                eyebrow="HR MANAGEMENT"
                title="Holiday Management"
                description="Manage company holidays, non-working days, and special working days."
                icon={CalendarCheck}
                onRefresh={() => loadHolidays(true)}
                refreshing={loading || refreshing}
            />

            <div className="hr-holidays-content">
                {error && (
                    <div className="hr-holidays-message error" role="alert">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Dismiss error"
                        >
                            <X size={17} />
                        </button>
                    </div>
                )}

                {notice && (
                    <div className="hr-holidays-message success" role="status">
                        <CheckCircle2 size={18} />
                        <span>{notice}</span>
                        <button
                            type="button"
                            onClick={() => setNotice("")}
                            aria-label="Dismiss message"
                        >
                            <X size={17} />
                        </button>
                    </div>
                )}

                <section className="hr-holiday-stats">
                    <article className="hr-holiday-stat">
                        <span className="hr-holiday-stat-icon total">
                            <CalendarDays size={21} />
                        </span>
                        <div>
                            <p>Scheduled Dates</p>
                            <strong>{loading ? "—" : holidays.length}</strong>
                        </div>
                    </article>

                    <article className="hr-holiday-stat">
                        <span className="hr-holiday-stat-icon holiday">
                            <CalendarOff size={21} />
                        </span>
                        <div>
                            <p>Non-working Holidays</p>
                            <strong>{loading ? "—" : nonWorkingCount}</strong>
                        </div>
                    </article>

                    <article className="hr-holiday-stat">
                        <span className="hr-holiday-stat-icon working">
                            <CalendarCheck size={21} />
                        </span>
                        <div>
                            <p>Special Working Days</p>
                            <strong>{loading ? "—" : workingDayCount}</strong>
                        </div>
                    </article>
                </section>

                <section className="hr-holidays-panel">
                    <div className="hr-holidays-toolbar">
                        <div className="hr-holidays-heading">
                            <h2>Company Calendar</h2>
                            <p>
                                Sundays are non-working days by default. You
                                can override a date by marking it as a working
                                day.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="hr-holiday-primary-btn"
                            onClick={openAddForm}
                        >
                            <Plus size={18} />
                            Add Holiday
                        </button>
                    </div>

                    <div className="hr-holidays-controls">
                        <label className="hr-holidays-year">
                            <span>Calendar year</span>
                            <select
                                value={year}
                                onChange={(event) => {
                                    setYear(Number(event.target.value));
                                    setNotice("");
                                }}
                            >
                                {Array.from(
                                    { length: 7 },
                                    (_, index) => getCurrentYear() - 3 + index
                                ).map((optionYear) => (
                                    <option
                                        key={optionYear}
                                        value={optionYear}
                                    >
                                        {optionYear}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="hr-holidays-search">
                            <Search size={18} />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search holidays..."
                                aria-label="Search holidays"
                            />
                        </label>

                        <button
                            type="button"
                            className="hr-holiday-refresh-btn"
                            onClick={() => loadHolidays(true)}
                            disabled={loading || refreshing}
                            aria-label="Refresh holidays"
                            title="Refresh holidays"
                        >
                            <RefreshCw
                                size={17}
                                className={
                                    refreshing ? "hr-holiday-spin" : ""
                                }
                            />
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="hr-holidays-loading">
                            <RefreshCw
                                size={22}
                                className="hr-holiday-spin"
                            />
                            <span>Loading holidays...</span>
                        </div>
                    ) : (
                        <div className="hr-holidays-table-wrap">
                            <table className="hr-holidays-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Holiday</th>
                                        <th>Type</th>
                                        <th>Attendance Rule</th>
                                        <th className="hr-holiday-actions-heading">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredHolidays.map((holiday) => {
                                        const id = getHolidayId(holiday);
                                        const isWorking =
                                            holiday.isWorkingDay === true;

                                        return (
                                            <tr key={id || holiday.date}>
                                                <td className="hr-holiday-date-cell">
                                                    {formatDate(holiday.date)}
                                                </td>

                                                <td>
                                                    <div className="hr-holiday-name-cell">
                                                        <strong>
                                                            {holiday.name}
                                                        </strong>
                                                        {holiday.description && (
                                                            <span>
                                                                {
                                                                    holiday.description
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td>
                                                    <span className="hr-holiday-type">
                                                        {holiday.type ===
                                                        "company"
                                                            ? "Company"
                                                            : "Public"}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span
                                                        className={`hr-holiday-status ${
                                                            isWorking
                                                                ? "working"
                                                                : "non-working"
                                                        }`}
                                                    >
                                                        {isWorking ? (
                                                            <CalendarCheck
                                                                size={15}
                                                            />
                                                        ) : (
                                                            <CalendarOff
                                                                size={15}
                                                            />
                                                        )}
                                                        {isWorking
                                                            ? "Working Day"
                                                            : "Non-working"}
                                                    </span>
                                                </td>

                                                <td>
                                                    <div className="hr-holiday-actions">
                                                        <button
                                                            type="button"
                                                            className="hr-holiday-icon-btn edit"
                                                            onClick={() =>
                                                                openEditForm(
                                                                    holiday
                                                                )
                                                            }
                                                            aria-label={`Edit ${holiday.name}`}
                                                            title="Edit holiday"
                                                        >
                                                            <Pencil size={17} />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="hr-holiday-icon-btn delete"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    holiday
                                                                )
                                                            }
                                                            disabled={
                                                                deletingId ===
                                                                id
                                                            }
                                                            aria-label={`Delete ${holiday.name}`}
                                                            title="Delete holiday"
                                                        >
                                                            {deletingId ===
                                                            id ? (
                                                                <RefreshCw
                                                                    size={17}
                                                                    className="hr-holiday-spin"
                                                                />
                                                            ) : (
                                                                <Trash2
                                                                    size={17}
                                                                />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredHolidays.length === 0 && (
                                        <tr>
                                            <td colSpan={5}>
                                                <div className="hr-holidays-empty">
                                                    <CalendarRange size={32} />
                                                    <strong>
                                                        No holidays found
                                                    </strong>
                                                    <span>
                                                        Add a holiday or change
                                                        the selected year or
                                                        search.
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <footer className="hr-holidays-footer">
                        <span>
                            Showing {filteredHolidays.length} of{" "}
                            {holidays.length} dates for {year}
                        </span>
                    </footer>
                </section>
            </div>

            {isFormOpen && (
                <div
                    className="hr-holiday-modal-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !saving
                        ) {
                            resetForm();
                        }
                    }}
                >
                    <section
                        className="hr-holiday-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="hr-holiday-modal-title"
                    >
                        <div className="hr-holiday-modal-header">
                            <div className="hr-holiday-modal-title-icon">
                                {editingId ? (
                                    <Pencil size={21} />
                                ) : (
                                    <CalendarRange size={21} />
                                )}
                            </div>

                            <div className="hr-holiday-modal-title-text">
                                <h2 id="hr-holiday-modal-title">
                                    {editingId ? "Edit Holiday" : "Add Holiday"}
                                </h2>
                                <p>
                                    Enter the date and attendance rules for
                                    this calendar entry.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="hr-holiday-icon-btn"
                                onClick={resetForm}
                                disabled={saving}
                                aria-label="Close form"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="hr-holiday-modal-body">
                                {error && (
                                    <div
                                        className="hr-holidays-message error"
                                        role="alert"
                                    >
                                        <AlertCircle size={18} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="hr-holiday-form-grid">
                                    <label>
                                        <span>Holiday name *</span>
                                        <input
                                            name="name"
                                            value={form.name}
                                            onChange={handleFormChange}
                                            placeholder="e.g. Independence Day"
                                            maxLength={150}
                                            required
                                        />
                                    </label>

                                    <label>
                                        <span>Date *</span>
                                        <input
                                            type="date"
                                            name="date"
                                            value={form.date}
                                            onChange={handleFormChange}
                                            required
                                        />
                                    </label>

                                    <label>
                                        <span>Holiday type</span>
                                        <select
                                            name="type"
                                            value={form.type}
                                            onChange={handleFormChange}
                                        >
                                            <option value="public">
                                                Public Holiday
                                            </option>
                                            <option value="company">
                                                Company Holiday
                                            </option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>Attendance rule</span>
                                        <select
                                            value={
                                                form.isWorkingDay
                                                    ? "true"
                                                    : "false"
                                            }
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    isWorkingDay:
                                                        event.target.value ===
                                                        "true",
                                                }))
                                            }
                                        >
                                            <option value="false">
                                                Non-working Holiday
                                            </option>
                                            <option value="true">
                                                Working Day
                                            </option>
                                        </select>
                                    </label>

                                    <label className="hr-holiday-description">
                                        <span>Description (optional)</span>
                                        <textarea
                                            name="description"
                                            value={form.description}
                                            onChange={handleFormChange}
                                            placeholder="Add any additional details..."
                                            rows={3}
                                            maxLength={1000}
                                        />
                                    </label>
                                </div>

                                <div className="hr-holiday-form-note">
                                    {form.isWorkingDay ? (
                                        <>
                                            <CalendarCheck size={17} />
                                            Employees will be expected to
                                            follow normal attendance rules on
                                            this date.
                                        </>
                                    ) : (
                                        <>
                                            <CalendarOff size={17} />
                                            This date will not add required
                                            attendance hours or eligible
                                            working days.
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="hr-holiday-modal-footer">
                                <button
                                    type="button"
                                    className="hr-holiday-secondary-btn"
                                    onClick={resetForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="hr-holiday-primary-btn"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw
                                                size={17}
                                                className="hr-holiday-spin"
                                            />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={17} />
                                            {editingId
                                                ? "Save Changes"
                                                : "Save Holiday"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}
