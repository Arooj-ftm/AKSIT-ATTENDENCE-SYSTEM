
const express = require("express");

const Holiday = require("../models/Holiday");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requirePasswordChangeComplete);

const HR_ROLES = ["hr"];

function isValidDate(date) {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
}

function validateHolidayFields(body, isUpdate = false) {
    const errors = [];

    if (!isUpdate || body.name !== undefined) {
        if (
            typeof body.name !== "string" ||
            !body.name.trim() ||
            body.name.trim().length > 150
        ) {
            errors.push(
                "Holiday name is required and must not exceed 150 characters."
            );
        }
    }

    if (!isUpdate || body.date !== undefined) {
        if (!isValidDate(body.date)) {
            errors.push("Date must be a valid date in YYYY-MM-DD format.");
        }
    }

    if (!isUpdate || body.type !== undefined) {
        if (
            body.type !== undefined &&
            !["public", "company"].includes(body.type)
        ) {
            errors.push("Type must be public or company.");
        }
    }

    if (body.description !== undefined) {
        if (
            typeof body.description !== "string" ||
            body.description.length > 1000
        ) {
            errors.push(
                "Description must be text and cannot exceed 1000 characters."
            );
        }
    }

    if (
        body.isWorkingDay !== undefined &&
        typeof body.isWorkingDay !== "boolean"
    ) {
        errors.push("isWorkingDay must be true or false.");
    }

    return errors;
}

// GET /api/holidays?year=2026
router.get("/", async (req, res) => {
    try {
        const filter = {};

        if (req.query.year !== undefined) {
            if (!/^\d{4}$/.test(req.query.year)) {
                return res.status(400).json({
                    success: false,
                    message: "Year must use YYYY format.",
                });
            }

            const year = Number(req.query.year);

            if (year < 1900 || year > 9999) {
                return res.status(400).json({
                    success: false,
                    message: "Year must be between 1900 and 9999.",
                });
            }

            filter.date = {
                $gte: `${req.query.year}-01-01`,
                $lt: year === 9999
                    ? "9999-12-32"
                    : `${String(year + 1).padStart(4, "0")}-01-01`,
            };
        }

        const holidays = await Holiday.find(filter)
            .populate("createdBy", "name email")
            .sort({ date: 1 })
            .lean();

        // Older documents without isWorkingDay are non-working holidays.
        const normalizedHolidays = holidays.map((holiday) => ({
            ...holiday,
            isWorkingDay: holiday.isWorkingDay === true,
        }));

        return res.json({
            success: true,
            holidays: normalizedHolidays,
        });
    } catch (error) {
        console.error("Get holidays error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load holidays.",
        });
    }
});

// POST /api/holidays — HR only
router.post(
    "/",
    allowRoles(...HR_ROLES),
    async (req, res) => {
        try {
            const errors = validateHolidayFields(req.body);

            if (errors.length) {
                return res.status(400).json({
                    success: false,
                    message: errors[0],
                    errors,
                });
            }

            const holiday = await Holiday.create({
                name: req.body.name.trim(),
                date: req.body.date,
                type: req.body.type || "public",
                description: (req.body.description || "").trim(),
                isWorkingDay: req.body.isWorkingDay === true,
                createdBy: req.user._id || req.user.id,
            });

            return res.status(201).json({
                success: true,
                message: holiday.isWorkingDay
                    ? "Working day saved successfully."
                    : "Holiday saved successfully.",
                holiday,
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "A holiday or working-day entry already exists for this date.",
                });
            }

            console.error("Create holiday error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to create holiday.",
            });
        }
    }
);

// PATCH /api/holidays/:id — HR only
router.patch(
    "/:id",
    allowRoles(...HR_ROLES),
    async (req, res) => {
        try {
            const allowedFields = [
                "name",
                "date",
                "type",
                "description",
                "isWorkingDay",
            ];

            const updates = {};

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            if (!Object.keys(updates).length) {
                return res.status(400).json({
                    success: false,
                    message: "Provide at least one field to update.",
                });
            }

            const errors = validateHolidayFields(updates, true);

            if (errors.length) {
                return res.status(400).json({
                    success: false,
                    message: errors[0],
                    errors,
                });
            }

            if (updates.name !== undefined) {
                updates.name = updates.name.trim();
            }

            if (updates.description !== undefined) {
                updates.description = updates.description.trim();
            }

            const holiday = await Holiday.findByIdAndUpdate(
                req.params.id,
                { $set: updates },
                {
                    new: true,
                    runValidators: true,
                }
            ).populate("createdBy", "name email");

            if (!holiday) {
                return res.status(404).json({
                    success: false,
                    message: "Holiday not found.",
                });
            }

            return res.json({
                success: true,
                message: "Holiday updated successfully.",
                holiday: {
                    ...holiday.toObject(),
                    isWorkingDay: holiday.isWorkingDay === true,
                },
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "An entry already exists for this date.",
                });
            }

            console.error("Update holiday error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to update holiday.",
            });
        }
    }
);

// DELETE /api/holidays/:id — HR only
router.delete(
    "/:id",
    allowRoles(...HR_ROLES),
    async (req, res) => {
        try {
            const holiday = await Holiday.findByIdAndDelete(
                req.params.id
            );

            if (!holiday) {
                return res.status(404).json({
                    success: false,
                    message: "Holiday not found.",
                });
            }

            return res.json({
                success: true,
                message: "Holiday deleted successfully.",
            });
        } catch (error) {
            console.error("Delete holiday error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to delete holiday.",
            });
        }
    }
);

module.exports = router;
