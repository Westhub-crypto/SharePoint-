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
const WEB_APP_URL = "https://sharepoint-wjdg.onrender.com"; // Your App URL

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
    isBanned: { type: Boolean, default: false },
    // NEW PROFILE FIELDS
    fullName: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    accountName: { type: String, default: "" },
    withdrawalPin: { type: String, default: "" }
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
// 3. CORE APP ROUTES
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
            user: { 
                walletBalance: user.walletBalance, 
                withdrawableBalance: user.withdrawableBalance, 
                username: user.username || name,
                fullName: user.fullName,
                bankName: user.bankName,
                accountNumber: user.accountNumber,
                accountName: user.accountName,
                hasPin: user.withdrawalPin ? true : false
            },
            plans: plans, 
            investments: investments, 
            referralCount: referralCount
        });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

// NEW: Save Profile Details
app.post('/api/profile/update', async (req, res) => {
    const { tgId, fullName, bankName, accountNumber, accountName, withdrawalPin } = req.body;
    try {
        let user = await User.findOne({ tgId: tgId });
        if (!user) return res.status(404).json({ error: "User not found" });

        user.fullName = fullName || user.fullName;
        user.bankName = bankName || user.bankName;
        user.accountNumber = accountNumber || user.accountNumber;
        user.accountName = accountName || user.accountName;
        if (withdrawalPin) user.withdrawalPin = withdrawalPin;

        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to update profile" }); }
});

// NEW: Customer Support Route
app.post('/api/support/send', async (req, res) => {
    const { tgId, username, topic, message } = req.body;
    try {
        if (bot && ADMIN_ID) {
            const supportMsg = `📩 *New Support Ticket*\n\n👤 *User:* ${username}\n🆔 *ID:* (${tgId})\n📌 *Topic:* ${topic}\n\n💬 *Message:*\n${message}\n\n_Reply directly to this message to chat with the user._`;
            bot.sendMessage(ADMIN_ID, supportMsg, { parse_mode: 'Markdown' });
            res.json({ success: true });
        } else {
            res.status(500).json({ error: "Bot offline" });
        }
    } catch (err) { res.status(500).json({ error: "Failed to send message" }); }
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
        const users = await User.find({}, 'username walletBalance withdrawableBalance isBanned tgId fullName');
        const pendingWithdrawals = await Withdrawal.find({ status: "Pending" });
        res.json({ users: users, pendingWithdrawals: pendingWithdrawals });
    } catch (err) { res.status(500).json({ error: "Error fetching stats" }); }
});

app.post('/api/admin/plan/add', isAdmin, async (req, res) => {
    const { name, cost, dailyReturn, duration, icon } = req.body;
    try {
        const plan = new Plan({ name: name, cost: cost, dailyReturn: dailyReturn, duration: duration, icon: icon });
        await plan.save(); res.json({ success: true, plan: plan });
    } catch (err) { res.status(500).json({ error: "Failed to add plan" }); }
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
    const { userId, userName, amount, pin } = req.body;
    if (!amount || amount < 1000) return res.status(400).json({ error: "Minimum is ₦1,000" });

    try {
        const user = await User.findOne({ tgId: userId });
        
        // WITHDRAWAL PIN SECURITY CHECK
        if (!user.withdrawalPin) return res.status(400).json({ error: "Please set your Withdrawal PIN in your Profile first." });
        if (user.withdrawalPin !== pin) return res.status(401).json({ error: "Incorrect Withdrawal PIN." });
        if (!user.bankName || !user.accountNumber) return res.status(400).json({ error: "Please save your Bank Details in your Profile first." });
        if (user.withdrawableBalance < amount) return res.status(400).json({ error: "Insufficient Balance" });

        user.withdrawableBalance -= amount; await user.save();

        const request = new Withdrawal({ 
            userId: userId, userName: userName, amount: amount, 
            bankName: user.bankName, accountNumber: user.accountNumber, accountName: user.accountName 
        });
        await request.save();

        if (bot && ADMIN_ID) {
            const adminMsg = `🚨 *New Withdrawal Request*\n\n🆔 *ID:* ${request.refId}\n👤 *User:* ${userName}\n💰 *Amount:* ₦${amount.toLocaleString()}\n🏦 *Bank:* ${user.bankName}\n🔢 *Acc:* \`${user.accountNumber}\`\n📛 *Name:* ${user.accountName}\n\n✅ Reply with:\n\`/paid ${request.refId}\``;
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

// ==========================================
// 5. TELEGRAM BOT LISTENERS
// ==========================================
if (bot) {
    // NEW PROFESSIONAL WELCOME MESSAGE
    bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
        const tgId = msg.chat.id.toString();
        const name = msg.from.first_name || "Investor";
        const referredBy = match[1] ? match[1].trim() : null; 
        try {
            let user = await User.findOne({ tgId: tgId });
            if (!user) { user = new User({ tgId: tgId, username: name, referredBy: referredBy }); await user.save(); }
            
            const welcomeText = `🌟 *Welcome to SharePoint Premium, ${name}!* 🌟\n\nYour ultimate digital asset and investment platform. Grow your portfolio, earn daily returns, and track your success in real-time.\n\n🛡️ *Bank-Grade Security*\n⚡ *Fast Withdrawals*\n👨‍💻 *24/7 Live Support*\n\nTap the button below to launch your dashboard!`;
            
            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "🚀 Launch SharePoint", web_app: { url: WEB_APP_URL } }]]
                }
            };
            bot.sendMessage(tgId, welcomeText, options);
        } catch (err) { console.error("Bot Start Error:", err); }
    });

    bot.on('message', async (msg) => {
        if (msg.chat.id.toString() !== ADMIN_ID) return;

        // Admin Payout Command
        if (msg.text && msg.text.startsWith('/paid ')) {
            const refId = msg.text.split(' ')[1].trim();
            try {
                const withdrawal = await Withdrawal.findOne({ refId: refId, status: "Pending" });
                if (!withdrawal) return bot.sendMessage(ADMIN_ID, `❌ Pending request not found.`);
                withdrawal.status = "Paid"; await withdrawal.save();
                bot.sendMessage(ADMIN_ID, `✅ Payout ${refId} PAID!`);
                bot.sendMessage(withdrawal.userId, `🎉 *Withdrawal Successful!*\n\n₦${withdrawal.amount.toLocaleString()} has been sent to your bank.`, { parse_mode: 'Markdown' });
            } catch (err) { bot.sendMessage(ADMIN_ID, `❌ Error.`); }
        }

        // NEW: ADMIN REPLY TO CUSTOMER SUPPORT
        if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.includes('New Support Ticket')) {
            const textMatch = msg.reply_to_message.text.match(/\((\d+)\)/); // Extracts user ID from (123456789)
            if (textMatch && textMatch[1]) {
                const customerId = textMatch[1];
                const adminReply = `👨‍💻 *Message from Admin:*\n\n${msg.text}`;
                bot.sendMessage(customerId, adminReply, { parse_mode: 'Markdown' })
                    .then(() => bot.sendMessage(ADMIN_ID, `✅ Reply sent to customer.`))
                    .catch(() => bot.sendMessage(ADMIN_ID, `❌ Failed to send reply.`));
            }
        }
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
