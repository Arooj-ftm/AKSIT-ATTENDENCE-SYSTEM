
const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requirePasswordChangeComplete);

const MANAGER = "manager";
const EMPLOYEE = "employee";
const CTO_MD = "cto_md";

const MONITOR_ROLES = [
    "hr",
    "ceo",
    "super_admin",
    CTO_MD,
];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (value) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDeadline = (value) => {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
};

const deadlineHasPassed = (deadline) => {
    if (!deadline) return false;

    const endOfDay = new Date(deadline);
    endOfDay.setHours(23, 59, 59, 999);

    return Date.now() > endOfDay.getTime();
};

const isValidTime = (value) =>
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isValidDateString = (value) => {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
};

const isMonitor = (role) => MONITOR_ROLES.includes(role);

const canManageTask = (task, user) =>
    user.role === MANAGER &&
    String(task.managerId) === String(user._id) &&
    String(task.department).trim().toLowerCase() ===
    String(user.department || "").trim().toLowerCase();

const canEditTask = (task, user) =>
    user.role === CTO_MD || canManageTask(task, user);

const isAssignedEmployee = (task, user) =>
    user.role === EMPLOYEE &&
    task.assignments.some(
        (assignment) =>
            String(
                assignment.employeeId?._id ||
                assignment.employeeId
            ) === String(user._id)
    );

const canViewTask = (task, user) =>
    canManageTask(task, user) ||
    isAssignedEmployee(task, user) ||
    isMonitor(user.role);

const getAssignment = (task, employeeId) =>
    task.assignments.find(
        (assignment) =>
            String(
                assignment.employeeId?._id ||
                assignment.employeeId
            ) === String(employeeId)
    );

const taskForEmployee = (task, employeeId) => {
    const object = task.toObject
        ? task.toObject()
        : { ...task };

    object.assignments = (object.assignments || []).filter(
        (assignment) =>
            String(
                assignment.employeeId?._id ||
                assignment.employeeId
            ) === String(employeeId)
    );

    object.timeEntries = (object.timeEntries || []).filter(
        (entry) =>
            String(
                entry.employeeId?._id ||
                entry.employeeId
            ) === String(employeeId)
    );

    object.dailyReports = (object.dailyReports || []).filter(
        (report) =>
            String(
                report.employeeId?._id ||
                report.employeeId
            ) === String(employeeId)
    );

    return object;
};

const findActiveTask = async (id) => {
    if (!isValidId(id)) return null;

    return Task.findOne({
        _id: id,
        isDeleted: false,
    });
};

/*
 * Managers can assign active employees from their own department.
 * CTO / Managing Director can assign active employees company-wide.
 */
const getEligibleEmployees = async (
    department,
    ids,
    companyWide = false
) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        return [];
    }

    if (!ids.every(isValidId)) return [];

    const filter = {
        _id: { $in: ids },
        role: EMPLOYEE,
        isActive: true,
    };

    if (!companyWide) {
        if (!department) return [];

        filter.department = {
            $regex: `^\\s*${escapeRegex(department)}\\s*$`,
            $options: "i",
        };
    }

    return User.find(filter)
        .select("_id name email department role isActive")
        .lean();
};

const validateAssignments = async (
    department,
    assignments,
    companyWide = false
) => {
    if (!Array.isArray(assignments) || assignments.length === 0) {
        return {
            valid: false,
            message: "Select at least one employee for the task.",
        };
    }

    const ids = assignments.map((item) =>
        String(item?.employeeId || "")
    );

    if (ids.some((id) => !isValidId(id))) {
        return {
            valid: false,
            message: "One or more employee IDs are invalid.",
        };
    }

    if (new Set(ids).size !== ids.length) {
        return {
            valid: false,
            message:
                "An employee cannot be assigned to the same task twice.",
        };
    }

    for (const item of assignments) {
        const hours = Number(item.plannedHours);

        if (!Number.isFinite(hours) || hours < 0.25 || hours > 1000) {
            return {
                valid: false,
                message:
                    "Planned hours must be between 0.25 and 1000.",
            };
        }
    }

    const employees = await getEligibleEmployees(
        department,
        ids,
        companyWide
    );

    if (employees.length !== ids.length) {
        return {
            valid: false,
            message: companyWide
                ? "All selected users must be active employees."
                : "All selected employees must be active employees in your department.",
        };
    }

    return {
        valid: true,
        employees,
        assignments: assignments.map((item) => ({
            employeeId: item.employeeId,
            plannedHours: Number(item.plannedHours),
        })),
    };
};

