const mongoose = require('mongoose');

// By setting { strict: false }, this schema becomes infinitely expandable.
// You can add new fields from your frontend without ever touching this file again.
const landingSchema = new mongoose.Schema({
    updatedAt: { type: Date, default: Date.now }
}, { strict: false }); 

module.exports = mongoose.model('LandingContent', landingSchema);