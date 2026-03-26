const FeeStructure = require('../models/feeStructureSchema.js');
const Fee = require('../models/feeSchema.js');
const FeeTransaction = require('../models/feeTransactionSchema.js');
const Student = require('../models/studentSchema.js');
const Sclass = require('../models/sclassSchema.js');
const mongoose = require('mongoose');
const EmailService = require('../services/emailService.js');

const isValidCampusId = (campus) => (
    !!campus &&
    campus !== 'undefined' &&
    campus !== 'null' &&
    mongoose.Types.ObjectId.isValid(campus)
);

// 1. Create Fee Structure
const createFeeStructure = async (req, res) => {
    try {
        const { feeName, feeType, amount, academicYear, dueDate, description, school, frequency, month } = req.body;

        const newFeeStructure = new FeeStructure({
            school,
            feeName,
            feeType,
            amount,
            academicYear,
            dueDate,
            frequency,
            month,
            description: description || ""
        });

        const result = await newFeeStructure.save();
        res.status(201).json({ 
            message: "Fee structure created successfully!",
            feeStructure: result
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating fee structure.", error: err.message });
    }
};

// 2. Get all fee structures for a school
const getFeeStructuresBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { campus } = req.query;
        
        let query = { school: schoolId, status: 'Active' };
        if (isValidCampusId(campus)) {
            query = {
                $and: [
                    { school: schoolId, status: 'Active' },
                    {
                        $or: [
                            { campus: campus },
                            { campus: { $exists: false } },
                            { campus: null }
                        ]
                    }
                ]
            };
        }

        const feeStructures = await FeeStructure.find(query)
            .sort({ createdAt: -1 });

        res.status(200).json(feeStructures);

    } catch (err) {
        res.status(500).json({ message: "Error fetching fee structures.", error: err.message });
    }
};

// 3. Update Fee Structure
const updateFeeStructure = async (req, res) => {
    try {
        const { id } = req.params;
        
        const updatedFeeStructure = await FeeStructure.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        );

        if (!updatedFeeStructure) {
            return res.status(404).json({ message: "Fee structure not found." });
        }

        res.status(200).json({ 
            message: "Fee structure updated successfully!",
            feeStructure: updatedFeeStructure
        });

    } catch (err) {
        res.status(500).json({ message: "Error updating fee structure.", error: err.message });
    }
};

// 4. Delete Fee Structure
const deleteFeeStructure = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if any fees are assigned using this structure
        const assignedFees = await Fee.findOne({ feeStructure: id });
        if (assignedFees) {
            return res.status(400).json({ 
                message: "Cannot delete fee structure. Fees are already assigned to students." 
            });
        }

        await FeeStructure.findByIdAndDelete(id);
        res.status(200).json({ message: "Fee structure deleted successfully!" });

    } catch (err) {
        res.status(500).json({ message: "Error deleting fee structure.", error: err.message });
    }
};

// 5. Assign Fee to Student(s)
const assignFeeToStudents = async (req, res) => {
    try {
        const { feeStructureId, studentIds, school } = req.body;

        console.log('📌 Assign Fee Request:', {
            feeStructureId,
            studentIds,
            school,
            studentCount: studentIds?.length
        });

        // Get fee structure
        const feeStructure = await FeeStructure.findById(feeStructureId);
        if (!feeStructure) {
            console.log('❌ Fee structure not found:', feeStructureId);
            return res.status(404).json({ message: "Fee structure not found." });
        }

        console.log('✅ Fee structure found:', feeStructure.feeName);

        const assignedFees = [];
        const errors = [];

        for (const studentId of studentIds) {
            try {
                // Check if fee already assigned
                const existingFee = await Fee.findOne({
                    student: studentId,
                    feeStructure: feeStructureId,
                    academicYear: feeStructure.academicYear
                });

                if (existingFee) {
                    console.log('⚠️ Fee already assigned to student:', studentId);
                    errors.push({ studentId, message: "Fee already assigned" });
                    continue;
                }

                const newFee = new Fee({
                    student: studentId,
                    school,
                    feeStructure: feeStructureId,
                    totalAmount: feeStructure.amount,
                    paidAmount: 0,
                    pendingAmount: feeStructure.amount,
                    dueDate: feeStructure.dueDate,
                    academicYear: feeStructure.academicYear
                });

                const savedFee = await newFee.save();
                console.log('✅ Fee assigned to student:', studentId);
                assignedFees.push(savedFee);

            } catch (err) {
                console.log('❌ Error assigning to student:', studentId, err.message);
                errors.push({ studentId, message: err.message });
            }
        }

        console.log(`🎉 Assignment complete: ${assignedFees.length} success, ${errors.length} errors`);

        res.status(201).json({
            message: `Fees assigned successfully to ${assignedFees.length} student(s)`,
            assignedFees,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.log('❌ Error in assignFeeToStudents:', err.message);
        res.status(500).json({ message: "Error assigning fees.", error: err.message });
    }
};

// 6. Get Student Fees (for individual student)
const getStudentFees = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        const fees = await Fee.find({ student: studentId })
            .populate('feeStructure')
            .populate('student', 'name rollNum')
            .sort({ dueDate: 1 });

        res.status(200).json(fees);

    } catch (err) {
        res.status(500).json({ message: "Error fetching student fees.", error: err.message });
    }
};