const validateProgress = (value) => {
    const progress = Number(value);

    return (
        Number.isFinite(progress) &&
        progress >= 0 &&
        progress <= 100
    );
};

const populateTask = (id) =>
    Task.findById(id)
        .populate("managerId", "name email role")
        .populate(
            "assignments.employeeId",
            "name email department role"
        )
        .populate(
            "timeEntries.employeeId",
            "name email department"
        )
        .populate(
            "dailyReports.employeeId",
            "name email department"
        )
        .lean();

// GET /api/tasks
// Managers: their own tasks.
// Employees: their assignments only.
// CTO, HR, CEO and Super Admin: company-wide task visibility.
router.get("/", async (req, res) => {
    try {
        const user = req.user;
        const filter = { isDeleted: false };

        if (user.role === MANAGER) {
            filter.managerId = user._id;
            filter.department = {
                $regex: `^\\s*${escapeRegex(user.department || "")}\\s*$`,
                $options: "i",
            };
        } else if (user.role === EMPLOYEE) {
            filter["assignments.employeeId"] = user._id;
        } else if (!isMonitor(user.role)) {
            return res.status(403).json({
                success: false,
                message: "You cannot access tasks.",
            });
        }

        const tasks = await Task.find(filter)
            .populate("managerId", "name email role")
            .populate(
                "assignments.employeeId",
                "name email department role"
            )
            .populate(
                "dailyReports.employeeId",
                "name email department"
            )
            .populate(
                "timeEntries.employeeId",
                "name email department"
            )
            .sort({ createdAt: -1 })
            .lean();

        const visibleTasks =
            user.role === EMPLOYEE
                ? tasks.map((task) => {
                    task.assignments = (
                        task.assignments || []
                    ).filter(
                        (item) =>
                            String(
                                item.employeeId?._id ||
                                item.employeeId
                            ) === String(user._id)
                    );

                    task.timeEntries = (
                        task.timeEntries || []
                    ).filter(
                        (entry) =>
                            String(
                                entry.employeeId?._id ||
                                entry.employeeId
                            ) === String(user._id)
                    );

                    task.dailyReports = (
                        task.dailyReports || []
                    ).filter(
                        (report) =>
                            String(
                                report.employeeId?._id ||
                                report.employeeId
                            ) === String(user._id)
                    );

                    return task;
                })
                : tasks;

        return res.status(200).json({
            success: true,
            count: visibleTasks.length,
            tasks: visibleTasks,
        });
    } catch (error) {
        console.error("Fetch tasks error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch tasks.",
        });
    }
});

// GET /api/tasks/history/deleted
router.get("/history/deleted", async (req, res) => {
    try {
        const user = req.user;
        const filter = { isDeleted: true };

        if (user.role === MANAGER) {
            filter.managerId = user._id;
            filter.department = {
                $regex: `^\\s*${escapeRegex(user.department || "")}\\s*$`,
                $options: "i",
            };
        } else if (!isMonitor(user.role)) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot access deleted task history.",
            });
        }

        const tasks = await Task.find(filter)
            .populate("managerId", "name email role")
            .populate(
                "deletedBy",
                "name email role"
            )
            .sort({ deletedAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: tasks.length,
            tasks,
        });
    } catch (error) {
        console.error("Deleted task history error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch deleted task history.",
        });
    }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res) => {
    try {
        const task = await findActiveTask(req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found.",
            });
        }

        if (!canViewTask(task, req.user)) {
            return res.status(403).json({
                success: false,
                message: "You cannot access this task.",
            });
        }

        const populatedTask = await populateTask(task._id);

        return res.status(200).json({
            success: true,
            task:
                req.user.role === EMPLOYEE
                    ? taskForEmployee(
                        populatedTask,
                        req.user._id
                    )
                    : populatedTask,
        });
    } catch (error) {
        console.error("Fetch task details error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch task details.",
        });
    }
});

