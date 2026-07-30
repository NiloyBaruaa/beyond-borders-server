const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// 🚀 GMAIL SMTP PORT 587 BYPASS
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Must be false for 587. It will automatically upgrade with STARTTLS.
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // This prevents Render's proxy network from rejecting the SSL certificate
    rejectUnauthorized: false
  }
});

// Verify the connection immediately when the server boots
transporter.verify((error, success) => {
  if (error) {
    console.log("🔴 Gmail SMTP Connection Error:", error.message);
  } else {
    console.log("🟢 Gmail SMTP is Ready to transmit");
  }
});

// 1. LOGIN & SEND OTP ROUTE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find User
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP via Gmail
    const mailOptions = {
      from: `"SAWN BD Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Flight Deck Access - OTP Code',
      html: `
        <div style="font-family: Arial; max-width: 500px; margin: auto; background: #0a0a0a; color: #fff; padding: 30px; border-radius: 10px;">
            <h2 style="color: #00f0ff;">Security Verification</h2>
            <p>Your OTP to access the Flight Deck is:</p>
            <h1 style="color: #8B5CF6; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in 10 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent to your email.' });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// 2. VERIFY OTP ROUTE
router.post('/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (user.otp !== otp || user.otpExpires < Date.now()) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP from database after successful verification
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate JWT Token
    const token = jwt.sign(
        { id: user._id, role: user.role }, 
        process.env.JWT_SECRET || 'SAWN_BD_SECURE_KEY', 
        { expiresIn: '1d' }
    );

    res.status(200).json({ 
        token, 
        user: { id: user._id, name: user.name, email: user.email, role: user.role } 
    });

  } catch (error) {
    console.error('Verify Error:', error);
    res.status(500).json({ message: 'Server error during verification.' });
  }
});

module.exports = router;