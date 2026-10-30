
const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },

        type: {
            type: String,
            enum: ["public", "company"],
            default: "public",
            required: true,
        },

        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000,
        },

        // false = holiday; attendance is not required.
        // true = working day; normal attendance rules apply.
        // Existing holiday documents without this field are
        // treated as non-working holidays.
        isWorkingDay: {
            type: Boolean,
            default: false,
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

// One holiday entry per calendar date.
holidaySchema.index(
    { date: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.Holiday ||
    mongoose.model("Holiday", holidaySchema);
