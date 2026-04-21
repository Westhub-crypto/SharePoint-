const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Models
const User = require('./models/User'); 
const Plan = require('./models/Plan'); 
const Investment = require('./models/Investment'); 
const Withdrawal = require('./models/Withdrawal'); 
const Transaction = require('./models/Transaction'); 
const Support = require('./models/Support');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static('public')); 

const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET = process.env.SQUAD_SECRET;

// ==========================================
// DATABASE & AUTO-ADMIN (WITH CRASH FIX)
// ==========================================
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB Connected');

        // 🚨 FIX FOR THE DUPLICATE TELEGRAM ID ERROR 🚨
        try {
            await mongoose.connection.collection('users').dropIndex('tgId_1');
            console.log('✅ Old Telegram Index cleared successfully.');
        } catch (e) {
            // Silently ignore if the index is already deleted
        }

        // Auto-Create Master Admin if it doesn't exist
        const adminExists = await User.findOne({ email: 'admin@sharepoint.com' });
        if (!adminExists) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('Admin@123', salt);
            await User.create({ username: 'SuperAdmin', email: 'admin@sharepoint.com', password: hash, role: 'admin', profilePicture: 'admin_dp' });
            console.log('👑 Default Admin Created: admin@sharepoint.com / Admin@123');
        }
    })
    .catch(err => console.log('❌ DB Error: ', err));

// Middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Session expired.' });
        req.user = user; next();
    });
};

const requireAdmin = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: "Admin access required." });
    next();
};

// ==========================================
// 1. AUTH & PROFILE
// ==========================================
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
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: "No account found with that email." });
        
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(tempPassword, salt);
        await user.save();
        
        res.json({ success: true, tempPassword: tempPassword });
    } catch (err) { res.status(500).json({ success: false, error: "Server error during reset." }); }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });
        const supportTickets = await Support.find({ userId: user._id }).sort({ date: -1 });
        res.json({ success: true, user: { id: user._id, username: user.username, email: user.email, profilePicture: user.profilePicture, fullName: user.fullName, banks: user.banks, hasPin: !!user.pin, walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, role: user.role }, referralCount: user.referralCount, plans, investments, supportTickets });
    } catch (err) { res.status(401).json({ success: false, error: "Unauthorized" }); }
});

// Profile Setup (Compulsory DP & Full Name)
app.post('/api/user/setup', authenticateToken, async (req, res) => {
    try {
        const { profilePicture, fullName } = req.body;
        await User.findByIdAndUpdate(req.user.id, { profilePicture, fullName });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Setup failed." }); }
});

// Add Bank
app.post('/api/user/add-bank', authenticateToken, async (req, res) => {
    try {
        const { bankName, accountNumber, accountName } = req.body;
        await User.findByIdAndUpdate(req.user.id, { $push: { banks: { bankName, accountNumber, accountName } } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Failed to add bank." }); }
});

// Set PIN
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

// ==========================================
// 2. USER TRANSACTIONS & SUPPORT
// ==========================================
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
        const { amount, pin, bankId } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user.pin || user.pin !== pin) return res.status(400).json({ success: false, error: "Incorrect PIN." });
        if (user.withdrawableBalance < amount) return res.status(400).json({ success: false, error: "Insufficient earnings." });

        const selectedBank = user.banks.id(bankId);
        if (!selectedBank) return res.status(400).json({ success: false, error: "Invalid bank selected." });

        user.withdrawableBalance -= amount; await user.save();
        await new Withdrawal({ userId: user._id, userName: user.username, amount, bankName: selectedBank.bankName, accountNumber: selectedBank.accountNumber, accountName: selectedBank.accountName }).save();
        await new Transaction({ userId: user._id, title: `Withdrawal Request`, amount: amount, type: 'debit', status: 'pending' }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Server error" }); }
});

app.post('/api/support/send', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        await new Support({ userId: user._id, userName: user.username, message: req.body.message }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: "Failed to send." }); }
});

// ==========================================
// 3. ADMIN ENDPOINTS
// ==========================================
app.get('/api/admin/data', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).select('username email walletBalance withdrawableBalance');
        const tickets = await Support.find({ status: 'open' });
        const withdrawals = await Withdrawal.find({ status: 'pending' });
        res.json({ success: true, users, tickets, withdrawals });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/user/topup', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, amount } = req.body;
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } });
        await new Transaction({ userId, title: `Admin Top-Up`, amount: amount, type: 'credit', status: 'completed' }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/support/reply', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { ticketId, replyMessage } = req.body;
        await Support.findByIdAndUpdate(ticketId, { reply: replyMessage, status: 'replied' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/plan/add', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await new Plan(req.body).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/plan/delete', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await Plan.findByIdAndDelete(req.body.planId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Platform Online`));
