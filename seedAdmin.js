// seedAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected. Creating Commander Account...");

    const existingAdmin = await User.findOne({ email: "admin@beyondborders.com" });
    if (existingAdmin) {
        console.log("Admin already exists!");
        process.exit();
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    await User.create({
      name: "Niloy Baruaa", // The Commander
      email: "admin@beyondborders.com",
      password: hashedPassword,
      phone: "01700000000",
      role: "admin" // THIS GRANTS YOU FULL ACCESS
    });

    console.log("✅ Admin Created! Email: admin@beyondborders.com | Password: admin123");
    process.exit();
  })
  .catch(err => console.log(err));