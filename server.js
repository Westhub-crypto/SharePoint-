const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Import your database models
const User = require('./models/User'); 
const Plan = require('./models/Plan'); 
const Investment = require('./models/Investment'); 
const Withdrawal = require('./models/Withdrawal'); 

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); 

// ==========================================
// SECURE ENVIRONMENT VARIABLES
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET = process.env.SQUAD_SECRET;

if (!MONGODB_URI) console.error("🚨 FATAL ERROR: MONGODB_URI is missing in Render environment!");
if (!JWT_SECRET) console.error("🚨 FATAL ERROR: JWT_SECRET is missing in Render environment!");

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error: ', err));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Session expired. Please log in again.' });
        req.user = user;
        next();
    });
};

// ==========================================
// 1. AUTHENTICATION & RECOVERY ROUTES
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, ref } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, error: "Email already exists." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, email, password: hashedPassword, referredBy: ref });
        await newUser.save();

        if (ref) await User.findOneAndUpdate({ _id: ref }, { $inc: { referralCount: 1 } });
        res.json({ success: true, message: "Account created" });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || user.isBanned) return res.status(400).json({ success: false, error: "Invalid credentials or banned." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, error: "Invalid credentials." });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });

        res.json({ success: true, token, user: { id: user._id, username: user.username, email: user.email, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans, investments });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

// NEW: FORGOT PASSWORD ROUTE
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(404).json({ success: false, error: "No account found with that email address." });

        // Generate a random 8-character temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        
        // Update the user's password in the database
        user.password = await bcrypt.hash(tempPassword, salt);
        await user.save();

        res.json({ success: true, tempPassword: tempPassword });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server error during password reset." });
    }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });
        res.json({ success: true, user: { id: user._id, username: user.username, email: user.email, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans, investments });
    } catch (err) { res.status(401).json({ success: false, error: "Unauthorized" }); }
});

// ==========================================
// 2. TRANSACTION ROUTES
// ==========================================
app.post('/api/fund', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);

        if (!SQUAD_SECRET) return res.status(500).json({ success: false, error: "Payment gateway is not configured on the server." });

        const response = await fetch('https://api-d.squadco.com/transaction/initiate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SQUAD_SECRET}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount * 100, email: user.email, currency: 'NGN', initiate_type: 'inline', transaction_ref: 'SP_' + Date.now() })
        });

        const squadData = await response.json();
        if (squadData && squadData.data && squadData.data.checkout_url) {
            res.json({ success: true, checkoutUrl: squadData.data.checkout_url });
        } else {
            res.status(400).json({ success: false, error: "Could not generate payment link." });
        }
    } catch (err) { res.status(500).json({ success: false, error: "Server error connecting to payment gateway." }); }
});

app.post('/api/buy-share', authenticateToken, async (req, res) => {
    try {
        const { planId } = req.body;
        const user = await User.findById(req.user.id);
        const plan = await Plan.findById(planId);

        if (!plan) return res.status(404).json({ success: false, error: "Plan not found." });
        if (user.walletBalance < plan.cost) return res.status(400).json({ success: false, error: "Insufficient balance." });

        user.walletBalance -= plan.cost; await user.save();
        await new Investment({ userId: user._id, planId: plan._id, shareName: plan.name, dailyReturn: plan.dailyReturn, duration: plan.duration, daysLeft: plan.duration }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error during purchase." }); }
});

app.post('/api/withdraw', authenticateToken, async (req, res) => {
    try {
        const { amount, bankName, accNo, accName } = req.body;
        const user = await User.findById(req.user.id);

        if (user.withdrawableBalance < amount) return res.status(400).json({ success: false, error: "Insufficient earnings balance." });
        user.withdrawableBalance -= amount; await user.save();
        await new Withdrawal({ userId: user._id, userName: user.username, amount, bankName, accountNumber: accNo, accountName: accName }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error during withdrawal." }); }
});

app.post('/api/admin/plan/add', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin') return res.status(403).json({ success: false, error: "Admin access required." });

        const { name, cost, dailyReturn, duration, icon } = req.body;
        await new Plan({ name, cost, dailyReturn, duration, icon }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SharePoint Premium Web running on port ${PORT}`));
