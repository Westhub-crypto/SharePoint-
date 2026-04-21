const mongoose = require('mongoose');

const supportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    message: String,
    reply: { type: String, default: '' },
    status: { type: String, default: 'open' }, 
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Support', supportSchema);
