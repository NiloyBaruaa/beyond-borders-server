const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    date: { type: String, required: true },
    time: { type: String, required: true },
    zoomLink: { type: String, default: '' }, // For LIVE
    recordedVideoUrl: { type: String, default: '' }, // For LATER
    batchNumber: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConceptualSession', sessionSchema);