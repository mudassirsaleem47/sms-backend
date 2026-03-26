const router = require('express').Router();
const upload = require('../middleware/uploadMiddleware');
const loginRateLimit = require('../middleware/loginRateLimit');
const { authenticateToken, requireRoles, requireSchoolAccess, requireSelfOrAdmin } = require('../middleware/auth');
const { adminRegister, adminLogin, getAdminDetail, updateAdmin, updateAdminSettings } = require('../controllers/admin-controller.js');
const { requestPasswordReset, resetPassword, verifyEmail, resendVerificationEmail } = require('../controllers/auth-controller.js');
const { studentAdmission, studentLogin, getStudentsBySchool, getStudentById, updateStudent, deleteStudent, getDisabledStudents, promoteStudents, getNextAdmissionNumber } = require('../controllers/student-controller.js');
const { enquiryCreate, enquiryList, enquiryDelete, enquiryUpdate } = require('../controllers/enquiry-controller.js');
const { sclassCreate, getSclassesBySchool, deleteSclass, addSection, deleteSection, updateSclass, reorderSclasses } = require('../controllers/sclass-controller.js');
const { createSection, getSectionsBySchool, deleteSection: deleteStandaloneSection, updateSection } = require('../controllers/section-controller.js');

const { addTeacher, getTeachersBySchool, updateTeacher, deleteTeacher, assignClassToTeacher, removeClassFromTeacher, teacherLogin } = require('../controllers/teacher-controller.js');
const { visitorCreate, visitorList, visitorUpdate, visitorDelete } = require('../controllers/visitor-controller.js');
const { createComplain, getComplains, getComplainById, updateComplain, deleteComplain } = require('../controllers/complain-controller.js');
const { createPhoneCall, getPhoneCalls, getPhoneCallById, updatePhoneCall, deletePhoneCall } = require('../controllers/phonecall-controller.js');
const { getNotifications, createNotification, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, getUnreadCount } = require('../controllers/notification-controller.js');
const { createFeeStructure, getFeeStructuresBySchool, updateFeeStructure, deleteFeeStructure, assignFeeToStudents, getStudentFees, getPendingFees, collectFee, getFeeTransactions, getReceiptDetails, getFeeStatistics, revertTransaction, sendFeeReminder } = require('../controllers/fee-controller.js');
const { createIncome, getIncomeBySchool, updateIncome, deleteIncome, getIncomeStatistics } = require('../controllers/income-controller.js');
const { createExpense, getExpenseBySchool, updateExpense, deleteExpense, getExpenseStatistics } = require('../controllers/expense-controller.js');
const {
    createExamGroup, getExamGroupsBySchool, updateExamGroup, deleteExamGroup,
    createExamSchedule, getExamSchedulesByGroup, getExamSchedulesByClass, updateExamSchedule, deleteExamSchedule,
    createExamResult, getResultsByStudent, getResultsByExam, updateExamResult, deleteExamResult,
    createMarksGrade, getMarksGradesBySchool, updateMarksGrade, deleteMarksGrade,
    createMarksDivision, getMarksDivisionsBySchool, updateMarksDivision, deleteMarksDivision
} = require('../controllers/examination-controller.js');
const { createCampus, getCampusesBySchool, getCampusById, updateCampus, deleteCampus, getCampusStats } = require('../controllers/campus-controller.js');
const { createStaff, getStaffBySchool, getStaffById, updateStaff, deleteStaff, resetStaffPassword, staffLogin } = require('../controllers/staff-controller.js');
const { createDesignation, getDesignationsBySchool, updateDesignation, deleteDesignation } = require('../controllers/designation-controller.js');
const { createEvent, getEventsBySchool, getEventById, updateEvent, deleteEvent } = require('../controllers/event-controller.js');
const { createTask, getTasksBySchool, getTaskById, updateTask, deleteTask } = require('../controllers/task-controller.js');
const { createHomework, getHomeworkBySchool, getHomeworkByStudent, markHomeworkCompletion, sendOverdueHomeworkReminders, updateHomework, deleteHomework } = require('../controllers/homework-controller.js');
const {
    createMessageTemplate, getMessageTemplatesBySchool, updateMessageTemplate, deleteMessageTemplate,
    getMessageReports, sendMessages, sendBirthdayWishes,
    getMessagingSettings, saveEmailSettings, testEmailSettings,
    whatsappConnect, whatsappStatus, whatsappDisconnect
} = require('../controllers/message-controller.js');

