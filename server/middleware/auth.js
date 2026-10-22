
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in first.",
            });
        }

        const token = header.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please log in first.",
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured.",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account not found or deactivated.",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Your session has expired. Please log in again.",
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }
}

function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action.",
            });
        }

        next();
    };
}

// Block normal protected API requests until a temporary password
// has been replaced. Apply this middleware only to protected routes.
function requirePasswordChangeComplete(req, res, next) {
    if (req.user?.mustChangePassword === true) {
        return res.status(403).json({
            success: false,
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "You must change your password before continuing.",
        });
    }

    next();
}

module.exports = {
    authenticate,
    allowRoles,
    requirePasswordChangeComplete,
};
