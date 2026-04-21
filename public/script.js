let currentUser = null;
let currentToken = null;

// On Page Load: Check if already logged in
window.onload = function() {
    const savedToken = localStorage.getItem('sharepoint_token');
    if (savedToken) {
        currentToken = savedToken;
        loadDashboard(); // Auto-login
    }
};

function toggleAuth(type) {
    if (type === 'register') {
        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('registerBox').classList.remove('hidden');
    } else {
        document.getElementById('registerBox').classList.add('hidden');
        document.getElementById('loginBox').classList.remove('hidden');
    }
}

async function handleRegister() {
    const user = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const ref = document.getElementById('regReferral').value;

    if(!user || !email || !pass) return alert("Please fill all fields.");
    
    document.getElementById('regBtn').innerText = "Processing...";
    try {
        const response = await fetch('/api/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass, ref: ref })
        });
        const result = await response.json();
        if (result.success) {
            alert("Registration Success! Please sign in.");
            toggleAuth('login');
        } else { alert(result.error); }
    } catch (e) { alert("Network error. Please check your connection."); }
    document.getElementById('regBtn').innerText = "Register";
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    
    if(!email || !pass) return alert("Please fill all fields.");
    
    document.getElementById('loginBtn').innerText = "Authenticating...";
    try {
        const response = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pass })
        });
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('sharepoint_token', data.token);
            currentToken = data.token;
            setupDashboard(data);
        } else { alert(data.error); }
    } catch (e) { alert("Network error. Please try again."); }
    document.getElementById('loginBtn').innerText = "Login";
}

function logout() {
    localStorage.removeItem('sharepoint_token');
    window.location.reload();
}

async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        
        if (data.success) {
            setupDashboard(data);
        } else {
            logout(); // Token expired
        }
    } catch (e) { console.log("Silent network error on auto-login"); }
}

function setupDashboard(data) {
    currentUser = data.user;

    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Populate Dashboard Data
    document.getElementById('userNameDisplay').innerText = currentUser.username;
    document.getElementById('walletBalanceDisplay').innerText = `₦${currentUser.walletBalance.toLocaleString()}`;
    document.getElementById('withdrawableBalanceDisplay').innerText = `₦${currentUser.withdrawableBalance.toLocaleString()}`;
    document.getElementById('dashboardRefDisplay').innerText = data.referralCount;
    document.getElementById('referralCountDisplay').innerText = data.referralCount;
    
    // Populate Profile Data
    document.getElementById('profileName').innerText = currentUser.username;
    document.getElementById('profileEmail').innerText = currentUser.email || "No email on file";
    document.getElementById('profileRole').innerText = currentUser.role;

    // Website Referral Link
    const refLink = window.location.origin + "?ref=" + currentUser.id;
    document.getElementById('refLinkText').innerText = refLink;

    // Show Admin Button in profile if user is admin
    if (currentUser.role === 'admin') {
        document.getElementById('profileAdminBtn').classList.remove('hidden');
        document.getElementById('profileAdminBtn').classList.add('flex');
    }

    renderPlans(data.plans);
    renderPortfolio(data.investments);
}

// ==========================================
// RENDER UI ELEMENTS
// ==========================================
function renderPlans(plans) {
    const plansList = document.getElementById('dynamicPlansList');
    if (plans && plans.length > 0) {
        plansList.innerHTML = plans.map(plan => {
            const totalProfit = plan.dailyReturn * plan.duration;
            const totalReturn = plan.cost + totalProfit;
            return `
            <div class="card rounded-[24px] p-6 mb-5 hover:border-[#00FF87] transition shadow-lg">
                <div class="flex justify-between items-center mb-5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-[#00FF87]/10 flex items-center justify-center border border-[#00FF87]/30"><i class="fa-solid ${plan.icon || 'fa-gem'} text-neon text-xl drop-shadow-sm"></i></div>
                        <div><h4 class="text-xl font-black text-white">${plan.name}</h4><p class="text-[11px] text-neon font-bold tracking-widest uppercase">Cost: ₦${plan.cost.toLocaleString()}</p></div>
                    </div>
                </div>
                <div class="bg-[#061410] rounded-xl p-4 text-sm text-gray-300 border border-[#143D2F] mb-5">
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Daily:</span> <span class="font-bold text-white">₦${plan.dailyReturn.toLocaleString()}</span></div>
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Duration:</span> <span class="font-bold text-white">${plan.duration} Days</span></div>
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Profit:</span> <span class="font-bold text-white">₦${totalProfit.toLocaleString()}</span></div>
                    <div class="flex justify-between pt-1"><span class="font-bold text-neon">Total Return:</span> <span class="font-black text-neon text-base">₦${totalReturn.toLocaleString()}</span></div>
                </div>
                <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="w-full btn-neon py-3.5 rounded-full text-sm font-black shadow-lg uppercase tracking-wide">Purchase Plan</button>
            </div>`
        }).join('');
    } else {
        plansList.innerHTML = `<p class="text-center text-[#4A7A66]">No plans available right now.</p>`;
    }
}

function renderPortfolio(investments) {
    const invList = document.getElementById('investmentsList');
    if (investments && investments.length > 0) {
        invList.innerHTML = investments.map(inv => `
            <div class="card rounded-2xl p-5 flex justify-between items-center border-l-4 border-l-[#00FF87] mb-3">
                <div><h4 class="font-extrabold text-white text-base">${inv.shareName}</h4><p class="text-xs text-neon font-bold mt-1">+₦${inv.dailyReturn.toLocaleString()} Daily</p></div>
                <div class="text-right"><p class="text-3xl font-black text-white">${inv.daysLeft}</p><p class="text-[9px] text-[#4A7A66] uppercase tracking-widest font-bold">Days Left</p></div>
            </div>
        `).join('');
    } else {
        invList.innerHTML = `<p class="text-center text-[#4A7A66]">You have no active assets.</p>`;
    }
}

