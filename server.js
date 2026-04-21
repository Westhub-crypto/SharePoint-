const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Import your database models
const User = require('./models/User'); 
const Plan = require('./models/Plan'); 
const Investment = require('./models/Investment'); 

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // This serves your index.html file

const JWT_SECRET = process.env.JWT_SECRET || "sharepoint_secure_key_123";

// ==========================================
// DATABASE CONNECTION 
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Westpablo:Westpablo0917@cluster0.6prwiav.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error: ', err));

// ==========================================
// 1. REGISTRATION ROUTE
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, ref } = req.body;
        
        // Check if the email is already in the database
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, error: "Email already exists. Please sign in." });
        }

        // Securely hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create the new user profile
        const newUser = new User({ 
            username, 
            email, 
            password: hashedPassword, 
            referredBy: ref 
        });
        await newUser.save();

        // If they used a referral link, add +1 to the inviter's count
        if (ref) {
            await User.findOneAndUpdate({ _id: ref }, { $inc: { referralCount: 1 } });
        }

        res.json({ success: true, message: "Account created successfully" });
    } catch (err) { 
        console.error("Registration Error: ", err);
        res.status(500).json({ success: false, error: "Server error during registration." }); 
    }
});

// ==========================================
// 2. LOGIN ROUTE
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find the user by their email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, error: "Invalid email or password." });
        }

        // Check if the admin banned them
        if (user.isBanned) {
            return res.status(403).json({ success: false, error: "Account Suspended by Admin." });
        }

        // Verify the password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: "Invalid email or password." });
        }

        // Generate a secure session token
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        
        // Load the marketplace plans and their active investments
        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });

        res.json({ 
            success: true, 
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                walletBalance: user.walletBalance, 
                withdrawableBalance: user.withdrawableBalance, 
                role: user.role 
            }, 
            referralCount: user.referralCount, 
            plans, 
            investments 
        });
    } catch (err) { 
        console.error("Login Error: ", err);
        res.status(500).json({ success: false, error: "Server error during login." }); 
    }
});

// ==========================================
// 3. SECURE DASHBOARD DATA (Auto-Login)
// ==========================================
app.get('/api/dashboard', async (req, res) => {
    try {
        // Verify the browser's token
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, error: "No token provided" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Fetch fresh data
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, error: "User not found" });

        const plans = await Plan.find({});
        const investments = await Investment.find({ userId: user._id, status: 'active' });

        res.json({ 
            success: true, 
            user: { 
                id: user._id, 
                username: user.username, 
                walletBalance: user.walletBalance, 
                withdrawableBalance: user.withdrawableBalance, 
                role: user.role 
            }, 
            referralCount: user.referralCount, 
            plans, 
            investments 
        });
    } catch (err) {
        res.status(401).json({ success: false, error: "Session expired. Please log in again." });
    }
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SharePoint Premium Web running on port ${PORT}`));
