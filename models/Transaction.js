const mongoose = require('mongoose');

const txSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true }, // e.g., "Deposit", "Plan Purchase"
    amount: { type: Number, required: true },
    type: { type: String, required: true }, // 'credit' or 'debit'
    status: { type: String, default: 'completed' }, // 'pending' or 'completed'
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', txSchema);
