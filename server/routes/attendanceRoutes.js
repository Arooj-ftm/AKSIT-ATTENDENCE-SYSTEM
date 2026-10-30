const express = require("express");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Holiday = require("../models/Holiday");
const LeaveRequest = require("../models/LeaveRequest");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

// Roles allowed to view company-wide attendance.
const COMPANY_ROLES = [
    "superuser",
    "hr",
    "ceo",
    "cto_md",
];

// Roles allowed to use employee check-in/check-out endpoints.
// Super Admin is deliberately excluded.
const ALL_ATTENDANCE_ROLES = [
    "hr",
    "ceo",
    "cto_md",
    "manager",
    "employee",
];

// Roles allowed to access company-wide monthly reports.
// Super Admin is deliberately excluded.
const REPORT_ROLES = [
    "hr",
    "ceo",
    "cto_md",
    "superuser",
];

const DAILY_TARGET_MINUTES = 7 * 60;
const BREAK_START_MINUTES = 13 * 60;
const BREAK_END_MINUTES = 14 * 60;

const normalizeRole = (role) =>
    String(role || "").trim().toLowerCase();

function getToday() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function isValidDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
}

function isValidMonth(month) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "");
}

function getCurrentUserId(req) {
    return req.user?._id || req.user?.id || req.user?.userId;
}

function getDateFilter(query) {
    const filter = {};

    if (query.date && isValidDate(query.date)) {
        filter.date = query.date;
    } else if (query.month && isValidMonth(query.month)) {
        const [year, month] = query.month.split("-").map(Number);
        const lastDay = new Date(year, month, 0)
            .getDate()
            .toString()
            .padStart(2, "0");

        filter.date = {
            $gte: `${query.month}-01`,
            $lte: `${query.month}-${lastDay}`,
        };
    }

    return filter;
}

function getLocalDayOfWeek(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day).getDay();
}

function getMonthDates(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const totalDays = new Date(year, monthNumber, 0).getDate();

    return Array.from({ length: totalDays }, (_, index) => {
        return `${year}-${String(monthNumber).padStart(2, "0")}-${String(
            index + 1
        ).padStart(2, "0")}`;
    });
}

function getNetWorkedMinutes(checkIn, checkOut, date) {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
        return 0;
    }

    const grossMinutes = Math.floor((end - start) / 60000);

    const [year, month, day] = date.split("-").map(Number);

    const breakStart = new Date(
        year,
        month - 1,
        day,
        13,
        0,
        0,
        0
    );

    const breakEnd = new Date(
        year,
        month - 1,
        day,
        14,
        0,
        0,
        0
    );

    const overlapStart = Math.max(
        start.getTime(),
        breakStart.getTime()
    );

    const overlapEnd = Math.min(
        end.getTime(),
        breakEnd.getTime()
    );

    const breakOverlap = Math.max(
        0,
        Math.floor((overlapEnd - overlapStart) / 60000)
    );

    return Math.max(0, grossMinutes - breakOverlap);
}

function formatHours(minutes) {
    return Number((minutes / 60).toFixed(2));
}

function getLeaveTarget(leave, date) {
    if (!leave) return DAILY_TARGET_MINUTES;

    if (leave.leaveType === "half_day") {
        return DAILY_TARGET_MINUTES / 2;
    }

    if (leave.leaveType === "short") {
        const start = leave.startTime;
        const end = leave.endTime;

        if (
            typeof start === "string" &&
            typeof end === "string" &&
            /^\d{2}:\d{2}$/.test(start) &&
            /^\d{2}:\d{2}$/.test(end)
        ) {
            const [startHour, startMinute] = start.split(":").map(Number);
            const [endHour, endMinute] = end.split(":").map(Number);

            const startMinutes = startHour * 60 + startMinute;
            const endMinutes = endHour * 60 + endMinute;

            if (
                startHour <= 23 &&
                endHour <= 23 &&
                startMinute <= 59 &&
                endMinute <= 59 &&
                endMinutes > startMinutes
            ) {
                const shortLeaveMinutes = endMinutes - startMinutes;

                return Math.max(
                    0,
                    DAILY_TARGET_MINUTES -
                        Math.min(
                            shortLeaveMinutes,
                            DAILY_TARGET_MINUTES
                        )
                );
            }
        }
    }

    return DAILY_TARGET_MINUTES;
}

function getLeaveForDate(approvedLeaves, date) {
    return approvedLeaves.find((leave) => {
        return leave.startDate <= date && leave.endDate >= date;
    });
}

function getHolidayForDate(holidayMap, date) {
    return holidayMap.get(date) || null;
}

