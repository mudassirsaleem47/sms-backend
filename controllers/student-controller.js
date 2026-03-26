const Student = require("../models/studentSchema.js");
const Sclass = require("../models/sclassSchema.js");
const Teacher = require("../models/teacherSchema.js");
const Fee = require("../models/feeSchema.js");
const FeeStructure = require("../models/feeStructureSchema.js");
const MessageTemplate = require("../models/messageTemplateSchema.js");
const MessageLog = require("../models/messageLogSchema.js");
const EmailService = require("../services/emailService.js");
const Admin = require("../models/adminSchema.js");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { signAuthToken } = require('../middleware/auth');

const isValidCampusId = (campus) => (
  !!campus &&
  campus !== "undefined" &&
  campus !== "null" &&
  mongoose.Types.ObjectId.isValid(campus)
);

const getAdmissionPrefix = (admin) => {
  const configuredPrefix = admin?.settings?.admissionPrefix;
  if (typeof configuredPrefix === "string") {
    const cleanedPrefix = configuredPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanedPrefix) {
      return cleanedPrefix.substring(0, 6);
    }
  }

  let prefix = "SMS";
  if (admin && admin.schoolName) {
    const initials = admin.schoolName
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    if (initials.length >= 3) {
      prefix = initials.substring(0, 3);
    } else {
      prefix = admin.schoolName
        .replace(/\s/g, "")
        .substring(0, 3)
        .toUpperCase();
    }
  }

  return prefix;
};

