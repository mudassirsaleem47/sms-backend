#!/usr/bin/env node

/**
 * Test script to verify admission number generation flow
 * Run: node test-admission-generation.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Admin = require('./models/adminSchema.js');
const Student = require('./models/studentSchema.js');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/soih-sms');
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
};

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

const testAdmissionGeneration = async () => {
  try {
    // Get the first admin/school
    const admin = await Admin.findOne();
    if (!admin) {
      console.error('❌ No admin/school found in database');
      return;
    }

    console.log('\n📋 Test Configuration:');
    console.log(`   School ID: ${admin._id}`);
    console.log(`   School Name: ${admin.schoolName}`);
    console.log(`   Admission Prefix: ${admin.settings?.admissionPrefix || 'Not configured'}`);

    // Test prefix generation
    const prefix = getAdmissionPrefix(admin);
    console.log(`\n📌 Generated Prefix: ${prefix}`);

    // Test admission number generation
    const admissionFilter = { school: admin._id };
    console.log(`\n🔍 Searching for students with filter:`, admissionFilter);

    const existingStudents = await Student.find(admissionFilter).select('admissionNum name');
    console.log(`   Found ${existingStudents.length} existing students`);

    if (existingStudents.length > 0) {
      console.log('\n📚 Existing admission numbers:');
      const numbers = [];
      existingStudents.forEach((student) => {
        console.log(`   - ${student.name}: ${student.admissionNum || 'NO ADMISSION NUM'}`);
        if (student.admissionNum) {
          const parts = student.admissionNum.split('-');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num)) numbers.push(num);
        }
      });

      if (numbers.length > 0) {
        const nextNumber = Math.max(...numbers) + 1;
        const nextAdmissionNum = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
        console.log(`\n✅ Next admission number would be: ${nextAdmissionNum}`);
      } else {
        console.log(`\n⚠️  No valid admission numbers found. Next would be: ${prefix}-0001`);
      }
    } else {
      console.log(`\n✅ First student would get: ${prefix}-0001`);
    }

    // Test with academicYear filter
    console.log('\n\n🔄 Testing with academicYear filter:');
    const currentYear = new Date().getFullYear();
    const admissionFilterWithYear = { school: admin._id, academicYear: String(currentYear) };
    console.log(`   Filter:`, admissionFilterWithYear);

    const studentsWithYear = await Student.find(admissionFilterWithYear).select('admissionNum name academicYear');
    console.log(`   Found ${studentsWithYear.length} students in academic year ${currentYear}`);

    console.log('\n✅ Test completed successfully!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
};

// Run the test
connectDB().then(() => {
  testAdmissionGeneration();
});
