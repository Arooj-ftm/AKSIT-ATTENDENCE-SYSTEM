
const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const LeaveRequest = require("../models/LeaveRequest");
const LeaveBalance = require("../models/LeaveBalance");
const Attendance = require("../models/Attendance");
const Holiday = require("../models/Holiday");
const User = require("../models/User");

const {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
} = require("../middleware/auth");

const {
    uploadMedicalCertificate,
    uploadDirectory,
} = require("../middleware/medicalCertificateUpload");

const router = express.Router();

router.use(authenticate, requirePasswordChangeComplete);

const HR_ROLE = "hr";
const CEO_ROLE = "ceo";
const MANAGER_ROLE = "manager";
const CTO_MD_ROLE = "cto_md";

const REQUEST_ROLES = [
    HR_ROLE,
    CEO_ROLE,
    MANAGER_ROLE,
    "employee",
    CTO_MD_ROLE,
];

const BALANCE_TYPES = ["annual", "casual", "sick"];

const LEAVE_TYPES = [
    "annual",
    "casual",
    "sick",
    "emergency",
    "half_day",
    "short",
];

const ACTIVE_LEAVE_STATUSES = ["pending", "approved"];
const DAY_MS = 24 * 60 * 60 * 1000;

function getUserId(req) {
    return String(req.user._id || req.user.id);
}

function getUserRole(req) {
    return String(req.user.role || "").toLowerCase();
}

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

function isValidTime(value) {
    return (
        typeof value === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    );
}

function getDatesInRange(startDate, endDate) {
    const dates = [];
    const current = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
}

function addCalendarDays(dateString, amount) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

function calendarDayCount(startDate, endDate) {
    return getDatesInRange(startDate, endDate).length;
}

function isSunday(dateString) {
    return (
        new Date(`${dateString}T00:00:00.000Z`).getUTCDay() === 0
    );
}

async function getWorkingDates(startDate, endDate) {
    const dates = getDatesInRange(startDate, endDate);

    const holidays = await Holiday.find({
        date: { $in: dates },
    })
        .select("date")
        .lean();

    const holidayDates = new Set(
        holidays.map((holiday) => holiday.date)
    );

    return dates.filter(
        (date) => !isSunday(date) && !holidayDates.has(date)
    );
}

function getAgeInMonths(fromDate, toDate) {
    let months =
        (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
        (toDate.getUTCMonth() - fromDate.getUTCMonth());

    if (toDate.getUTCDate() < fromDate.getUTCDate()) {
        months -= 1;
    }

    return months;
}

function isAnnualLeaveEligible(user) {
    if (!user?.joiningDate) return false;

    const joiningDate = new Date(user.joiningDate);

    if (Number.isNaN(joiningDate.getTime())) return false;

    return getAgeInMonths(joiningDate, new Date()) >= 12;
}

function getAnnualEntitlement(user) {
    return isAnnualLeaveEligible(user) ? 14 : 0;
}

/*
 * Balance deduction policy:
 * - Short leave: no balance deduction.
 * - Half-day: selected annual/casual/sick balance.
 * - Emergency: casual balance.
 * - Annual leave under 4 working days: casual balance.
 * - Other leave: its own balance.
 */
function getChargedBalanceType(request) {
    if (request.leaveType === "short") return null;

    if (request.leaveType === "half_day") {
        return request.balanceLeaveType;
    }

    if (request.leaveType === "emergency") {
        return "casual";
    }

    if (
        request.leaveType === "annual" &&
        Number(request.requestedDays) < 4
    ) {
        return "casual";
    }

    return request.leaveType;
}

async function getOrCreateBalance(user, year) {
    const annualEntitlement = getAnnualEntitlement(user);

    let balance = await LeaveBalance.findOne({
        userId: user._id,
        year,
    });

    if (!balance) {
        try {
            balance = await LeaveBalance.create({
                userId: user._id,
                year,
                annual: {
                    entitled: annualEntitlement,
                    used: 0,
                    pending: 0,
                },
                casual: {
                    entitled: 10,
                    used: 0,
                    pending: 0,
                },
                sick: {
                    entitled: 8,
                    used: 0,
                    pending: 0,
                },
                emergency: {
                    entitled: 0,
                    used: 0,
                    pending: 0,
                },
            });
        } catch (error) {
            if (error.code !== 11000) throw error;

            balance = await LeaveBalance.findOne({
                userId: user._id,
                year,
            });
        }
    }

    if (!balance) {
        throw new Error("Unable to initialize leave balance.");
    }

    if (
        balance.annual.used === 0 &&
        balance.annual.pending === 0 &&
        balance.annual.entitled !== annualEntitlement
    ) {
        balance.annual.entitled = annualEntitlement;
        await balance.save();
    }

    return balance;
}

function getAvailable(balance, type) {
    if (!balance || !BALANCE_TYPES.includes(type)) return 0;

    const item = balance[type];

    return Math.max(0, item.entitled - item.used);
}

async function changePendingBalance(userId, year, type, amount) {
    if (!type || !BALANCE_TYPES.includes(type) || amount === 0) {
        return;
    }

    const balance = await LeaveBalance.findOne({
        userId,
        year,
    });

    if (!balance) {
        throw new Error("Leave balance record not found.");
    }

    const item = balance[type];
    const nextPending = item.pending + amount;

    if (nextPending < 0) {
        throw new Error("Pending leave balance is inconsistent.");
    }

    item.pending = nextPending;
    await balance.save();
}

function getYearFromDate(date) {
    return Number(date.slice(0, 4));
}

function getMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);

    return hours * 60 + minutes;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * Approval routing:
 * - HR and CTO / Managing Director requests go to CEO.
 * - Other requests default to HR.
 */
