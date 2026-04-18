const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api'); 

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. DATABASE & SECRETS
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY || "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_ID = "8067627422"; 

const SQUAD_INITIATE_URL = SQUAD_SECRET_KEY.startsWith("sandbox_") 
    ? "https://sandbox-api-d.squadco.com/transaction/initiate" 
    : "https://api-d.squadco.com/transaction/initiate";

let bot;
if (BOT_TOKEN) bot = new TelegramBot(BOT_TOKEN, { polling: true });

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 2. DATABASE SCHEMAS
// ==========================================
const UserSchema = new mongoose.Schema({
    tgId: { type: String, required: true, unique: true },
    username: { type: String }, 
    walletBalance: { type: Number, default: 0 },       
    withdrawableBalance: { type: Number, default: 0 }, 
    referredBy: { type: String, default: null },
    isBanned: { type: Boolean, default: false } 
});
const User = mongoose.model('User', UserSchema);

const PlanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    icon: { type: String, default: "fa-gem" }, 
    cost: { type: Number, required: true },
    dailyReturn: { type: Number, required: true },
    duration: { type: Number, required: true }, 
    isActive: { type: Boolean, default: true }
});
const Plan = mongoose.model('Plan', PlanSchema);

const InvestmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    planId: { type: String, required: true },
    shareName: { type: String, required: true },
    dailyReturn: { type: Number, required: true },
    daysLeft: { type: Number, required: true }
});
const Investment = mongoose.model('Investment', InvestmentSchema);

const WithdrawalSchema = new mongoose.Schema({
    refId: { type: String, default: () => 'W-' + Math.floor(10000 + Math.random() * 90000) },
    userId: { type: String, required: true },
    userName: { type: String },
    amount: { type: Number, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    status: { type: String, default: "Pending" },
    date: { type: Date, default: Date.now }
});
const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

// ==========================================
// 3. SMART LOGIN & DASHBOARD
// ==========================================
app.post('/api/login', async (req, res) => {
    const { tgId, name, referredBy } = req.body;
    try {
        let user = await User.findOne({ tgId: tgId });
        if (!user) {
            user = new User({ tgId: tgId, username: name, referredBy: referredBy });
            await user.save();
        }
        
        if (user.isBanned) return res.status(403).json({ error: "Banned" });

        const plans = await Plan.find({ isActive: true });
        const investments = await Investment.find({ userId: tgId, daysLeft: { $gt: 0 } });
        const referralCount = await User.countDocuments({ referredBy: tgId });

        res.json({
            user: { walletBalance: user.walletBalance, withdrawableBalance: user.withdrawableBalance, username: user.username || name },
            plans: plans, 
            investments: investments, 
            referralCount: referralCount
        });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

// ==========================================
// 4. ADMIN & TRANSACTIONS
// ==========================================
const isAdmin = (req, res, next) => {
    if (req.headers['x-admin-id'] !== ADMIN_ID) return res.status(403).json({ error: "Unauthorized" });
    next();
};

app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, 'username walletBalance withdrawableBalance isBanned tgId');
        const pendingWithdrawals = await Withdrawal.find({ status: "Pending" });
        const plans = await Plan.find({}); // Fetch all plans for the admin to edit/delete
        res.json({ users, pendingWithdrawals, plans });
    } catch (err) { res.status(500).json({ error: "Error fetching admin stats" }); }
});

// ADD PLAN
app.post('/api/admin/plan/add', isAdmin, async (req, res) => {
    const { name, cost, dailyReturn, duration, icon } = req.body;
    try {
        const plan = new Plan({ name, cost, dailyReturn, duration, icon });
        await plan.save(); res.json({ success: true, plan });
    } catch (err) { res.status(500).json({ error: "Failed to add plan" }); }
});

