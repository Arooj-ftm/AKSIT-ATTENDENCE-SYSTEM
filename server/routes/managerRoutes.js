
const express = require("express");
const User = require("../models/User");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

// Only authenticated managers who have completed password setup
// can access manager routes.
router.use(
    authenticate,
    allowRoles("manager"),
    requirePasswordChangeComplete
);

// GET /api/manager/employees
// Return active employees from the logged-in manager's department.
router.get("/employees", async (req, res) => {
    try {
        const department = String(req.user.department || "").trim();

        if (!department) {
            return res.status(400).json({
                success: false,
                message:
                    "Your account does not have a department assigned. Please contact Super Admin.",
            });
        }

        // Escape special regex characters and ignore letter case.
        const escapedDepartment = department.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const employees = await User.find({
            role: "employee",
            isActive: true,
            department: {
                $regex: `^\\s*${escapedDepartment}\\s*$`,
                $options: "i",
            },
        })
            .select(
                "name email role department designation joiningDate isActive"
            )
            .sort({ name: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            department,
            count: employees.length,
            employees: employees.map((employee) => ({
                id: employee._id.toString(),
                name: employee.name,
                email: employee.email,
                role: employee.role,
                department: employee.department,
                designation: employee.designation,
                joiningDate: employee.joiningDate,
                status: employee.isActive ? "Active" : "Inactive",
            })),
        });
    } catch (error) {
        console.error("Manager department employees error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch department employees.",
        });
    }
});

module.exports = router;
