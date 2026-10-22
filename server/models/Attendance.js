
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
            index: true,
        },

        checkIn: {
            type: Date,
            default: null,
        },

        checkOut: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: ["present", "on_leave"],
            default: "present",
        },
    },
    {
        timestamps: true,
    }
);

// An employee can have only one attendance record per day.
attendanceSchema.index(
    { userId: 1, date: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.Attendance ||
    mongoose.model("Attendance", attendanceSchema);