// POST /api/tasks
// Managers create tasks in their own department.
// CTO / Managing Director can create company-wide tasks.
router.post(
    "/",
    allowRoles(MANAGER, CTO_MD),
    async (req, res) => {
        try {
            const {
                title,
                description = "",
                deadline,
                assignments,
                type = "Task",
            } = req.body;

            const isCto = req.user.role === CTO_MD;
            const managerDepartment = String(
                req.user.department || ""
            ).trim();

            if (!isCto && !managerDepartment) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Your account has no department. Contact Super Admin.",
                });
            }

            if (
                typeof title !== "string" ||
                title.trim().length < 2 ||
                title.trim().length > 150
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Task title must be between 2 and 150 characters.",
                });
            }

            if (
                typeof description !== "string" ||
                description.length > 5000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Task description cannot exceed 5000 characters.",
                });
            }

            if (!["Task", "Project"].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: "Task type must be Task or Project.",
                });
            }

            const parsedDeadline = parseDeadline(deadline);

            if (!parsedDeadline) {
                return res.status(400).json({
                    success: false,
                    message: "Provide a valid task deadline.",
                });
            }

            const validation = await validateAssignments(
                managerDepartment,
                assignments,
                isCto
            );

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message,
                });
            }

            /*
             * The Task model has one department field.
             * If a CTO assigns across departments, label the task
             * Company-wide. A task assigned within one department
             * keeps that department's name.
             */
            let department = managerDepartment;

            if (isCto) {
                const departments = [
                    ...new Set(
                        validation.employees
                            .map((employee) =>
                                String(employee.department || "").trim()
                            )
                            .filter(Boolean)
                    ),
                ];

                department =
                    departments.length === 1
                        ? departments[0]
                        : "Company-wide";
            }

            const task = await Task.create({
                title: title.trim(),
                description: description.trim(),
                type,
                managerId: req.user._id,
                department,
                deadline: parsedDeadline,
                assignments: validation.assignments,
            });

            return res.status(201).json({
                success: true,
                message:
                    "Task created and assigned successfully.",
                task: await populateTask(task._id),
            });
        } catch (error) {
            console.error("Create task error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create task.",
            });
        }
    }
);

// PUT /api/tasks/:id
// Managers edit their own tasks.
// CTO / Managing Director can edit any active task.
router.put(
    "/:id",
    allowRoles(MANAGER, CTO_MD),
    async (req, res) => {
        try {
            const task = await findActiveTask(req.params.id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found.",
                });
            }

            if (!canEditTask(task, req.user)) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You can only edit tasks you created.",
                });
            }

            const {
                title,
                description,
                deadline,
                assignments,
                type,
            } = req.body;

            const isCto = req.user.role === CTO_MD;

            if (title !== undefined) {
                if (
                    typeof title !== "string" ||
                    title.trim().length < 2 ||
                    title.trim().length > 150
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Task title must be between 2 and 150 characters.",
                    });
                }

                task.title = title.trim();
            }

            if (description !== undefined) {
                if (
                    typeof description !== "string" ||
                    description.length > 5000
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Task description cannot exceed 5000 characters.",
                    });
                }

                task.description = description.trim();
            }

            if (type !== undefined) {
                if (!["Task", "Project"].includes(type)) {
                    return res.status(400).json({
                        success: false,
                        message: "Task type must be Task or Project.",
                    });
                }

                task.type = type;
            }

            if (deadline !== undefined) {
                const parsedDeadline = parseDeadline(deadline);

                if (!parsedDeadline) {
                    return res.status(400).json({
                        success: false,
                        message: "Provide a valid task deadline.",
                    });
                }

                task.deadline = parsedDeadline;
            }

            if (assignments !== undefined) {
                const validation = await validateAssignments(
                    task.department,
                    assignments,
                    isCto
                );

                if (!validation.valid) {
                    return res.status(400).json({
                        success: false,
                        message: validation.message,
                    });
                }

                const existingAssignmentMap = new Map(
                    task.assignments.map((assignment) => [
                        String(assignment.employeeId),
                        assignment,
                    ])
                );

                const nextEmployeeIds = new Set(
                    validation.assignments.map((assignment) =>
                        String(assignment.employeeId)
                    )
                );

                /*
                 * Preserve previous time entries and reports as audit
                 * history, even if an employee is later unassigned.
                 * Existing assignments retain their progress/status.
                 */
                task.assignments = validation.assignments.map(
                    (assignment) => {
                        const existing =
                            existingAssignmentMap.get(
                                String(assignment.employeeId)
                            );

                        return {
                            employeeId: assignment.employeeId,
                            plannedHours: assignment.plannedHours,
                            status: existing?.status || "To Do",
                            progressPercent:
                                existing?.progressPercent || 0,
                            assignedAt:
                                existing?.assignedAt || new Date(),
                        };
                    }
                );

                /*
                 * If the CTO edits a manager's task, do not change
                 * managerId or department. This preserves its original
                 * owner and the manager's existing task visibility.
                 */
                if (isCto && !task.managerId) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "The original task owner could not be verified.",
                    });
                }
            }

            await task.save();

            return res.status(200).json({
                success: true,
                message: "Task updated successfully.",
                task: await populateTask(task._id),
            });
        } catch (error) {
            console.error("Update task error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update task.",
            });
        }
    }
);

