const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const User = require('./models/User'); 
const Plan = require('./models/Plan'); 
const Investment = require('./models/Investment'); 
const Withdrawal = require('./models/Withdrawal'); 
const Transaction = require('./models/Transaction'); // New History Logger

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); 

const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET = process.env.SQUAD_SECRET;

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Error: ', err));

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Session expired.' });
        req.user = user; next();
    });
};

// --- AUTH ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, ref } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ success: false, error: "Email exists." });
        const salt = await bcrypt.genSalt(10);
        const newUser = new User({ username, email, password: await bcrypt.hash(password, salt), referredBy: ref });
        await newUser.save();
        if (ref) await User.findOneAndUpdate({ _id: ref }, { $inc: { referralCount: 1 } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.isBanned || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ success: false, error: "Invalid credentials." });
        
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: user._id, username: user.username, email: user.email, fullName: user.fullName, bankName: user.bankName, accountNumber: user.accountNumber, accountName: user.accountName, hasPin: !!user.pin, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans: await Plan.find({}), investments: await Investment.find({ userId: user._id, status: 'active' }) });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, user: { id: user._id, username: user.username, email: user.email, fullName: user.fullName, bankName: user.bankName, accountNumber: user.accountNumber, accountName: user.accountName, hasPin: !!user.pin, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans: await Plan.find({}), investments: await Investment.find({ userId: user._id, status: 'active' }) });
    } catch (err) { res.status(401).json({ success: false, error: "Unauthorized" }); }
});

// --- PROFILE SETTINGS ---
app.post('/api/user/update', authenticateToken, async (req, res) => {
    try {
        const { fullName, bankName, accountNumber, accountName } = req.body;
        await User.findByIdAndUpdate(req.user.id, { fullName, bankName, accountNumber, accountName });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Update failed." }); }
});

app.post('/api/user/pin', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { pin: req.body.pin });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "PIN setup failed." }); }
});

app.get('/api/user/transactions', authenticateToken, async (req, res) => {
    try {
        const txs = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
        res.json({ success: true, transactions: txs });
    } catch (err) { res.status(500).json({ success: false, error: "Failed to load history." }); }
});

// --- TRANSACTIONS ---
app.post('/api/fund', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const response = await fetch('https://api-d.squadco.com/transaction/initiate', {
            method: 'POST', headers: { 'Authorization': `Bearer ${SQUAD_SECRET}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: req.body.amount * 100, email: user.email, currency: 'NGN', initiate_type: 'inline', transaction_ref: 'SP_' + Date.now() })
        });
        const squadData = await response.json();
        if (squadData?.data?.checkout_url) res.json({ success: true, checkoutUrl: squadData.data.checkout_url });
        else res.status(400).json({ success: false, error: "Gateway error." });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.post('/api/buy-share', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const plan = await Plan.findById(req.body.planId);
        if (!plan) return res.status(404).json({ success: false, error: "Plan not found." });
        if (user.walletBalance < plan.cost) return res.status(400).json({ success: false, error: "Insufficient balance." });

        user.walletBalance -= plan.cost; await user.save();
        await new Investment({ userId: user._id, planId: plan._id, shareName: plan.name, dailyReturn: plan.dailyReturn, duration: plan.duration, daysLeft: plan.duration }).save();
        await new Transaction({ userId: user._id, title: `Purchased ${plan.name}`, amount: plan.cost, type: 'debit', status: 'completed' }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.post('/api/withdraw', authenticateToken, async (req, res) => {
    try {
        const { amount, pin } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user.pin) return res.status(400).json({ success: false, error: "Please set a withdrawal PIN in Settings first." });
        if (user.pin !== pin) return res.status(400).json({ success: false, error: "Incorrect PIN." });
        if (!user.bankName || !user.accountNumber) return res.status(400).json({ success: false, error: "Please update your Bank Details in Settings." });
        if (user.withdrawableBalance < amount) return res.status(400).json({ success: false, error: "Insufficient earnings." });

        user.withdrawableBalance -= amount; await user.save();
        await new Withdrawal({ userId: user._id, userName: user.username, amount, bankName: user.bankName, accountNumber: user.accountNumber, accountName: user.accountName }).save();
        await new Transaction({ userId: user._id, title: `Withdrawal Request`, amount: amount, type: 'debit', status: 'pending' }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.listen(process.env.PORT || 3000, () => console.log(`🚀 Ready`));
