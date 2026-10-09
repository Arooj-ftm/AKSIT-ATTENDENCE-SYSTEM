
/*
  Task structure

  - plannedHoursByEmployee = har employee ka alag target
  - timeEntries = har employee ki daily working entries
  - 15% allowance = individual planned hours ka 15%
*/

export const initialTasks = [];

/* =========================================
   TASK STATUS
========================================= */

export const TASK_STATUS = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    OVERDUE: "Overdue",
};

/* =========================================
   CREATE NEW TASK
========================================= */

export function createTask({
    title,
    description = "",
    managerId,
    employeeIds = [],
    deadline,
    plannedHours = 0,
    plannedHoursByEmployee = {},
}) {
    const individualHours = {};

    employeeIds.forEach((employeeId) => {
        const value = plannedHoursByEmployee[employeeId];

        individualHours[employeeId] =
            value !== undefined && value !== ""
                ? Number(value) || 0
                : Number(plannedHours) || 0;
    });

    return {
        id: Date.now(),
        title: title.trim(),
        description: description.trim(),
        managerId,
        employeeIds,
        createdAt: new Date().toISOString().split("T")[0],
        deadline,

        // Backward compatibility with older tasks
        plannedHours: Number(plannedHours) || 0,

        // New: each employee has an individual target
        plannedHoursByEmployee: individualHours,

        status: TASK_STATUS.TODO,
        timeEntries: {},
    };
}

/* =========================================
   GET EMPLOYEE PLANNED HOURS
========================================= */

export function getEmployeePlannedHours(task, employeeId) {
    const individualHours =
        task?.plannedHoursByEmployee?.[employeeId];

    // Use individual target if set
    if (individualHours !== undefined && individualHours !== "") {
        return Math.max(0, Number(individualHours) || 0);
    }

    // Fallback for older tasks
    return Math.max(0, Number(task?.plannedHours) || 0);
}

/* =========================================
   CALCULATE HOURS FROM TIME ENTRY
========================================= */

export function calculateEntryHours(startTime, endTime) {
    if (!startTime || !endTime) {
        return 0;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    // Entries ending before or at start time are invalid
    if (end <= start) {
        return 0;
    }

    return (end - start) / 60;
}

/* =========================================
   EMPLOYEE TOTAL HOURS
========================================= */

export function getEmployeeHours(task, employeeId) {
    const entries = task?.timeEntries?.[employeeId] || [];

    return entries.reduce((total, entry) => {
        // Incomplete entries are not counted
        if (!entry.startTime || !entry.endTime) {
            return total;
        }

        const hours = calculateEntryHours(
            entry.startTime,
            entry.endTime
        );

        return total + hours;
    }, 0);
}

/* =========================================
   EMPLOYEE DAILY HOURS
========================================= */

export function getEmployeeDailyHours(task, employeeId, date) {
    const entries = task?.timeEntries?.[employeeId] || [];

    return entries.reduce((total, entry) => {
        if (entry.date !== date) {
            return total;
        }

        if (!entry.startTime || !entry.endTime) {
            return total;
        }

        return (
            total +
            calculateEntryHours(entry.startTime, entry.endTime)
        );
    }, 0);
}

/* =========================================
   EMPLOYEE TIME ALLOWANCE
   Planned hours + 15%
========================================= */

export function getEmployeeAllowedHours(task, employeeId) {
    const planned = getEmployeePlannedHours(task, employeeId);

    return planned * 1.15;
}

/* =========================================
   CHECK IF EMPLOYEE EXCEEDED ALLOWANCE
========================================= */

export function hasExceededEmployeeAllowance(task, employeeId) {
    const planned = getEmployeePlannedHours(task, employeeId);

    if (planned <= 0) {
        return false;
    }

    const worked = getEmployeeHours(task, employeeId);
    const allowed = getEmployeeAllowedHours(task, employeeId);

    return worked > allowed;
}

/* =========================================
   EMPLOYEE PROGRESS
========================================= */

export function getEmployeeProgress(task, employeeId) {
    const planned = getEmployeePlannedHours(task, employeeId);

    if (planned <= 0) {
        return 0;
    }

    const worked = getEmployeeHours(task, employeeId);
    const progress = (worked / planned) * 100;

    return Math.min(100, Math.round(progress));
}

/* =========================================
   OVERALL TASK PROGRESS
   Average of individual employee progress
========================================= */

export function getTaskProgress(task) {
    const employeeIds = task?.employeeIds || [];

    if (employeeIds.length === 0) {
        return 0;
    }

    const totalProgress = employeeIds.reduce(
        (total, employeeId) =>
            total + getEmployeeProgress(task, employeeId),
        0
    );

    return Math.round(totalProgress / employeeIds.length);
}

/* =========================================
   VALID TIME ENTRY
========================================= */

export function isValidTimeEntry(entry) {
    return Boolean(
        entry &&
        entry.date &&
        entry.startTime &&
        entry.endTime &&
        calculateEntryHours(entry.startTime, entry.endTime) > 0
    );
}

/* =========================================
   TASK STATUS
========================================= */


// Date-only deadline ko company ke closing time, 5 PM, par set karo.
function getDeadlineAtWorkdayEnd(deadline) {
    if (!deadline) return null;

    const datePart = String(deadline).slice(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);

    if (!year || !month || !day) return null;

    // Local time: 5:00 PM
    return new Date(year, month - 1, day, 17, 0, 0, 0);
}

export function getTaskStatus(task) {
    const progress = getTaskProgress(task);

    if (progress >= 100) {
        return TASK_STATUS.COMPLETED;
    }

    const deadlineAt = getDeadlineAtWorkdayEnd(task.deadline);

    if (deadlineAt && new Date() > deadlineAt) {
        return TASK_STATUS.OVERDUE;
    }

    if (progress > 0) {
        return TASK_STATUS.IN_PROGRESS;
    }

    return TASK_STATUS.TODO;
}

/* =========================================
   ADD TIME ENTRY
========================================= */

export function addTimeEntry(task, employeeId, entry) {
    const currentEntries = task?.timeEntries?.[employeeId] || [];

    return {
        ...task,
        timeEntries: {
            ...(task.timeEntries || {}),
            [employeeId]: [
                ...currentEntries,
                {
                    ...entry,
                    id: Date.now(),
                },
            ],
        },
    };
}

/* =========================================
   UPDATE TIME ENTRY
========================================= */

export function updateTimeEntry(
    task,
    employeeId,
    entryId,
    updatedEntry
) {
    const currentEntries = task?.timeEntries?.[employeeId] || [];

    return {
        ...task,
        timeEntries: {
            ...(task.timeEntries || {}),
            [employeeId]: currentEntries.map((entry) =>
                entry.id === entryId
                    ? { ...entry, ...updatedEntry }
                    : entry
            ),
        },
    };
}

/* =========================================
   DELETE TIME ENTRY
========================================= */

export function deleteTimeEntry(task, employeeId, entryId) {
    const currentEntries = task?.timeEntries?.[employeeId] || [];

    return {
        ...task,
        timeEntries: {
            ...(task.timeEntries || {}),
            [employeeId]: currentEntries.filter(
                (entry) => entry.id !== entryId
            ),
        },
    };
}