const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const User = require('./models/User'); 
const Plan = require('./models/Plan'); 
const Investment = require('./models/Investment'); 

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serves your index.html

const JWT_SECRET = process.env.JWT_SECRET || "sharepoint_secure_key_123";

// ==========================================
// 1. REGISTER
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, ref } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, error: "Email exists." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, email, password: hashedPassword, referredBy: ref });
        await newUser.save();

        if (ref) await User.findOneAndUpdate({ _id: ref }, { $inc: { referralCount: 1 } });

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error." }); }
});

// ==========================================
// 2. LOGIN
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, error: "Invalid credentials." });
        if (user.isBanned) return res.status(403).json({ success: false, error: "Account Banned" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, error: "Invalid credentials." });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });

        res.json({ success: true, token, user: { id: user._id, username: user.username, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans, investments });
    } catch (err) { res.status(500).json({ success: false, error: "Server error." }); }
});

// ==========================================
// 3. SECURE DASHBOARD DATA (Auto-Login)
// ==========================================
app.get('/api/dashboard', async (req, res) => {
    try {
        // Verify Token
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findById(decoded.id);
        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });

        res.json({ success: true, user: { id: user._id, username: user.username, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans, investments });
    } catch (err) {
        res.status(401).json({ success: false, error: "Unauthorized" });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SharePoint Premium Web running on port ${PORT}`));