function getRequestStage(request, owner) {
    if (request.approvalStage) {
        return request.approvalStage;
    }

    const ownerRole = String(owner?.role || "").toLowerCase();

    return [HR_ROLE, CTO_MD_ROLE].includes(ownerRole)
        ? "ceo"
        : "hr";
}

function formatBalance(item) {
    const entitled = Number(item?.entitled || 0);
    const used = Number(item?.used || 0);
    const pending = Number(item?.pending || 0);

    return {
        entitled,
        used,
        pending,
        remaining: Math.max(0, entitled - used),
        availableAfterPending: Math.max(
            0,
            entitled - used - pending
        ),
    };
}

async function findActiveDepartmentManager(user) {
    if (!user?.department || !String(user.department).trim()) {
        return null;
    }

    const departmentPattern =
        `^\\s*${escapeRegex(String(user.department).trim())}\\s*$`;

    return User.findOne({
        _id: { $ne: user._id },
        role: MANAGER_ROLE,
        isActive: true,
        department: {
            $regex: departmentPattern,
            $options: "i",
        },
    })
        .select("_id name email role department")
        .lean();
}

async function getUserForRequest(userId) {
    return User.findById(userId).select(
        "_id name email role department designation joiningDate isActive"
    );
}

async function releaseReservedBalance(request, owner) {
    const chargedType = getChargedBalanceType(request);

    if (!chargedType || !BALANCE_TYPES.includes(chargedType)) {
        return;
    }

    const year = getYearFromDate(request.startDate);
    const balance = await getOrCreateBalance(owner, year);
    const item = balance[chargedType];
    const amount = Number(request.requestedDays || 0);

    if (item.pending < amount) {
        throw new Error(
            "Pending leave balance is inconsistent; cannot safely release reservation."
        );
    }

    item.pending -= amount;
    await balance.save();
}

function populateLeaveRequest(query) {
    return query
        .populate("userId", "name email role department designation")
        .populate("reviewedBy", "name email role")
        .populate("managerReviewedBy", "name email role");
}

/*
 * Delete an uploaded file safely.
 */
async function removeUploadedFile(file) {
    if (!file?.path) return;

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Medical certificate cleanup error:",
                error.message
            );
        }
    }
}

/*
 * Validate the actual file signature in addition to the extension and MIME
 * type checked by Multer. This rejects files with mismatched signatures.
 */
async function validateMedicalCertificateFile(file) {
    if (!file) return true;

    const extension = path.extname(file.originalname).toLowerCase();
    const handle = await fs.open(file.path, "r");

    try {
        const buffer = Buffer.alloc(8);
        const { bytesRead } = await handle.read(buffer, 0, 8, 0);
        const header = buffer.subarray(0, bytesRead);

        if (extension === ".pdf") {
            return (
                file.mimetype === "application/pdf" &&
                header.length >= 5 &&
                header.subarray(0, 5).toString("ascii") === "%PDF-"
            );
        }

        if (extension === ".doc") {
            const expected = Buffer.from([
                0xd0, 0xcf, 0x11, 0xe0,
                0xa1, 0xb1, 0x1a, 0xe1,
            ]);

            return (
                file.mimetype === "application/msword" &&
                header.length === 8 &&
                header.equals(expected)
            );
        }

        if (extension === ".docx") {
            return (
                file.mimetype ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
                header.length >= 4 &&
                header[0] === 0x50 &&
                header[1] === 0x4b &&
                header[2] === 0x03 &&
                header[3] === 0x04
            );
        }

        return false;
    } finally {
        await handle.close();
    }
}

/*
 * Multer wrapper:
 * - Converts upload errors to JSON.
 * - Rejects invalid file signatures.
 * - Cleans up rejected uploads.
 */
function handleMedicalCertificateUpload(req, res, next) {
    uploadMedicalCertificate(req, res, async (error) => {
        if (error) {
            await removeUploadedFile(req.file);

            const limitErrorCodes = [
                "LIMIT_FILE_SIZE",
                "LIMIT_FILE_COUNT",
                "LIMIT_PART_COUNT",
                "LIMIT_FIELD_COUNT",
            ];

            const status = limitErrorCodes.includes(error.code)
                ? 400
                : Number(error.statusCode) || 400;

            return sendError(
                res,
                status,
                error.code === "LIMIT_FILE_SIZE"
                    ? "Medical certificate cannot exceed 5 MB."
                    : error.message ||
                    "Unable to upload medical certificate."
            );
        }

        try {
            if (req.file) {
                const valid =
                    await validateMedicalCertificateFile(req.file);

                if (!valid) {
                    await removeUploadedFile(req.file);
                    req.file = undefined;

                    return sendError(
                        res,
                        400,
                        "The uploaded file does not match its declared PDF, DOC, or DOCX format."
                    );
                }
            }

            return next();
        } catch (validationError) {
            await removeUploadedFile(req.file);
            req.file = undefined;

            console.error(
                "Medical certificate validation error:",
                validationError.message
            );

            return sendError(
                res,
                400,
                "Unable to validate the medical certificate file."
            );
        }
    });
}

