const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountName: { type: String, default: '' },
    pin: { type: String, default: null }, // 4-digit secure PIN
    walletBalance: { type: Number, default: 0 },
    withdrawableBalance: { type: Number, default: 0 },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    role: { type: String, default: 'user' } 
});

module.exports = mongoose.model('User', userSchema);
