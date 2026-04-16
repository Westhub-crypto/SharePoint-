const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Serve the frontend files
app.use(express.static(path.join(__dirname, 'public')));

// --- MOCK DATABASE ---
let users = {
    "12345": { id: "12345", name: "Godwin", balance: 50000, referredBy: "99999", virtualAccount: "0123456789" },
    "99999": { id: "99999", name: "Promoter", balance: 0, referredBy: null, virtualAccount: null }
};
let activeInvestments = [];

const SHARE_TYPES = {
    "silver": { cost: 10000, dailyReturn: 200, duration: 30 }
};

// --- SQUADCO WEBHOOK (Phase 2) ---
app.post('/webhook/squad', (req, res) => {
    // In production, verify SquadCo signature here first!
    const { event, data } = req.body;

    if (event === 'charge.completed') {
        const amount = data.amount / 100; // SquadCo sends amounts in kobo
        const virtualAccount = data.virtual_account_number;

        // Find user and credit wallet
        let user = Object.values(users).find(u => u.virtualAccount === virtualAccount);
        if (user) {
            user.balance += amount;
            console.log(`Credited ${amount} to ${user.name}`);
            // Here you would trigger a Telegram Bot message to the user
        }
    }
    res.status(200).send('Webhook received');
});

// --- BUY SHARE & UPFRONT REFERRAL (Phase 1) ---
app.post('/api/buy-share', (req, res) => {
    const { userId, shareType } = req.body;
    const user = users[userId];
    const share = SHARE_TYPES[shareType];

    if (!user || !share) return res.status(400).json({ error: "Invalid request" });
    if (user.balance < share.cost) return res.status(400).json({ error: "Insufficient funds" });

    // 1. Deduct Cost
    user.balance -= share.cost;

    // 2. Create Investment
    activeInvestments.push({
        userId: userId,
        shareType: shareType,
        dailyReturn: share.dailyReturn,
        daysLeft: share.duration
    });

    // 3. Upfront Referral Payout (e.g., 5% of cost)
    if (user.referredBy && users[user.referredBy]) {
        const bonus = share.cost * 0.05;
        users[user.referredBy].balance += bonus;
        console.log(`Paid upfront bonus of ${bonus} to referrer ${user.referredBy}`);
    }

    res.json({ success: true, newBalance: user.balance, message: "Share purchased!" });
});

// --- DAILY YIELD CRON JOB ---
// Runs at midnight every day
cron.schedule('0 0 * * *', () => {
    console.log("Running daily yield distribution...");
    
    for (let i = activeInvestments.length - 1; i >= 0; i--) {
        let inv = activeInvestments[i];
        let buyer = users[inv.userId];

        if (inv.daysLeft > 0) {
            // Pay Buyer
            buyer.balance += inv.dailyReturn;
            inv.daysLeft--;

            // Pay Referrer (e.g., 10% of daily yield)
            if (buyer.referredBy && users[buyer.referredBy]) {
                const yieldBonus = inv.dailyReturn * 0.10;
                users[buyer.referredBy].balance += yieldBonus;
            }
        } else {
            // Remove completed investment
            activeInvestments.splice(i, 1);
        }
    }
});

// Endpoint to fetch user data for the frontend
app.get('/api/user/:id', (req, res) => {
    res.json(users[req.params.id] || { error: "User not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
