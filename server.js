const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto'); // Built-in security tool
const TelegramBot = require('node-telegram-bot-api'); // New bot tool

const app = express();

// 1. ADVANCED SECURITY: Save exact raw body for Webhook verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 2. DATABASE & SECRETS
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY || "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_ID = "8067627422";

const SQUAD_INITIATE_URL = SQUAD_SECRET_KEY.startsWith("sandbox_") 
    ? "https://sandbox-api-d.squadco.com/transaction/initiate" 
    : "https://api-d.squadco.com/transaction/initiate";

// Initialize the Telegram Bot listener
let bot;
if (BOT_TOKEN) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 3. DATABASE SCHEMAS
// ==========================================
const UserSchema = new mongoose.Schema({
    tgId: { type: String, required: true, unique: true },
    name: { type: String },
    walletBalance: { type: Number, default: 0 },       
    withdrawableBalance: { type: Number, default: 0 }, 
    referredBy: { type: String, default: null }
});
const User = mongoose.model('User', UserSchema);

const InvestmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    shareType: { type: String, required: true },
    dailyReturn: { type: Number, required: true },
    daysLeft: { type: Number, required: true }
});
const Investment = mongoose.model('Investment', InvestmentSchema);

const WithdrawalSchema = new mongoose.Schema({
    // NEW: Generates a short, easy-to-type ID like W-12345
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

const SHARE_TYPES = {
    "silver": { cost: 10000, dailyReturn: 200, duration: 30 }
};

// ==========================================
// 4. API ROUTES
// ==========================================
app.post('/api/login', async (req, res) => {
    const { tgId, name, referredBy } = req.body;
    try {
        let user = await User.findOne({ tgId: tgId });
        if (!user) {
            user = new User({ tgId, name, referredBy });
            await user.save();
        }
        let activeInvs = await Investment.find({ userId: tgId, daysLeft: { $gt: 0 } });
        let referralCount = await User.countDocuments({ referredBy: tgId });
        res.json({
            walletBalance: user.walletBalance,
            withdrawableBalance: user.withdrawableBalance,
            investments: activeInvs,
            referrals: referralCount
        });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

app.post('/api/withdraw', async (req, res) => {
    const { userId, userName, amount, bankName, accNo, accName } = req.body;
    if (!amount || amount < 1000) return res.status(400).json({ error: "Minimum withdrawal is ₦1,000" });

    try {
        const user = await User.findOne({ tgId: userId });
        if (!user || user.withdrawableBalance < amount) return res.status(400).json({ error: "Insufficient Balance" });

        user.withdrawableBalance -= amount;
        await user.save();

        const request = new Withdrawal({ userId, userName, amount, bankName, accountNumber: accNo, accountName: accName });
        await request.save();

        // Send a formatted admin alert with the exact bot command to approve it
        if (bot && ADMIN_ID) {
            const adminMsg = `🚨 *New Withdrawal Request*\n\n` +
                             `🆔 *ID:* ${request.refId}\n` +
                             `👤 *User:* ${userName}\n` +
                             `💰 *Amount:* ₦${amount.toLocaleString()}\n` +
                             `🏦 *Bank:* ${bankName}\n` +
                             `🔢 *Acc:* \`${accNo}\`\n` +
                             `📛 *Name:* ${accName}\n\n` +
                             `✅ To approve and notify user, reply with:\n\`/paid ${request.refId}\``;
            
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
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SQUAD_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount * 100,
                email: `user${userId}@sharepoint.com`, 
                currency: "NGN",
                initiate_type: "inline",
                transaction_ref: `SP-${userId}-${Date.now()}`
            })
        });

        const data = await response.json();
        if (data.status === 200 && data.data && data.data.checkout_url) res.json({ success: true, checkoutUrl: data.data.checkout_url });
        else res.status(400).json({ error: "Failed to generate gateway link." });
    } catch (error) { res.status(500).json({ error: "Internal server error." }); }
});

app.post('/api/buy-share', async (req, res) => {
    const { userId, shareType } = req.body;
    const share = SHARE_TYPES[shareType];
    if (!share) return res.status(400).json({ error: "Invalid share type" });

    try {
        let user = await User.findOne({ tgId: userId });
        if (!user) return res.status(400).json({ error: "User not found" });
        if (user.walletBalance < share.cost) return res.status(400).json({ error: "Insufficient Wallet Balance." });

        user.walletBalance -= share.cost;
        await user.save();

        const newInvestment = new Investment({ userId, shareType, dailyReturn: share.dailyReturn, daysLeft: share.duration });
        await newInvestment.save();

        if (user.referredBy) {
            const referrer = await User.findOne({ tgId: user.referredBy });
            if (referrer) {
                referrer.withdrawableBalance += (share.cost * 0.05);
                await referrer.save();
            }
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Transaction failed" }); }
});

// ==========================================
// 5. SECURE SQUADCO WEBHOOK
// ==========================================
app.post('/webhook/squad', async (req, res) => {
    // SECURITY CHECK: Verify the cryptographic signature from SquadCo
    const squadSignature = req.headers['x-squad-encrypted-body'];
    if (!squadSignature) return res.status(400).send("Missing Signature");

    const hash = crypto.createHmac('sha512', SQUAD_SECRET_KEY)
                       .update(req.rawBody)
                       .digest('hex').toUpperCase();

    if (hash !== squadSignature.toUpperCase()) {
        console.error("🚨 WARNING: Fake Webhook Attempt Blocked!");
        return res.status(401).send("Invalid Signature");
    }

    res.status(200).send("OK");
    
    try {
        const eventType = req.body.Event;
        const txData = req.body.Body;

        if (eventType === 'charge_successful' && txData) {
            const amountInNaira = txData.amount / 100;
            const parts = txData.transaction_ref.split('-');
            
            if (parts[0] === 'SP' && parts[1]) {
                const tgId = parts[1];
                const user = await User.findOne({ tgId: tgId });
                if (user) {
                    user.walletBalance += amountInNaira;
                    await user.save();

                    if (bot) {
                        const message = `✅ *Deposit Successful!*\n\n₦${amountInNaira.toLocaleString()} has been added to your Wallet Balance.`;
                        bot.sendMessage(tgId, message, { parse_mode: 'Markdown' });
                    }
                }
            }
        }
    } catch (error) { console.error("Webhook Error:", error); }
});

// ==========================================
// 6. ADMIN BOT COMMANDS
// ==========================================
if (bot) {
    bot.onText(/\/paid (.+)/, async (msg, match) => {
        // ONLY YOU can trigger this command
        if (msg.chat.id.toString() !== ADMIN_ID) return;
        
        const refId = match[1].trim();

        try {
            const withdrawal = await Withdrawal.findOne({ refId: refId, status: "Pending" });
            if (!withdrawal) {
                return bot.sendMessage(ADMIN_ID, `❌ Could not find a pending request with ID: ${refId}`);
            }

            // Mark it as Paid in the database
            withdrawal.status = "Paid";
            await withdrawal.save();

            // Tell you it worked
            bot.sendMessage(ADMIN_ID, `✅ Payout ${refId} officially marked as PAID!`);

            // Tell the user their money is arriving
            const userMsg = `🎉 *Withdrawal Successful!*\n\nYour request for ₦${withdrawal.amount.toLocaleString()} has been processed and sent to your bank.`;
            bot.sendMessage(withdrawal.userId, userMsg, { parse_mode: 'Markdown' });

        } catch (err) {
            bot.sendMessage(ADMIN_ID, `❌ Database error occurred.`);
        }
    });
}

// ==========================================
// 7. DAILY YIELD CRON JOB
// ==========================================
cron.schedule('0 0 * * *', async () => {
    try {
        const activeInvs = await Investment.find({ daysLeft: { $gt: 0 } });
        for (let inv of activeInvs) {
            const buyer = await User.findOne({ tgId: inv.userId });
            if (buyer) {
                buyer.withdrawableBalance += inv.dailyReturn;
                inv.daysLeft -= 1;
                await buyer.save();
                await inv.save();

                if (buyer.referredBy) {
                    const referrer = await User.findOne({ tgId: buyer.referredBy });
                    if (referrer) {
                        referrer.withdrawableBalance += (inv.dailyReturn * 0.10);
                        await referrer.save();
                    }
                }
            }
        }
        await Investment.deleteMany({ daysLeft: { $lte: 0 } });
    } catch (error) { }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
