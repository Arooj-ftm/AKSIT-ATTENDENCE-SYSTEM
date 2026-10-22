
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const MIN_PASSWORD_LENGTH = 12;

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required.",
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+password");

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured.",
            });
        }

        const token = jwt.sign(
            { id: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                designation: user.designation,
                mustChangePassword: Boolean(user.mustChangePassword),
            },
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to log in.",
        });
    }
});

// CHANGE PASSWORD
// Existing password functionality is unchanged.
router.post("/change-password", authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};

        if (
            typeof currentPassword !== "string" ||
            !currentPassword ||
            typeof newPassword !== "string" ||
            !newPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required.",
            });
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
            });
        }

        const user = await User.findById(req.user._id).select("+password");

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Your account is unavailable. Please log in again.",
            });
        }

        const currentPasswordMatches = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!currentPasswordMatches) {
            return res.status(400).json({
                success: false,
                message: "Your current password is incorrect.",
            });
        }

        const samePassword = await bcrypt.compare(
            newPassword,
            user.password
        );

        if (samePassword) {
            return res.status(400).json({
                success: false,
                message: "Your new password must be different from your current password.",
            });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        user.mustChangePassword = false;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                mustChangePassword: false,
            },
        });
    } catch (error) {
        console.error("Change password error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to change the password.",
        });
    }
});

// UPDATE PROFILE
// Only the authenticated user's name and email can be updated.
router.patch("/profile", authenticate, async (req, res) => {
    try {
        const { name, email } = req.body || {};

        if (
            typeof name !== "string" ||
            typeof email !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required.",
            });
        }

        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (trimmedName.length < 2 || trimmedName.length > 80) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 80 characters.",
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            normalizedEmail.length > 254 ||
            !emailPattern.test(normalizedEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
            });
        }

        const user = await User.findById(req.user._id);

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Your account is unavailable. Please log in again.",
            });
        }

        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id },
        }).select("_id");

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "This email address is already in use.",
            });
        }

        // Explicitly update only these two fields.
        user.name = trimmedName;
        user.email = normalizedEmail;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                designation: user.designation,
                mustChangePassword: Boolean(user.mustChangePassword),
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This email address is already in use.",
            });
        }

        console.error("Profile update error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update your profile.",
        });
    }
});

// CURRENT USER
router.get("/me", authenticate, (req, res) => {
    const user = req.user;

    return res.json({
        success: true,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            designation: user.designation,
            mustChangePassword: Boolean(user.mustChangePassword),
        },
    });
});

module.exports = router;
