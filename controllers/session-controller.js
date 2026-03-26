const Session = require('../models/sessionSchema.js');
const mongoose = require('mongoose');

const createSession = async (req, res) => {
    try {
        const { sessionYear, startDate, endDate, schoolId } = req.body;
        
        // If this is the first session being created, make it active by default
        const existingSessionsCount = await Session.countDocuments({ school: schoolId });
        const isActive = existingSessionsCount === 0;

        const session = new Session({
            sessionYear,
            startDate,
            endDate,
            school: schoolId,
            isActive
        });

        const result = await session.save();
        res.status(201).json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to create session', error: err.message });
    }
};

const getSessionsBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const sessions = await Session.find({ school: schoolId }).sort({ startDate: -1 });
        res.status(200).json(sessions);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch sessions', error: err.message });
    }
};

const makeSessionActive = async (req, res) => {
    try {
        const { schoolId, sessionId } = req.body;
        
        // Step 1: Deactivate all sessions for this school
        await Session.updateMany({ school: schoolId }, { isActive: false });

        // Step 2: Activate the selected session
        const activeSession = await Session.findByIdAndUpdate(
            sessionId,
            { isActive: true },
            { new: true }
        );

        res.status(200).json({ success: true, activeSession, message: 'Session marked as active' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to make session active', error: err.message });
    }
};

const deleteSession = async (req, res) => {
    try {
        const { id } = req.params;
        
        const session = await Session.findById(id);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (session.isActive) {
            return res.status(400).json({ success: false, message: 'Cannot delete an active session. Please set a different session as active first.' });
        }

        await Session.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Session deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete session', error: err.message });
    }
};

const updateSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { sessionYear, startDate, endDate } = req.body;
        
        const result = await Session.findByIdAndUpdate(
            id,
            { sessionYear, startDate, endDate },
            { new: true }
        );
        res.status(200).json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update session', error: err.message });
    }
};

// Also export a helper endpoint to get the Current Active Session for a school
const getActiveSessionBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(schoolId)) {
            return res.status(400).json({ success: false, message: 'Invalid school ID' });
        }
        const activeSession = await Session.findOne({ school: schoolId, isActive: true });
        if (activeSession) {
            res.status(200).json({ success: true, session: activeSession });
        } else {
            res.status(404).json({ success: false, message: 'No active session found for this school' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to get active session', error: err.message });
    }
};

module.exports = {
    createSession,
    getSessionsBySchool,
    makeSessionActive,
    deleteSession,
    updateSession,
    getActiveSessionBySchool
};