// 1. New Student ka Admission
const studentAdmission = async (req, res) => {
  try {
    // Front-end se aane wala data
    const { rollNum, password, sclassName, school, campus } = req.body;
    
    // Check: Roll Number pehle se exist toh nahi karta in this class and campus?
    const studentExists = await Student.findOne({ rollNum, sclassName, campus });
    if (studentExists) {
        return res.status(400).json({ message: "Roll Number already registered in this class/branch." });
    }

    // Check: Class ID valid hai?
    const sclass = await Sclass.findById(sclassName).populate("classIncharge");
    if (!sclass) {
      return res.status(404).json({ message: "Class not found." });
    }

    // Password ko encrypt (Hashing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const studentPhoto =
      req.files && req.files["studentPhoto"]
        ? req.files["studentPhoto"][0].path.replace(/\\/g, '/')
        : req.body.studentPhotoUrl || "";
    const fatherPhoto =
      req.files && req.files["fatherPhoto"]
        ? req.files["fatherPhoto"][0].path.replace(/\\/g, '/')
        : "";
    const motherPhoto =
      req.files && req.files["motherPhoto"]
        ? req.files["motherPhoto"][0].path.replace(/\\/g, '/')
        : "";
    const guardianPhoto =
      req.files && req.files["guardianPhoto"]
        ? req.files["guardianPhoto"][0].path.replace(/\\/g, '/')
        : "";

    // Parse JSON fields with error handling
    const parseJSON = (str, defaultVal) => {
      try {
        return str ? JSON.parse(str) : defaultVal;
      } catch (e) {
        console.error('JSON Parse Error:', e.message, 'Value:', str);
        return defaultVal;
      }
    };
    const father = parseJSON(req.body.father, {});
    const mother = parseJSON(req.body.mother, {});
    const guardian = parseJSON(req.body.guardian, {});
    const transport = parseJSON(req.body.transport, {});
    const siblings = parseJSON(req.body.siblings, []);

    const studentPayload = { ...req.body };
    if (studentPayload.session === "") delete studentPayload.session;
    if (studentPayload.campus === "") delete studentPayload.campus;
    if (studentPayload.rollNum !== undefined && studentPayload.rollNum !== "") {
      studentPayload.rollNum = Number(studentPayload.rollNum);
    }

    // Generate Admission Number (Format: [Initials]-[4 digits])
    // Fetch school details for prefix
    const admin = await Admin.findById(school);
    const prefix = getAdmissionPrefix(admin);

    // Scope numbering to current session when available so a new session can start fresh.
    const admissionFilter = { school };
    if (isValidCampusId(studentPayload.session)) {
      admissionFilter.session = studentPayload.session;
    }

    // Find all matching students and derive next sequence from numeric suffix.
    const schoolStudents = await Student.find(admissionFilter).select("admissionNum");

    let nextNumber = 0;
    if (schoolStudents.length > 0) {
        const numbers = schoolStudents
            .map(s => {
              if (!s.admissionNum) return null;
                const parts = s.admissionNum.split("-");
                const lastPart = parts[parts.length - 1];
                const num = parseInt(lastPart, 10);
              return isNaN(num) ? null : num;
            })
          .filter(n => n !== null && n >= 0);
        
        if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1;
        }
    }

    const admissionNum = `${prefix}-${nextNumber.toString().padStart(4, "0")}`;
    console.log(`🎫 Generated next admission number: ${admissionNum}`);

    const newStudent = new Student({
      ...studentPayload,
      admissionNum, // Adding the auto-generated ID
      password: hashedPassword,
      studentPhoto,
      father: { ...father, photo: fatherPhoto },
      mother: { ...mother, photo: motherPhoto },
      guardian: { ...guardian, photo: guardianPhoto },
      transport,
      siblings,
    });

    const result = await newStudent.save();
    console.log("✅ Student saved to database:", result._id);

    // --- Admission Confirmation Email Logic ---
    try {
      const template = await MessageTemplate.findOne({
        school: school,
        category: "admission",
      });

      // Try to find an email address to send to
      const recipientEmail =
        result.email ||
        result.father?.email ||
        result.guardian?.email ||
        result.mother?.email;

      if (template && recipientEmail) {
        console.log("📧 Sending admission confirmation email to:", recipientEmail);
        let message = template.content;
        message = message.replace(/\{\{name\}\}/g, result.name || "");
        message = message.replace(/\{\{father\}\}/g, result.father?.name || "");
        message = message.replace(/\{\{class\}\}/g, sclass.sclassName || "");
        message = message.replace(/\{\{section\}\}/g, result.section || "");
        message = message.replace(
          /\{\{phone\}\}/g,
          result.mobileNumber || result.father?.phone || "",
        );
        message = message.replace(/\{\{email\}\}/g, recipientEmail || "");
        message = message.replace(/\{\{password\}\}/g, "[Set by student, not shared by email]");
        message = message.replace(/\{\{roll_number\}\}/g, result.rollNum || "");
        message = message.replace(
          /\{\{login_url\}\}/g,
          process.env.FRONTEND_URL || "http://localhost:5173/login",
        );
        message = message.replace(
          /\{\{school\}\}/g,
          sclass.school?.schoolName || "Your School",
        );

        const emailResult = await EmailService.sendEmail(school, {
          to: recipientEmail,
          subject: template.name || "Admission Confirmation",
          text: message,
        });

        const log = new MessageLog({
          recipient: {
            studentId: result._id,
            name: result.name,
            phone: result.mobileNumber || result.father?.phone,
            email: recipientEmail,
            group: "student",
          },
          content: message,
          messageType: "email",
          templateId: template._id,
          status: emailResult.success ? "sent" : "failed",
          error: emailResult.success ? null : emailResult.error,
          school: school,
        });

        if (emailResult.success) {
          log.deliveredAt = new Date();
        }
        await log.save();
        console.log(
          `✅ Admission confirmation email sent successfully to ${recipientEmail}`,
        );
      }
    } catch (emailErr) {
      console.error(`❌ Error sending admission email:`, emailErr.message);
    }

    // --- Fee Assignment Logic ---
    const feeStructureIds = parseJSON(req.body.feeStructureIds, []);
    if (feeStructureIds.length > 0) {
      for (const feeStructureId of feeStructureIds) {
        try {
          const feeStructure = await FeeStructure.findById(feeStructureId);
          if (feeStructure) {
            const newFee = new Fee({
              student: result._id,
              school: school,
              campus: result.campus,
              feeStructure: feeStructureId,
              totalAmount: feeStructure.amount,
              paidAmount: 0,
              pendingAmount: feeStructure.amount,
              dueDate: feeStructure.dueDate,
              academicYear: feeStructure.academicYear,
            });
            await newFee.save();
            console.log(
              `✅ Fee ${feeStructure.feeName} assigned to student ${result.name}`,
            );
          }
        } catch (feeErr) {
          console.error(
            `❌ Error assigning fee ${feeStructureId}:`,
            feeErr.message,
          );
        }
      }
    }

    // Auto-assign student to class incharge
    if (sclass.classIncharge) {
      const teacher = await Teacher.findById(sclass.classIncharge);
      if (teacher) {
        // Check agar class pehle se assigned nahi hai to add karo
        if (!teacher.assignedClasses.includes(sclassName)) {
          teacher.assignedClasses.push(sclassName);
          await teacher.save();
          console.log(
            `✅ Class ${sclass.sclassName} assigned to teacher ${teacher.name}`,
          );
        }
      }
    }

    res.status(201).json({
      message: "Student admitted successfully!",
      student: result,
    });
  } catch (err) {
    console.log("❌ Fatal Error during Student Admission:", err);
    res.status(500).json({ 
        message: `Internal Server Error: ${err.message}`,
        error: err.message 
    });
  }
};

