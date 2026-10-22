
const express = require("express");

const Attendance = require("../models/Attendance");
const User = require("../models/User");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

// All attendance endpoints require authentication and a completed
// password change when the account is flagged for one.
router.use(authenticate, requirePasswordChangeComplete);

const COMPANY_ROLES = [
    "super_admin",
    "hr",
    "ceo",
];

const ALL_ATTENDANCE_ROLES = [
    "super_admin",
    "hr",
    "ceo",
    "cto_md",
    "manager",
    "employee",
];

function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function isValidDate(date) {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
}

function isValidMonth(month) {
    if (
        typeof month !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
        return false;
    }

    const [year, monthNumber] = month.split("-").map(Number);

    return (
        year >= 1900 &&
        year <= 9999 &&
        monthNumber >= 1 &&
        monthNumber <= 12
    );
}

function getCurrentUserId(req) {
    return String(req.user._id || req.user.id);
}

function getDateFilter(query) {
    if (query.month) {
        if (!isValidMonth(query.month)) {
            throw new Error("Month must use YYYY-MM format.");
        }

        const [year, month] = query.month.split("-").map(Number);
        const startDate = `${query.month}-01`;

        const nextMonthDate = new Date(Date.UTC(year, month, 1));

        const endDate = [
            nextMonthDate.getUTCFullYear(),
            String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0"),
            "01",
        ].join("-");

        return {
            date: {
                $gte: startDate,
                $lt: endDate,
            },
        };
    }

    const date = query.date || getToday();

    if (!isValidDate(date)) {
        throw new Error("Date must use YYYY-MM-DD format.");
    }

    return { date };
}

// Check in: the logged-in user can only create their own record.
router.post(
    "/check-in",
    allowRoles(...ALL_ATTENDANCE_ROLES),
    async (req, res) => {
        try {
            const userId = getCurrentUserId(req);
            const date = getToday();

            let record = await Attendance.findOne({ userId, date });

            if (record?.checkIn) {
                return res.status(409).json({
                    success: false,
                    message: "You have already checked in today.",
                });
            }

            if (!record) {
                record = new Attendance({
                    userId,
                    date,
                    checkIn: new Date(),
                    status: "present",
                });
            } else {
                record.checkIn = new Date();
                record.status = "present";
            }

            await record.save();

            return res.status(201).json({
                success: true,
                message: "Check-in saved successfully.",
                record,
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message:
                        "An attendance record already exists for today.",
                });
            }

            console.error("Attendance check-in error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to save check-in.",
            });
        }
    }
);

// Check out: requires a check-in and allows one check-out per day.
router.post(
    "/check-out",
    allowRoles(...ALL_ATTENDANCE_ROLES),
    async (req, res) => {
        try {
            const userId = getCurrentUserId(req);
            const date = getToday();

            const record = await Attendance.findOne({ userId, date });

            if (!record || !record.checkIn) {
                return res.status(400).json({
                    success: false,
                    message: "Check in before checking out.",
                });
            }

            if (record.checkOut) {
                return res.status(409).json({
                    success: false,
                    message: "You have already checked out today.",
                });
            }

            record.checkOut = new Date();
            await record.save();

            return res.json({
                success: true,
                message: "Check-out saved successfully.",
                record,
            });
        } catch (error) {
            console.error("Attendance check-out error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to save check-out.",
            });
        }
    }
);

// Supports a single day (?date=YYYY-MM-DD)
// or a complete month (?month=YYYY-MM).
router.get(
    "/",
    allowRoles(...ALL_ATTENDANCE_ROLES),
    async (req, res) => {
        try {
            let dateFilter;

            try {
                dateFilter = getDateFilter(req.query);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            let employeeQuery;
            let attendanceQuery = { ...dateFilter };

            if (COMPANY_ROLES.includes(req.user.role)) {
                employeeQuery = { isActive: true };
            } else {
                // Employees and managers can only view their own records.
                const userId = getCurrentUserId(req);

                attendanceQuery.userId = userId;

                employeeQuery = {
                    _id: userId,
                    isActive: true,
                };
            }

            const [records, employees] = await Promise.all([
                Attendance.find(attendanceQuery)
                    .populate(
                        "userId",
                        "name email role department designation"
                    )
                    .sort({ date: 1, checkIn: 1 })
                    .lean(),

                User.find(employeeQuery)
                    .select(
                        "name email role department designation"
                    )
                    .sort({ name: 1 })
                    .lean(),
            ]);

            return res.json({
                success: true,
                date:
                    req.query.date ||
                    (!req.query.month ? getToday() : undefined),
                month: req.query.month || undefined,
                employees,
                records,
            });
        } catch (error) {
            console.error("Attendance list error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to load attendance records.",
            });
        }
    }
);

module.exports = router;