// HR's explicit holiday entry overrides the default Sunday rule.
// isWorkingDay: false means no attendance target.
// isWorkingDay: true means normal attendance rules apply.
function isWorkingDate(date, holiday) {
    if (holiday) {
        return holiday.isWorkingDay === true;
    }

    return getLocalDayOfWeek(date) !== 0;
}

function isLeaveDay(leave) {
    if (!leave) return false;

    return ["annual", "casual", "sick", "emergency"].includes(
        leave.leaveType
    );
}

function isFullDayAttendanceExempt(leave) {
    return Boolean(leave && isLeaveDay(leave));
}

function getDailyStatus({
    date,
    today,
    workingDay,
    holiday,
    leave,
    attendance,
    workedMinutes,
    targetMinutes,
}) {
    if (holiday && holiday.isWorkingDay !== true) {
        return "Holiday";
    }

    if (!holiday && getLocalDayOfWeek(date) === 0) {
        return "Sunday";
    }

    if (isFullDayAttendanceExempt(leave)) {
        return "On Leave";
    }

    if (!workingDay) {
        return "Off Day";
    }

    if (date > today) {
        return "Upcoming";
    }

    if (!attendance) {
        return date === today ? "Not Started" : "Absent";
    }

    if (attendance.status === "on_leave") {
        return "On Leave";
    }

    if (!attendance.checkIn) {
        return date === today ? "Not Started" : "Absent";
    }

    if (workedMinutes >= targetMinutes) {
        return "Target Met";
    }

    if (date === today && !attendance.checkOut) {
        return "In Progress";
    }

    if (!attendance.checkOut) {
        return "Incomplete";
    }

    return "Target Missed";
}

function isCompanyReportRole(role) {
    return REPORT_ROLES.includes(normalizeRole(role));
}

// --------------------------------------------------
// CHECK-IN
// Super Admin cannot modify attendance.
// --------------------------------------------------

router.post("/check-in", async (req, res) => {
    try {
        const role = normalizeRole(req.user.role);

        if (!ALL_ATTENDANCE_ROLES.includes(role)) {
            return res.status(403).json({
                message: "You are not allowed to check in.",
            });
        }

        const userId = getCurrentUserId(req);
        const date = getToday();

        const holiday = await Holiday.findOne({ date }).lean();
        const workingDay = isWorkingDate(date, holiday);

        if (!workingDay) {
            return res.status(400).json({
                message: holiday
                    ? "Check-in is not allowed on this non-working holiday."
                    : "Check-in is not allowed on Sunday.",
                code: "NON_WORKING_DAY",
            });
        }

        const existing = await Attendance.findOne({ userId, date });

        if (existing?.checkIn) {
            return res.status(400).json({
                message: "You have already checked in today.",
            });
        }

        const attendance =
            existing ||
            new Attendance({
                userId,
                date,
                status: "present",
            });

        attendance.checkIn = new Date();
        attendance.checkOut = null;
        attendance.status = "present";

        await attendance.save();

        return res.json({
            message: "Checked in successfully.",
            attendance,
        });
    } catch (error) {
        console.error("Check-in error:", error);

        return res.status(500).json({
            message: "Failed to check in.",
        });
    }
});

// --------------------------------------------------
// CHECK-OUT
// Super Admin cannot modify attendance.
// --------------------------------------------------

router.post("/check-out", async (req, res) => {
    try {
        const role = normalizeRole(req.user.role);

        if (!ALL_ATTENDANCE_ROLES.includes(role)) {
            return res.status(403).json({
                message: "You are not allowed to check out.",
            });
        }

        const userId = getCurrentUserId(req);
        const date = getToday();

        const holiday = await Holiday.findOne({ date }).lean();

        if (!isWorkingDate(date, holiday)) {
            return res.status(400).json({
                message: "Check-out is not allowed on a non-working day.",
                code: "NON_WORKING_DAY",
            });
        }

        const attendance = await Attendance.findOne({ userId, date });

        if (!attendance || !attendance.checkIn) {
            return res.status(400).json({
                message: "You must check in before checking out.",
            });
        }

        if (attendance.checkOut) {
            return res.status(400).json({
                message: "You have already checked out today.",
            });
        }

        attendance.checkOut = new Date();

        await attendance.save();

        const workedMinutes = getNetWorkedMinutes(
            attendance.checkIn,
            attendance.checkOut,
            date
        );

        return res.json({
            message: "Checked out successfully.",
            attendance,
            workedMinutes,
            workedHours: formatHours(workedMinutes),
        });
    } catch (error) {
        console.error("Check-out error:", error);

        return res.status(500).json({
            message: "Failed to check out.",
        });
    }
});

