require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Frontend origins allowed to access the backend
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    process.env.CLIENT_URL,
].filter(Boolean);

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests without an Origin header, such as
            // health checks or server-to-server requests.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(
                new Error(`CORS blocked this origin: ${origin}`)
            );
        },
        credentials: true,
    })
);

app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "HR Management API is running",
    });
});

// Authentication and user management
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/manager", require("./routes/managerRoutes"));

// Attendance management
app.use("/api/attendance", require("./routes/attendanceRoutes"));

// Leave management
app.use("/api/leaves", require("./routes/leaveRoutes"));

// Holidays
app.use("/api/holidays", require("./routes/holidayRoutes"));

// Tasks and projects
app.use("/api/tasks", require("./routes/taskRoutes"));

app.use("/api/cto-md", require("./routes/ctoMdRoutes"));

async function startServer() {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Backend running at http://localhost:${PORT}`);
            console.log("Allowed frontend origins:", allowedOrigins);
        });
    } catch (error) {
        console.error("Backend startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
