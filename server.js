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

const SQUAD_INITIATE_URL = SQUAD_SECRET_KEY.startsWith("sandbox_") 
    ? "https://sandbox-api-d.squadco.com/transaction/initiate" 
    : "https://api-d.squadco.com/transaction/initiate";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 2. DATABASE SCHEMAS (UPDATED)
// ==========================================
const UserSchema = new mongoose.Schema({
    tgId: { type: String, required: true, unique: true },
    name: { type: String },
    walletBalance: { type: Number, default: 0 },       // DEPOSITS go here
    withdrawableBalance: { type: Number, default: 0 }, // EARNINGS go here
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

const SHARE_TYPES = {
    "silver": { cost: 10000, dailyReturn: 200, duration: 30 }
};

// ==========================================
// 3. API ROUTES
// ==========================================

// Get User Balances
app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findOne({ tgId: req.params.id });
        if (!user) return res.json({ walletBalance: 0, withdrawableBalance: 0 });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Generate Payment Link
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

// Buy a Share
app.post('/api/buy-share', async (req, res) => {
    const { userId, userName, shareType } = req.body;
    const share = SHARE_TYPES[shareType];

    if (!share) return res.status(400).json({ error: "Invalid share type" });

    try {
        let user = await User.findOne({ tgId: userId });
        if (!user) {
            user = new User({ tgId: userId, name: userName });
            await user.save();
        }

        // Check against WALLET BALANCE specifically
        if (user.walletBalance < share.cost) {
            return res.status(400).json({ error: "Insufficient Wallet Balance. Please deposit funds." });
        }

        // Deduct from Wallet Balance
        user.walletBalance -= share.cost;
        await user.save();

        const newInvestment = new Investment({
            userId: userId,
            shareType: shareType,
            dailyReturn: share.dailyReturn,
            daysLeft: share.duration
        });
        await newInvestment.save();

        // Give Upfront Bonus to Referrer's WITHDRAWABLE balance
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
// 4. DAILY YIELD CRON JOB
// ==========================================
cron.schedule('0 0 * * *', async () => {
    console.log("💰 Running daily yield distribution...");
    try {
        const activeInvs = await Investment.find({ daysLeft: { $gt: 0 } });
        for (let inv of activeInvs) {
            const buyer = await User.findOne({ tgId: inv.userId });
            if (buyer) {
                // Add daily earnings to WITHDRAWABLE BALANCE
                buyer.withdrawableBalance += inv.dailyReturn;
                inv.daysLeft -= 1;
                await buyer.save();
                await inv.save();

                if (buyer.referredBy) {
                    const referrer = await User.findOne({ tgId: buyer.referredBy });
                    if (referrer) {
                        // Add referral yield to WITHDRAWABLE BALANCE
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