/*
 * Find whether the new sick-leave date range creates a streak of at least
 * three consecutive calendar days when combined with pending or approved
 * sick-leave requests.
 *
 * Weekends and holidays count for this certificate rule.
 */
async function requiresSickCertificate(userId, startDate, endDate) {
    const searchStart = addCalendarDays(startDate, -2);
    const searchEnd = addCalendarDays(endDate, 2);

    const existingRequests = await LeaveRequest.find({
        userId,
        leaveType: "sick",
        status: { $in: ACTIVE_LEAVE_STATUSES },
        startDate: { $lte: searchEnd },
        endDate: { $gte: searchStart },
    })
        .select("startDate endDate")
        .lean();

    const ranges = [
        { startDate, endDate },
        ...existingRequests.map((request) => ({
            startDate: request.startDate,
            endDate: request.endDate,
        })),
    ];

    ranges.sort((a, b) => a.startDate.localeCompare(b.startDate));

    let mergedStart = ranges[0].startDate;
    let mergedEnd = ranges[0].endDate;

    for (let index = 1; index < ranges.length; index += 1) {
        const range = ranges[index];
        const dayAfterMergedEnd = addCalendarDays(mergedEnd, 1);

        if (range.startDate <= dayAfterMergedEnd) {
            if (range.endDate > mergedEnd) {
                mergedEnd = range.endDate;
            }
        } else {
            if (calendarDayCount(mergedStart, mergedEnd) >= 3) {
                return true;
            }

            mergedStart = range.startDate;
            mergedEnd = range.endDate;
        }
    }

    return calendarDayCount(mergedStart, mergedEnd) >= 3;
}

/*
 * GET CURRENT USER'S LEAVE BALANCE
 * GET /api/leaves/balance
 */
router.get(
    "/balance",
    allowRoles(...REQUEST_ROLES),
    async (req, res) => {
        try {
            const user = await getUserForRequest(getUserId(req));

            if (!user) {
                return sendError(res, 404, "User not found.");
            }

            const year = new Date().getFullYear();
            const balance = await getOrCreateBalance(user, year);

            return res.json({
                success: true,
                year,
                annualEligible: isAnnualLeaveEligible(user),
                balances: {
                    annual: formatBalance(balance.annual),
                    casual: formatBalance(balance.casual),
                    sick: formatBalance(balance.sick),
                },
            });
        } catch (error) {
            console.error("Get leave balance error:", error.message);

            return sendError(
                res,
                500,
                "Unable to load leave balance."
            );
        }
    }
);

/*
 * GET COMPANY-WIDE LEAVE BALANCES
 * GET /api/leaves/all-balances
 * HR and CEO only.
 */
router.get(
    "/all-balances",
    allowRoles(HR_ROLE, CEO_ROLE),
    async (req, res) => {
        try {
            const year = new Date().getFullYear();

            const users = await User.find({
                role: { $in: REQUEST_ROLES },
            })
                .select(
                    "_id name email role department designation joiningDate"
                )
                .sort({ name: 1 })
                .lean();

            const staffBalances = await Promise.all(
                users.map(async (user) => {
                    const balance = await getOrCreateBalance(user, year);

                    return {
                        userId: String(user._id),
                        name: user.name || "Unnamed User",
                        email: user.email || "",
                        role: String(user.role || "").toLowerCase(),
                        department: user.department || "",
                        designation: user.designation || "",
                        annualEligible: isAnnualLeaveEligible(user),
                        balances: {
                            annual: formatBalance(balance.annual),
                            casual: formatBalance(balance.casual),
                            sick: formatBalance(balance.sick),
                        },
                    };
                })
            );

            return res.json({
                success: true,
                year,
                totalStaff: staffBalances.length,
                balances: staffBalances,
            });
        } catch (error) {
            console.error(
                "Get company leave balances error:",
                error.message
            );

            return sendError(
                res,
                500,
                "Unable to load company leave balances."
            );
        }
    }
);

/*
 * APPLY FOR LEAVE
 * POST /api/leaves
 *
 * Use multipart/form-data if uploading a certificate.
 * File field name: medicalCertificate
 */