// DELETE /api/tasks/:id
// Managers delete their own tasks; CTO can delete any active task.
// Soft deletion preserves the task snapshot, reports and time entries.
router.delete(
    "/:id",
    allowRoles(MANAGER, CTO_MD),
    async (req, res) => {
        try {
            const task = await findActiveTask(req.params.id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found.",
                });
            }

            if (!canEditTask(task, req.user)) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You can only delete tasks you created.",
                });
            }

            const snapshot = task.toObject();
            delete snapshot.deletedTaskSnapshot;

            task.deletedTaskSnapshot = snapshot;
            task.isDeleted = true;
            task.deletedAt = new Date();
            task.deletedBy = req.user._id;
            task.deletionReason =
                typeof req.body?.reason === "string"
                    ? req.body.reason.trim().slice(0, 500)
                    : req.user.role === CTO_MD
                        ? "Deleted by CTO / Managing Director"
                        : "Deleted by manager";

            await task.save();

            return res.status(200).json({
                success: true,
                message:
                    "Task removed from active lists. Its history has been preserved.",
            });
        } catch (error) {
            console.error("Delete task error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to delete task.",
            });
        }
    }
);

// PATCH /api/tasks/:id/status
// Employees can update their own assignment status.
// Completion is blocked after the deadline.
router.patch(
    "/:id/status",
    allowRoles(EMPLOYEE),
    async (req, res) => {
        try {
            const { status } = req.body;

            const allowedStatuses = [
                "To Do",
                "In Progress",
                "Completed",
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Select a valid task status.",
                });
            }

            const task = await findActiveTask(req.params.id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found.",
                });
            }

            const assignment = getAssignment(
                task,
                req.user._id
            );

            if (!assignment) {
                return res.status(403).json({
                    success: false,
                    message: "This task is not assigned to you.",
                });
            }

            if (
                status === "Completed" &&
                deadlineHasPassed(task.deadline)
            ) {
                return res.status(400).json({
                    success: false,
                    code: "TASK_DEADLINE_PASSED",
                    message:
                        "The deadline has passed. Ask your manager to extend the deadline before completing this task.",
                });
            }

            assignment.status = status;

            if (status === "Completed") {
                assignment.progressPercent = 100;
            } else if (status === "To Do") {
                assignment.progressPercent = 0;
            }

            await task.save();

            return res.status(200).json({
                success: true,
                message: "Task status updated successfully.",
                task: await populateTask(task._id),
            });
        } catch (error) {
            console.error("Update task status error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update task status.",
            });
        }
    }
);

// PATCH /api/tasks/:id/progress
// Employees update their own assignment progress.
router.patch(
    "/:id/progress",
    allowRoles(EMPLOYEE),
    async (req, res) => {
        try {
            const { progressPercent } = req.body;

            if (!validateProgress(progressPercent)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Progress must be a number between 0 and 100.",
                });
            }

            if (Number(progressPercent) === 100) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Submit the task as Completed instead of setting progress directly to 100%.",
                });
            }

            const task = await findActiveTask(req.params.id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found.",
                });
            }

            const assignment = getAssignment(
                task,
                req.user._id
            );

            if (!assignment) {
                return res.status(403).json({
                    success: false,
                    message: "This task is not assigned to you.",
                });
            }

            if (assignment.status === "Completed") {
                return res.status(400).json({
                    success: false,
                    message:
                        "This task is already completed. Contact your manager if it needs to be reopened.",
                });
            }

            assignment.progressPercent = Number(progressPercent);

            if (
                assignment.progressPercent > 0 &&
                assignment.status === "To Do"
            ) {
                assignment.status = "In Progress";
            }

            await task.save();

            return res.status(200).json({
                success: true,
                message: "Progress updated successfully.",
                task: await populateTask(task._id),
            });
        } catch (error) {
            console.error("Update task progress error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update task progress.",
            });
        }
    }
);

