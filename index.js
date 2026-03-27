const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const routes = require("./routes/route");
const transportRoutes = require("./routes/transportRoutes");
const lessonPlanRoutes = require("./routes/lessonPlanRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const staffAttendanceRoutes = require("./routes/staffAttendanceRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const designationRoutes = require("./routes/designationRoutes");
const issueItemRoutes = require("./routes/issueItemRoutes");
const inventoryItemRoutes = require("./routes/inventoryItemRoutes");
const itemMasterRoutes = require("./routes/itemMasterRoutes");
const itemCategoryRoutes = require("./routes/itemCategoryRoutes");
const itemSupplierRoutes = require("./routes/itemSupplierRoutes");
const itemStoreRoutes = require("./routes/itemStoreRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/school-management';
const configuredOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;

    try {
        const parsed = new URL(origin);
        const host = parsed.hostname;

        if (configuredOrigins.includes(origin)) return true;
        if (configuredOrigins.some((entry) => {
            try {
                const configuredHost = new URL(entry).hostname;
                return configuredHost === host;
            } catch {
                return false;
            }
        })) return true;

        if (host === 'localhost' || host === '127.0.0.1') return true;
        if (/^192\.168\./.test(host)) return true;
        if (host === 'hostingersite.com' || host.endsWith('.hostingersite.com')) return true;
        if (host === 'vercel.app' || host.endsWith('.vercel.app')) return true;

        return false;
    } catch (error) {
        return false;
    }
};

// Middleware
app.use(express.json());
app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        // Return a CORS deny without turning it into a 500 server error.
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get("/", (req, res) => {
    res.send("School Management System Backend is Working!");
});

app.get('/health', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    res.status(isDbConnected ? 200 : 503).json({
        success: isDbConnected,
        server: 'up',
        db: isDbConnected ? 'connected' : 'disconnected'
    });
});

app.use('/', routes);
app.use('/Transport', transportRoutes);
app.use('/LessonPlan', lessonPlanRoutes);
app.use('/Attendance', attendanceRoutes);
app.use('/StaffAttendance', staffAttendanceRoutes);
app.use('/Payroll', payrollRoutes);
app.use('/Designation', designationRoutes);
app.use('/Inventory/IssueItem', issueItemRoutes);
app.use('/Inventory/Stock', inventoryItemRoutes);
app.use('/Inventory/Item', itemMasterRoutes);
app.use('/Inventory/Category', itemCategoryRoutes);
app.use('/Inventory/Supplier', itemSupplierRoutes);
app.use('/Inventory/Store', itemStoreRoutes);


// Database Connection
if (process.env.NODE_ENV === 'production' && !process.env.MONGO_URL && !process.env.MONGODB_URL) {
    console.error('❌ Missing MongoDB connection string in production. Set MONGO_URL or MONGODB_URL.');
}

mongoose
    .connect(MONGO_URL)
    .then(() => {
        console.log("✅ MongoDB Connected Successfully");
    })
    .catch((err) => {
        console.log("Database Connection Error:", err.message || err);
        console.log("⚠️ Server is running but DB is disconnected. Check MONGO_URL/MONGODB_URL and MongoDB service.");
    });

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server started on port ${PORT}`);
    });
}

module.exports = app;
