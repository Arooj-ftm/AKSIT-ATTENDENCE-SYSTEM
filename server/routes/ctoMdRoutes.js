
const express = require("express");

const Attendance = require("../models/Attendance");
const User = require("../models/User");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requirePasswordChangeComplete);

// Company-wide employees; exclude system super admin and CTO/MD.
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

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-");
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

    const [year] = month.split("-").map(Number);

    return year >= 1900 && year <= 9999;
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

    return record.status === "on_leave"
        ? "on_leave"
        : "present";
}

function calculateDailySummary(employees, records) {
    const present = records.filter(
        (record) => record.status === "present"
    ).length;

    const onLeave = records.filter(
        (record) => record.status === "on_leave"
    ).length;

    const absent = records.filter(
        (record) => record.status === "absent"
    ).length;

    const checkedIn = records.filter(
        (record) => Boolean(record.checkIn)
    ).length;

    const checkedOut = records.filter(
        (record) => Boolean(record.checkOut)
    ).length;

    return {
        totalEmployees: employees.length,
        total: employees.length,
        present,
        absent,
        onLeave,
        checkedIn,
        checkedOut,
        attendanceRecords: records.length,
    };
}

// GET /api/cto-md/employees
// Active employees across company departments.
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
        console.error("CTO/MD company employees error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch company employees.",
        });
    }
});

// GET /api/cto-md/company-attendance
//
// Daily:
// ?date=YYYY-MM-DD&view=daily
//
// Monthly:
// ?month=YYYY-MM&view=monthly
//
// Optional:
// &department=Engineering
//
// Accessible to CTO/MD and CEO, as in the existing route.
router.get(
    "/company-attendance",
    allowRoles("cto_md", "ceo"),
    async (req, res) => {
        try {
            const view =
                req.query.view === "monthly"
                    ? "monthly"
                    : "daily";

            const department =
                typeof req.query.department === "string"
                    ? req.query.department.trim()
                    : "";

            const date = req.query.date || getToday();
            const month = req.query.month || date.slice(0, 7);

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

            const attendanceDateFilter =
                view === "monthly"
                    ? getMonthDateRange(month)
                    : date;

            const attendanceRecords = await Attendance.find({
                userId: {
                    $in: employeeIds,
                },
                date: attendanceDateFilter,
            })
                .sort({
                    date: 1,
                    checkIn: 1,
                })
                .lean();

            const employeesById = new Map(
                employees.map((employee) => [
                    getEmployeeId(employee),
                    employee,
                ])
            );

            let records;

            if (view === "daily") {
                const attendanceByUserId = new Map();

                for (const record of attendanceRecords) {
                    attendanceByUserId.set(
                        String(record.userId),
                        record
                    );
                }

                records = employees.map((employee) => {
                    const employeeId = getEmployeeId(employee);
                    const attendance =
                        attendanceByUserId.get(employeeId);

                    const details = getEmployeeDetails(employee);

                    if (attendance) {
                        return {
                            ...attendance,
                            userId: details,
                            employee: details,
                            date,
                            status: getAttendanceStatus(attendance),
                        };
                    }

                    return {
                        _id: `absent-${employeeId}-${date}`,
                        userId: details,
                        employee: details,
                        date,
                        status: "absent",
                        checkIn: null,
                        checkOut: null,
                    };
                });
            } else {
                records = attendanceRecords.map((record) => {
                    const employee = employeesById.get(
                        String(record.userId)
                    );

                    const details = employee
                        ? getEmployeeDetails(employee)
                        : null;

                    return {
                        ...record,
                        userId: details || record.userId,
                        employee: details,
                        status: getAttendanceStatus(record),
                    };
                });
            }

            let summary;

            if (view === "daily") {
                summary = calculateDailySummary(
                    employees,
                    records
                );
            } else {
                const presentRecords = records.filter(
                    (record) => record.status === "present"
                );

                const leaveRecords = records.filter(
                    (record) => record.status === "on_leave"
                );

                const employeesWithAttendance = new Set(
                    records.map((record) => {
                        const id =
                            record.employee?.id ||
                            record.employee?._id ||
                            record.userId?.id ||
                            record.userId?._id ||
                            record.userId;

                        return String(id);
                    })
                );

                summary = {
                    totalEmployees: employees.length,
                    total: employees.length,
                    attendanceRecords: records.length,
                    present: presentRecords.length,
                    onLeave: leaveRecords.length,
                    absent: Math.max(
                        0,
                        employees.length -
                            employeesWithAttendance.size
                    ),
                    checkedIn: records.filter(
                        (record) => Boolean(record.checkIn)
                    ).length,
                    checkedOut: records.filter(
                        (record) => Boolean(record.checkOut)
                    ).length,
                };
            }

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
            console.error("Company attendance error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to fetch company attendance.",
            });
        }
    }
);

module.exports = router;
