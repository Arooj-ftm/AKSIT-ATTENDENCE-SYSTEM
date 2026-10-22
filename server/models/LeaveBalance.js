
const mongoose = require("mongoose");

const leaveTypeBalanceSchema = new mongoose.Schema(
    {
        entitled: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        used: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        // Pending requests are tracked separately and do not reduce
        // the available balance until approval.
        pending: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
    },
    {
        _id: false,
    }
);

const leaveBalanceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        year: {
            type: Number,
            required: true,
            min: 2000,
            index: true,
        },

        annual: {
            type: leaveTypeBalanceSchema,
            default: () => ({ entitled: 0, used: 0, pending: 0 }),
        },

        casual: {
            type: leaveTypeBalanceSchema,
            default: () => ({ entitled: 10, used: 0, pending: 0 }),
        },

        sick: {
            type: leaveTypeBalanceSchema,
            default: () => ({ entitled: 8, used: 0, pending: 0 }),
        },

        // Emergency leave is tracked separately.
        // Its paid entitlement must follow the company's approval policy.
        emergency: {
            type: leaveTypeBalanceSchema,
            default: () => ({ entitled: 0, used: 0, pending: 0 }),
        },
    },
    {
        timestamps: true,
    }
);

// One balance record per user per calendar year.
leaveBalanceSchema.index(
    { userId: 1, year: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.LeaveBalance ||
    mongoose.model("LeaveBalance", leaveBalanceSchema);