const studentLogin = async (req, res) => {
  if (req.body.rollNum && req.body.studentName && req.body.password) {
    let student = await Student.findOne({
      rollNum: req.body.rollNum,
      name: req.body.studentName,
    });
    if (student) {
      const validPassword = await bcrypt.compare(
        req.body.password,
        student.password,
      );
      if (validPassword) {
        const token = signAuthToken({
          userId: student._id,
          schoolId: student.school,
          role: 'parent',
          userType: 'parent'
        });
        student.password = undefined;
        res.send({ ...student.toObject(), token });
      } else {
        res.status(400).json({ message: "Invalid Password" });
      }
    } else {
      res.status(404).json({ message: "Student not found" });
    }
  } else {
    res
      .status(400)
      .json({
        message: "All fields are required (Name, Roll Number, Password)",
      });
  }
};

// 2. Student List Fetch karna (School ID ke hisab se)
const getStudentsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { session, campus } = req.query; // Expect optional session/campus query param

    let query = { school: schoolId, status: "Active" };
    if (session) {
      query.session = session;
    }
    if (isValidCampusId(campus)) {
      query.$or = [
        { campus: campus },
        { campus: { $exists: false } },
        { campus: null }
      ];
    }

    // Find students belonging to this school ID
    // .populate('sclassName') se class ka poora data bhi saath mein aa jayega
    const students = await Student.find(query)
      .populate("sclassName")
      .populate("session"); // Populate session details if needed

    if (students.length === 0) {
      return res.status(200).json([]);
    }

    // Security: Password ko response se hata diya
    const safeStudents = students.map((student) => {
      const { password, ...rest } = student.toObject();
      return rest;
    });

    res.status(200).json(safeStudents);
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Internal Server Error while fetching students.",
        error: err.message,
      });
  }
};

// 3. Disabled Student List Fetch karna
const getDisabledStudents = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { campus } = req.query;
    
    let query = { school: schoolId, status: "Disabled" };
    if (isValidCampusId(campus)) query.campus = campus;

    const students = await Student.find(query)
      .populate("sclassName")
      .populate("disableInfo.disabledBy", "schoolName");

    if (students.length === 0) {
      return res.status(200).json([]);
    }

    const safeStudents = students.map((student) => {
      const { password, ...rest } = student.toObject();
      return rest;
    });

    res.status(200).json(safeStudents);
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Internal Server Error while fetching disabled students.",
        error: err.message,
      });
  }
};

const updateStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const updateData = { ...req.body };

    const safeParse = (value, fallback) => {
      if (typeof value !== "string") return value ?? fallback;
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      try {
        return JSON.parse(trimmed);
      } catch (_) {
        return fallback;
      }
    };

    // Multipart form fields for nested objects arrive as JSON strings.
    // Parse only when keys are present to avoid overwriting existing data on partial updates.
    if (Object.prototype.hasOwnProperty.call(updateData, "father")) {
      updateData.father = safeParse(updateData.father, {});
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "mother")) {
      updateData.mother = safeParse(updateData.mother, {});
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "guardian")) {
      updateData.guardian = safeParse(updateData.guardian, {});
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "transport")) {
      updateData.transport = safeParse(updateData.transport, {});
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "siblings")) {
      updateData.siblings = safeParse(updateData.siblings, []);
    }

    if (updateData.rollNum !== undefined && updateData.rollNum !== "") {
      updateData.rollNum = Number(updateData.rollNum);
    }

    if (updateData.campus === "") delete updateData.campus;
    if (updateData.session === "") delete updateData.session;
    if (updateData.studentPhotoUrl) {
      updateData.studentPhoto = updateData.studentPhotoUrl;
      delete updateData.studentPhotoUrl;
    }

    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
      updateData.passwordChangedAt = new Date();
    } else {
      delete updateData.password;
    }

    if (req.files) {
      if (req.files["studentPhoto"])
        updateData.studentPhoto = req.files["studentPhoto"][0].path;
      if (req.files["fatherPhoto"])
        updateData.father = {
          ...updateData.father,
          photo: req.files["fatherPhoto"][0].path,
        };
      if (req.files["motherPhoto"])
        updateData.mother = {
          ...updateData.mother,
          photo: req.files["motherPhoto"][0].path,
        };
      if (req.files["guardianPhoto"])
        updateData.guardian = {
          ...updateData.guardian,
          photo: req.files["guardianPhoto"][0].path,
        };
    }

    // If status is being changed to 'Disabled', handle disable info
    if (updateData.status === "Disabled") {
      if (!updateData.disableInfo || !updateData.disableInfo.reason) {
        return res.status(400).json({
          message: "Disable reason is required when disabling a student",
        });
      }
      if (!updateData.disableInfo.disabledDate) {
        updateData.disableInfo.disabledDate = new Date();
      }
    } else if (updateData.status === "Active") {
      // If re-enabling student, clear disable info
      updateData.disableInfo = {
        reason: null,
        description: null,
        disabledDate: null,
        disabledBy: null,
      };
    }

    const result = await Student.findByIdAndUpdate(studentId, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("sclassName")
      .populate("disableInfo.disabledBy", "schoolName");

    if (!result) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating student", error: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    await Student.findByIdAndDelete(studentId);
    res.status(200).json({ message: "Student deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting student", error: err.message });
  }
};

const promoteStudents = async (req, res) => {
  try {
    const { studentIds, nextClassId } = req.body;

    if (!studentIds || !nextClassId) {
      return res
        .status(400)
        .json({ message: "Student IDs and Next Class ID are required" });
    }

    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { sclassName: nextClassId } },
    );

    // Auto-assign new class to teacher if applicable
    const sclass = await Sclass.findById(nextClassId);
    if (sclass && sclass.classIncharge) {
      const teacher = await Teacher.findById(sclass.classIncharge);
      if (teacher && !teacher.assignedClasses.includes(nextClassId)) {
        teacher.assignedClasses.push(nextClassId);
        await teacher.save();
      }
    }

    res.send({ message: "Students promoted successfully", result });
  } catch (err) {
    res.status(500).json(err);
  }
};

// 5. Student By ID fetch karna
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id).populate("sclassName");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { password, ...rest } = student.toObject();
    res.status(200).json(rest);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching student", error: err.message });
  }
};

const getNextAdmissionNumber = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { session } = req.query;

    // Fetch school details for prefix
    const admin = await Admin.findById(schoolId);
    const prefix = getAdmissionPrefix(admin);

    const admissionFilter = { school: schoolId };
    if (isValidCampusId(session)) {
      admissionFilter.session = session;
    }

    const students = await Student.find(admissionFilter).select("admissionNum");

    let nextNumber = 0;
    if (students.length > 0) {
      const numbers = students
        .map((s) => {
          if (!s.admissionNum) return null;
          const parts = s.admissionNum.split("-");
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          return Number.isNaN(num) ? null : num;
        })
        .filter((n) => n !== null && n >= 0);

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    res
      .status(200)
      .json({
        nextAdmissionNum: `${prefix}-${nextNumber.toString().padStart(4, "0")}`,
      });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error fetching next admission number",
        error: err.message,
      });
  }
};

module.exports = {
  studentAdmission,
  studentLogin,
  getStudentsBySchool,
  getStudentById,
  updateStudent,
  deleteStudent,
  getDisabledStudents,
  promoteStudents,
  getNextAdmissionNumber,
};
