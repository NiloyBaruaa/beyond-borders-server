const express = require("express");
const router = express.Router();
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authMiddleware");

// Check if user is SuperAdmin or Admin
const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role === "student")
      return res.status(403).json({ message: "Access Denied." });
    next();
  } catch (err) {
    res.status(500).send("Server Error");
  }
};

// 1. PUBLIC ROUTE: Student Submits Payment TxID
router.post("/submit", async (req, res) => {
  try {
    const { name, email, phone, transactionId, paymentMethod } = req.body;

    // Check if email or TxID already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res
        .status(400)
        .json({ message: "This email is already registered." });

    const existingTx = await Enrollment.findOne({ transactionId });
    if (existingTx)
      return res
        .status(400)
        .json({ message: "This Transaction ID has already been used." });

    const newRequest = new Enrollment({
      name,
      email,
      phone,
      transactionId,
      paymentMethod,
    });
    await newRequest.save();

    res
      .status(200)
      .json({
        message:
          "Enrollment request submitted! Waiting for Commander approval.",
      });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 2. ADMIN ROUTE: View all pending requests
router.get("/pending", [authMiddleware, verifyAdmin], async (req, res) => {
  try {
    const requests = await Enrollment.find({ status: "pending" }).sort({
      createdAt: -1,
    });
    res.json(requests);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 3. ADMIN ROUTE: Approve Request & Send Welcome Email (The Magic Route)
router.post("/approve/:id", [authMiddleware, verifyAdmin], async (req, res) => {
  try {
    const request = await Enrollment.findById(req.params.id);
    if (!request)
      return res.status(404).json({ message: "Request not found." });

    // Generate a random 8-character password
    const tempPassword = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // Create the Student Account
    const newStudent = new User({
      name: request.name,
      email: request.email,
      phone: request.phone,
      password: hashedPassword,
      role: "student",
      batchNumber: 1, // You can make this dynamic later
    });
    await newStudent.save();

    // Mark request as approved
    request.status = "approved";
    await request.save();

    // SEND THE WELCOME EMAIL
 const transporter = nodemailer.createTransport({
            host: "smtp-relay.brevo.com",
            port: 587,
            secure: false, // Must be false for port 587
            auth: { 
                user: process.env.EMAIL_USER, // Your Brevo account email
                pass: process.env.EMAIL_PASS  // Your Brevo SMTP Key
            },
        });
        
        const mailOptions = {
            from: `"SAWN BD Support" <${process.env.EMAIL_USER}>`,
            // ... rest of your email config
        };

    const mailOptions = {
      from: `"SAWN BD" <${process.env.EMAIL_USER}>`,
      to: newStudent.email,
      subject: "Welcome to SAWN BD Bootcamp! 🚀",
      html: `
                <div style="font-family: Arial; max-width: 500px; margin: auto; background: #0a0a0a; color: #fff; padding: 30px; border-radius: 10px;">
                    <h2 style="color: #8B5CF6;">Payment Verified! 🎉</h2>
                    <p>Hello ${newStudent.name},</p>
                    <p>Your payment has been successfully verified by the Commander. Welcome to the SAWN BD Europe Study Abroad Bootcamp!</p>
                    <div style="background: #111; padding: 20px; border-left: 4px solid #00f0ff; margin: 20px 0;">
                        <p><strong>Your Flight Deck Login:</strong></p>
                        <p>Email: ${newStudent.email}</p>
                        <p>Password: <span style="color: #00f0ff; font-weight: bold; letter-spacing: 2px;">${tempPassword}</span></p>
                    </div>
                    <p>Please log in and change your password immediately from your profile settings.</p>
                    <a href="https://your-website-url.com/login" style="background: #8B5CF6; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to Dashboard</a>
                </div>
            `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Student Approved! Welcome email and password sent." });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// 4. ADMIN ROUTE: Reject Request
router.post("/reject/:id", [authMiddleware, verifyAdmin], async (req, res) => {
  try {
    await Enrollment.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.json({ message: "Request rejected." });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