// EDIT PLAN
app.post('/api/admin/plan/edit', isAdmin, async (req, res) => {
    const { id, name, cost, dailyReturn, duration, icon } = req.body;
    try {
        await Plan.findByIdAndUpdate(id, { name, cost, dailyReturn, duration, icon });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to update plan" }); }
});

// DELETE PLAN
app.post('/api/admin/plan/delete', isAdmin, async (req, res) => {
    const { id } = req.body;
    try {
        await Plan.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to delete plan" }); }
});

app.post('/api/admin/ban', isAdmin, async (req, res) => {
    const { tgId, banStatus } = req.body;
    try {
        await User.findOneAndUpdate({ tgId: tgId }, { isBanned: banStatus });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to update user" }); }
});

app.post('/api/admin/withdraw/resolve', isAdmin, async (req, res) => {
    const { refId, action } = req.body;
    try {
        const request = await Withdrawal.findOne({ refId: refId, status: "Pending" });
        if (!request) return res.status(404).json({ error: "Request not found" });

        request.status = action === 'approve' ? "Paid" : "Rejected";
        await request.save();

        if (action === 'reject') {
            const user = await User.findOne({ tgId: request.userId });
            if (user) { user.withdrawableBalance += request.amount; await user.save(); }
        }

        if (bot) {
            const msg = action === 'approve' 
                ? `🎉 *Withdrawal Approved!*\n\n₦${request.amount.toLocaleString()} has been sent to your bank.`
                : `❌ *Withdrawal Rejected.*\n\nYour request for ₦${request.amount.toLocaleString()} was declined and refunded.`;
            bot.sendMessage(request.userId, msg, { parse_mode: 'Markdown' });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to resolve withdrawal" }); }
});

app.post('/api/buy-share', async (req, res) => {
    const { userId, planId } = req.body;
    try {
        const plan = await Plan.findById(planId);
        if (!plan || !plan.isActive) return res.status(400).json({ error: "Invalid Plan" });

        let user = await User.findOne({ tgId: userId });
        if (user.walletBalance < plan.cost) return res.status(400).json({ error: "Insufficient Wallet Balance." });

        user.walletBalance -= plan.cost; await user.save();

        const newInvestment = new Investment({ userId: userId, planId: planId, shareName: plan.name, dailyReturn: plan.dailyReturn, daysLeft: plan.duration });
        await newInvestment.save();

        if (user.referredBy) {
            const referrer = await User.findOne({ tgId: user.referredBy });
            if (referrer) { referrer.withdrawableBalance += (plan.cost * 0.05); await referrer.save(); }
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Transaction failed" }); }
});

app.post('/api/withdraw', async (req, res) => {
    const { userId, userName, amount, bankName, accNo, accName } = req.body;
    if (!amount || amount < 1000) return res.status(400).json({ error: "Minimum is ₦1,000" });

    try {
        const user = await User.findOne({ tgId: userId });
        if (!user || user.withdrawableBalance < amount) return res.status(400).json({ error: "Insufficient Balance" });

        user.withdrawableBalance -= amount; await user.save();

        const request = new Withdrawal({ userId: userId, userName: userName, amount: amount, bankName: bankName, accountNumber: accNo, accountName: accName });
        await request.save();

        if (bot && ADMIN_ID) {
            const adminMsg = `🚨 *New Withdrawal Request*\n\n🆔 *ID:* ${request.refId}\n👤 *User:* ${userName}\n💰 *Amount:* ₦${amount.toLocaleString()}\n🏦 *Bank:* ${bankName}\n🔢 *Acc:* \`${accNo}\`\n📛 *Name:* ${accName}\n\n✅ Reply with:\n\`/paid ${request.refId}\``;
            bot.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
        }
        res.json({ success: true, newBalance: user.withdrawableBalance });
    } catch (error) { res.status(500).json({ error: "Withdrawal failed" }); }
});

app.post('/api/fund', async (req, res) => {
    const { userId, amount } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ error: "Minimum deposit is ₦100" });
    try {
        const response = await fetch(SQUAD_INITIATE_URL, {
            method: 'POST', headers: { 'Authorization': `Bearer ${SQUAD_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount * 100, email: `user${userId}@sharepoint.com`, currency: "NGN", initiate_type: "inline", transaction_ref: `SP-${userId}-${Date.now()}` })
        });
        const data = await response.json();
        if (data.status === 200 && data.data) res.json({ success: true, checkoutUrl: data.data.checkout_url });
        else res.status(400).json({ error: "Failed to generate gateway link." });
    } catch (error) { res.status(500).json({ error: "Internal server error." }); }
});

app.post('/webhook/squad', async (req, res) => {
    const squadSignature = req.headers['x-squad-encrypted-body'];
    if (!squadSignature) return res.status(400).send("Missing Signature");
    const hash = crypto.createHmac('sha512', SQUAD_SECRET_KEY).update(req.rawBody).digest('hex').toUpperCase();
    if (hash !== squadSignature.toUpperCase()) return res.status(401).send("Invalid Signature");

    res.status(200).send("OK");
    try {
        const { Event, Body } = req.body;
        if (Event === 'charge_successful' && Body) {
            const amountInNaira = Body.amount / 100;
            const parts = Body.transaction_ref.split('-');
            if (parts[0] === 'SP' && parts[1]) {
                const tgId = parts[1];
                const user = await User.findOne({ tgId: tgId });
                if (user) {
                    user.walletBalance += amountInNaira; await user.save();
                    if (bot) bot.sendMessage(tgId, `✅ *Deposit Successful!*\n\n₦${amountInNaira.toLocaleString()} added to your Wallet.`, { parse_mode: 'Markdown' });
                }
            }
        }
    } catch (error) { console.error("Webhook Error:", error); }
});

if (bot) {
    bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
        const tgId = msg.chat.id.toString();
        const name = msg.from.first_name || "User";
        const referredBy = match[1] ? match[1].trim() : null; 
        try {
            let user = await User.findOne({ tgId: tgId });
            if (!user) { user = new User({ tgId: tgId, username: name, referredBy: referredBy }); await user.save(); }
            bot.sendMessage(tgId, `Welcome to SharePoint, ${name}!\n\nTap the "Open App" button below to start earning.`);
        } catch (err) { console.error("Bot Start Error:", err); }
    });

    bot.onText(/\/paid (.+)/, async (msg, match) => {
        if (msg.chat.id.toString() !== ADMIN_ID) return;
        const refId = match[1].trim();
        try {
            const withdrawal = await Withdrawal.findOne({ refId: refId, status: "Pending" });
            if (!withdrawal) return bot.sendMessage(ADMIN_ID, `❌ Pending request not found.`);
            withdrawal.status = "Paid"; await withdrawal.save();
            bot.sendMessage(ADMIN_ID, `✅ Payout ${refId} PAID!`);
            bot.sendMessage(withdrawal.userId, `🎉 *Withdrawal Successful!*\n\n₦${withdrawal.amount.toLocaleString()} has been sent to your bank.`, { parse_mode: 'Markdown' });
        } catch (err) { bot.sendMessage(ADMIN_ID, `❌ Error.`); }
    });
}

cron.schedule('0 0 * * *', async () => {
    try {
        const activeInvs = await Investment.find({ daysLeft: { $gt: 0 } });
        for (let inv of activeInvs) {
            const buyer = await User.findOne({ tgId: inv.userId });
            if (buyer) {
                buyer.withdrawableBalance += inv.dailyReturn; inv.daysLeft -= 1;
                await buyer.save(); await inv.save();
                if (buyer.referredBy) {
                    const referrer = await User.findOne({ tgId: buyer.referredBy });
                    if (referrer) { referrer.withdrawableBalance += (inv.dailyReturn * 0.10); await referrer.save(); }
                }
            }
        }
        await Investment.deleteMany({ daysLeft: { $lte: 0 } });
    } catch (error) { }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
