const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    name: { type: String, required: true },
    cost: { type: Number, required: true },
    dailyReturn: { type: Number, required: true },
    duration: { type: Number, required: true },
    icon: { type: String, default: 'fa-gem' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', planSchema);
