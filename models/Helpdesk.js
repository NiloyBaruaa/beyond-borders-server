const mongoose = require('mongoose');

const helpdeskSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, required: true },
    subject: { type: String, required: true },
    details: { type: String, required: true },
    adminReply: { type: String, default: null },
    status: { type: String, default: 'Open' }, // Open or Resolved
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Helpdesk', helpdeskSchema);