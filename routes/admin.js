// routes/admin.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const User = require('../models/User');
const CourseModule = require('../models/CourseModule');
const Helpdesk = require('../models/Helpdesk');
const Announcement = require('../models/Announcement');
const SystemConfig = require('../models/SystemConfig');
const ConceptualSession = require('../models/ConceptualSession');
const LandingContent = require('../models/LandingContent');
const superAdminMiddleware = require('../middleware/superAdminMiddleware');
const bcrypt = require('bcryptjs'); 
// ROUTE 1: Get all students and their assignments
router.get('/dashboard-data', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        // Find all users who are 'student' role, returning only necessary fields
        const students = await User.find({ role: 'student' }).select('-password -otp -otpExpires');
        res.json(students);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ROUTE 2: Grade an assignment
router.post('/grade-assignment', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { studentId, assignmentId, marks, status } = req.body;

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Find the specific assignment in the student's array
        const assignmentIndex = student.assignments.findIndex(a => a.assignmentId === assignmentId);
        if (assignmentIndex === -1) return res.status(404).json({ message: "Assignment not found" });

        // Update the marks and status
        student.assignments[assignmentIndex].marksObtained = marks;
        student.assignments[assignmentIndex].status = status; // 'graded' or 'resubmit_requested'

        // If resubmit requested, deduct 5 gems (Programming Hero style penalty)
        if (status === 'resubmit_requested') {
            student.gems = Math.max(0, student.gems - 5);
        }

        await student.save();

        res.status(200).json({ message: "Grade submitted successfully!" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// ROUTE 3: Add Content Dynamically (No Code Needed!)
router.post('/add-content', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        // You will send this data from a form in your Admin Dashboard
        const { moduleId, title, description, newVideos, newQuizzes, isAssignmentModule } = req.body;

        // Find the module, or create it if it doesn't exist
        let courseModule = await CourseModule.findOne({ moduleId });

        if (courseModule) {
            // Module exists? Just push the new daily videos/quizzes into it!
            if (newVideos && newVideos.length > 0) courseModule.videos.push(...newVideos);
            if (newQuizzes && newQuizzes.length > 0) courseModule.quizzes.push(...newQuizzes);
            await courseModule.save();
            return res.json({ message: `Successfully added content to Module ${moduleId}` });
        } else {
            // It's a brand new week/module? Create it!
            courseModule = new CourseModule({ 
                moduleId, 
                title, 
                description, 
                videos: newVideos || [], 
                quizzes: newQuizzes || [], 
                isAssignmentModule: isAssignmentModule || false 
            });
            await courseModule.save();
            return res.json({ message: `New Module ${moduleId} Created Successfully!` });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ROUTE 4: Generate Paid Student Account
router.post('/register-student', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        // When someone pays you via bKash, you type their details into your Admin UI
        const { name, email, phone, tempPassword } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "Student already exists in the system." });

        // Encrypt their temporary password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        user = new User({
            name, 
            email, 
            phone, 
            password: hashedPassword, 
            role: 'student', 
            gems: 0,
            completedModules: []
        });

        await user.save();
        res.status(200).json({ message: `Access granted. Paid account created for ${name}.` });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// ROUTE 5: Get All Students (For Admin Roster)
// Get Paginated Students
router.get('/students', [authMiddleware, verifySuperAdmin], async (req, res) => {
    try {
        // Grab page and limit from the URL, default to page 1, 20 students per page
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Fetch only the requested slice of students
        const students = await User.find({ role: 'student' })
            .select('-password -otp')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Count total students so the frontend knows how many pages exist
        const total = await User.countDocuments({ role: 'student' });

        res.json({
            students,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalStudents: total
        });
    } catch (err) { 
        res.status(500).send('Server Error'); 
    }
});

// ROUTE 6: Reset Device Lock
router.post('/reset-device/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { deviceId: null, deviceFlagged: false });
        res.json({ message: 'Device lock reset. Student can now log in from a new device.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE 7: Terminate Student Account
router.delete('/students/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Student account terminated permanently.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE 8: Delete an Entire Module
router.delete('/module/:moduleId', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        await CourseModule.findOneAndDelete({ moduleId: req.params.moduleId });
        res.json({ message: 'Module completely deleted from the grid.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE 9: Delete a Single Quiz Question
router.delete('/module/:moduleId/quiz/:questionId', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const mod = await CourseModule.findOne({ moduleId: req.params.moduleId });
        if (!mod) return res.status(404).json({ message: 'Module not found' });
        
        mod.quizzes = mod.quizzes.filter(q => q.questionId !== parseInt(req.params.questionId));
        await mod.save();
        
        res.json({ message: 'Quiz question deleted.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Get Specific Student Profile
router.get('/student/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const student = await User.findById(req.params.id).select('-password');
        res.json(student);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Modify Student Gems
router.post('/student/:id/gems', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { amount, action } = req.body; // action: 'add' or 'subtract'
        const student = await User.findById(req.params.id);
        
        if (action === 'add') student.gems += parseInt(amount);
        if (action === 'subtract') student.gems -= parseInt(amount);
        
        await student.save();
        res.json({ message: `Gems updated. New balance: ${student.gems}`, gems: student.gems });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Grade Assignment
router.post('/student/:id/grade', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { assignmentId, marksObtained, feedback } = req.body;
        const student = await User.findById(req.params.id);
        
        // Find existing assignment or create it
        let assignment = student.assignments.find(a => a.assignmentId === parseInt(assignmentId));
        if (!assignment) {
            student.assignments.push({ assignmentId, status: 'Graded', marksObtained, feedback });
        } else {
            assignment.status = 'Graded';
            assignment.marksObtained = marksObtained;
            assignment.feedback = feedback;
        }

        // Award gems based on marks (e.g., 10 gems for a perfect SOP)
        if (marksObtained >= 80) student.gems += 10;
        else if (marksObtained >= 50) student.gems += 5;

        await student.save();
        res.json({ message: 'Assignment graded and Gems awarded.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Commander Reply to Ticket
router.post('/helpdesk/:id/reply', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const ticket = await Helpdesk.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        ticket.adminReply = req.body.reply;
        ticket.status = 'Resolved';
        await ticket.save();
        
        res.json({ message: 'Reply posted and ticket resolved.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Delete a Ticket (Moderation)
router.delete('/helpdesk/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        await Helpdesk.findByIdAndDelete(req.params.id);
        res.json({ message: 'Ticket deleted from the community.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Get All Announcements (Admin)
router.get('/announcements', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const posts = await Announcement.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Create Announcement
router.post('/announcements', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const newPost = new Announcement(req.body);
        await newPost.save();
        res.json({ message: 'Broadcast dispatched to all recruits.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Edit Announcement
router.put('/announcements/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        await Announcement.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: 'Broadcast updated.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Delete Announcement
router.delete('/announcements/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: 'Broadcast permanently deleted.' });
    } catch (err) { res.status(500).send('Server Error'); }
});


// ROUTE: Get or Update System Config (Batches)
router.post('/config', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { activeBatch, latestCompletedBatch } = req.body;
        let config = await SystemConfig.findOne();
        if (!config) config = new SystemConfig();
        
        if (activeBatch) config.activeBatch = parseInt(activeBatch);
        if (latestCompletedBatch) config.latestCompletedBatch = parseInt(latestCompletedBatch);
        
        await config.save();
        res.json({ message: 'Global Cohort Rules Updated.', config });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Deploy Conceptual Session
router.post('/conceptual-session', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const newSession = new ConceptualSession(req.body);
        await newSession.save();
        res.json({ message: 'Conceptual Session deployed successfully.' });
    } catch (err) { res.status(500).send('Server Error'); }
});


// ROUTE: Admin Force Password Reset
router.post('/student/:id/reset-password', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
        res.json({ message: `Student password successfully overridden.` });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});


// ROUTE: Staff Updates Website Content (LIMITLESS ENGINE)
router.post('/landing-content', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        let content = await LandingContent.findOne();
        
        if (!content) {
            // First time setup
            content = new LandingContent({ ...req.body, updatedAt: Date.now() });
            await content.save();
        } else {
            // Forcefully overwrite the entire document with whatever the frontend sends
            await LandingContent.updateOne(
                { _id: content._id }, 
                { $set: { ...req.body, updatedAt: Date.now() } }
            );
        }
        res.json({ message: 'Website Live Content Updated Successfully!' });
    } catch (err) { 
        res.status(500).send('Server Error'); 
    }
});

// ================= STAFF MANAGEMENT (SUPER ADMIN ONLY) =================

// ROUTE: Get all staff members
router.get('/staff', [authMiddleware, superAdminMiddleware], async (req, res) => {
    try {
        const staff = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('-password -otp');
        res.json(staff);
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Create a new Admin
router.post('/add-staff', [authMiddleware, superAdminMiddleware], async (req, res) => {
    try {
        const { name, email, password, role } = req.body; // role should be 'admin'

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "Email already in use." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'admin'
        });

        await user.save();
        res.json({ message: 'New staff member deployed successfully.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Remove an Admin
router.delete('/remove-staff/:id', [authMiddleware, superAdminMiddleware], async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        
        // Prevent deleting other superadmins or yourself
        if (targetUser.role === 'superadmin') {
            return res.status(403).json({ message: "Cannot delete a Super Admin." });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Staff member access revoked.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

const verifySuperAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'superadmin') {
            return res.status(403).json({ message: 'ACCESS DENIED: Commander clearance required.' });
        }
        next();
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// ================= STAFF MANAGEMENT ROUTES =================

// 1. Get all active staff (Admins & Superadmins)
router.get('/staff', [authMiddleware, verifySuperAdmin], async (req, res) => {
    try {
        const staff = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('-password -otp');
        res.json(staff);
    } catch (err) { res.status(500).send('Server Error'); }
});

// 2. Authorize a new Admin
router.post('/add-staff', [authMiddleware, verifySuperAdmin], async (req, res) => {
    try {
        const { name, email, tempPassword } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "An account with this email already exists." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'admin' // Forces the role to be standard admin
        });

        await user.save();
        res.json({ message: 'New Admin deployed successfully.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

// 3. Revoke Admin Access (Delete)
router.delete('/remove-staff/:id', [authMiddleware, verifySuperAdmin], async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        
        if (!targetUser) return res.status(404).json({ message: "User not found." });
        if (targetUser.role === 'superadmin') {
            return res.status(403).json({ message: "Protocol dictates you cannot delete the Super Admin." });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Admin access permanently revoked.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const transporter = require('../config/nodemailer'); // Your Brevo config

// SECRET BACKUP ROUTE
router.get('/secret-db-backup', async (req, res) => {
    // 1. Add a secret password so hackers can't trigger this
    if (req.query.key !== process.env.BACKUP_SECRET_KEY) {
        return res.status(401).send('Unauthorized');
    }

    try {
        // 2. Fetch all critical data
        const users = await User.find().select('-password');
        const enrollments = await Enrollment.find();
        
        const backupData = JSON.stringify({ users, enrollments }, null, 2);

        // 3. Email it to yourself via Brevo
        await transporter.sendMail({
            from: `"SAWN BD Server" <${process.env.EMAIL_USER}>`,
            to: "support.sawnbd@protonmail.com",
            subject: `Database Backup - ${new Date().toISOString()}`,
            text: "Attached is the latest database backup.",
            attachments: [
                {
                    filename: `sawn-bd-backup-${Date.now()}.json`,
                    content: backupData
                }
            ]
        });

        res.send('Backup emailed successfully!');
    } catch (err) {
        res.status(500).send('Backup failed');
    }
});
module.exports = router;
