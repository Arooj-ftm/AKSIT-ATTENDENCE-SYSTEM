const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

const ALLOWED_ROLES = [
    "super_admin",
    "cto_md",
    "hr",
    "ceo",
    "manager",
    "employee",
];

// Only Super Admin can manage user accounts.
router.use(
    authenticate,
    allowRoles("super_admin"),
    requirePasswordChangeComplete
);

const safeUser = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || "",
    designation: user.designation || "",
    joiningDate: user.joiningDate || null,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
});

// CREATE ACCOUNT
router.post("/", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            role,
            department = "",
            designation = "",
            joiningDate = null,
        } = req.body || {};

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required.",
            });
        }

        if (password.length < 12) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 12 characters long.",
            });
        }

        const normalizedRole =
            typeof role === "string"
                ? role.trim().toLowerCase()
                : "";

        if (!ALLOWED_ROLES.includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid account role.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Validate joining date on the backend as well.
        let parsedJoiningDate = null;

        if (
            joiningDate !== null &&
            joiningDate !== ""
        ) {
            if (
                typeof joiningDate !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Joining date must be a valid date in YYYY-MM-DD format.",
                });
            }

            const [year, month, day] = joiningDate
                .split("-")
                .map(Number);

            const candidateDate = new Date(
                Date.UTC(year, month - 1, day)
            );

            // Reject impossible dates, such as February 31.
            if (
                candidateDate.getUTCFullYear() !== year ||
                candidateDate.getUTCMonth() !== month - 1 ||
                candidateDate.getUTCDate() !== day
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid joining date.",
                });
            }

            // Compare calendar dates in UTC to avoid timezone issues.
            const today = new Date();
            const todayUTC = new Date(
                Date.UTC(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                )
            );

            if (candidateDate > todayUTC) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Joining date cannot be in the future.",
                });
            }

            parsedJoiningDate = candidateDate;
        }

        const existingUser = await User.findOne({
            email: normalizedEmail,
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message:
                    "An account with this email already exists.",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: normalizedRole,
            department:
                typeof department === "string"
                    ? department.trim()
                    : "",
            designation:
                typeof designation === "string"
                    ? designation.trim()
                    : "",
            joiningDate: parsedJoiningDate,
            isActive: true,
            mustChangePassword: true,
        });

        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user: safeUser(user),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    "An account with this email already exists.",
            });
        }

        console.error("Create user error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create the account.",
        });
    }
});

// LIST ACCOUNTS
router.get("/", async (req, res) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            users: users.map((user) => ({
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department || "",
                designation: user.designation || "",
                joiningDate: user.joiningDate || null,
                isActive: user.isActive,
                mustChangePassword: user.mustChangePassword,
                createdAt: user.createdAt,
            })),
        });
    } catch (error) {
        console.error("Fetch users error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve user accounts.",
        });
    }
});

// RESET PASSWORD — SUPER ADMIN ONLY
router.patch("/:id/reset-password", async (req, res) => {
    try {
        const { password } = req.body || {};

        if (
            typeof password !== "string" ||
            password.length < 12
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "The new password must be at least 12 characters long.",
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found.",
            });
        }

        user.password = await bcrypt.hash(password, 12);
        user.mustChangePassword = true;

        await user.save();

        return res.status(200).json({
            success: true,
            message:
                "Password reset successfully. The account is marked to change its password.",
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                mustChangePassword: user.mustChangePassword,
            },
        });
    } catch (error) {
        console.error("Reset password error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to reset the password.",
        });
    }
});

module.exports = router;
