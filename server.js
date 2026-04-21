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
// The server pulls these securely from your Render dashboard
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET = process.env.SQUAD_SECRET;

if (!MONGODB_URI) console.error("🚨 FATAL ERROR: MONGODB_URI is missing in Render environment!");
if (!JWT_SECRET) console.error("🚨 FATAL ERROR: JWT_SECRET is missing in Render environment!");
if (!SQUAD_SECRET) console.warn("⚠️ WARNING: SQUAD_SECRET is missing. SquadCo deposits will fail.");

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error: ', err));

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
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
// 1. AUTHENTICATION ROUTES
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

// AUTOMATED SQUADCO DEPOSIT
app.post('/api/fund', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);

        if (!SQUAD_SECRET) return res.status(500).json({ success: false, error: "Payment gateway is not configured on the server." });

        // Call SquadCo API
        const response = await fetch('https://api-d.squadco.com/transaction/initiate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SQUAD_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount * 100, // SquadCo uses Kobo (Multiply by 100)
                email: user.email,
                currency: 'NGN',
                initiate_type: 'inline',
                transaction_ref: 'SP_' + Date.now()
            })
        });

        const squadData = await response.json();
        
        if (squadData && squadData.data && squadData.data.checkout_url) {
            res.json({ success: true, checkoutUrl: squadData.data.checkout_url });
        } else {
            res.status(400).json({ success: false, error: "Could not generate payment link. Please check your SquadCo keys in Render." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Server error connecting to payment gateway." });
    }
});

// Buy Investment Plan
app.post('/api/buy-share', authenticateToken, async (req, res) => {
    try {
        const { planId } = req.body;
        const user = await User.findById(req.user.id);
        const plan = await Plan.findById(planId);

        if (!plan) return res.status(404).json({ success: false, error: "Plan not found." });
        if (user.walletBalance < plan.cost) return res.status(400).json({ success: false, error: "Insufficient balance. Please deposit funds." });

        user.walletBalance -= plan.cost;
        await user.save();

        const newInv = new Investment({
            userId: user._id, planId: plan._id, shareName: plan.name,
            dailyReturn: plan.dailyReturn, duration: plan.duration, daysLeft: plan.duration
        });
        await newInv.save();

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error during purchase." }); }
});

// Withdraw Funds
app.post('/api/withdraw', authenticateToken, async (req, res) => {
    try {
        const { amount, bankName, accNo, accName } = req.body;
        const user = await User.findById(req.user.id);

        if (user.withdrawableBalance < amount) return res.status(400).json({ success: false, error: "Insufficient earnings balance." });

        user.withdrawableBalance -= amount;
        await user.save();

        const withdrawalReq = new Withdrawal({
            userId: user._id, userName: user.username, amount, bankName, accountNumber: accNo, accountName: accName
        });
        await withdrawalReq.save();

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error during withdrawal." }); }
});

// Admin: Add New Plan
app.post('/api/admin/plan/add', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin') return res.status(403).json({ success: false, error: "Admin access required." });

        const { name, cost, dailyReturn, duration, icon } = req.body;
        const newPlan = new Plan({ name, cost, dailyReturn, duration, icon });
        await newPlan.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SharePoint Premium Web running on port ${PORT}`));