// ==========================================
// NAVIGATION SYSTEM
// ==========================================
function switchTab(tabId) {
    // Hide all major views
    const allViews = ['dashboard', 'shares', 'portfolio', 'referral', 'profile', 'admin', 'deposit', 'withdraw', 'support'];
    allViews.forEach(id => {
        const viewEl = document.getElementById(id + 'View');
        if(viewEl) viewEl.classList.add('hidden');
    });

    // Reset bottom nav colors
    const navItems = ['dashboard', 'shares', 'portfolio', 'referral', 'profile'];
    navItems.forEach(id => {
        const tabEl = document.getElementById('tab-' + id);
        if (tabEl) {
            tabEl.className = "flex flex-col items-center text-[#4A7A66] hover:text-neon w-1/5 transition";
            tabEl.querySelector('span').classList.remove('font-extrabold');
            tabEl.querySelector('span').classList.add('font-bold');
        }
    });

    // Show the requested view
    const selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');

    // Highlight bottom nav if applicable
    const selectedTab = document.getElementById('tab-' + tabId);
    if(selectedTab) {
        selectedTab.className = "flex flex-col items-center text-[#00FF87] w-1/5 transition";
        selectedTab.querySelector('span').classList.remove('font-bold');
        selectedTab.querySelector('span').classList.add('font-extrabold');
    }
    
    // Toggle bottom nav visibility (hide on sub-pages)
    if (['deposit', 'withdraw', 'admin', 'support'].includes(tabId)) {
        document.getElementById('bottomNav').classList.add('hidden');
    } else {
        document.getElementById('bottomNav').classList.remove('hidden');
    }

    window.scrollTo(0,0);
}

// ==========================================
// TRANSACTION ACTIONS (FIXED FOR WEB)
// ==========================================
function setAmount(amount) {
    document.getElementById('depositAmount').value = amount;
}

async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    const btn = document.getElementById('generateLinkBtn');
    
    if (!amount || amount < 100) return alert("Minimum deposit is ₦100.");
    
    btn.innerText = "Processing..."; 
    btn.disabled = true; 

    try {
        const response = await fetch('/api/fund', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ amount: amount })
        });
        const result = await response.json();
        
        btn.innerText = "Proceed to Pay"; 
        btn.disabled = false;

        if (result.success) {
            // Replaced tg.openLink with standard Web redirect
            window.location.href = result.checkoutUrl;
        } else { 
            alert(`Error: ${result.error}`); 
        }
    } catch (error) {
        btn.innerText = "Proceed to Pay"; 
        btn.disabled = false; 
        alert("Network error.");
    }
}

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const bank = document.getElementById('withdrawBank').value;
    const accNo = document.getElementById('withdrawAccNo').value;
    const accName = document.getElementById('withdrawAccName').value;
    const btn = document.getElementById('withdrawBtn');

    if (!amount || amount < 1000) return alert("Minimum withdrawal is ₦1,000.");
    if (!bank || !accNo || !accName) return alert("Please fill all banking details.");

    btn.innerText = "Sending Request..."; 
    btn.disabled = true;

    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ amount: amount, bankName: bank, accNo: accNo, accName: accName })
        });
        const result = await response.json();
        
        btn.disabled = false;
        btn.innerText = "Request Payout";

        if (result.success) {
            alert("✅ Withdrawal request sent successfully!");
            switchTab('dashboard'); 
            loadDashboard(); // refresh balances
        } else { 
            alert(`❌ Error: ${result.error}`); 
        }
    } catch (e) { 
        btn.disabled = false; 
        btn.innerText = "Request Payout";
        alert("Network error."); 
    }
}

async function buyDynamicShare(planId, planName, cost) {
    // Replaced tg.showConfirm with standard Web confirm box
    const confirmed = confirm(`Are you sure you want to purchase ${planName} for ₦${cost.toLocaleString()}?`);
    if (!confirmed) return;

    try {
        const res = await fetch('/api/buy-share', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ planId: planId })
        });
        const result = await res.json();
        
        if (result.success) { 
            alert("✅ Success! Asset purchased. You can track it in your Portfolio."); 
            loadDashboard(); 
            switchTab('portfolio'); 
        } else { 
            alert(`❌ ${result.error}`); 
        }
    } catch (e) { 
        alert("Transaction failed. Check your network connection."); 
    }
}

// ==========================================
// SUPPORT SYSTEM
// ==========================================
function sendSupportMessage() {
    const msg = document.getElementById('supportMessage').value;
    const btn = document.getElementById('supportBtn');
    
    if (!msg.trim()) return alert("Please enter a message before sending.");

    btn.innerText = "Sending...";
    btn.disabled = true;

    // Simulate sending for now until you create the backend route
    setTimeout(() => {
        alert("✅ Message sent to the support team. An agent will contact you shortly.");
        document.getElementById('supportMessage').value = "";
        btn.innerText = "Send Message";
        btn.disabled = false;
        switchTab('dashboard');
    }, 1500);
}

// ==========================================
// UTILITIES
// ==========================================
function copyRefLink() {
    navigator.clipboard.writeText(document.getElementById('refLinkText').innerText);
    alert("✅ Link copied to clipboard!");
                }
