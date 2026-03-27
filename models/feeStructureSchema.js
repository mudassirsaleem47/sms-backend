const mongoose = require("mongoose");

const feeStructureSchema = new mongoose.Schema({
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true
    },
    feeName: {
        type: String,
        required: true
    },
    feeType: {
        type: String,
        enum: ['Tuition', 'Transport', 'Library', 'Sports', 'Lab', 'Exam', 'Uniform', 'Other'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    academicYear: {
        type: String,
        required: true
    },
    dueDate: {
        type: Date,
        required: false
    },
    description: {
        type: String,
        default: ""
    },
    frequency: {
        type: String,
        enum: ['Monthly', 'Quarterly', 'Yearly', 'One-time'],
        default: 'One-time'
    },
    month: {
        type: String,
        enum: ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December', ''],
        default: ''
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model("feeStructure", feeStructureSchema);
