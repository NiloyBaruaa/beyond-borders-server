const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "student" },
  batchNumber: { type: Number, default: 1 },

  // NEW: PERSONAL DETAILS
  personalDetails: {
    dob: { type: String, default: "" },
    address: { type: String, default: "" },
    currentUniversity: { type: String, default: "" },
    targetCountry: { type: String, default: "" },
    passportNo: { type: String, default: "" },
  },

  otp: { type: String },
  otpExpires: { type: Date },
  lastViewedAnnouncements: { type: Date, default: null },
  gems: { type: Number, default: 0 },
  completedModules: [Number],
  completedVideos: [Number],
  bookmarkedVideos: [Number],
  quizScores: [
    {
      moduleId: Number,
      score: Number,
      total: Number,
    },
  ],

  // NEW: MANUAL ASSIGNMENTS
  assignments: [
    {
      assignmentId: Number, // Links to a Module ID
      submissionLink: String, // Google Drive or Docs link
      status: { type: String, default: "Pending" }, // Pending, Graded
      marksObtained: { type: Number, default: null },
      feedback: { type: String, default: "" },
    },
  ],

  deviceId: { type: String, default: null },
  deviceFlagged: { type: Boolean, default: false },
});

module.exports = mongoose.model("User", userSchema);