// POST /api/tasks/:id/daily-reports
// Employees submit or update their daily report for a date.
router.post(
    "/:id/daily-reports",
    allowRoles(EMPLOYEE),
    async (req, res) => {
        try {
            const {
                date,
                progressPercent,
                workSummary,
                blockers = "",
            } = req.body;

            if (!isValidDateString(date)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Provide a valid date in YYYY-MM-DD format.",
                });
            }

            if (!validateProgress(progressPercent)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Progress must be between 0 and 100.",
                });
            }

            if (
                typeof workSummary !== "string" ||
                !workSummary.trim() ||
                workSummary.trim().length > 3000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Work summary is required and cannot exceed 3000 characters.",
                });
            }

            if (
                typeof blockers !== "string" ||
                blockers.length > 2000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Blockers cannot exceed 2000 characters.",
                });
            }

            const task = await findActiveTask(req.params.id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found.",
                });
            }

            const assignment = getAssignment(
                task,
                req.user._id
            );

            if (!assignment) {
                return res.status(403).json({
                    success: false,
                    message: "This task is not assigned to you.",
                });
            }

            if (assignment.status === "Completed") {
                return res.status(400).json({
                    success: false,
                    message:
                        "This task is already completed and cannot accept new daily reports.",
                });
            }

            const progress = Number(progressPercent);

            if (progress === 100) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Use the task completion action to submit 100% progress.",
                });
            }

            const existingReport = task.dailyReports.find(
                (report) =>
                    String(report.employeeId) ===
                    String(req.user._id) &&
                    report.date === date
            );

            const isUpdating = Boolean(existingReport);

            if (existingReport) {
                existingReport.progressPercent = progress;
                existingReport.workSummary = workSummary.trim();
                existingReport.blockers = blockers.trim();
                existingReport.submittedAt = new Date();
            } else {
                task.dailyReports.push({
                    employeeId: req.user._id,
                    date,
                    progressPercent: progress,
                    workSummary: workSummary.trim(),
                    blockers: blockers.trim(),
                    submittedAt: new Date(),
                });
            }

            assignment.progressPercent = progress;

            if (progress > 0 && assignment.status === "To Do") {
                assignment.status = "In Progress";
            }

            await task.save();

            return res.status(201).json({
                success: true,
                message: isUpdating
                    ? "Daily report updated successfully."
                    : "Daily report submitted successfully.",
                task: await populateTask(task._id),
            });
        } catch (error) {
            console.error("Submit daily report error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to submit daily report.",
            });
        }
    }
);

// POST /api/tasks/:id/time-entries
// Employees log their own working hours.
router.post(
    "/:id/time-entries",
    allowRoles(EMPLOYEE),
    async (req, res) => {
        try {
            const {
                date,
                startTime,
                endTime,
                note = "",
            } = req.body;

            if (!isValidDateString(date)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Provide a valid work date in YYYY-MM-DD format.",
                });
            }

            if (
                !isValidTime(startTime) ||
                !isValidTime(endTime)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Start and end times must use HH:mm format.",
                });
            }

            if (endTime <= startTime) {
                return res.status(400).json({
                    success: false,
                    message:
                        "End time must be later than start time on the same day.",
                });
            }

            if (
                typeof note !== "string" ||
                note.length > 1000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "The work note cannot exceed 1000 characters.",
                });
            }

            const startMinutes =
                Number(startTime.slice(0, 2)) * 60 +
                Number(startTime.slice(3, 5));

            const endMinutes =
                Number(endTime.slice(0, 2)) * 60 +
                Number(endTime.slice(3, 5));

            const workedMinutes = endMinutes - startMinutes;

            const task = await findActiveTask(req.params.id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found.",
                });
            }

            const assignment = getAssignment(
                task,
                req.user._id
            );

            if (!assignment) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You can only log hours for tasks assigned to you.",
                });
            }

            if (assignment.status === "Completed") {
                return res.status(400).json({
                    success: false,
                    message:
                        "This task is completed and cannot accept more time entries.",
                });
            }

            task.timeEntries.push({
                employeeId: req.user._id,
                date,
                startTime,
                endTime,
                workedMinutes,
                note: note.trim(),
            });

            if (assignment.status === "To Do") {
                assignment.status = "In Progress";
            }

            await task.save();

            const totalWorkedMinutes = task.timeEntries
                .filter(
                    (entry) =>
                        String(entry.employeeId) ===
                        String(req.user._id)
                )
                .reduce(
                    (total, entry) =>
                        total + entry.workedMinutes,
                    0
                );

            return res.status(201).json({
                success: true,
                message:
                    "Working hours recorded successfully.",
                workedMinutes,
                totalWorkedMinutes,
                totalWorkedHours: Number(
                    (totalWorkedMinutes / 60).toFixed(2)
                ),
                task: await populateTask(task._id),
            });
        } catch (error) {
            console.error("Log working hours error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to record working hours.",
            });
        }
    }
);

module.exports = router;
