const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. DATABASE & SECRETS
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY || "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_ID = "8067627422"; // Your Admin Telegram ID is now active!

const SQUAD_INITIATE_URL = SQUAD_SECRET_KEY.startsWith("sandbox_") 
    ? "https://sandbox-api-d.squadco.com/transaction/initiate" 
    : "https://api-d.squadco.com/transaction/initiate";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 2. DATABASE SCHEMAS
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
// 3. API ROUTES
// ==========================================

// SMART LOGIN
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

// WITHDRAWAL REQUEST
app.post('/api/withdraw', async (req, res) => {
    const { userId, userName, amount, bankName, accNo, accName } = req.body;

    if (!amount || amount < 1000) return res.status(400).json({ error: "Minimum withdrawal is ₦1,000" });

    try {
        const user = await User.findOne({ tgId: userId });
        if (!user || user.withdrawableBalance < amount) {
            return res.status(400).json({ error: "Insufficient Withdrawable Balance" });
        }

        user.withdrawableBalance -= amount;
        await user.save();

        const request = new Withdrawal({
            userId, userName, amount, bankName, accountNumber: accNo, accountName: accName
        });
        await request.save();

        // ALERT THE ADMIN
        if (BOT_TOKEN && ADMIN_ID) {
            const adminMsg = `🚨 *New Withdrawal Request*\n\n` +
                             `👤 User: ${userName} (${userId})\n` +
                             `💰 Amount: ₦${amount.toLocaleString()}\n` +
                             `🏦 Bank: ${bankName}\n` +
                             `🔢 Acc: ${accNo}\n` +
                             `📛 Name: ${accName}`;
            
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_ID, text: adminMsg, parse_mode: 'Markdown' })
            });
        }

        res.json({ success: true, newBalance: user.withdrawableBalance });
    } catch (error) {
        res.status(500).json({ error: "Withdrawal failed" });
    }
});

// GENERATE SQUADCO PAYMENT LINK
app.post('/api/fund', async (req, res) => {
    const { userId, amount } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ error: "Minimum deposit is ₦100" });

    const amountInKobo = amount * 100;
    const transactionRef = `SP-${userId}-${Date.now()}`;

    try {
        const response = await fetch(SQUAD_INITIATE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amountInKobo,
                email: `user${userId}@sharepoint.com`, 
                currency: "NGN",
                initiate_type: "inline",
                transaction_ref: transactionRef
            })
        });

        const data = await response.json();
        if (data.status === 200 && data.data && data.data.checkout_url) {
            res.json({ success: true, checkoutUrl: data.data.checkout_url });
        } else {
            res.status(400).json({ error: "Failed to generate gateway link." });
        }
    } catch (error) {
        res.status(500).json({ error: "Internal server error." });
    }
});

// BUY SHARE
app.post('/api/buy-share', async (req, res) => {
    const { userId, shareType } = req.body;
    const share = SHARE_TYPES[shareType];

    if (!share) return res.status(400).json({ error: "Invalid share type" });

    try {
        let user = await User.findOne({ tgId: userId });
        if (!user) return res.status(400).json({ error: "User not found" });

        if (user.walletBalance < share.cost) {
            return res.status(400).json({ error: "Insufficient Wallet Balance. Please deposit funds." });
        }

        user.walletBalance -= share.cost;
        await user.save();

        const newInvestment = new Investment({
            userId: userId,
            shareType: shareType,
            dailyReturn: share.dailyReturn,
            daysLeft: share.duration
        });
        await newInvestment.save();

        if (user.referredBy) {
            const referrer = await User.findOne({ tgId: user.referredBy });
            if (referrer) {
                referrer.withdrawableBalance += (share.cost * 0.05);
                await referrer.save();
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Transaction failed" });
    }
});

// ==========================================
// 4. SQUADCO WEBHOOK LISTENER
// ==========================================
app.post('/webhook/squad', async (req, res) => {
    res.status(200).send("OK");
    try {
        const eventType = req.body.Event;
        const txData = req.body.Body;

        if (eventType === 'charge_successful' && txData) {
            const txRef = txData.transaction_ref;
            const amountInNaira = txData.amount / 100;
            const parts = txRef.split('-');
            
            if (parts[0] === 'SP' && parts[1]) {
                const tgId = parts[1];
                const user = await User.findOne({ tgId: tgId });
                if (user) {
                    user.walletBalance += amountInNaira;
                    await user.save();

                    if (BOT_TOKEN) {
                        const message = `✅ *Deposit Successful!*\n\n₦${amountInNaira.toLocaleString()} has been added to your Wallet Balance.`;
                        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: tgId, text: message, parse_mode: 'Markdown' })
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Webhook Error:", error);
    }
});

// ==========================================
// 5. DAILY YIELD CRON JOB
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
    } catch (error) {
        console.error("❌ Cron Job Error:", error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
