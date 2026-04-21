let currentUser = null;
let currentToken = null;
let confirmCallback = null;

// ==========================================
// CUSTOM IN-APP MODALS
// ==========================================
function appAlert(message, title = "Notification", isError = false) {
    const modal = document.getElementById('customModal');
    const content = document.getElementById('customModalContent');
    
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    
    document.getElementById('modalIcon').className = isError ? "fa-solid fa-triangle-exclamation text-2xl text-red-500" : "fa-solid fa-bell text-2xl text-neon";
    document.getElementById('modalIconBox').className = isError ? "w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4" : "w-16 h-16 mx-auto bg-[#00FF87]/10 rounded-full flex items-center justify-center mb-4";
    
    document.getElementById('modalButtons').innerHTML = `<button onclick="closeAppModal()" class="w-full ${isError ? 'bg-red-500 text-white' : 'btn-neon'} font-black py-3.5 rounded-full text-sm shadow-lg transition active:scale-95">OK</button>`;
    
    modal.classList.add('modal-active');
    content.classList.add('modal-content-active');
}

function appConfirm(message, callback, title = "Please Confirm") {
    confirmCallback = callback;
    const modal = document.getElementById('customModal');
    const content = document.getElementById('customModalContent');
    
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    
    document.getElementById('modalIcon').className = "fa-solid fa-circle-question text-2xl text-[#4A7A66]";
    document.getElementById('modalIconBox').className = "w-16 h-16 mx-auto bg-[#143D2F] rounded-full flex items-center justify-center mb-4";
    
    document.getElementById('modalButtons').innerHTML = `
        <button onclick="closeAppModal()" class="w-1/2 bg-transparent border border-[#143D2F] text-[#4A7A66] font-bold py-3.5 rounded-full text-sm transition active:scale-95">Cancel</button>
        <button onclick="executeConfirm()" class="w-1/2 btn-neon font-black py-3.5 rounded-full text-sm shadow-lg transition active:scale-95">Yes, Proceed</button>
    `;
    
    modal.classList.add('modal-active');
    content.classList.add('modal-content-active');
}

function closeAppModal() {
    document.getElementById('customModal').classList.remove('modal-active');
    document.getElementById('customModalContent').classList.remove('modal-content-active');
}

function executeConfirm() {
    closeAppModal();
    if (confirmCallback) confirmCallback();
}

// ==========================================
// AUTHENTICATION & INITIALIZATION
// ==========================================
window.onload = function() {
    const savedToken = localStorage.getItem('sharepoint_token');
    if (savedToken) { 
        currentToken = savedToken; 
        loadDashboard(); 
    }
};

function toggleAuth(type) {
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('forgotPasswordBox').classList.add('hidden');

    if (type === 'register') {
        document.getElementById('registerBox').classList.remove('hidden');
    } else if (type === 'forgot') {
        document.getElementById('forgotPasswordBox').classList.remove('hidden');
    } else {
        document.getElementById('loginBox').classList.remove('hidden');
    }
}

async function handleRegister() {
    const user = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const ref = document.getElementById('regReferral').value;
    
    if(!user || !email || !pass) return appAlert("Please fill all required fields.", "Registration Error", true);
    
    document.getElementById('regBtn').innerText = "Processing...";
    try {
        const response = await fetch('/api/register', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username: user, email: email, password: pass, ref: ref }) 
        });
        const result = await response.json();
        
        if (result.success) { 
            appAlert("Account successfully created! Please sign in.", "Welcome to SharePoint"); 
            toggleAuth('login'); 
        } else { appAlert(result.error, "Registration Failed", true); }
    } catch (e) { appAlert("Network error. Please check your internet connection.", "Connection Failed", true); }
    document.getElementById('regBtn').innerText = "Register";
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    
    if(!email || !pass) return appAlert("Please enter your email and password.", "Login Error", true);
    
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
        } else { appAlert(data.error, "Login Failed", true); }
    } catch (e) { appAlert("Network error. Please try again.", "Connection Failed", true); }
    document.getElementById('loginBtn').innerText = "Login";
}

async function handleForgotPassword() {
    const email = document.getElementById('forgotEmail').value;
    if(!email) return appAlert("Please enter your registered email address.", "Error", true);
    
    document.getElementById('forgotBtn').innerText = "Processing...";
    try {
        const response = await fetch('/api/forgot-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const result = await response.json();
        
        if (result.success) {
            appAlert(`Your password has been reset. \n\nYour temporary password is: \n\n ${result.tempPassword} \n\nPlease copy this, log in, and contact support if you need to change it.`, "Password Reset Success");
            toggleAuth('login');
            document.getElementById('forgotEmail').value = "";
        } else {
            appAlert(result.error, "Reset Failed", true);
        }
    } catch (e) {
        appAlert("Network error. Could not connect to server.", "Error", true);
    }
    document.getElementById('forgotBtn').innerText = "Generate Password";
}

function logout() { 
    localStorage.removeItem('sharepoint_token'); 
    window.location.reload(); 
}

// ==========================================
// DASHBOARD & NAVIGATION
// ==========================================
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard', { headers: { 'Authorization': `Bearer ${currentToken}` } });
        const data = await response.json();
        if (data.success) setupDashboard(data); else logout();
    } catch (e) { console.log("Silent network error on auto-login"); }
}

