// routes/auth.js
const authMiddleware = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const CourseModule = require('../models/CourseModule');
const Helpdesk = require('../models/Helpdesk');
const Announcement = require('../models/Announcement');
const SystemConfig = require('../models/SystemConfig');
const ConceptualSession = require('../models/ConceptualSession');
const LandingContent = require('../models/LandingContent');

// ROUTE 1: Login & Trigger OTP
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"SAWN BD" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "SAWN BD - Flight Deck Access Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #333;">
            <h2 style="color: #8B5CF6; text-align: center; margin-bottom: 20px;">COMMANDER ACCESS CODE</h2>
            <p style="color: #cccccc; text-align: center;">You have requested access to the SAWN BD Flight Deck. Use the code below to securely log in.</p>
            <div style="background-color: #111111; border: 1px solid #8B5CF6; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
                <h1 style="font-size: 40px; letter-spacing: 8px; margin: 0; color: #ffffff;">${otp}</h1>
            </div>
            <p style="color: #666666; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Secure OTP dispatched to ${user.email}`);
    console.log(`🔑 DEVELOPER BACKDOOR: The OTP for ${user.email} is: ${otp}`);

    res.status(200).json({ message: "OTP Sent successfully", step: 2 });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ROUTE: Admin creates a new student (Register)
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, tempPassword, batchNumber } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Student with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      batchNumber: batchNumber || 1 
    });

    await user.save();
    res.status(200).json({ message: "Student account created successfully." });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ROUTE 2: Verify OTP & Issue JWT Key
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP Code" });
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: "OTP has expired." });

    // const currentDeviceId = req.body.deviceId;

    // if (user.deviceFlagged) {
    //     return res.status(403).json({ msg: 'SECURITY LOCK: Suspicious activity detected. Contact Commander.' });
    // }

    // if (!user.deviceId) {
    //     user.deviceId = currentDeviceId;
    //     await user.save();
    // } else if (user.deviceId !== currentDeviceId) {
    //     user.deviceFlagged = true;
    //     await user.save();
    //     return res.status(403).json({ msg: 'DEVICE MISMATCH: You are trying to log in from an unauthorized device. Admin has been notified.' });
    // }

    const payload = { user: { id: user.id, role: user.role } };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
      async (err, token) => {
        if (err) throw err;

        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        // THIS IS THE FIX: Sending the token AND the role back to the frontend
        res.status(200).json({ 
            message: "Welcome to the Bootcamp",
            token: token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role 
            }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ROUTE 3: Get Student Profile (Protected Route)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -otp -otpExpires");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ROUTE 4: Get Leaderboard
router.get("/leaderboard", authMiddleware, async (req, res) => {
  try {
    const topStudents = await User.find({ role: "student" })
      .select("name gems") 
      .sort({ gems: -1 })
      .limit(10);
    res.json(topStudents);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ROUTE 5: Grade Quiz & Award Gems 
router.post('/submit-quiz', authMiddleware, async (req, res) => {
    try {
        const { moduleId, answers } = req.body; 

        const courseModule = await CourseModule.findOne({ moduleId });
        if (!courseModule) return res.status(404).json({ msg: 'Module not found' });

        let score = 0;
        let gemsEarned = 0;

        courseModule.quizzes.forEach(quiz => {
            const studentAnswer = answers.find(a => a.questionId === quiz.questionId);
            if (studentAnswer && parseInt(studentAnswer.selectedOptionIndex) === parseInt(quiz.correctAnswerIndex)) {
                score += 1;
            }
        });

        const totalQuestions = courseModule.quizzes.length;
        if (score === totalQuestions && totalQuestions > 0) {
            gemsEarned = 2; 
        } else if (score >= 5) {
            gemsEarned = 1; 
        } else {
            gemsEarned = 0; 
        }

        const user = await User.findById(req.user.id);
        const existingScore = user.quizScores.find(q => q.moduleId === parseInt(moduleId));
        if (existingScore) return res.status(400).json({ msg: 'Quiz already completed for this module.' });

        user.quizScores.push({ moduleId, score, total: totalQuestions });
        user.gems += gemsEarned;
        
        if (!user.completedModules.includes(parseInt(moduleId))) {
            user.completedModules.push(parseInt(moduleId));
        }

        await user.save();
        res.json({ score, total: totalQuestions, gemsEarned });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ROUTE 6: Get Smart Modules & Conceptual Sessions 
router.get('/modules', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig({ activeBatch: 1, latestCompletedBatch: 1 });
            await config.save();
        }

        let targetBatch;

        if (user.batchNumber === config.activeBatch) {
            targetBatch = config.activeBatch;
        } else if (user.batchNumber < config.activeBatch) {
            targetBatch = config.latestCompletedBatch;
        } else {
            targetBatch = user.batchNumber;
        }

        const modules = await CourseModule.find({ batchNumber: targetBatch }).sort({ moduleId: 1 });
        const sessions = await ConceptualSession.find({ batchNumber: targetBatch }).sort({ createdAt: -1 });

        res.json({ modules, sessions, config });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ROUTE 7: Toggle Bookmark
router.post('/toggle-bookmark', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.body;
        const user = await User.findById(req.user.id);
        
        const isBookmarked = user.bookmarkedVideos.includes(videoId);
        
        if (isBookmarked) {
            user.bookmarkedVideos = user.bookmarkedVideos.filter(id => id !== videoId);
        } else {
            user.bookmarkedVideos.push(videoId);
        }
        
        await user.save();
        res.json({ isBookmarked: !isBookmarked, bookmarkedVideos: user.bookmarkedVideos });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ROUTE: Update Student Profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.personalDetails = { ...user.personalDetails, ...req.body };
        await user.save();
        res.json({ message: 'Profile updated securely.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Get All Community Helpdesk Tickets
router.get('/helpdesk', authMiddleware, async (req, res) => {
    try {
        const tickets = await Helpdesk.find().sort({ createdAt: -1 }); 
        res.json(tickets);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Create a New Ticket
router.post('/helpdesk', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const { category, subject, details } = req.body;
        
        const newTicket = new Helpdesk({
            studentName: user.name,
            studentId: user.id,
            category,
            subject,
            details
        });
        await newTicket.save();
        res.json({ message: 'Question posted to the community.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Get Announcements & Check Notification Status
router.get('/announcements', authMiddleware, async (req, res) => {
    try {
        const posts = await Announcement.find().sort({ createdAt: -1 });
        const user = await User.findById(req.user.id);
        
        const latestPost = posts.length > 0 ? posts[0].createdAt : null;
        const hasUnread = latestPost && (!user.lastViewedAnnouncements || latestPost > user.lastViewedAnnouncements);

        res.json({ posts, hasUnread });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Mark Announcements as Read
router.post('/announcements/read', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.lastViewedAnnouncements = Date.now();
        await user.save();
        res.json({ message: 'Radar cleared.' });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ROUTE: Student Change Password
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Incorrect current password.' });
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();
        res.json({ message: 'Password updated securely.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ROUTE: Public Website Fetch (NO AUTH REQUIRED)
router.get('/landing-content', async (req, res) => {
    try {
        let content = await LandingContent.findOne();
        if (!content) {
            content = new LandingContent(); 
            await content.save();
        }
        res.json(content);
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;