const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '' }, // Compulsory DP
    fullName: { type: String, default: '' },
    banks: [{ 
        bankName: String, 
        accountNumber: String, 
        accountName: String 
    }],
    pin: { type: String, default: null }, 
    walletBalance: { type: Number, default: 0 },
    withdrawableBalance: { type: Number, default: 0 },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    role: { type: String, default: 'user' } 
});

module.exports = mongoose.model('User', userSchema);
