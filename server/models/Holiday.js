
const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Holiday name is required."],
            trim: true,
            maxlength: [150, "Holiday name cannot exceed 150 characters."],
        },

        date: {
            type: String,
            required: [true, "Holiday date is required."],
            match: [
                /^\d{4}-\d{2}-\d{2}$/,
                "Date must use YYYY-MM-DD format.",
            ],

        },

        type: {
            type: String,
            enum: ["public", "company"],
            required: [true, "Holiday type is required."],
            default: "public",
        },

        description: {
            type: String,
            trim: true,
            maxlength: [500, "Description cannot exceed 500 characters."],
            default: "",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent duplicate holidays on the same date.
holidaySchema.index({ date: 1 }, { unique: true });

module.exports =
    mongoose.models.Holiday ||
    mongoose.model("Holiday", holidaySchema);