router.post(
    "/",
    allowRoles(...REQUEST_ROLES),
    handleMedicalCertificateUpload,
    async (req, res) => {
        let keepUploadedFile = false;

        try {
            const {
                leaveType,
                startDate,
                endDate,
                startTime = "",
                endTime = "",
                halfDayPeriod = "",
                balanceLeaveType = "",
                reason,
            } = req.body;

            const uploadedFile = req.file;

            if (req.body.medicalCertificate !== undefined) {
                return sendError(
                    res,
                    400,
                    "Upload the medical certificate using the medicalCertificate file field. Text references are not accepted."
                );
            }

            if (!LEAVE_TYPES.includes(leaveType)) {
                return sendError(res, 400, "Select a valid leave type.");
            }

            if (uploadedFile && leaveType !== "sick") {
                return sendError(
                    res,
                    400,
                    "Medical certificates can only be attached to Sick Leave requests."
                );
            }

            if (!isValidDate(startDate) || !isValidDate(endDate)) {
                return sendError(
                    res,
                    400,
                    "Dates must use YYYY-MM-DD format."
                );
            }

            if (startDate > endDate) {
                return sendError(
                    res,
                    400,
                    "End date cannot be before start date."
                );
            }

            if (getYearFromDate(startDate) !== getYearFromDate(endDate)) {
                return sendError(
                    res,
                    400,
                    "Submit separate leave requests for different calendar years."
                );
            }

            if (
                typeof reason !== "string" ||
                !reason.trim() ||
                reason.trim().length > 1000
            ) {
                return sendError(
                    res,
                    400,
                    "Please provide a reason of up to 1000 characters."
                );
            }

            /*
             * Casual leave is limited to three inclusive calendar days.
             * This deliberately includes Sundays and holidays.
             */
            if (
                leaveType === "casual" &&
                calendarDayCount(startDate, endDate) > 3
            ) {
                return sendError(
                    res,
                    400,
                    "Casual Leave cannot exceed 3 consecutive calendar days. Submit separate requests if appropriate."
                );
            }

            if (leaveType === "short") {
                if (startDate !== endDate) {
                    return sendError(
                        res,
                        400,
                        "Short Leave must be for a single date."
                    );
                }

                if (
                    !isValidTime(startTime) ||
                    !isValidTime(endTime) ||
                    getMinutes(endTime) <= getMinutes(startTime)
                ) {
                    return sendError(
                        res,
                        400,
                        "Provide valid Short Leave start and end times."
                    );
                }

                if (getMinutes(endTime) - getMinutes(startTime) > 120) {
                    return sendError(
                        res,
                        400,
                        "Short Leave cannot exceed two hours."
                    );
                }
            }

            if (leaveType === "half_day") {
                if (
                    startDate !== endDate ||
                    !["first_half", "second_half"].includes(halfDayPeriod)
                ) {
                    return sendError(
                        res,
                        400,
                        "Half-Day requires one date and a first-half or second-half selection."
                    );
                }

                if (!BALANCE_TYPES.includes(balanceLeaveType)) {
                    return sendError(
                        res,
                        400,
                        "Select Annual, Casual or Sick Leave for the half-day deduction."
                    );
                }
            }

            const user = await getUserForRequest(getUserId(req));

            if (!user) {
                return sendError(res, 404, "User not found.");
            }

            if (user.isActive === false) {
                return sendError(
                    res,
                    403,
                    "Inactive users cannot submit leave requests."
                );
            }

            const year = getYearFromDate(startDate);
            const workingDates = await getWorkingDates(startDate, endDate);

            if (
                ["short", "half_day"].includes(leaveType) &&
                workingDates.length !== 1
            ) {
                return sendError(
                    res,
                    400,
                    "Short Leave and Half-Day can only be requested on a working day."
                );
            }

            if (
                !["short", "half_day"].includes(leaveType) &&
                workingDates.length === 0
            ) {
                return sendError(
                    res,
                    400,
                    "The selected date range contains no working days."
                );
            }

            const requestedDays =
                leaveType === "short"
                    ? 0
                    : leaveType === "half_day"
                        ? 0.5
                        : workingDates.length;

            /*
             * Annual eligibility and notice apply to annual leave requests
             * even if a short annual request is charged to casual balance.
             */
            if (leaveType === "annual") {
                if (!isAnnualLeaveEligible(user)) {
                    return sendError(
                        res,
                        400,
                        "Annual Leave is available after 12 months of continuous employment."
                    );
                }

                const today = new Date().toISOString().slice(0, 10);

                const noticeDays =
                    (
                        new Date(`${startDate}T00:00:00.000Z`).getTime() -
                        new Date(`${today}T00:00:00.000Z`).getTime()
                    ) / DAY_MS;

                if (noticeDays < 12) {
                    return sendError(
                        res,
                        400,
                        "Annual Leave must normally be requested at least 12 days in advance."
                    );
                }
            }

            /*
             * Certificate rule uses calendar-day continuity across this
             * request and existing pending/approved Sick Leave requests.
             */
            if (leaveType === "sick") {
                const certificateRequired =
                    await requiresSickCertificate(
                        user._id,
                        startDate,
                        endDate
                    );

                if (certificateRequired && !uploadedFile) {
                    return sendError(
                        res,
                        400,
                        "A medical certificate is required when Sick Leave reaches 3 consecutive calendar days, including across separate requests."
                    );
                }
            }

            const overlappingRequest = await LeaveRequest.findOne({
                userId: user._id,
                status: { $in: ACTIVE_LEAVE_STATUSES },
                startDate: { $lte: endDate },
                endDate: { $gte: startDate },
            }).lean();

            if (overlappingRequest) {
                return sendError(
                    res,
                    409,
                    "You already have a pending or approved leave request for overlapping dates."
                );
            }

            const balance = await getOrCreateBalance(user, year);

            const chargedType = getChargedBalanceType({
                leaveType,
                requestedDays,
                balanceLeaveType,
            });

            if (chargedType) {
                if (!BALANCE_TYPES.includes(chargedType)) {
                    return sendError(
                        res,
                        400,
                        "Invalid leave balance type."
                    );
                }

                const availableAfterPending =
                    getAvailable(balance, chargedType) -
                    balance[chargedType].pending;

                if (availableAfterPending < requestedDays) {
                    return sendError(
                        res,
                        400,
                        `Insufficient ${chargedType} leave balance. Available after pending requests: ${Math.max(0, availableAfterPending)} day(s).`
                    );
                }
            }

            /*
             * ROUTING FIX:
             * CTO / Managing Director and HR requests go directly to CEO.
             */
            let approvalStage = "hr";

            const applicantRole = String(user.role || "").toLowerCase();

            if ([HR_ROLE, CTO_MD_ROLE].includes(applicantRole)) {
                approvalStage = "ceo";
            } else if (applicantRole === "employee") {
                const manager = await findActiveDepartmentManager(user);

                approvalStage = manager ? "manager" : "hr";
            }

            /*
             * Reserve pending balance before creating the request.
             * If creation fails, release the reservation.
             */
            if (chargedType && requestedDays > 0) {
                const latestBalance = await LeaveBalance.findOne({
                    userId: user._id,
                    year,
                });

                if (!latestBalance) {
                    return sendError(
                        res,
                        500,
                        "Unable to reserve leave balance."
                    );
                }

                const item = latestBalance[chargedType];

                const available =
                    item.entitled - item.used - item.pending;

                if (available < requestedDays) {
                    return sendError(
                        res,
                        409,
                        `Insufficient ${chargedType} leave balance after pending requests.`
                    );
                }

                item.pending += requestedDays;
                await latestBalance.save();
            }

            let request;

            try {
                request = await LeaveRequest.create({
                    userId: user._id,
                    leaveType,
                    startDate,
                    endDate,
                    startTime: leaveType === "short" ? startTime : "",
                    endTime: leaveType === "short" ? endTime : "",
                    halfDayPeriod:
                        leaveType === "half_day" ? halfDayPeriod : "",
                    balanceLeaveType:
                        leaveType === "half_day" ? balanceLeaveType : "",
                    medicalCertificate: "",
                    medicalCertificateFile: uploadedFile
                        ? {
                            storageKey: path.basename(
                                uploadedFile.filename
                            ),
                            originalName: path
                                .basename(uploadedFile.originalname)
                                .slice(0, 255),
                            mimeType: uploadedFile.mimetype,
                            size: uploadedFile.size,
                        }
                        : null,
                    requestedDays,
                    reason: reason.trim(),
                    status: "pending",
                    approvalStage,
                });
            } catch (error) {
                if (chargedType && requestedDays > 0) {
                    await changePendingBalance(
                        user._id,
                        year,
                        chargedType,
                        -requestedDays
                    );
                }

                throw error;
            }

            keepUploadedFile = true;

            const populatedRequest = await populateLeaveRequest(
                LeaveRequest.findById(request._id)
            ).lean();

            return res.status(201).json({
                success: true,
                message:
                    approvalStage === "manager"
                        ? "Leave request submitted to your department manager."
                        : approvalStage === "ceo"
                            ? "Leave request submitted to the CEO."
                            : "Leave request submitted to HR.",
                request: populatedRequest,
            });
        } catch (error) {
            console.error(
                "Create leave request error:",
                error.message
            );

            return sendError(
                res,
                500,
                "Unable to submit leave request."
            );
        } finally {
            if (!keepUploadedFile) {
                await removeUploadedFile(req.file);
            }
        }
    }
);

