// routes/curriculum.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const CourseModule = require('../models/CourseModule');
const User = require('../models/User');

// Get all modules (with locking logic)
router.get('/modules', authMiddleware, async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        const allModules = await CourseModule.find().sort({ moduleId: 1 });

        // Security check: Hide video URLs for modules the student hasn't unlocked yet
        const secureModules = allModules.map(mod => {
            const isUnlocked = student.completedModules.includes(mod.moduleId - 1) || mod.moduleId === 1;

            if (isUnlocked) {
                return { ...mod.toObject(), isUnlocked: true };
            } else {
                // Strip the videos array if it's locked to prevent cheating
                return { 
                    moduleId: mod.moduleId, 
                    title: mod.title, 
                    description: mod.description, 
                    isUnlocked: false,
                    videos: [] // HIDDEN!
                };
            }
        });

        res.json(secureModules);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// ROUTE 2: Mark Module as Complete & Award Gems
router.post('/complete', authMiddleware, async (req, res) => {
    try {
        const { moduleId } = req.body;
        const user = await User.findById(req.user.id);

        // 1. Anti-Cheat: Check if they already completed it
        if (user.completedModules.includes(moduleId)) {
            return res.status(400).json({ message: "You have already claimed the gems for this module!" });
        }

        // 2. The Reward: Add to completed list and give 2 gems
        user.completedModules.push(moduleId);
        user.gems += 2;
        await user.save();

        res.status(200).json({ 
            message: "Module Completed! +2 Gems Awarded.", 
            newGemTotal: user.gems 
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;