// 7. Get Pending Fees for School
const getPendingFees = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { campus } = req.query;
        
        let query = { 
            school: schoolId,
            status: { $in: ['Pending', 'Partial', 'Overdue'] }
        };

        if (isValidCampusId(campus)) {
            query.campus = campus;
        }

        const pendingFees = await Fee.find(query)
            .populate('student', 'name rollNum sclassName section')
        .populate('feeStructure', 'feeName feeType')
        .populate({
            path: 'student',
            populate: {
                path: 'sclassName',
                select: 'sclassName'
            }
        })
        .sort({ dueDate: 1 });

        res.status(200).json(pendingFees);

    } catch (err) {
        res.status(500).json({ message: "Error fetching pending fees.", error: err.message });
    }
};

// 8. Collect Fee (Process Payment)
const collectFee = async (req, res) => {
    try {
        console.log('Collect Fee Request:', req.body);

        const { 
            feeId, 
            amount, 
            paymentMethod, 
            collectedBy, 
            chequeNumber, 
            bankName, 
            transactionReference, 
            remarks,
            discount 
        } = req.body;

        console.log('Payment Details:', { feeId, amount, paymentMethod, collectedBy });

        // Get the fee record
        const fee = await Fee.findById(feeId).populate('student').populate('feeStructure');
        if (!fee) {
            console.log('Fee not found:', feeId);
            return res.status(404).json({ message: "Fee record not found." });
        }

        console.log('fee found:', fee.feeStructure?.feeName, 'Pending:', fee.pendingAmount);

        // Validate payment amount
        if (amount <= 0 || amount > fee.pendingAmount) {
            console.log('Invalid amount:', amount, 'Pending:', fee.pendingAmount);
            return res.status(400).json({ 
                message: `Invalid payment amount. Pending amount is ${fee.pendingAmount}` 
            });
        }

        console.log('💳 Creating transaction...');

        // Create transaction record
        const transaction = new FeeTransaction({
            student: fee.student._id,
            fee: feeId,
            school: fee.school,
            campus: fee.campus,
            amount,
            discount: discount || 0,
            paymentMethod,
            collectedBy,
            chequeNumber: chequeNumber || "",
            bankName: bankName || "",
            transactionReference: transactionReference || "",
            remarks: remarks || ""
        });

        console.log('💾 Saving transaction...');
        await transaction.save();
        console.log('✅ Transaction saved:', transaction.receiptNumber);

        // Update fee record
        fee.paidAmount += amount;
        fee.discountAmount = (fee.discountAmount || 0) + (discount || 0);
        
        // pendingAmount and status will be updated by pre('save') hook in model

        console.log('💾 Updating fee record...');
        await fee.save();
        console.log('✅ Fee updated. New status:', fee.status);

        res.status(201).json({
            message: "Payment collected successfully!",
            transaction,
            updatedFee: fee
        });

    } catch (err) {
        console.error('❌ Collect Fee Error:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ message: "Error processing payment.", error: err.message });
    }
};

// 9. Get Fee Transactions for School
const getFeeTransactions = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { startDate, endDate, campus } = req.query;

        console.log('📊 Get Transactions - School ID:', schoolId);
        console.log('📅 Date Range:', { startDate, endDate });

        let query = { school: schoolId };
        if (isValidCampusId(campus)) query.campus = campus;
        
        // Filter by date range if provided
        if (startDate && endDate) {
            query.paymentDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        console.log('🔍 Query:', query);

        const transactions = await FeeTransaction.find(query)
            .populate('student', 'name rollNum sclassName section')
            .populate('fee')
            .populate('collectedBy', 'schoolName')
            .populate({
                path: 'student',
                populate: {
                    path: 'sclassName',
                    select: 'sclassName'
                }
            })
            .sort({ paymentDate: -1 });

        console.log('✅ Transactions found:', transactions.length);
        if (transactions.length > 0) {
            console.log('First transaction:', transactions[0]);
        }

        res.status(200).json(transactions);

    } catch (err) {
        console.error('❌ Get Transactions Error:', err);
        res.status(500).json({ message: "Error fetching transactions.", error: err.message });
    }
};

