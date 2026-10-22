
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const uploadDirectory = path.join(
    __dirname,
    "..",
    "private_uploads",
    "medical-certificates"
);

// This directory must NOT be exposed through express.static().
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${crypto.randomUUID()}${extension}`);
    },
});

function fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
        !allowedExtensions.has(extension) ||
        !allowedMimeTypes.has(file.mimetype)
    ) {
        const error = new Error(
            "Medical certificate must be a PDF, DOC, or DOCX file."
        );

        error.statusCode = 400;
        return callback(error);
    }

    callback(null, true);
}

const uploadMedicalCertificate = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 12,
        parts: 14,
    },
}).single("medicalCertificate");

module.exports = {
    uploadMedicalCertificate,
    uploadDirectory,
};
