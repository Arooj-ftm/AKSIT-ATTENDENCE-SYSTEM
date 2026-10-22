
const express = require("express");
const mongoose = require("mongoose");

const Holiday = require("../models/Holiday");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const router = express.Router();

// Authentication and mandatory password change enforcement.
router.use(authenticate, requirePasswordChangeComplete);

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message,
    });
}

function isValidDate(value) {
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
}

function validateHolidayFields(body, partial = false) {
    const { name, date, type, description } = body;

    if (!partial || name !== undefined) {
        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 150
        ) {
            return "Holiday name is required and must not exceed 150 characters.";
        }
    }

    if (!partial || date !== undefined) {
        if (!isValidDate(date)) {
            return "Provide a valid holiday date in YYYY-MM-DD format.";
        }
    }

    if (type !== undefined) {
        if (!["public", "company"].includes(type)) {
            return "Holiday type must be public or company.";
        }
    } else if (!partial) {
        return "Holiday type is required.";
    }

    if (description !== undefined) {
        if (
            typeof description !== "string" ||
            description.length > 500
        ) {
            return "Description must not exceed 500 characters.";
        }
    }

    return null;
}

function handleDatabaseError(res, error) {
    if (error.code === 11000) {
        return sendError(
            res,
            409,
            "A holiday already exists for this date."
        );
    }

    console.error("Holiday route error:", error.message);

    return sendError(
        res,
        500,
        "Unable to process holiday request."
    );
}

/*
 * GET ALL HOLIDAYS
 * GET /api/holidays
 *
 * Optional query: ?year=2027
 *
 * All authenticated users whose password change is complete
 * can view holidays.
 */
router.get("/", async (req, res) => {
    try {
        const filter = {};

        if (req.query.year !== undefined) {
            const yearText = String(req.query.year);

            if (!/^\d{4}$/.test(yearText)) {
                return sendError(
                    res,
                    400,
                    "Year must be provided in YYYY format."
                );
            }

            const year = Number(yearText);

            if (year < 2000 || year > 9999) {
                return sendError(
                    res,
                    400,
                    "Invalid holiday year."
                );
            }

            filter.date = {
                $gte: `${year}-01-01`,
                $lte: `${year}-12-31`,
            };
        }

        const holidays = await Holiday.find(filter)
            .populate("createdBy", "name email role")
            .sort({ date: 1, name: 1 })
            .lean();

        return res.json({
            success: true,
            count: holidays.length,
            holidays,
        });
    } catch (error) {
        return handleDatabaseError(res, error);
    }
});

/*
 * CREATE HOLIDAY
 * POST /api/holidays
 *
 * HR only.
 */
router.post("/", allowRoles("hr"), async (req, res) => {
    try {
        const validationError = validateHolidayFields(req.body);

        if (validationError) {
            return sendError(res, 400, validationError);
        }

        const holiday = await Holiday.create({
            name: req.body.name.trim(),
            date: req.body.date,
            type: req.body.type,
            description: (req.body.description || "").trim(),
            createdBy: req.user._id || req.user.id,
        });

        const populatedHoliday = await Holiday.findById(holiday._id)
            .populate("createdBy", "name email role")
            .lean();

        return res.status(201).json({
            success: true,
            message: "Holiday created successfully.",
            holiday: populatedHoliday,
        });
    } catch (error) {
        return handleDatabaseError(res, error);
    }
});

/*
 * UPDATE HOLIDAY
 * PATCH /api/holidays/:id
 *
 * HR only.
 */
router.patch("/:id", allowRoles("hr"), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return sendError(res, 400, "Invalid holiday ID.");
        }

        const allowedFields = [
            "name",
            "date",
            "type",
            "description",
        ];

        const submittedFields = Object.keys(req.body);

        if (
            submittedFields.length === 0 ||
            submittedFields.some(
                (field) => !allowedFields.includes(field)
            )
        ) {
            return sendError(
                res,
                400,
                "Provide valid holiday fields to update."
            );
        }

        const validationError = validateHolidayFields(
            req.body,
            true
        );

        if (validationError) {
            return sendError(res, 400, validationError);
        }

        const updates = {};

        if (req.body.name !== undefined) {
            updates.name = req.body.name.trim();
        }

        if (req.body.date !== undefined) {
            updates.date = req.body.date;
        }

        if (req.body.type !== undefined) {
            updates.type = req.body.type;
        }

        if (req.body.description !== undefined) {
            updates.description = req.body.description.trim();
        }

        const holiday = await Holiday.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                new: true,
                runValidators: true,
            }
        )
            .populate("createdBy", "name email role")
            .lean();

        if (!holiday) {
            return sendError(res, 404, "Holiday not found.");
        }

        return res.json({
            success: true,
            message: "Holiday updated successfully.",
            holiday,
        });
    } catch (error) {
        return handleDatabaseError(res, error);
    }
});

/*
 * DELETE HOLIDAY
 * DELETE /api/holidays/:id
 *
 * HR only.
 */
router.delete("/:id", allowRoles("hr"), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return sendError(res, 400, "Invalid holiday ID.");
        }

        const holiday = await Holiday.findByIdAndDelete(
            req.params.id
        );

        if (!holiday) {
            return sendError(res, 404, "Holiday not found.");
        }

        return res.json({
            success: true,
            message: "Holiday deleted successfully.",
            holidayId: holiday._id,
        });
    } catch (error) {
        return handleDatabaseError(res, error);
    }
});

module.exports = router;