// 10. Get Receipt Details
const getReceiptDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await FeeTransaction.findById(transactionId)
            .populate({
                path: 'student',
                populate: {
                    path: 'sclassName',
                    select: 'sclassName'
                }
            })
            .populate({
                path: 'fee',
                populate: {
                    path: 'feeStructure',
                    select: 'feeName feeType'
                }
            })
            .populate({
                path: 'school',
                select: 'schoolName email phone address'
            })
            .populate('collectedBy', 'schoolName');

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found." });
        }

        res.status(200).json(transaction);

    } catch (err) {
        res.status(500).json({ message: "Error fetching receipt details.", error: err.message });
    }
};

// 11. Get Fee Statistics for Dashboard
const getFeeStatistics = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { session, startDate, endDate, campus } = req.query;

        let feeDateQuery = {};
        let transDateQuery = {};

        if (startDate && endDate) {
            feeDateQuery.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
            transDateQuery.paymentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (session) {
            const SessionData = await mongoose.model('session').findById(session);
            if (SessionData) {
                feeDateQuery.dueDate = { $gte: SessionData.startDate, $lte: SessionData.endDate };
                transDateQuery.paymentDate = { $gte: SessionData.startDate, $lte: SessionData.endDate };
            }
        }

        if (!mongoose.Types.ObjectId.isValid(schoolId)) {
            return res.status(400).json({ message: "Invalid school ID format" });
        }
        const feeMatchQuery = { school: new mongoose.Types.ObjectId(schoolId), ...feeDateQuery };
        const transMatchQuery = { school: new mongoose.Types.ObjectId(schoolId), ...transDateQuery };

        if (isValidCampusId(campus)) {
            feeMatchQuery.campus = new mongoose.Types.ObjectId(campus);
            transMatchQuery.campus = new mongoose.Types.ObjectId(campus);
        }

        // Total pending fees
        const pendingFeesData = await Fee.aggregate([
            { 
                $match: { 
                    ...feeMatchQuery,
                    status: { $in: ['Pending', 'Partial', 'Overdue'] }
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    totalPending: { $sum: "$pendingAmount" },
                    count: { $sum: 1 }
                } 
            }
        ]);

        // Today's collection
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayCollection = await FeeTransaction.aggregate([
            {
                $match: {
                    ...transMatchQuery,
                    paymentDate: { ...(transDateQuery.paymentDate || {}), $gte: today, $lt: tomorrow }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Monthly collection
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthlyCollection = await FeeTransaction.aggregate([
            {
                $match: {
                    ...transMatchQuery,
                    paymentDate: { ...(transDateQuery.paymentDate || {}), $gte: firstDayOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // All-time collection
        const allTimeCollection = await FeeTransaction.aggregate([
            { $match: transMatchQuery },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        res.status(200).json({
            pendingFees: {
                amount: pendingFeesData[0]?.totalPending || 0,
                count: pendingFeesData[0]?.count || 0
            },
            todayCollection: {
                amount: todayCollection[0]?.total || 0,
                count: todayCollection[0]?.count || 0
            },
            monthlyCollection: {
                amount: monthlyCollection[0]?.total || 0,
                count: monthlyCollection[0]?.count || 0
            },
            totalCollection: {
                amount: allTimeCollection[0]?.total || 0,
                count: allTimeCollection[0]?.count || 0
            }
        });

    } catch (err) {
        res.status(500).json({ message: "Error fetching statistics.", error: err.message });
    }
};

// ─── Revert Transaction ───────────────────────────────────────────────────────
const revertTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await FeeTransaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found." });
        }

        // Restore fee amounts BEFORE deleting
        const fee = await Fee.findById(transaction.fee);
        if (fee) {
            fee.paidAmount = Math.max(0, (fee.paidAmount || 0) - transaction.amount);
            fee.discountAmount = Math.max(0, (fee.discountAmount || 0) - (transaction.discount || 0));
            // pendingAmount and status will be updated by pre('save') hook
            await fee.save();
        }

        // Permanently delete the transaction record
        await FeeTransaction.findByIdAndDelete(transactionId);

        res.status(200).json({
            message: "Transaction deleted and fee balance restored.",
            fee
        });
    } catch (err) {
        res.status(500).json({ message: "Error reverting transaction.", error: err.message });
    }
};

// 13. Send Fee Reminder (EmailTemplate)
const sendFeeReminder = async (req, res) => {
    try {
        const { id } = req.params; // Fee ID

        const fee = await Fee.findById(id)
            .populate({
                path: 'student',
                populate: { path: 'sclassName', select: 'sclassName' }
            })
            .populate('feeStructure', 'feeName')
            .populate('school', 'schoolName');

        if (!fee) {
            return res.status(404).json({ message: "Fee record not found." });
        }

        const student = fee.student;
        if (!student) {
            return res.status(404).json({ message: "Student record not found for this fee." });
        }

        const targetEmail = student.email || student.father?.email || student.guardian?.email;

        if (!targetEmail) {
            return res.status(400).json({ message: "No email address found for this student/parent." });
        }

        if (!fee.school) {
            return res.status(400).json({ message: "School data missing for this fee." });
        }

        const schoolId = fee.school._id.toString();
        const schoolName = fee.school.schoolName || 'School Administration';
        const dueDateStr = fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : 'N/A';

        // Check if user has defined a message template for 'fee'
        let template = null;
        try {
            const MessageTemplate = mongoose.model('MessageTemplate');
            template = await MessageTemplate.findOne({ school: schoolId, category: 'fee' });
        } catch (err) {
            console.error("Error fetching message template:", err);
            // Continue with fallback if template fetching fails
        }

        let htmlTemplate = '';
        let subject = `Fee Reminder: ${fee.feeStructure?.feeName || 'Pending'}`;

        if (template && template.content) {
            htmlTemplate = template.content
                .replace(/{{name}}/g, student.name || '')
                .replace(/{{father}}/g, student.father?.name || '')
                .replace(/{{class}}/g, student.sclassName?.sclassName || '')
                .replace(/{{section}}/g, student.section || '')
                .replace(/{{phone}}/g, student.mobileNumber || student.father?.phone || '')
                .replace(/{{fee_amount}}/g, String(fee.pendingAmount || 0))
                .replace(/{{due_date}}/g, dueDateStr)
                .replace(/{{school}}/g, schoolName)
                .replace(/{{email}}/g, targetEmail)
                .replace(/{{roll_number}}/g, student.rollNum || '')
                .replace(/{{password}}/g, '') 
                .replace(/{{login_url}}/g, '');

            subject = template.name || subject;
        } else {
            // Fallback template
            htmlTemplate = `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 24px;">Fee Reminder</h2>
                    </div>
                    <div style="padding: 24px; color: #334155; line-height: 1.6;">
                        <p>Dear Parent/Guardian of <strong>${student.name}</strong>,</p>
                        <p>This is a gentle reminder regarding the pending fee for <strong>${fee.feeStructure?.feeName || 'Pending'}</strong>.</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;">Total Amount:</td>
                                    <td style="padding: 4px 0; font-weight: bold; text-align: right;">${fee.totalAmount}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;">Paid Amount:</td>
                                    <td style="padding: 4px 0; font-weight: bold; text-align: right; color: #10b981;">${fee.paidAmount}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #ef4444; font-weight: bold; border-top: 1px solid #e2e8f0;">Pending Amount:</td>
                                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #ef4444; border-top: 1px solid #e2e8f0; font-size: 18px;">${fee.pendingAmount}</td>
                                </tr>
                            </table>
                        </div>

                        <p>The due date for this payment was <strong>${dueDateStr}</strong>. Please ensure the payment is made at the earliest to avoid any inconvenience.</p>
                        
                        <p style="margin-top: 24px; font-size: 14px; color: #94a3b8;">If you have already made the payment, please ignore this email or contact the school administration.</p>
                    </div>
                    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; color: #64748b; font-size: 14px;">
                        <p style="margin: 0;">${schoolName}</p>
                    </div>
                </div>
            `;
        }

        const emailResult = await EmailService.sendEmail(schoolId, {
            to: targetEmail,
            subject,
            html: htmlTemplate,
            text: `Dear Parent/Guardian of ${student.name}, this is a reminder regarding the pending fee for ${fee.feeStructure?.feeName || 'Pending'}. Pending Amount: ${fee.pendingAmount}. Due Date: ${dueDateStr}.`
        });

        if (emailResult.success) {
            res.status(200).json({ success: true, message: `Reminder sent successfully to ${targetEmail}` });
        } else {
            console.error("Email sending failed:", emailResult.error);
            res.status(400).json({ success: false, message: "Failed to send email. Check SMTP settings.", error: emailResult.error });
        }

    } catch (err) {
        console.error("Error in sendFeeReminder:", err);
        res.status(500).json({ success: false, message: "Error sending fee reminder.", error: err.message });
    }
};

module.exports = {
    createFeeStructure,
    getFeeStructuresBySchool,
    updateFeeStructure,
    deleteFeeStructure,
    assignFeeToStudents,
    getStudentFees,
    getPendingFees,
    collectFee,
    getFeeTransactions,
    getReceiptDetails,
    getFeeStatistics,
    revertTransaction,
    sendFeeReminder
};