function setupDashboard(data) {
    currentUser = data.user;
    
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    document.getElementById('userNameDisplay').innerText = currentUser.username;
    document.getElementById('walletBalanceDisplay').innerText = `₦${currentUser.walletBalance.toLocaleString()}`;
    document.getElementById('withdrawableBalanceDisplay').innerText = `₦${currentUser.withdrawableBalance.toLocaleString()}`;
    document.getElementById('dashboardRefDisplay').innerText = data.referralCount;
    document.getElementById('referralCountDisplay').innerText = data.referralCount;
    
    document.getElementById('profileName').innerText = currentUser.username;
    document.getElementById('profileEmail').innerText = currentUser.email;
    document.getElementById('refLinkText').innerText = window.location.origin + "?ref=" + currentUser.id;

    if (currentUser.role === 'admin') {
        document.getElementById('profileAdminBtn').classList.remove('hidden');
        document.getElementById('profileAdminBtn').classList.add('flex');
    }

    renderPlans(data.plans);
    renderPortfolio(data.investments);
}

function switchTab(tabId) {
    const allViews = ['dashboard', 'shares', 'portfolio', 'referral', 'profile', 'admin', 'deposit', 'withdraw', 'support'];
    allViews.forEach(id => { 
        const viewEl = document.getElementById(id + 'View'); 
        if(viewEl) viewEl.classList.add('hidden'); 
    });

    const navItems = ['dashboard', 'shares', 'portfolio', 'referral', 'profile'];
    navItems.forEach(id => {
        const tabEl = document.getElementById('tab-' + id);
        if (tabEl) { 
            tabEl.className = "flex flex-col items-center text-[#4A7A66] hover:text-neon w-1/5 transition"; 
            tabEl.querySelector('span').className = 'font-bold text-[9px] uppercase tracking-wide'; 
        }
    });

    const selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');

    const selectedTab = document.getElementById('tab-' + tabId);
    if(selectedTab) { 
        selectedTab.className = "flex flex-col items-center text-[#00FF87] w-1/5 transition"; 
        selectedTab.querySelector('span').className = 'font-extrabold text-[9px] uppercase tracking-wide'; 
    }
    
    if (['deposit', 'withdraw', 'admin', 'support'].includes(tabId)) {
        document.getElementById('bottomNav').classList.add('hidden');
    } else { document.getElementById('bottomNav').classList.remove('hidden'); }
    
    window.scrollTo(0,0);
}

// ==========================================
// RENDERERS (PLANS & PORTFOLIO)
// ==========================================
function renderPlans(plans) {
    const plansList = document.getElementById('dynamicPlansList');
    if (plans && plans.length > 0) {
        plansList.innerHTML = plans.map(plan => `
            <div class="card rounded-[24px] p-6 mb-5 hover:border-[#00FF87] transition shadow-lg">
                <div class="flex justify-between items-center mb-5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-[#00FF87]/10 flex items-center justify-center border border-[#00FF87]/30"><i class="fa-solid ${plan.icon || 'fa-gem'} text-neon text-xl drop-shadow-sm"></i></div>
                        <div><h4 class="text-xl font-black text-white">${plan.name}</h4><p class="text-[11px] text-neon font-bold tracking-widest uppercase">Cost: ₦${plan.cost.toLocaleString()}</p></div>
                    </div>
                </div>
                <div class="bg-[#061410] rounded-xl p-4 text-sm text-gray-300 border border-[#143D2F] mb-5 shadow-inner">
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Daily Return:</span> <span class="font-bold text-white">₦${plan.dailyReturn.toLocaleString()}</span></div>
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Duration:</span> <span class="font-bold text-white">${plan.duration} Days</span></div>
                    <div class="flex justify-between pt-1"><span class="font-bold text-neon">Total Payout:</span> <span class="font-black text-neon text-base">₦${(plan.cost + (plan.dailyReturn * plan.duration)).toLocaleString()}</span></div>
                </div>
                <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="w-full btn-neon py-3.5 rounded-full text-sm font-black shadow-lg uppercase tracking-wide">Purchase Plan</button>
            </div>`).join('');
    } else { plansList.innerHTML = `<p class="text-center text-[#4A7A66] font-medium mt-10">No investment plans available at the moment.</p>`; }
}

function renderPortfolio(investments) {
    const invList = document.getElementById('investmentsList');
    if (investments && investments.length > 0) {
        invList.innerHTML = investments.map(inv => `
            <div class="card rounded-2xl p-5 flex justify-between items-center border-l-4 border-l-[#00FF87] mb-3 shadow-md">
                <div><h4 class="font-extrabold text-white text-base">${inv.shareName}</h4><p class="text-xs text-neon font-bold mt-1">+₦${inv.dailyReturn.toLocaleString()} Daily</p></div>
                <div class="text-right"><p class="text-3xl font-black text-white">${inv.daysLeft}</p><p class="text-[9px] text-[#4A7A66] uppercase tracking-widest font-bold">Days Left</p></div>
            </div>`).join('');
    } else { invList.innerHTML = `<p class="text-center text-[#4A7A66] font-medium mt-10">You have no active assets in your portfolio.</p>`; }
}

