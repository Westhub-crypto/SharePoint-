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
// 1. DATABASE CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 2. DATABASE SCHEMAS
// ==========================================
const UserSchema = new mongoose.Schema({
    tgId: { type: String, required: true, unique: true },
    name: { type: String },
    balance: { type: Number, default: 0 },
    referredBy: { type: String, default: null },
    virtualAccount: { type: String, default: null }
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

// Get User Balance
app.get('/api/user/:id', async (req, res) => {
    try {
        let user = await User.findOne({ tgId: req.params.id });
        if (!user) {
            // Return 0 if user doesn't exist yet, so frontend doesn't crash
            return res.json({ balance: 0 });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Buy a Share
app.post('/api/buy-share', async (req, res) => {
    const { userId, userName, shareType } = req.body;
    const share = SHARE_TYPES[shareType];

    if (!share) return res.status(400).json({ error: "Invalid share type" });

    try {
        // Find user, or create them if it's their very first interaction
        let user = await User.findOne({ tgId: userId });
        if (!user) {
            user = new User({ tgId: userId, name: userName, balance: 0 });
            await user.save();
        }

        if (user.balance < share.cost) {
            return res.status(400).json({ error: "Insufficient funds. Please fund your wallet." });
        }

        // Deduct cost and save user
        user.balance -= share.cost;
        await user.save();

        // Create the investment
        const newInvestment = new Investment({
            userId: userId,
            shareType: shareType,
            dailyReturn: share.dailyReturn,
            daysLeft: share.duration
        });
        await newInvestment.save();

        // Upfront Referral Bonus (5%)
        if (user.referredBy) {
            const referrer = await User.findOne({ tgId: user.referredBy });
            if (referrer) {
                referrer.balance += (share.cost * 0.05);
                await referrer.save();
            }
        }

        res.json({ success: true, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ error: "Transaction failed" });
    }
});

// ==========================================
// 4. DAILY YIELD CRON JOB (Runs at Midnight)
// ==========================================
cron.schedule('0 0 * * *', async () => {
    console.log("💰 Running daily yield distribution...");
    
    try {
        // Find all active investments
        const activeInvs = await Investment.find({ daysLeft: { $gt: 0 } });

        for (let inv of activeInvs) {
            const buyer = await User.findOne({ tgId: inv.userId });
            
            if (buyer) {
                // Pay Buyer
                buyer.balance += inv.dailyReturn;
                inv.daysLeft -= 1;
                
                await buyer.save();
                await inv.save();

                // Pay Referrer (10% of daily yield)
                if (buyer.referredBy) {
                    const referrer = await User.findOne({ tgId: buyer.referredBy });
                    if (referrer) {
                        referrer.balance += (inv.dailyReturn * 0.10);
                        await referrer.save();
                    }
                }
            }
        }

        // Delete any investments that reached 0 days
        await Investment.deleteMany({ daysLeft: { $lte: 0 } });
        console.log("✅ Daily distribution complete!");
    } catch (error) {
        console.error("❌ Cron Job Error:", error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
