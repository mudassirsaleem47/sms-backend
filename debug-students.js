#!/usr/bin/env node
/**
 * Quick debug script to check students in database
 * Usage: node debug-students.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/school-management';

const connect = async () => {
    try {
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connected');
        
        const Student = require('./models/studentSchema');
        const Admin = require('./models/adminSchema');
        
        // Get all admins
        const admins = await Admin.find({}, '_id schoolName').limit(3);
        console.log('\n📋 Admins in database:');
        admins.forEach(a => console.log(`  - ${a.schoolName} (${a._id})`));
        
        // Get all students with key fields
        const students = await Student.find({}, 'name admissionNum school sclassName status').populate('sclassName', 'sclassName').limit(10);
        console.log(`\n👥 Students in database (showing up to 10):`);
        console.log(`Total count: ${await Student.countDocuments()}`);
        
        students. forEach(s => {
            console.log(`  - ${s.name} (Admission: ${s.admissionNum}, School: ${s.school}, Class: ${s.sclassName?.sclassName}, Status: ${s.status})`);
        });
        
        // Check if any students have school set
        const studentsWithSchool = await Student.countDocuments({ school: { $exists: true, $ne: null } });
        const studentsWithoutSchool = await Student.countDocuments({ school: { $in: [null, undefined] } });
        
        console.log(`\n📊 School field status:`);
        console.log(`  - Students WITH school field: ${studentsWithSchool}`);
        console.log(`  - Students WITHOUT school field: ${studentsWithoutSchool}`);
        
        // Check if any are marked as Active
        const activeStudents = await Student.countDocuments({ status: 'Active' });
        const inactiveStudents = await Student.countDocuments({ status: { $ne: 'Active' } });
        
        console.log(`\n📊 Student status:`);
        console.log(`  - Active: ${activeStudents}`);
        console.log(`  - Non-active: ${inactiveStudents}`);
        
        if (admins.length > 0) {
            const adminId = admins[0]._id;
            console.log(`\n🔍 Searching for students with school = ${adminId}:`);
            const matches = await Student.find({ school: adminId }).select('name admissionNum school').limit(5);
            console.log(`  Found: ${matches.length}`);
            matches.forEach(m => console.log(`    - ${m.name} (${m.admissionNum})`));
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

connect();
