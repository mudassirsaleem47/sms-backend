const Sclass = require('../models/sclassSchema.js');
const mongoose = require('mongoose');

const isValidSchoolId = (schoolId) => (
    !!schoolId &&
    schoolId !== 'undefined' &&
    schoolId !== 'null' &&
    mongoose.Types.ObjectId.isValid(schoolId)
);

// 1. Nayi Class/Section Create karna
const sclassCreate = async (req, res) => {
    try {
        const { sclassName, school, classIncharge, sections, campus } = req.body;
        
        const sclassExists = await Sclass.findOne({ sclassName, school, campus });
        if (sclassExists) {
            return res.status(400).json({ message: "Class already exists." });
        }

        const newSclass = new Sclass({
            sclassName,
            school,
            campus,
            classIncharge,
            sections: sections || []
        });
        const result = await newSclass.save();

        const populatedClass = await Sclass.findById(result._id)
            .populate('classIncharge', 'name email')
            .populate('sections');

        res.status(201).json({ 
            message: "Class created successfully!",
            classId: result._id,
            class: populatedClass
        });

    } catch (err) {
        res.status(500).json({ message: "Internal Server Error during Class Creation.", error: err.message });
    }
};

const getSclassesBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { campus } = req.query;

        if (!isValidSchoolId(schoolId)) {
            return res.status(400).json({ message: 'Invalid school ID.' });
        }

        let query = { school: schoolId };
        if (
            campus &&
            campus !== 'undefined' &&
            campus !== 'null' &&
            mongoose.Types.ObjectId.isValid(campus)
        ) {
            query.$or = [
                { campus: campus },
                { campus: { $exists: false } },
                { campus: null }
            ];
        }

        const sclasses = await Sclass.find(query)
            .sort({ order: 1, createdAt: 1 })
            .populate('classIncharge', 'name email')
            .populate('sections');

        if (sclasses.length === 0) {
            return res.status(200).json([]);
        }

        res.status(200).json(sclasses);

    } catch (err) {
        res.status(500).json({ message: "Internal Server Error while fetching classes.", error: err.message });
    }
};

// 3. Class Delete karna
const deleteSclass = async (req, res) => {
    try {
        const { id } = req.params;

        // Class delete karne se pehle zaroori hai ke us class ke students, teachers ko bhi handle kiya jaye.
        // Abhi hum sirf Class delete kar rahe hain.
        const deletedClass = await Sclass.findByIdAndDelete(id);

        if (!deletedClass) {
            return res.status(404).json({ message: "Class not found." });
        }

        res.status(200).json({ message: "Class deleted successfully." });

    } catch (err) {
        res.status(500).json({ message: "Internal Server Error during Class Deletion.", error: err.message });
    }
};


const addSection = async (req, res) => {
    try {
        // Class ID URL se milegi, Section Name body se
        const { id } = req.params; 
        const { sectionName } = req.body;

        // Class dhoondo aur section push karo
        const result = await Sclass.findByIdAndUpdate(
            id,
            { $push: { sections: { sectionName: sectionName } } },
            { new: true } // Update hone ke baad wala data wapis karo
        );

        if (!result) return res.status(404).json({ message: "Class not found" });

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

// 5. Section Delete karna
const deleteSection = async (req, res) => {
    try {
        const { id, sectionId } = req.params;

        // Class dhoondo aur specific section ko 'pull' (nikal) do
        const result = await Sclass.findByIdAndUpdate(
            id,
            { $pull: { sections: { _id: sectionId } } },
            { new: true }
        );

        if (!result) return res.status(404).json({ message: "Class not found" });
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

// 6. Class Update karna
const updateSclass = async (req, res) => {
    try {
        const { id } = req.params;
        const { sclassName, classIncharge, sections } = req.body;

        const updateData = { sclassName, classIncharge };
        if (sections !== undefined) {
            updateData.sections = sections;
        }

        const updatedSclass = await Sclass.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('classIncharge', 'name email');

        if (!updatedSclass) {
            return res.status(404).json({ message: "Class not found." });
        }

        res.status(200).json({ message: "Class updated successfully!", class: updatedSclass });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error during Class Update.", error: err.message });
    }
};

// 7. Reorder Classes
const reorderSclasses = async (req, res) => {
    try {
        const { schoolId, newOrder } = req.body; // newOrder should be an array of { id, order }

        if (!Array.isArray(newOrder)) {
            return res.status(400).json({ message: "Invalid order data." });
        }

        const bulkOps = newOrder.map(item => ({
            updateOne: {
                filter: { _id: item.id, school: schoolId },
                update: { $set: { order: item.order } }
            }
        }));

        if (bulkOps.length > 0) {
            await Sclass.bulkWrite(bulkOps);
        }

        res.status(200).json({ message: "Classes reordered successfully." });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error during Reordering.", error: err.message });
    }
};

// Export mein naye functions add karna mat bhoolna
module.exports = { sclassCreate, getSclassesBySchool, deleteSclass, addSection, deleteSection, updateSclass, reorderSclasses };
