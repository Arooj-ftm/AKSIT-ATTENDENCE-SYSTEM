const mongoose = require("mongoose");

const timeEntrySchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },

        startTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
        },

        endTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
        },

        workedMinutes: {
            type: Number,
            required: true,
            min: 1,
        },

        note: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        loggedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const employeeAssignmentSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        plannedHours: {
            type: Number,
            required: true,
            min: 0.25,
            max: 1000,
        },

        status: {
            type: String,
            enum: ["To Do", "In Progress", "Completed"],
            default: "To Do",
        },

        // Progress belongs to this employee's assignment.
        progressPercent: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },

        assignedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);

const dailyReportSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },

        progressPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },

        workSummary: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 3000,
        },

        blockers: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },

        submittedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 150,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 5000,
            default: "",
        },

        // Existing tasks remain tasks by default.
        type: {
            type: String,
            enum: ["Task", "Project"],
            default: "Task",
        },

        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        department: {
            type: String,
            required: true,
            trim: true,
        },

        assignments: {
            type: [employeeAssignmentSchema],
            required: true,
            validate: {
                validator(assignments) {
                    if (!assignments || assignments.length === 0) {
                        return false;
                    }

                    const employeeIds = assignments.map(
                        (assignment) => String(assignment.employeeId)
                    );

                    return new Set(employeeIds).size === employeeIds.length;
                },
                message:
                    "A task must have at least one employee, without duplicate assignments.",
            },
        },

        deadline: {
            type: Date,
            required: true,
        },

        // Existing time entries remain the source of logged working hours.
        timeEntries: {
            type: [timeEntrySchema],
            default: [],
        },

        // Daily employee progress reports.
        dailyReports: {
            type: [dailyReportSchema],
            default: [],
        },

        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        deletionReason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        // Snapshot retained for audit/history after deletion.
        deletedTaskSnapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

taskSchema.index({
    "assignments.employeeId": 1,
    isDeleted: 1,
});

taskSchema.index({
    deadline: 1,
    isDeleted: 1,
});

taskSchema.index({
    "dailyReports.employeeId": 1,
    "dailyReports.date": 1,
});

module.exports =
    mongoose.models.Task ||
    mongoose.model("Task", taskSchema);