// --------------------------------------------------
// MONTHLY WORKING-HOURS REPORT
// GET /api/attendance/monthly-report?month=2026-10
// --------------------------------------------------

router.get("/monthly-report", async (req, res) => {
    try {
        const role = normalizeRole(req.user.role);

        // Super Admin must not access employee monthly reports.
        if (role === "super_admin") {
            return res.status(403).json({
                message:
                    "Super Admin accounts do not have access to monthly attendance reports.",
                code: "MONTHLY_REPORT_ACCESS_DENIED",
            });
        }

        const month = req.query.month;

        if (!isValidMonth(month)) {
            return res.status(400).json({
                message: "Valid month required. Format: YYYY-MM.",
            });
        }

        const currentUserId = getCurrentUserId(req);
        const isCompanyWide = isCompanyReportRole(role);

        const userFilter = isCompanyWide
            ? {
                  isActive: true,
                  role: { $ne: "super_admin" },
              }
            : {
                  _id: currentUserId,
                  isActive: true,
                  role: { $ne: "super_admin" },
              };

        const users = await User.find(userFilter)
            .select("_id name email role department designation joiningDate")
            .sort({ name: 1 })
            .lean();

        const dates = getMonthDates(month);
        const monthStart = dates[0];
        const monthEnd = dates[dates.length - 1];
        const today = getToday();

        const [
            attendanceRecords,
            holidays,
            leaveRequests,
        ] = await Promise.all([
            Attendance.find({
                userId: { $in: users.map((user) => user._id) },
                date: { $gte: monthStart, $lte: monthEnd },
            }).lean(),

            Holiday.find({
                date: { $gte: monthStart, $lte: monthEnd },
            }).lean(),

            LeaveRequest.find({
                userId: { $in: users.map((user) => user._id) },
                status: "approved",
                startDate: { $lte: monthEnd },
                endDate: { $gte: monthStart },
            }).lean(),
        ]);

        const attendanceMap = new Map(
            attendanceRecords.map((record) => [
                `${record.userId.toString()}_${record.date}`,
                record,
            ])
        );

        const holidayMap = new Map(
            holidays.map((holiday) => [holiday.date, holiday])
        );

        const report = users.map((user) => {
            const userId = user._id.toString();

            const userLeaves = leaveRequests.filter(
                (leave) => leave.userId.toString() === userId
            );

            let actualMinutes = 0;
            let requiredMinutes = 0;
            let eligibleDays = 0;
            let targetMetDays = 0;
            let targetMissedDays = 0;
            let absentDays = 0;
            let leaveDays = 0;
            let holidayDays = 0;
            let sundayDays = 0;
            let completedDays = 0;

            const joiningDate = user.joiningDate
                ? new Date(user.joiningDate)
                : null;

            const normalizedJoiningDate =
                joiningDate && !Number.isNaN(joiningDate.getTime())
                    ? `${joiningDate.getFullYear()}-${String(
                          joiningDate.getMonth() + 1
                      ).padStart(2, "0")}-${String(
                          joiningDate.getDate()
                      ).padStart(2, "0")}`
                    : null;

            const dailyRecords = dates.map((date) => {
                const attendance =
                    attendanceMap.get(`${userId}_${date}`) || null;

                const holiday = getHolidayForDate(holidayMap, date);
                const leave = getLeaveForDate(userLeaves, date);

                const workingDay = isWorkingDate(date, holiday);

                const joinedOnOrBeforeDate =
                    !normalizedJoiningDate ||
                    normalizedJoiningDate <= date;

                const checkIn = attendance?.checkIn || null;
                let checkOut = attendance?.checkOut || null;

                if (checkIn && !checkOut && date === today) {
                    checkOut = new Date();
                }

                const workedMinutes =
                    attendance?.status === "on_leave"
                        ? 0
                        : getNetWorkedMinutes(checkIn, checkOut, date);

                const fullDayLeave =
                    isFullDayAttendanceExempt(leave) ||
                    attendance?.status === "on_leave";

                // A non-working day has no attendance target.
                const targetMinutes =
                    !workingDay || fullDayLeave
                        ? 0
                        : getLeaveTarget(leave, date);

                const eligible =
                    workingDay &&
                    !fullDayLeave &&
                    date <= today &&
                    joinedOnOrBeforeDate;

                const exemptDay =
                    !eligible;

                // Preserve actual hours worked, including recorded work
                // on holidays or Sundays. Such dates do not add targets.
                if (workedMinutes > 0) {
                    actualMinutes += workedMinutes;
                }

                if (eligible) {
                    eligibleDays += 1;
                    requiredMinutes += targetMinutes;

                    if (workedMinutes >= targetMinutes) {
                        targetMetDays += 1;
                        completedDays += 1;
                    } else {
                        targetMissedDays += 1;

                        if (!attendance?.checkIn) {
                            absentDays += 1;
                        }
                    }
                }

                if (fullDayLeave && workingDay) {
                    leaveDays += 1;
                }

                if (holiday && holiday.isWorkingDay !== true) {
                    holidayDays += 1;
                }

                if (!holiday && getLocalDayOfWeek(date) === 0) {
                    sundayDays += 1;
                }

                const status = getDailyStatus({
                    date,
                    today,
                    workingDay,
                    holiday,
                    leave,
                    attendance,
                    workedMinutes,
                    targetMinutes,
                });

                return {
                    date,
                    dayOfWeek: getLocalDayOfWeek(date),
                    checkIn: attendance?.checkIn || null,
                    checkOut: attendance?.checkOut || null,
                    workedMinutes,
                    workedHours: formatHours(workedMinutes),
                    targetMinutes,
                    targetHours: formatHours(targetMinutes),
                    targetMet:
                        eligible && workedMinutes >= targetMinutes,
                    eligible,
                    status,
                    holiday: holiday
                        ? {
                              name: holiday.name,
                              type: holiday.type,
                              isWorkingDay: holiday.isWorkingDay === true,
                          }
                        : null,
                    leave: leave
                        ? {
                              leaveType: leave.leaveType,
                              status: leave.status,
                              startTime: leave.startTime || null,
                              endTime: leave.endTime || null,
                          }
                        : null,
                    isExemptDay: exemptDay,
                };
            });

            return {
                user: {
                    id: userId,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department || "",
                    designation: user.designation || "",
                },
                month,
                summary: {
                    actualMinutes,
                    actualHours: formatHours(actualMinutes),
                    requiredMinutes,
                    requiredHours: formatHours(requiredMinutes),
                    remainingMinutes: Math.max(
                        0,
                        requiredMinutes - actualMinutes
                    ),
                    remainingHours: formatHours(
                        Math.max(0, requiredMinutes - actualMinutes)
                    ),
                    eligibleDays,
                    targetMetDays,
                    targetMissedDays,
                    absentDays,
                    completedDays,
                    leaveDays,
                    holidayDays,
                    sundayDays,
                    dailyTargetCompletionPercent:
                        eligibleDays > 0
                            ? Number(
                                  (
                                      (targetMetDays / eligibleDays) *
                                      100
                                  ).toFixed(2)
                              )
                            : 0,
                    monthlyHoursCompletionPercent:
                        requiredMinutes > 0
                            ? Number(
                                  (
                                      (actualMinutes / requiredMinutes) *
                                      100
                                  ).toFixed(2)
                              )
                            : 0,
                },
                days: dailyRecords,
            };
        });

        return res.json({
            month,
            dailyTargetHours: DAILY_TARGET_MINUTES / 60,
            break: {
                start: "13:00",
                end: "14:00",
                deduction: "Actual overlap only",
            },
            companyWide: isCompanyWide,
            employees: report,
        });
    } catch (error) {
        console.error("Monthly attendance report error:", error);

        return res.status(500).json({
            message: "Failed to generate monthly attendance report.",
        });
    }
});

