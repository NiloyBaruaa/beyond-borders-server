// seedModules.js
const mongoose = require('mongoose');
require('dotenv').config();
const CourseModule = require('./models/CourseModule');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected. Seeding Curriculum...");

    // Clear old test data if any
    await CourseModule.deleteMany({});

    await CourseModule.create([
      {
        moduleId: 1,
        title: "Mindset & Foundation",
        description: "The brutal reality of studying in Europe.",
        videos: [
            { videoId: 101, title: "Why Europe?", videoUrl: "https://www.youtube.com/embed/dummy1", duration: "12:00" },
            { videoId: 102, title: "Cost & Survival Guide", videoUrl: "https://www.youtube.com/embed/dummy2", duration: "15:30" }
        ]
      },
      {
        moduleId: 2,
        title: "Document Mastery",
        description: "Crafting the perfect CV and SOP.",
        videos: [
            { videoId: 201, title: "The Europass CV", videoUrl: "https://www.youtube.com/embed/dummy3", duration: "10:00" },
            { videoId: 202, title: "Writing a Killer SOP", videoUrl: "https://www.youtube.com/embed/dummy4", duration: "20:00" }
        ]
      },
      {
        moduleId: 3,
        title: "Assignment: The Embassy Simulation",
        description: "Submit your final SOP and your Mock Interview video.",
        isAssignmentModule: true, // THIS IS THE MAGIC FLAG
        videos: [
            { 
                videoId: 301, 
                title: "Assignment Instructions", 
                videoUrl: "https://www.youtube.com/embed/dummy5", 
                duration: "05:00" 
            }
        ]
      }
    ]);

    console.log("✅ Curriculum Seeded Successfully!");
    process.exit();
  })
  .catch(err => console.log(err));