/*
 * GET PERSONAL LEAVE HISTORY
 * GET /api/leaves/mine
 */
router.get(
    "/mine",
    allowRoles(...REQUEST_ROLES),
    async (req, res) => {
        try {
            const requests = await populateLeaveRequest(
                LeaveRequest.find({
                    userId: getUserId(req),
                }).sort({ createdAt: -1 })
            ).lean();

            return res.json({
                success: true,
                requests,
            });
        } catch (error) {
            console.error("My leave requests error:", error.message);

            return sendError(
                res,
                500,
                "Unable to load your leave requests."
            );
        }
    }
);

/*
 * GET COMPANY-WIDE LEAVE RECORDS
 * GET /api/leaves/company-records
 * HR and CEO only.
 */
router.get(
    "/company-records",
    allowRoles(HR_ROLE, CEO_ROLE),
    async (req, res) => {
        try {
            const users = await User.find({
                role: { $in: REQUEST_ROLES },
            })
                .select("_id")
                .lean();

            const userIds = users.map((user) => user._id);

            const requests = await populateLeaveRequest(
                LeaveRequest.find({
                    userId: { $in: userIds },
                }).sort({ createdAt: -1 })
            ).lean();

            return res.json({
                success: true,
                total: requests.length,
                requests,
            });
        } catch (error) {
            console.error(
                "Company leave records error:",
                error.message
            );

            return sendError(
                res,
                500,
                "Unable to load company leave records."
            );
        }
    }
);

