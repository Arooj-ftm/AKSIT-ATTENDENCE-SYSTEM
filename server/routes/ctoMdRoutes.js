
const express = require("express");

const Attendance = require("../models/Attendance");
const User = require("../models/User");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

// All CTO / Managing Director routes require authentication.
router.use(
    authenticate,
    allowRoles("cto_md"),
    requirePasswordChangeComplete
);

// Company-wide employee access.
// Exclude the system super admin and CTO/Managing Director.
const COMPANY_EMPLOYEE_FILTER = {
    role: {
        $nin: ["super_admin", "cto_md"],
    },
    isActive: {
        $ne: false,
    },
};

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

function getMonthDateRange(month) {
    const [year, monthNumber] = month.split("-").map(Number);

    const nextMonth = new Date(
        Date.UTC(year, monthNumber, 1)
    );

    const endDate = [
        nextMonth.getUTCFullYear(),
        String(nextMonth.getUTCMonth() + 1).padStart(2, "0"),
        "01",
    ].join("-");

    return {
        $gte: `${month}-01`,
        $lt: endDate,
    };
}

function getEmployeeId(employee) {
    return String(employee._id);
}

function getEmployeeDetails(employee) {
    return {
        _id: employee._id,
        id: getEmployeeId(employee),
        name: employee.name || "Unknown employee",
        email: employee.email || "",
        role: employee.role || "employee",
        department: employee.department || "",
        designation: employee.designation || "",
    };
}

function getAttendanceStatus(record) {
    if (!record) {
        return "absent";
    }

    return record.status || "present";
}

function calculateSummary(employees, records) {
    const totalEmployees = employees.length;

    const present = records.filter(
        (record) =>
            record.status === "present" ||
            Boolean(record.checkIn)
    ).length;

    const checkedIn = records.filter(
        (record) => Boolean(record.checkIn)
    ).length;

    const checkedOut = records.filter(
        (record) => Boolean(record.checkOut)
    ).length;

    const absent = records.filter(
        (record) => record.status === "absent"
    ).length;

    const onLeave = records.filter(
        (record) => record.status === "leave" ||
            record.status === "on_leave"
    ).length;

    return {
        totalEmployees,
        total: totalEmployees,
        present,
        absent,
        checkedIn,
        checkedOut,
        onLeave,
    };
}

// GET /api/cto-md/employees
// Active employees from all departments.
router.get("/employees", async (req, res) => {
    try {
        const employees = await User.find(
            COMPANY_EMPLOYEE_FILTER
        )
            .select(
                "name email role department designation joiningDate isActive"
            )
            .sort({ name: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: employees.length,
            employees: employees.map((employee) => ({
                id: employee._id.toString(),
                name: employee.name,
                email: employee.email,
                role: employee.role,
                department: employee.department,
                designation: employee.designation,
                joiningDate: employee.joiningDate,
                status: employee.isActive === false
                    ? "Inactive"
                    : "Active",
            })),
        });
    } catch (error) {
        console.error(
            "CTO/MD company employees error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch company employees.",
        });
    }
});

// GET /api/cto-md/company-attendance
//
// Supports:
// ?date=YYYY-MM-DD&view=daily
// ?month=YYYY-MM&view=monthly
//
// Daily view includes active employees without an attendance
// record, so the frontend can show them as absent.
router.get("/company-attendance", async (req, res) => {
    try {
        const view = req.query.view === "monthly"
            ? "monthly"
            : "daily";

        const department =
            typeof req.query.department === "string"
                ? req.query.department.trim()
                : "";

        const date = req.query.date || getToday();

        const month = req.query.month ||
            date.slice(0, 7);

        if (!isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Date must use YYYY-MM-DD format.",
            });
        }

        if (!isValidMonth(month)) {
            return res.status(400).json({
                success: false,
                message: "Month must use YYYY-MM format.",
            });
        }

        const employeeFilter = {
            ...COMPANY_EMPLOYEE_FILTER,
        };

        if (department) {
            employeeFilter.department = department;
        }

        const employees = await User.find(employeeFilter)
            .select(
                "name email role department designation isActive"
            )
            .sort({ name: 1 })
            .lean();

        const employeeIds = employees.map(
            (employee) => employee._id
        );

        const attendanceDateFilter = view === "monthly"
            ? getMonthDateRange(month)
            : date;

        const attendanceQuery = {
            userId: {
                $in: employeeIds,
            },
            date: attendanceDateFilter,
        };

        const attendanceRecords = await Attendance.find(
            attendanceQuery
        )
            .populate(
                "userId",
                "name email role department designation"
            )
            .sort({
                date: 1,
                checkIn: 1,
            })
            .lean();

        let records;

        if (view === "daily") {
            const attendanceByUserId = new Map();

            for (const record of attendanceRecords) {
                if (record.userId?._id) {
                    attendanceByUserId.set(
                        String(record.userId._id),
                        record
                    );
                }
            }

            records = employees.map((employee) => {
                const employeeId = getEmployeeId(employee);

                const attendance = attendanceByUserId.get(
                    employeeId
                );

                if (attendance) {
                    return {
                        ...attendance,
                        userId: getEmployeeDetails(employee),
                        employee: getEmployeeDetails(employee),
                        date,
                        status: getAttendanceStatus(attendance),
                    };
                }

                return {
                    _id: `absent-${employeeId}-${date}`,
                    userId: getEmployeeDetails(employee),
                    employee: getEmployeeDetails(employee),
                    date,
                    status: "absent",
                    checkIn: null,
                    checkOut: null,
                    workedMinutes: 0,
                };
            });
        } else {
            records = attendanceRecords.map((record) => {
                const employee = record.userId;

                return {
                    ...record,
                    employee: employee
                        ? getEmployeeDetails(employee)
                        : null,
                };
            });
        }

        const summary = view === "daily"
            ? calculateSummary(employees, records)
            : {
                totalEmployees: employees.length,
                total: employees.length,
                attendanceRecords: records.length,
                present: records.filter(
                    (record) =>
                        record.status === "present" ||
                        Boolean(record.checkIn)
                ).length,
                absent: Math.max(
                    0,
                    employees.length -
                    new Set(
                        records
                            .filter(
                                (record) =>
                                    record.checkIn ||
                                    record.status === "present"
                            )
                            .map((record) =>
                                String(
                                    record.userId?._id ||
                                    record.userId?.id ||
                                    record.userId
                                )
                            )
                    ).size
                ),
                checkedIn: records.filter(
                    (record) => Boolean(record.checkIn)
                ).length,
                checkedOut: records.filter(
                    (record) => Boolean(record.checkOut)
                ).length,
            };

        return res.status(200).json({
            success: true,
            view,
            date: view === "daily" ? date : undefined,
            month,
            employees,
            records,
            summary,
        });
    } catch (error) {
        console.error(
            "CTO/MD company attendance error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch company attendance.",
        });
    }
});

module.exports = router;
