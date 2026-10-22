
const mongoose = require("mongoose");

const medicalCertificateFileSchema = new mongoose.Schema(
    {
        // Random server-generated filename; never accept a path from the client.
        storageKey: {
            type: String,
            default: "",
            select: false,
        },

        originalName: {
            type: String,
            default: "",
            trim: true,
            maxlength: 255,
        },

        mimeType: {
            type: String,
            default: "",
            trim: true,
        },

        size: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { _id: false }
);

const leaveRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        leaveType: {
            type: String,
            enum: [
                "annual",
                "casual",
                "sick",
                "emergency",
                "half_day",
                "short",
            ],
            required: true,
        },

        startDate: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },

        endDate: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },

        halfDayPeriod: {
            type: String,
            enum: ["", "first_half", "second_half"],
            default: "",
        },

        balanceLeaveType: {
            type: String,
            enum: ["", "annual", "casual", "sick"],
            default: "",
        },

        startTime: {
            type: String,
            default: "",
        },

        endTime: {
            type: String,
            default: "",
        },

        // Legacy field retained for compatibility with older records.
        // New uploads must use medicalCertificateFile.
        medicalCertificate: {
            type: String,
            default: "",
            trim: true,
        },

        // File metadata is private; storageKey is excluded from normal queries.
        medicalCertificateFile: {
            type: medicalCertificateFileSchema,
            default: null,
        },

        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },

        requestedDays: {
            type: Number,
            min: 0,
            default: 0,
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
            index: true,
        },

        approvalStage: {
            type: String,
            enum: ["manager", "hr", "ceo", "completed"],
            default: "hr",
            index: true,
        },

        managerReviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        managerReviewedAt: {
            type: Date,
            default: null,
        },

        managerDecision: {
            type: String,
            enum: ["", "approved", "rejected"],
            default: "",
        },

        managerComment: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        rejectionReason: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        balanceDeducted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

leaveRequestSchema.index({
    userId: 1,
    startDate: 1,
    endDate: 1,
    status: 1,
});

leaveRequestSchema.index({
    approvalStage: 1,
    status: 1,
});

module.exports =
    mongoose.models.LeaveRequest ||
    mongoose.model("LeaveRequest", leaveRequestSchema);
