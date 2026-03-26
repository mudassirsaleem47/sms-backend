const Admin = require('../models/adminSchema');
const bcrypt = require('bcryptjs'); // Password secure karne ke liye
const mongoose = require('mongoose');
const crypto = require('crypto');
const EmailService = require('../services/emailService');
const { signAuthToken } = require('../middleware/auth');

const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const getFrontendBaseUrl = () => {
    const envUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    if (envUrl && /^https?:\/\//i.test(envUrl)) {
        return envUrl.replace(/\/+$/, '');
    }
    return 'http://localhost:5173';
};

const sendVerificationEmail = async (admin, rawToken) => {
    const frontendBase = getFrontendBaseUrl();
    const verifyUrl = `${frontendBase}/verify-email?token=${rawToken}&email=${encodeURIComponent(admin.email)}`;

    const result = await EmailService.sendEmail(admin._id, {
        to: admin.email,
        subject: 'Verify Your Email Address',
        text: `Hello ${admin.name},\n\nWelcome to School Management System. Please verify your email by clicking this link (valid for 24 hours):\n${verifyUrl}\n\nIf you did not create this account, you can ignore this email.`,
        html: `
            <p>Hello ${admin.name},</p>
            <p>Welcome to School Management System.</p>
            <p>Please verify your email by clicking the link below:</p>
            <p>
                <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">
                    Verify Email
                </a>
            </p>
            <p>This link is valid for <strong>24 hours</strong>.</p>
            <p>If you did not create this account, you can ignore this email.</p>
        `
    });

    return result;
};

const adminRegister = async (req, res) => {
    try {
        console.log("AdminReg request received:", req.body);

        // User se data lena
        const { name, schoolName, password } = req.body;
        const email = normalizeEmail(req.body?.email);

        if (!name || !schoolName || !email || !password) {
            return res.status(400).json({ message: 'Name, email, school name and password are required' });
        }

        // Check karna ke pehle se toh exist nahi karta
        const existingAdmin = await Admin.findOne({ email });
        const existingSchool = await Admin.findOne({ schoolName });

        if (existingAdmin || existingSchool) {
            console.log("Conflict: Admin or School already exists");
            return res.status(400).json({ message: "Admin or School already exists" });
        }

        // Password ko encrypt karna (Security)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const rawVerificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');

        // Naya Admin banana
        const admin = new Admin({
            name,
            email,
            schoolName,
            password: hashedPassword,
            emailVerified: false,
            emailVerificationToken: hashedVerificationToken,
            emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS)
        });

        // Save karna
        const result = await admin.save();
        console.log("Admin registered successfully:", result._id);

        const emailResult = await sendVerificationEmail(result, rawVerificationToken);
        if (!emailResult.success) {
            console.error('Verification email delivery failed:', emailResult.error || 'Unknown error');
        }

        // Password wapis nahi bhejna response mein
        const responseAdmin = result.toObject();
        delete responseAdmin.password;
        delete responseAdmin.emailVerificationToken;
        delete responseAdmin.resetPasswordToken;

        res.status(200).json({
            ...responseAdmin,
            message: 'Registration successful. Please verify your email before login.'
        });
    } catch (err) {
        console.error("Error in adminRegister:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

const adminLogin = async (req, res) => {
    try {
        const { password } = req.body;
        const email = normalizeEmail(req.body?.email);

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!admin.emailVerified) {
            return res.status(403).json({
                message: 'Email not verified. Please verify your email before logging in.',
                code: 'EMAIL_NOT_VERIFIED',
                email: admin.email
            });
        }

        // Password match karna
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid Password" });
        }

        const token = signAuthToken({
            userId: admin._id,
            schoolId: admin._id,
            role: 'admin',
            userType: 'admin',
            email: admin.email
        });

        // Admin data bhejna (Login successful) - whitelist safe fields
        const safeAdmin = {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            schoolName: admin.schoolName,
            schoolLogo: admin.schoolLogo,
            profilePicture: admin.profilePicture,
            favicon: admin.favicon,
            address: admin.address,
            phoneNumber: admin.phoneNumber,
            website: admin.website,
            settings: admin.settings,
            emailVerified: admin.emailVerified,
            subscriptionStatus: admin.subscriptionStatus,
            subscriptionExpiry: admin.subscriptionExpiry,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
            token
        };

        res.status(200).json(safeAdmin);
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getAdminDetail = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid admin ID' });
        }
        let admin = await Admin.findById(req.params.id);
        if (admin) {
            admin.password = undefined;
            res.send(admin);
        } else {
            res.send({ message: "No admin found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
}

const updateAdmin = async (req, res) => {
    try {
        const { name, email, schoolName, address, phoneNumber, website } = req.body;
        const updateData = { name, email, schoolName, address, phoneNumber, website };

        if (req.files) {
            if (req.files.schoolLogo && req.files.schoolLogo[0]) {
                console.log("School Logo uploaded:", req.files.schoolLogo[0]);
                updateData.schoolLogo = req.files.schoolLogo[0].path;
            }
            if (req.files.profilePicture && req.files.profilePicture[0]) {
                console.log("Profile Picture uploaded:", req.files.profilePicture[0]);
                updateData.profilePicture = req.files.profilePicture[0].path;
            }
            if (req.files.favicon && req.files.favicon[0]) {
                console.log("Favicon uploaded:", req.files.favicon[0]);
                updateData.favicon = req.files.favicon[0].path;
            }
        }

        const result = await Admin.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
        result.password = undefined;
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

const updateAdminSettings = async (req, res) => {
    try {
        const { settings, currentPassword, newPassword } = req.body;
        const admin = await Admin.findById(req.params.id);

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        if (settings && typeof settings === 'object') {
            admin.settings = { ...(admin.settings || {}), ...settings };
        }

        if (newPassword !== undefined) {
            if (!currentPassword) {
                return res.status(400).json({ message: "Current password is required" });
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: "Current password is incorrect" });
            }

            if (typeof newPassword !== 'string' || newPassword.length < 6) {
                return res.status(400).json({ message: "New password must be at least 6 characters" });
            }

            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(newPassword, salt);
            admin.passwordChangedAt = new Date();
        }

        await admin.save();
        const safeAdmin = admin.toObject();
        delete safeAdmin.password;
        res.send(safeAdmin);
    } catch (err) {
        res.status(500).json(err);
    }
};

module.exports = { adminRegister, adminLogin, getAdminDetail, updateAdmin, updateAdminSettings };