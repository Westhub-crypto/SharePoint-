const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Securely hashed
    walletBalance: { type: Number, default: 0 },
    withdrawableBalance: { type: Number, default: 0 },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    role: { type: String, default: 'user' } // 'admin' or 'user'
});

module.exports = mongoose.model('User', userSchema);
