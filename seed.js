const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to Database. Creating test student...");

    // Check if user already exists to prevent duplicates
    const existingUser = await User.findOne({ email: "student@test.com" });
    if (existingUser) {
        console.log("Test student already exists!");
        process.exit();
    }

    // Hash the password just like a real user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("123456", salt);

    // Create the student
    await User.create({
      name: "Pilot Student",
      email: "student@test.com",
      password: hashedPassword,
      phone: "01700000000",
      gems: 10,
      lives: 3
    });

    console.log("✅ Success! Test student created. Email: student@test.com | Password: 123456");
    process.exit();
  })
  .catch(err => console.log(err));