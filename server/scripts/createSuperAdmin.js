
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");

async function createSuperAdmin() {
    try {
        const { SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } =
            process.env;

        if (!SUPER_ADMIN_NAME || !SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
            throw new Error(
                "Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env"
            );
        }

        if (SUPER_ADMIN_PASSWORD.length < 12) {
            throw new Error(
                "Super Admin password must be at least 12 characters."
            );
        }

        await connectDB();

        const existingAdmin = await User.findOne({
            role: "super_admin",
        });

        if (existingAdmin) {
            console.log("A Super Admin already exists. No account was created.");
            return;
        }

        const email = SUPER_ADMIN_EMAIL.trim().toLowerCase();
        const existingEmail = await User.findOne({ email });

        if (existingEmail) {
            throw new Error(
                "This email already belongs to another account. Use a different email."
            );
        }

        const password = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

        await User.create({
            name: SUPER_ADMIN_NAME.trim(),
            email,
            password,
            role: "super_admin",
            designation: "Super Admin",
            mustChangePassword: false,
        });

        console.log("Super Admin created successfully.");
    } catch (error) {
        console.error("Super Admin setup failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(() => { });
    }
}

createSuperAdmin();
