const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    activeBatch: { type: Number, default: 1 }, // E.g., Batch 3 (Currently running)
    latestCompletedBatch: { type: Number, default: 1 }, // E.g., Batch 2 (Alumni see this)
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);