/*
 * APPROVAL QUEUES
 *
 * Manager: active employees in their own department, manager stage only.
 * HR: employee/manager/CEO requests awaiting HR.
 * CEO: HR and CTO / Managing Director requests awaiting CEO.
 */
router.get(
    "/",
    allowRoles(MANAGER_ROLE, HR_ROLE, CEO_ROLE),
    async (req, res) => {
        try {
            const reviewerRole = getUserRole(req);
            const filter = {};

            if (req.query.status !== undefined) {
                if (
                    !["pending", "approved", "rejected"].includes(
                        req.query.status
                    )
                ) {
                    return sendError(
                        res,
                        400,
                        "Invalid leave status."
                    );
                }

                filter.status = req.query.status;
            } else {
                filter.status = "pending";
            }

            if (reviewerRole === MANAGER_ROLE) {
                const manager = await User.findById(getUserId(req))
                    .select("_id role department isActive")
                    .lean();

                if (
                    !manager ||
                    !manager.isActive ||
                    !manager.department ||
                    !String(manager.department).trim()
                ) {
                    return sendError(
                        res,
                        403,
                        "An active manager account with a department is required."
                    );
                }

                const departmentPattern =
                    `^\\s*${escapeRegex(String(manager.department).trim())}\\s*$`;

                const employees = await User.find({
                    role: "employee",
                    isActive: true,
                    department: {
                        $regex: departmentPattern,
                        $options: "i",
                    },
                })
                    .select("_id")
                    .lean();

                filter.userId = {
                    $in: employees.map((employee) => employee._id),
                };

                filter.approvalStage = "manager";
            } else if (reviewerRole === CEO_ROLE) {
                /*
                 * FIX 1:
                 * The previous code referenced undefined `owner` and `stage`
                 * variables in the GET queue handler, causing a server error.
                 *
                 * Restrict the CEO queue to HR and CTO / Managing Director
                 * leave requests, and include legacy records without an
                 * explicitly saved approvalStage.
                 */
                const eligibleUsers = await User.find({
                    role: {
                        $in: [HR_ROLE, CTO_MD_ROLE],
                    },
                })
                    .select("_id")
                    .lean();

                filter.userId = {
                    $in: eligibleUsers.map((user) => user._id),
                };

                filter.$or = [
                    { approvalStage: "ceo" },
                    { approvalStage: { $exists: false } },
                    { approvalStage: null },
                    { approvalStage: "" },
                ];
            } else {
                const eligibleUsers = await User.find({
                    role: {
                        $in: ["employee", MANAGER_ROLE, CEO_ROLE],
                    },
                })
                    .select("_id")
                    .lean();

                filter.userId = {
                    $in: eligibleUsers.map((user) => user._id),
                };

                filter.$or = [
                    { approvalStage: "hr" },
                    { approvalStage: { $exists: false } },
                    { approvalStage: null },
                    { approvalStage: "" },
                ];
            }

            const requests = await populateLeaveRequest(
                LeaveRequest.find(filter).sort({ createdAt: -1 })
            ).lean();

            return res.json({
                success: true,
                requests,
            });
        } catch (error) {
            console.error(
                "Leave approval queue error:",
                error.message
            );

            return sendError(
                res,
                500,
                "Unable to load leave requests."
            );
        }
    }
);

/*
 * DOWNLOAD MEDICAL CERTIFICATE
 * GET /api/leaves/:id/medical-certificate
 *
 * Owner, HR, CEO, or the employee's department manager who is part of
 * the request's manager-review stage may access the file.
 */
