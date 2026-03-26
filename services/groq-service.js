const Groq = require('groq-sdk');
const mongoose = require('mongoose');
const CODEBASE_SUMMARY = require('../codebaseSummary');

let groq = null;
const getGroqClient = () => {
    if (groq) return groq;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
        return null;
    }

    groq = new Groq({ apiKey });
    return groq;
};

// Models to provide context if needed
const Student = require('../models/studentSchema');
const Teacher = require('../models/teacherSchema');
const Staff = require('../models/staffSchema');
const Sclass = require('../models/sclassSchema');
const FeeTransaction = require('../models/feeTransactionSchema');
const Enquiry = require('../models/enquirySchema');
const InventoryItem = require('../models/inventoryItemSchema');
const Campus = require('../models/campusSchema');
const Subject = require('../models/subjectSchema');
const TransportRoute = require('../models/transportRouteSchema');

const SYSTEM_PROMPT = `You are "SMS AI Assistant", an expert in this School Management System (SAAS). 
Your goal is to help users (School Admins, Teachers, Accountants) navigate the system, understand its features, and provide information about students and staff.

**System Architecture & Features Knowledge:**
1.  **Dashboard**: Real-time stats for Fees, Income, Expense, Students, Teachers, and Employees.
2.  **Student Management**: 
    - Admission: New student entry with parent/guardian details and fee assignment.
    - Student List: Browse, edit student profiles, and manage active/inactive status.
    - Attendance: Daily attendance tracking for students.
3.  **Financials**: 
    - Fee Management: Define fee structures (Monthly, Admission, etc.), track transactions, and view pending fees.
    - Income/Expense Management: Track other school costs and revenues.
4.  **Academic**: 
    - Classes & Sections: Manage grade levels and divisions.
    - Subjects: Assign subjects to classes.
    - Class Schedule: Create timetables.
5.  **Inventory**: Track items (Item Master), Categories, Suppliers, and Stock levels.
6.  **Examination**: Create exam schedules, record results, and generate mark sheets/admit cards.
7.  **Staff & Teachers**: 
    - Teacher Management: Add/edit teachers with qualifications and subjects.
    - Staff Management: Manage accountants, receptionists, librarians, etc.
    - Payroll: Generate monthly salaries.
8.  **Transport**: Manage routes, vehicles, and pickup points.
9.  **Settings**: Customize school profile, academic sessions (years), and appearance.

**Guidelines for Answering:**
- Be professional, helpful, and concise.
- If asked "Where can I find X?", provide the exact navigation path.
- If asked about specific data, use the provided context. 
- **Language**: Respond in the **SAME LANGUAGE** used by the user (match English or Roman Urdu).
- Do not make up data. If data is missing, say you don't have it.
- **IMPORTANT**: Current date and time is ${new Date().toLocaleString()}.

**Contextual Awareness:**
You always respond based on the school's specific data if provided in the query.

**Codebase Technical Structure:**
Use this knowledge ONLY if the user asks for technical help or "Where is X feature implemented?":
${CODEBASE_SUMMARY}`;

async function getChatResponse(userQuery, schoolId, history = []) {
    try {
        const groqClient = getGroqClient();
        if (!groqClient) {
            return {
                success: false,
                error: 'GROQ_API_KEY is missing. Please set it in backend .env to enable AI chat.'
            };
        }

        // Fetch detailed stats for context if schoolId is provided
        let contextData = "";
        if (schoolId) {
            // Multi-query for maximum context
            const [
                studentCount, teacherCount, staffCount, classes,
                enquiryCount, feeStats, inventoryCount, campusCount,
                subjectCount, transportCount
            ] = await Promise.all([
                Student.countDocuments({ school: schoolId }).catch(() => 0),
                Teacher.countDocuments({ school: schoolId }).catch(() => 0),
                Staff.countDocuments({ school: schoolId }).catch(() => 0),
                Sclass.find({ school: schoolId }).limit(10).select('sclassName sections').catch(() => []),
                Enquiry.countDocuments({ school: schoolId }).catch(() => 0),
                FeeTransaction.aggregate([
                    { $match: { school: new mongoose.Types.ObjectId(schoolId), status: 'Active' } },
                    { $group: { _id: null, totalCollected: { $sum: "$amount" } } }
                ]).catch(() => []),
                InventoryItem.countDocuments({ school: schoolId }).catch(() => 0),
                Campus.countDocuments({ school: schoolId }).catch(() => 0),
                Subject.countDocuments({ school: schoolId }).catch(() => 0),
                TransportRoute.countDocuments({ school: schoolId }).catch(() => 0),
            ]);

            const totalCollected = feeStats.length > 0 ? feeStats[0].totalCollected : 0;
            
            contextData = `\n\n**School Data Context (VERY IMPORTANT - Use this for accuracy):**
            - Students: ${studentCount}
            - Teaching Staff: ${teacherCount}
            - Non-Teaching Staff: ${staffCount}
            - Total Fee Collected: Rs. ${totalCollected.toLocaleString()}
            - Active Enquiries: ${enquiryCount}
            - Inventory Stock (Items): ${inventoryCount}
            - Schools/Campuses: ${campusCount}
            - Total Subjects: ${subjectCount}
            - Transport Routes: ${transportCount}
            - Registered Classes: ${classes.map(c => c.sclassName).join(', ')}`;
        }

        const chatCompletion = await groqClient.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT + contextData },
                ...history,
                { role: "user", content: userQuery }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 1024,
        });

        return {
            success: true,
            response: chatCompletion.choices[0]?.message?.content || "No response from AI."
        };
    } catch (error) {
        console.error('Groq API Error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { getChatResponse };

