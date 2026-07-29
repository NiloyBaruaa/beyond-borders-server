const mongoose = require('mongoose');

// The Video blueprint
const videoSchema = new mongoose.Schema({
    videoId: { type: Number, required: true },
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
    duration: { type: String }
});

// NEW: The Quiz blueprint
const quizSchema = new mongoose.Schema({
    questionId: { type: Number, required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }], // Array of 4 text options
    correctAnswerIndex: { type: Number, required: true }, // 0, 1, 2, or 3
    gemsReward: { type: Number, default: 5 } // Gems given for correct answer
});

const moduleSchema = new mongoose.Schema({
    moduleId: { type: Number, required: true, unique: true },
    batchNumber: { type: Number, default: 1 },
    title: { type: String, required: true },
    description: { type: String },
    unlockDate: { type: Date },
    videos: [videoSchema],
    quizzes: [quizSchema], // <-- ADDED DAILY QUIZZES HERE
    isAssignmentModule: { type: Boolean, default: false }
});

module.exports = mongoose.model('CourseModule', moduleSchema);