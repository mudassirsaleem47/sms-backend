const Income = require('../models/incomeSchema.js');
const mongoose = require('mongoose');

// 1. Create Income Entry
const createIncome = async (req, res) => {
    try {
        const { amount, category, description, date, paymentMethod, reference, school, createdBy } = req.body;

        const newIncome = new Income({
            amount,
            category,
            description,
            date: date || Date.now(),
            paymentMethod: paymentMethod || 'Cash',
            reference: reference || '',
            school,
            createdBy
        });

        const result = await newIncome.save();
        res.status(201).json({ 
            message: "Income entry created successfully!",
            income: result
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating income entry.", error: err.message });
    }
};

// 2. Get all income entries for a school
const getIncomeBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        
        const incomeEntries = await Income.find({ school: schoolId })
            .sort({ date: -1 });

        res.status(200).json(incomeEntries);

    } catch (err) {
        res.status(500).json({ message: "Error fetching income entries.", error: err.message });
    }
};

// 3. Update Income Entry
const updateIncome = async (req, res) => {
    try {
        const { id } = req.params;
        
        const updatedIncome = await Income.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        );

        if (!updatedIncome) {
            return res.status(404).json({ message: "Income entry not found." });
        }

        res.status(200).json({ 
            message: "Income entry updated successfully!",
            income: updatedIncome
        });

    } catch (err) {
        res.status(500).json({ message: "Error updating income entry.", error: err.message });
    }
};

// 4. Delete Income Entry
const deleteIncome = async (req, res) => {
    try {
        const { id } = req.params;
        
        await Income.findByIdAndDelete(id);
        res.status(200).json({ message: "Income entry deleted successfully!" });

    } catch (err) {
        res.status(500).json({ message: "Error deleting income entry.", error: err.message });
    }
};

// 5. Get Income Statistics
const getIncomeStatistics = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { session, startDate, endDate } = req.query;

        let dateQuery = {};
        if (startDate && endDate) {
            dateQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (session) {
            const SessionData = await mongoose.model('session').findById(session);
            if (SessionData) {
                dateQuery.date = { $gte: SessionData.startDate, $lte: SessionData.endDate };
            }
        }

        if (!mongoose.Types.ObjectId.isValid(schoolId)) {
            return res.status(400).json({ message: "Invalid school ID format" });
        }
        const matchQuery = { school: new mongoose.Types.ObjectId(schoolId), ...dateQuery };

        // Total income
        const totalIncomeData = await Income.aggregate([
            { $match: matchQuery },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        // Today's income (bounded by session if applicable)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayIncome = await Income.aggregate([
            {
                $match: {
                    ...matchQuery,
                    date: { ...(dateQuery.date || {}), $gte: today, $lt: tomorrow }
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        // Monthly income
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthlyIncome = await Income.aggregate([
            {
                $match: {
                    ...matchQuery,
                    date: { ...(dateQuery.date || {}), $gte: firstDayOfMonth }
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        // Category-wise breakdown
        const categoryBreakdown = await Income.aggregate([
            { $match: matchQuery },
            { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        res.status(200).json({
            totalIncome: {
                amount: totalIncomeData[0]?.total || 0,
                count: totalIncomeData[0]?.count || 0
            },
            todayIncome: {
                amount: todayIncome[0]?.total || 0,
                count: todayIncome[0]?.count || 0
            },
            monthlyIncome: {
                amount: monthlyIncome[0]?.total || 0,
                count: monthlyIncome[0]?.count || 0
            },
            categoryBreakdown
        });

    } catch (err) {
        res.status(500).json({ message: "Error fetching income statistics.", error: err.message });
    }
};

module.exports = {
    createIncome,
    getIncomeBySchool,
    updateIncome,
    deleteIncome,
    getIncomeStatistics
};
