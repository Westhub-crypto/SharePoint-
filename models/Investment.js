const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    shareName: { type: String, required: true },
    dailyReturn: { type: Number, required: true },
    duration: { type: Number, required: true },
    daysLeft: { type: Number, required: true },
    status: { type: String, default: 'active' }, // 'active' or 'completed'
    purchaseDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Investment', investmentSchema);
