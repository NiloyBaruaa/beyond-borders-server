// routes/assignments.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// ROUTE 1: Submit Assignment
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const { assignmentId, docLink, videoLink } = req.body;
        const user = await User.findById(req.user.id);

        // 1. Anti-Cheat: Check if already submitted
        const hasSubmitted = user.assignments.find(a => a.assignmentId === assignmentId);
        if (hasSubmitted) {
            return res.status(400).json({ message: "You have already submitted this assignment. Resubmission costs Gems." });
        }

        // 2. Log the submission with an exact timestamp
        user.assignments.push({
            assignmentId,
            submissionLink: docLink,  // e.g., Google Doc for SOP
            liveLink: videoLink,      // e.g., Unlisted YouTube for Mock Interview
            submittedAt: new Date(),
            status: 'pending'
        });

        // 3. Optional: Give them a massive gem reward for submitting an assignment
        user.gems += 10; 

        await user.save();

        res.status(200).json({ 
            message: "Assignment locked and submitted successfully!",
            newGemTotal: user.gems
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;