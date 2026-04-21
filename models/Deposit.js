const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    amount: { type: Number, required: true },
    receiptImage: { type: String, required: true }, // Saves the image data
    status: { type: String, default: 'pending' }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deposit', depositSchema);