// --------------------------------------------------
// EXISTING ATTENDANCE HISTORY
// GET /api/attendance?month=YYYY-MM
// --------------------------------------------------

router.get("/", async (req, res) => {
    try {
        const role = normalizeRole(req.user.role);
        const userId = getCurrentUserId(req);

        const filter = getDateFilter(req.query);

        if (
            (req.query.date && !isValidDate(req.query.date)) ||
            (req.query.month && !isValidMonth(req.query.month))
        ) {
            return res.status(400).json({
                message: "Invalid date or month format.",
            });
        }

        if (COMPANY_ROLES.includes(role)) {
            const records = await Attendance.find(filter)
                .populate("userId", "name email role department")
                .sort({ date: -1 });

            const employees = await User.find({
                isActive: true,
                role: { $ne: "super_admin" },
            })
                .select("_id name email role department")
                .sort({ name: 1 })
                .lean();

            // Exclude Super Admin attendance records from company-wide views.
            const visibleRecords = records.filter(
                (record) =>
                    normalizeRole(record.userId?.role) !== "super_admin"
            );

            return res.json({
                records: visibleRecords,
                employees,
            });
        }

        const records = await Attendance.find({
            ...filter,
            userId,
        }).sort({ date: -1 });

        return res.json({
            records,
            employees: [],
        });
    } catch (error) {
        console.error("Attendance history error:", error);

        return res.status(500).json({
            message: "Failed to fetch attendance records.",
        });
    }
});

module.exports = router;