const { getMedia, deleteMedia, uploadMedia } = require('../controllers/media-controller.js');

// --- Admin Auth Routes ---
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', loginRateLimit, adminLogin);
router.post('/admin/login', loginRateLimit, adminLogin); // Alias for case-insensitivity or cleaner URLs
router.post('/Auth/ForgotPassword', requestPasswordReset);
router.post('/Auth/ResetPassword', resetPassword);
router.post('/Auth/VerifyEmail', verifyEmail);
router.post('/Auth/ResendVerification', resendVerificationEmail);

// --- Public Login Routes ---
router.post('/StudentLogin', loginRateLimit, studentLogin);
router.post('/student/login', loginRateLimit, studentLogin); // Alias
router.post('/TeacherLogin', loginRateLimit, teacherLogin);
router.post('/teacher/login', loginRateLimit, teacherLogin); // Alias
router.post('/StaffLogin', loginRateLimit, staffLogin);
router.post('/staff/login', loginRateLimit, staffLogin); // Alias

// Protect all routes below with JWT auth.
router.use(authenticateToken);

// --- Session API Routes (Protected) ---
const { createSession, getSessionsBySchool, makeSessionActive, deleteSession, updateSession, getActiveSessionBySchool } = require('../controllers/session-controller.js');

router.post('/SessionCreate', requireRoles(['admin']), createSession);
router.get('/Sessions/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getSessionsBySchool);
router.get('/Sessions/Active/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getActiveSessionBySchool);
router.put('/Sessions/MakeActive', requireRoles(['admin']), makeSessionActive);
router.put('/Session/:id', requireRoles(['admin']), updateSession);
router.delete('/Session/:id', requireRoles(['admin']), deleteSession);

router.get('/Admin/:id', requireSchoolAccess({ paramKey: 'id' }), getAdminDetail);
router.put('/Admin/:id', requireRoles(['admin']), requireSchoolAccess({ paramKey: 'id' }), upload.fields([{ name: 'schoolLogo', maxCount: 1 }, { name: 'profilePicture', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), updateAdmin);
router.put('/Admin/Settings/:id', requireRoles(['admin']), requireSchoolAccess({ paramKey: 'id' }), updateAdminSettings);

// --- Student Routes ---
router.post('/StudentRegister', requireRoles(['admin', 'receptionist']), upload.fields([
    { name: 'studentPhoto', maxCount: 1 },
    { name: 'fatherPhoto', maxCount: 1 },
    { name: 'motherPhoto', maxCount: 1 },
    { name: 'guardianPhoto', maxCount: 1 }
]), studentAdmission);
router.get('/NextAdmissionNumber/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getNextAdmissionNumber);
router.get('/Students/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getStudentsBySchool);
router.get('/Student/:id', getStudentById);
router.put('/Student/:id', requireRoles(['admin', 'receptionist']), upload.fields([
    { name: 'studentPhoto', maxCount: 1 },
    { name: 'fatherPhoto', maxCount: 1 },
    { name: 'motherPhoto', maxCount: 1 },
    { name: 'guardianPhoto', maxCount: 1 }
]), updateStudent);
router.delete('/Student/:id', requireRoles(['admin', 'receptionist']), deleteStudent);
router.get('/Students/Disabled/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getDisabledStudents);
router.put('/Students/Promote', requireRoles(['admin', 'receptionist']), promoteStudents);

// --- SClass (Academic) Routes ---
router.post('/SclassCreate', requireRoles(['admin', 'receptionist']), sclassCreate);
router.get('/Sclasses/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getSclassesBySchool);
router.delete('/Sclass/:id', requireRoles(['admin', 'receptionist']), deleteSclass);
router.put('/SclassUpdate/:id', requireRoles(['admin', 'receptionist']), updateSclass);
router.post('/SclassReorder', requireRoles(['admin', 'receptionist']), reorderSclasses);
router.put('/Sclass/:id/Section', requireRoles(['admin', 'receptionist']), addSection);

router.delete('/Sclass/:id/Section/:sectionId', requireRoles(['admin', 'receptionist']), deleteSection);

// --- Standalone Section Routes ---
router.post('/SectionCreate', requireRoles(['admin', 'receptionist']), createSection);
router.get('/Sections/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getSectionsBySchool);
router.put('/SectionUpdate/:id', requireRoles(['admin', 'receptionist']), updateSection);
router.delete('/SectionDelete/:id', requireRoles(['admin', 'receptionist']), deleteStandaloneSection);

// --- Subject Routes ---
const { subjectCreate, getSubjectDetail, deleteSubject, allSubjects, deleteSubjects, updateSubject } = require('../controllers/subject-controller.js');

router.post('/SubjectCreate', subjectCreate);
router.get('/AllSubjects/:id', allSubjects);
router.get('/Subject/:id', getSubjectDetail);
router.delete('/Subject/:id', deleteSubject);
router.delete('/Subjects/:id', deleteSubjects);
router.put('/Subject/:id', updateSubject);

// --- Subject Group Routes ---
const { createSubjectGroup, getSubjectGroupsBySchool, updateSubjectGroup, deleteSubjectGroup } = require('../controllers/subject-group-controller.js');

router.post('/SubjectGroupCreate', createSubjectGroup);
router.get('/SubjectGroups/:schoolId', getSubjectGroupsBySchool);
router.put('/SubjectGroup/:id', updateSubjectGroup);
router.delete('/SubjectGroup/:id', deleteSubjectGroup);

// --- Class Schedule Routes ---
const { createSchedule, getScheduleByClassSection, getTeacherSchedule } = require('../controllers/class-schedule-controller.js');

router.post('/ScheduleCreate', createSchedule);
router.get('/Schedule/:classId/:sectionId', getScheduleByClassSection);
router.get('/TeacherSchedule/:teacherId', getTeacherSchedule);


// --- Enquiry Routes ---
router.post('/EnquiryCreate', requireRoles(['admin', 'receptionist']), enquiryCreate);
router.get('/EnquiryList/:id', requireSchoolAccess({ paramKey: 'id' }), enquiryList);
router.delete('/EnquiryDelete/:id', requireRoles(['admin', 'receptionist']), enquiryDelete);
router.put('/EnquiryUpdate/:id', requireRoles(['admin', 'receptionist']), enquiryUpdate);

// --- Teacher Routes ---
router.post('/TeacherRegister', requireRoles(['admin']), addTeacher);
router.get('/Teachers/:schoolId', requireSchoolAccess({ paramKey: 'schoolId' }), getTeachersBySchool);
router.put('/Teacher/:id', requireRoles(['admin']), updateTeacher);
router.delete('/Teacher/:id', requireRoles(['admin']), deleteTeacher);
router.put('/Teacher/:id/AssignClass', requireRoles(['admin']), assignClassToTeacher);
router.delete('/Teacher/:id/Class/:classId', requireRoles(['admin']), removeClassFromTeacher);


// --- Visitor Routes ---
router.post('/VisitorCreate', visitorCreate);
router.get('/Visitors/:schoolId', visitorList);
router.put('/Visitor/:id', visitorUpdate);
router.delete('/Visitor/:id', visitorDelete);

// --- Complain Routes ---
router.post('/ComplainCreate', upload.single('document'), createComplain);
router.get('/Complains/:schoolId', getComplains);
router.get('/Complain/:id', getComplainById);
router.put('/Complain/:id', upload.single('document'), updateComplain);
router.delete('/Complain/:id', deleteComplain);

// --- Phone Call Routes ---
router.post('/PhoneCallCreate', createPhoneCall);
router.get('/PhoneCalls/:schoolId', getPhoneCalls);
router.get('/PhoneCall/:id', getPhoneCallById);
router.put('/PhoneCall/:id', updatePhoneCall);
router.delete('/PhoneCall/:id', deletePhoneCall);

// --- Notification Routes ---
router.get('/Notifications/:userId', requireSelfOrAdmin('userId'), getNotifications);
router.post('/NotificationCreate', createNotification);
router.put('/Notification/:id/read', markAsRead);
router.put('/Notifications/read-all/:userId', requireSelfOrAdmin('userId'), markAllAsRead);
router.delete('/Notification/:id', deleteNotification);
router.delete('/Notifications/clear-all/:userId', requireSelfOrAdmin('userId'), clearAllNotifications);
router.get('/Notifications/:userId/unread-count', requireSelfOrAdmin('userId'), getUnreadCount);

// --- Fee Management Routes ---
router.post('/FeeStructureCreate', createFeeStructure);
router.get('/FeeStructures/:schoolId', getFeeStructuresBySchool);
router.put('/FeeStructure/:id', updateFeeStructure);
router.delete('/FeeStructure/:id', deleteFeeStructure);
router.post('/AssignFee', assignFeeToStudents);
router.get('/StudentFees/:studentId', getStudentFees);
router.get('/PendingFees/:schoolId', getPendingFees);
router.post('/CollectFee', collectFee);
router.get('/FeeTransactions/:schoolId', getFeeTransactions);
router.delete('/RevertTransaction/:transactionId', revertTransaction);
router.get('/FeeReceipt/:transactionId', getReceiptDetails);
router.get('/FeeStatistics/:schoolId', getFeeStatistics);
router.post('/Fee/Remind/:id', sendFeeReminder);
// --- Income Management Routes ---


// --- Income Management Routes ---
router.post('/IncomeCreate', createIncome);
router.get('/Income/:schoolId', getIncomeBySchool);
router.put('/Income/:id', updateIncome);
router.delete('/Income/:id', deleteIncome);
router.get('/IncomeStatistics/:schoolId', getIncomeStatistics);

// --- Expense Management Routes ---
router.post('/ExpenseCreate', createExpense);
router.get('/Expense/:schoolId', getExpenseBySchool);
router.put('/Expense/:id', updateExpense);
router.delete('/Expense/:id', deleteExpense);
router.get('/ExpenseStatistics/:schoolId', getExpenseStatistics);

// --- Examination Management Routes ---
// Exam Groups
router.post('/ExamGroupCreate', createExamGroup);
router.get('/ExamGroups/:schoolId', getExamGroupsBySchool);
router.put('/ExamGroup/:id', updateExamGroup);
router.delete('/ExamGroup/:id', deleteExamGroup);

// Exam Schedules
router.post('/ExamScheduleCreate', createExamSchedule);
router.get('/ExamSchedules/Group/:groupId', getExamSchedulesByGroup);
router.get('/ExamSchedules/Class/:classId', getExamSchedulesByClass);
router.put('/ExamSchedule/:id', updateExamSchedule);
router.delete('/ExamSchedule/:id', deleteExamSchedule);

// Exam Results
router.post('/ExamResultCreate', createExamResult);
router.get('/ExamResults/Student/:studentId', getResultsByStudent);
router.get('/ExamResults/Exam/:scheduleId', getResultsByExam);
router.put('/ExamResult/:id', updateExamResult);
router.delete('/ExamResult/:id', deleteExamResult);

// Marks Grades
router.post('/MarksGradeCreate', createMarksGrade);
router.get('/MarksGrades/:schoolId', getMarksGradesBySchool);
router.put('/MarksGrade/:id', updateMarksGrade);
router.delete('/MarksGrade/:id', deleteMarksGrade);

// Marks Divisions
router.post('/MarksDivisionCreate', createMarksDivision);
router.get('/MarksDivisions/:schoolId', getMarksDivisionsBySchool);
router.put('/MarksDivision/:id', updateMarksDivision);
router.delete('/MarksDivision/:id', deleteMarksDivision);

// --- Campus Management Routes ---
router.post('/Campus', createCampus);
router.get('/Campuses/:schoolId', getCampusesBySchool);
router.get('/Campus/:id', getCampusById);
router.put('/Campus/:id', updateCampus);
router.delete('/Campus/:id', deleteCampus);
router.get('/CampusStats/:id', getCampusStats);


// --- Staff Management Routes ---
router.post('/Staff', requireRoles(['admin']), requireSchoolAccess({ bodyKey: 'school' }), createStaff);
router.get('/Staff/:schoolId', requireRoles(['admin']), requireSchoolAccess({ paramKey: 'schoolId' }), getStaffBySchool);
router.get('/StaffDetail/:id', requireRoles(['admin']), getStaffById);
router.put('/Staff/:id', requireRoles(['admin']), updateStaff);
router.delete('/Staff/:id', requireRoles(['admin']), deleteStaff);
router.put('/Staff/:id/resetPassword', requireRoles(['admin']), resetStaffPassword);

// --- Designation Management Routes ---
router.post('/Designation', createDesignation);
router.get('/Designations/:schoolId', getDesignationsBySchool);
router.put('/Designation/:id', updateDesignation);
router.delete('/Designation/:id', deleteDesignation);

// --- Event Management Routes ---
router.post('/Event', createEvent);
router.get('/Events/:schoolId', getEventsBySchool);
router.get('/Event/:id', getEventById);
router.put('/Event/:id', updateEvent);
router.delete('/Event/:id', deleteEvent);

// --- Task Management Routes ---
router.post('/Task', createTask);
router.get('/Tasks/:schoolId', getTasksBySchool);
router.get('/Task/:id', getTaskById);
router.put('/Task/:id', updateTask);
router.delete('/Task/:id', deleteTask);

// --- Homework & Assignment Routes ---
router.post('/Homework', createHomework);
router.get('/Homework/Student/:studentId', getHomeworkByStudent);
router.put('/Homework/:id/Student/:studentId/Complete', markHomeworkCompletion);
router.post('/Homework/:schoolId/RemindOverdue', sendOverdueHomeworkReminders);
router.get('/Homework/:schoolId', getHomeworkBySchool);
router.put('/Homework/:id', updateHomework);
router.delete('/Homework/:id', deleteHomework);

// --- Communication / Messaging Routes ---
// Message Templates
router.post('/MessageTemplateCreate', createMessageTemplate);
router.get('/MessageTemplates/:schoolId', getMessageTemplatesBySchool);
router.put('/MessageTemplate/:id', updateMessageTemplate);
router.delete('/MessageTemplate/:id', deleteMessageTemplate);

// Send Messages
router.post('/SendMessages', sendMessages);
router.post('/SendBirthdayWishes', sendBirthdayWishes);

// Message Reports
router.get('/MessageReports/:schoolId', getMessageReports);

// Messaging Settings
router.get('/MessagingSettings/:schoolId', requireRoles(['admin']), requireSchoolAccess({ paramKey: 'schoolId' }), getMessagingSettings);
router.post('/EmailSettings', requireRoles(['admin']), requireSchoolAccess({ bodyKey: 'school' }), saveEmailSettings);
router.post('/EmailSettings/Test', requireRoles(['admin']), requireSchoolAccess({ bodyKey: 'school' }), testEmailSettings);

// WhatsApp
router.post('/WhatsApp/Connect', requireRoles(['admin']), requireSchoolAccess({ bodyKey: 'school' }), whatsappConnect);
router.get('/WhatsApp/Status/:schoolId', requireRoles(['admin']), requireSchoolAccess({ paramKey: 'schoolId' }), whatsappStatus);
router.post('/WhatsApp/Disconnect', requireRoles(['admin']), requireSchoolAccess({ bodyKey: 'school' }), whatsappDisconnect);


// --- Card Management Routes ---
const { getStudentCardData, getStaffCardData, getAdmitCardData } = require('../controllers/card-controller.js');

// Express 5 Router Fix: Define explicit routes instead of using ? for optional params
router.get('/Card/Student/:schoolId', getStudentCardData);
router.get('/Card/Student/:schoolId/:classId', getStudentCardData);
router.get('/Card/Student/:schoolId/:classId/:sectionId', getStudentCardData);
router.get('/Card/Staff/:schoolId/:type', getStaffCardData); // type: teacher, staff, all
router.get('/Card/Admit/:schoolId/:examGroupId/:classId', getAdmitCardData);


// --- Card Template Routes ---
const { saveTemplate, getTemplates, deleteTemplate } = require('../controllers/card-template-controller.js');

router.post('/CardTemplate/save', upload.single('backgroundImage'), saveTemplate);
router.get('/CardTemplate/:schoolId', getTemplates);
router.delete('/CardTemplate/:id', deleteTemplate);

// --- Media Management Routes ---
router.get('/Media/:schoolId', getMedia);
router.post('/MediaUpload', upload.single('document'), uploadMedia);
router.post('/MediaDelete', deleteMedia);

// --- AI Chat Routes ---
const { groqChat } = require('../controllers/ai-controller.js');
router.post('/AiChat/Groq', groqChat);

// --- Attendance Routes ---
const attendanceRoutes = require('./attendanceRoutes');
router.use('/Attendance', attendanceRoutes);
const { getAdmitCardData: getAdmitCardDataNew } = require('../controllers/admit-card-controller');

// Admit Card Routes
router.get('/AdmitCardData/:schoolId/:examGroupId/:classId', getAdmitCardDataNew);

module.exports = router;