
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        role: {
            type: String,
            enum: [
                "super_admin",
                "cto_md",
                "hr",
                "ceo",
                "manager",
                "employee",
            ],
            default: "employee",
            required: true,
        },

        department: {
            type: String,
            trim: true,
            default: "",
        },

        designation: {
            type: String,
            trim: true,
            default: "",
        },

        // Actual employment joining date.
        // Keep null until the correct date is provided.
        joiningDate: {
            type: Date,
            default: null,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        mustChangePassword: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.User ||
    mongoose.model("User", userSchema);