router.get(
    "/:id/medical-certificate",
    allowRoles(...REQUEST_ROLES),
    async (req, res) => {
        try {
            if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
                return sendError(
                    res,
                    400,
                    "Invalid leave request ID."
                );
            }

            const request = await LeaveRequest.findById(req.params.id)
                .select("+medicalCertificateFile.storageKey");

            if (!request) {
                return sendError(
                    res,
                    404,
                    "Leave request not found."
                );
            }

            if (!request.medicalCertificateFile?.storageKey) {
                return sendError(
                    res,
                    404,
                    "No uploaded medical certificate exists for this request."
                );
            }

            const requesterId = getUserId(req);
            const requesterRole = getUserRole(req);
            const isOwner = String(request.userId) === requesterId;

            let allowed = isOwner;

            if ([HR_ROLE, CEO_ROLE].includes(requesterRole)) {
                allowed = true;
            }

            if (requesterRole === MANAGER_ROLE && !isOwner) {
                const manager = await User.findById(requesterId)
                    .select("_id role department isActive")
                    .lean();

                const owner = await getUserForRequest(request.userId);

                const sameDepartment =
                    manager?.department &&
                    owner?.department &&
                    String(manager.department).trim().toLowerCase() ===
                    String(owner.department).trim().toLowerCase();

                const participatedInReview =
                    String(request.managerReviewedBy || "") ===
                    requesterId;

                const isCurrentReviewer =
                    request.approvalStage === "manager" &&
                    request.status === "pending";

                allowed = Boolean(
                    manager?.isActive &&
                    owner?.role === "employee" &&
                    sameDepartment &&
                    (participatedInReview || isCurrentReviewer)
                );
            }

            if (!allowed) {
                return sendError(
                    res,
                    403,
                    "You are not authorized to access this medical certificate."
                );
            }

            const storageKey =
                request.medicalCertificateFile.storageKey;

            if (
                typeof storageKey !== "string" ||
                !/^[a-f\d-]{36}\.(pdf|doc|docx)$/i.test(storageKey) ||
                path.basename(storageKey) !== storageKey
            ) {
                return sendError(
                    res,
                    500,
                    "The stored certificate reference is invalid."
                );
            }

            const filePath = path.join(uploadDirectory, storageKey);

            try {
                await fs.access(filePath);
            } catch {
                return sendError(
                    res,
                    404,
                    "The certificate file could not be found on the server."
                );
            }

            const originalName = path.basename(
                request.medicalCertificateFile.originalName ||
                `medical-certificate${path.extname(storageKey)}`
            );

            res.setHeader("Cache-Control", "private, no-store");
            res.setHeader("X-Content-Type-Options", "nosniff");

            return res.download(filePath, originalName, (error) => {
                if (error && !res.headersSent) {
                    console.error(
                        "Medical certificate download error:",
                        error.message
                    );

                    res.status(500).json({
                        success: false,
                        message:
                            "Unable to download medical certificate.",
                    });
                }
            });
        } catch (error) {
            console.error(
                "Medical certificate access error:",
                error.message
            );

            return sendError(
                res,
                500,
                "Unable to access the medical certificate."
            );
        }
    }
);

/*
 * APPROVE OR REJECT
 * PATCH /api/leaves/:id/review
 */