// ==========================================
// TRANSACTIONS (DEPOSIT, WITHDRAW, BUY)
// ==========================================
function setAmount(amount) { document.getElementById('depositAmount').value = amount; }

async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    if (!amount || amount < 100) return appAlert("Minimum deposit amount is ₦100.", "Invalid Amount", true);

    document.getElementById('generateLinkBtn').innerText = "Connecting to Gateway..."; 
    document.getElementById('generateLinkBtn').disabled = true;

    try {
        const response = await fetch('/api/fund', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ amount: amount }) 
        });
        const result = await response.json();
        
        if (result.success) window.location.href = result.checkoutUrl;
        else appAlert(result.error, "Deposit Failed", true); 
    } catch (error) { appAlert("Network error. Could not connect to payment gateway.", "Connection Error", true); }
    
    document.getElementById('generateLinkBtn').innerText = "Proceed to Pay"; 
    document.getElementById('generateLinkBtn').disabled = false;
}

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const bank = document.getElementById('withdrawBank').value;
    const accNo = document.getElementById('withdrawAccNo').value;
    const accName = document.getElementById('withdrawAccName').value;

    if (!amount || amount < 1000) return appAlert("Minimum withdrawal is ₦1,000.", "Invalid Amount", true);
    if (!bank || !accNo || !accName) return appAlert("Please fill all banking details.", "Error", true);

    document.getElementById('withdrawBtn').innerText = "Processing Request..."; 
    document.getElementById('withdrawBtn').disabled = true;

    try {
        const response = await fetch('/api/withdraw', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ amount, bankName: bank, accNo, accName }) 
        });
        const result = await response.json();
        
        if (result.success) {
            appAlert("Your withdrawal request has been sent securely!", "Success");
            document.getElementById('withdrawAmount').value = "";
            switchTab('dashboard'); loadDashboard();
        } else { appAlert(result.error, "Withdrawal Failed", true); }
    } catch (e) { appAlert("Network error. Please try again.", "Error", true); }
    
    document.getElementById('withdrawBtn').innerText = "Request Payout";
    document.getElementById('withdrawBtn').disabled = false;
}

function buyDynamicShare(planId, planName, cost) {
    appConfirm(`Are you sure you want to purchase the ${planName} plan for ₦${cost.toLocaleString()}?`, async () => {
        try {
            const res = await fetch('/api/buy-share', { 
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
                body: JSON.stringify({ planId: planId }) 
            });
            const result = await res.json();
            
            if (result.success) { 
                appAlert("Asset purchased successfully. You can track its earnings in your Portfolio.", "Transaction Successful"); 
                loadDashboard(); switchTab('portfolio'); 
            } else { appAlert(result.error, "Purchase Failed", true); }
        } catch (e) { appAlert("Transaction failed due to network error.", "Error", true); }
    }, "Confirm Purchase");
}

// ==========================================
// UTILITIES & SUPPORT & ADMIN
// ==========================================
async function adminAddPlan() {
    const name = document.getElementById('newPlanName').value;
    const icon = document.getElementById('newPlanIcon').value || "fa-gem";
    const cost = Number(document.getElementById('newPlanCost').value);
    const dailyReturn = Number(document.getElementById('newPlanDaily').value);
    const duration = Number(document.getElementById('newPlanDuration').value);
    
    if(!name || !cost || !dailyReturn || !duration) return appAlert("Please fill all plan details.", "Admin Error", true);

    try {
        const res = await fetch('/api/admin/plan/add', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ name, cost, dailyReturn, duration, icon }) 
        });
        const result = await res.json();
        
        if (result.success) {
            appAlert("New Investment Plan Published Successfully!", "Admin Action");
            document.getElementById('newPlanName').value = ""; document.getElementById('newPlanCost').value = ""; document.getElementById('newPlanDaily').value = ""; document.getElementById('newPlanDuration').value = "";
            loadDashboard();
        } else { appAlert(result.error, "Admin Error", true); }
    } catch (e) { appAlert("Error publishing plan to server.", "Error", true); }
}

function sendSupportMessage() {
    const msg = document.getElementById('supportMessage').value;
    const btn = document.getElementById('supportBtn');
    
    if (!msg.trim()) return appAlert("Please describe your issue before sending.", "Empty Message", true);

    btn.innerText = "Sending Message..."; btn.disabled = true;
    setTimeout(() => {
        appAlert("Message sent to the support team. An agent will review your account shortly.", "Message Delivered");
        document.getElementById('supportMessage').value = "";
        btn.innerText = "Send Message"; btn.disabled = false;
        switchTab('dashboard');
    }, 1500);
}

function copyRefLink() { navigator.clipboard.writeText(document.getElementById('refLinkText').innerText); appAlert("Your referral link has been copied to your clipboard. Share it to start earning!", "Link Copied"); }
