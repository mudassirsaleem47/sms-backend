#!/usr/bin/env node

/**
 * Diagnostic script to identify admission number generation issue
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/soih-sms');
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ DB Error:', err.message);
    process.exit(1);
  }
};

const Student = require('./models/studentSchema.js');
const Admin = require('./models/adminSchema.js');

const runDiagnostics = async () => {
  try {
    // 1. Get first school
    const admin = await Admin.findOne();
    if (!admin) {
      console.error('❌ No school found');
      return;
    }
    
    console.log('\n📋 DIAGNOSTICS:');
    console.log(`School: ${admin.schoolName} (${admin._id})`);
    
    // 2. Find ALL students regardless of filter
    console.log('\n🔍 Finding ALL students in database:');
    const allStudents = await Student.find({}).select('name rollNum school admissionNum academicYear session campus').limit(5);
    console.log(`   Total: ${allStudents.length > 5 ? '5+' : allStudents.length} students`);
    allStudents.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.name || 'NO NAME'}`);
      console.log(`      School: ${s.school || 'NONE'}`);
      console.log(`      AdmissionNum: ${s.admissionNum || '❌ MISSING'}`);
      console.log(`      AcademicYear: ${s.academicYear || 'NONE'}`);
      console.log(`      Session: ${s.session || 'NONE'}`);
    });
    
    // 3. Find students for this school
    console.log(`\n🔍 Students for school ${admin._id}:`);
    const schoolStudents = await Student.find({ school: admin._id }).select('name rollNum admissionNum academicYear').limit(5);
    console.log(`   Found: ${schoolStudents.length} students`);
    schoolStudents.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.name}: ${s.admissionNum || '❌ NO ADMISSION NUM'}`);
    });
    
    // 4. Check for students with NO admission number
    console.log(`\n⚠️  Students with MISSING admissionNum:`);
    const noAdmissionNum = await Student.find({ 
      school: admin._id, 
      $or: [
        { admissionNum: { $exists: false } },
        { admissionNum: null },
        { admissionNum: '' }
      ]
    }).select('name rollNum createdAt').limit(5);
    console.log(`   Found: ${noAdmissionNum.length} students without admission numbers`);
    noAdmissionNum.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.name} (Roll: ${s.rollNum}) - Created:`,s.createdAt);
    });
    
    // 5. Check if admission numbers are actually sequential
    console.log(`\n📊 Checking admission number sequencing:`);
    const withAdmissionNum = await Student.find({ 
      school: admin._id,
      admissionNum: { $exists: true, $ne: null, $ne: '' }
    }).select('name admissionNum').limit(10);
    
    if (withAdmissionNum.length === 0) {
      console.log('   ❌ NO STUDENTS WITH ADMISSION NUMBERS!');
    } else {
      console.log(`   Found ${withAdmissionNum.length} students with admission numbers:`);
      const nums = withAdmissionNum.map(s => {
        const parts = s.admissionNum.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return { name: s.name, admissionNum: s.admissionNum, num };
      }).sort((a, b) => a.num - b.num);
      
      nums.forEach(item => {
        console.log(`   ${item.admissionNum}`);
      });
      
      const maxNum = Math.max(...nums.map(n => n.num));
      const nextNum = maxNum + 1;
      const prefix = nums[0].admissionNum.split('-')[0];
      console.log(`\n   Expected next admission number: ${prefix}-${nextNum.toString().padStart(4, '0')}`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Done\n');
  }
};

connectDB().then(() => runDiagnostics());