router.patch(
    "/:id/review",
    allowRoles(MANAGER_ROLE, HR_ROLE, CEO_ROLE),
    async (req, res) => {
        try {
            const reviewerRole = getUserRole(req);

            const {
                status,
                rejectionReason = "",
                comment = "",
            } = req.body;

            if (!["approved", "rejected"].includes(status)) {
                return sendError(
                    res,
                    400,
                    "Review status must be approved or rejected."
                );
            }

            if (
                typeof rejectionReason !== "string" ||
                rejectionReason.length > 1000
            ) {
                return sendError(
                    res,
                    400,
                    "Invalid rejection reason."
                );
            }

            if (
                typeof comment !== "string" ||
                comment.length > 1000
            ) {
                return sendError(
                    res,
                    400,
                    "Invalid review comment."
                );
            }

            if (status === "rejected" && !rejectionReason.trim()) {
                return sendError(
                    res,
                    400,
                    "Provide a rejection reason."
                );
            }

            const request = await LeaveRequest.findById(req.params.id);

            if (!request) {
                return sendError(
                    res,
                    404,
                    "Leave request not found."
                );
            }

            if (request.status !== "pending") {
                return sendError(
                    res,
                    409,
                    "This leave request has already been reviewed."
                );
            }

            const owner = await getUserForRequest(request.userId);

            if (
                !owner ||
                !REQUEST_ROLES.includes(
                    String(owner.role || "").toLowerCase()
                )
            ) {
                return sendError(
                    res,
                    403,
                    "This user's leave requests are not part of the approval workflow."
                );
            }

            const stage = getRequestStage(request, owner);

            /*
             * MANAGER REVIEW
             */
            if (reviewerRole === MANAGER_ROLE) {
                if (stage !== "manager") {
                    return sendError(
                        res,
                        403,
                        "This request is not awaiting manager approval."
                    );
                }

                if (owner.role !== "employee") {
                    return sendError(
                        res,
                        403,
                        "Managers can review employee leave requests only."
                    );
                }

                const manager = await User.findById(getUserId(req))
                    .select("_id role department isActive")
                    .lean();

                if (
                    !manager ||
                    !manager.isActive ||
                    !manager.department ||
                    !owner.department ||
                    String(manager.department).trim().toLowerCase() !==
                    String(owner.department).trim().toLowerCase()
                ) {
                    return sendError(
                        res,
                        403,
                        "You can review requests from your own department only."
                    );
                }

                if (status === "approved") {
                    request.managerDecision = "approved";
                    request.managerReviewedBy = getUserId(req);
                    request.managerReviewedAt = new Date();
                    request.managerComment = comment.trim();
                    request.approvalStage = "hr";

                    await request.save();

                    const populatedRequest = await populateLeaveRequest(
                        LeaveRequest.findById(request._id)
                    ).lean();

                    return res.json({
                        success: true,
                        message:
                            "Manager approval recorded. Request forwarded to HR.",
                        request: populatedRequest,
                    });
                }

                await releaseReservedBalance(request, owner);

                request.status = "rejected";
                request.approvalStage = "completed";
                request.managerDecision = "rejected";
                request.managerReviewedBy = getUserId(req);
                request.managerReviewedAt = new Date();
                request.managerComment = comment.trim();
                request.reviewedBy = getUserId(req);
                request.reviewedAt = new Date();
                request.rejectionReason = rejectionReason.trim();

                await request.save();

                const populatedRequest = await populateLeaveRequest(
                    LeaveRequest.findById(request._id)
                ).lean();

                return res.json({
                    success: true,
                    message: "Leave request rejected by manager.",
                    request: populatedRequest,
                });
            }

            /*
             * CEO REVIEW
             *
             * FIX 2:
             * CEO can review HR and CTO / Managing Director requests,
             * but only when they are awaiting CEO approval.
             */
            if (reviewerRole === CEO_ROLE) {
                const ownerRole = String(owner.role || "").toLowerCase();

                if (
                    ![HR_ROLE, CTO_MD_ROLE].includes(ownerRole) ||
                    stage !== "ceo"
                ) {
                    return sendError(
                        res,
                        403,
                        "CEO can review HR and CTO / Managing Director leave requests awaiting CEO approval only."
                    );
                }
            }

            /*
             * HR REVIEW:
             * Employee, manager, and CEO requests awaiting HR.
             */
            if (reviewerRole === HR_ROLE) {
                const ownerRole = String(owner.role || "").toLowerCase();

                if ([HR_ROLE, CTO_MD_ROLE].includes(ownerRole)) {
                    return sendError(
                        res,
                        403,
                        "HR and CTO / Managing Director requests must be reviewed by the CEO."
                    );
                }

                if (
                    !["employee", MANAGER_ROLE, CEO_ROLE].includes(
                        ownerRole
                    )
                ) {
                    return sendError(
                        res,
                        403,
                        "HR cannot review this user's leave request."
                    );
                }

                if (stage !== "hr") {
                    return sendError(
                        res,
                        403,
                        "This request must complete its previous approval stage first."
                    );
                }
            }

            /*
             * FINAL REVIEW
             */
            const year = getYearFromDate(request.startDate);
            const chargedType = getChargedBalanceType(request);
            const requestedDays = Number(request.requestedDays || 0);

            if (status === "approved") {
                const workingDates = await getWorkingDates(
                    request.startDate,
                    request.endDate
                );

                if (
                    !["short", "half_day"].includes(request.leaveType) &&
                    workingDates.length === 0
                ) {
                    return sendError(
                        res,
                        400,
                        "This request has no working days to approve."
                    );
                }

                if (!["short", "half_day"].includes(request.leaveType)) {
                    const conflictingAttendance =
                        await Attendance.findOne({
                            userId: request.userId,
                            date: { $in: workingDates },
                            $or: [
                                { checkIn: { $ne: null } },
                                { checkOut: { $ne: null } },
                            ],
                        }).lean();

                    if (conflictingAttendance) {
                        return sendError(
                            res,
                            409,
                            `Attendance already exists for ${conflictingAttendance.date}. Resolve the attendance conflict before approval.`
                        );
                    }
                }

                let balance = null;

                if (chargedType) {
                    if (request.balanceDeducted) {
                        return sendError(
                            res,
                            409,
                            "This request has already deducted leave balance."
                        );
                    }

                    balance = await getOrCreateBalance(owner, year);

                    const item = balance[chargedType];

                    if (
                        !item ||
                        item.pending < requestedDays ||
                        item.entitled - item.used < requestedDays
                    ) {
                        return sendError(
                            res,
                            409,
                            `The ${chargedType} leave balance or pending reservation is inconsistent. Reconcile the balance before approving.`
                        );
                    }

                    item.used += requestedDays;
                    item.pending -= requestedDays;
                    request.balanceDeducted = true;
                }

                if (balance) {
                    await balance.save();
                }

                request.status = "approved";
                request.approvalStage = "completed";
                request.reviewedBy = getUserId(req);
                request.reviewedAt = new Date();
                request.rejectionReason = "";

                await request.save();

                if (!["short", "half_day"].includes(request.leaveType)) {
                    await Attendance.bulkWrite(
                        workingDates.map((date) => ({
                            updateOne: {
                                filter: {
                                    userId: request.userId,
                                    date,
                                },
                                update: {
                                    $set: {
                                        status: "on_leave",
                                    },
                                    $setOnInsert: {
                                        userId: request.userId,
                                        date,
                                        checkIn: null,
                                        checkOut: null,
                                    },
                                },
                                upsert: true,
                            },
                        })),
                        { ordered: true }
                    );
                }
            } else {
                await releaseReservedBalance(request, owner);

                request.status = "rejected";
                request.approvalStage = "completed";
                request.reviewedBy = getUserId(req);
                request.reviewedAt = new Date();
                request.rejectionReason = rejectionReason.trim();

                await request.save();
            }

            const populatedRequest = await populateLeaveRequest(
                LeaveRequest.findById(request._id)
            ).lean();

            return res.json({
                success: true,
                message:
                    status === "approved"
                        ? "Leave request approved successfully."
                        : "Leave request rejected successfully.",
                request: populatedRequest,
            });
        } catch (error) {
            console.error(
                "Review leave request error:",
                error.message
            );

            return sendError(
                res,
                500,
                "Unable to review leave request."
            );
        }
    }
);

module.exports = router;
