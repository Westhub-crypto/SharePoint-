// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;
let currentToken = null;
let confirmCallback = null;

// ==========================================
// CUSTOM IN-APP MODALS (Replaces browser alerts)
// ==========================================
function appAlert(message, title = "Notification", isError = false) {
    const modal = document.getElementById('customModal');
    const content = document.getElementById('customModalContent');
    
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    
    // Change icon and color based on error or success
    document.getElementById('modalIcon').className = isError ? "fa-solid fa-triangle-exclamation text-2xl text-red-500" : "fa-solid fa-bell text-2xl text-neon";
    document.getElementById('modalIconBox').className = isError ? "w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4" : "w-16 h-16 mx-auto bg-[#00FF87]/10 rounded-full flex items-center justify-center mb-4";
    
    // Single OK Button
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
    
    // Question Icon
    document.getElementById('modalIcon').className = "fa-solid fa-circle-question text-2xl text-[#4A7A66]";
    document.getElementById('modalIconBox').className = "w-16 h-16 mx-auto bg-[#143D2F] rounded-full flex items-center justify-center mb-4";
    
    // Yes / No Buttons
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
    
    if(!user || !email || !pass) return appAlert("Please fill all required fields.", "Registration Error", true);
    
    document.getElementById('regBtn').innerText = "Processing...";
    try {
        const response = await fetch('/api/register', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username: user, email: email, password: pass, ref: ref }) 
        });
        const result = await response.json();
        
        if (result.success) { 
            appAlert("Account successfully created! Please sign in.", "Welcome to SharePoint"); 
            toggleAuth('login'); 
        } else { 
            appAlert(result.error, "Registration Failed", true); 
        }
    } catch (e) { 
        appAlert("Network error. Please check your internet connection.", "Connection Failed", true); 
    }
    document.getElementById('regBtn').innerText = "Register";
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    
    if(!email || !pass) return appAlert("Please enter your email and password.", "Login Error", true);
    
    document.getElementById('loginBtn').innerText = "Authenticating...";
    try {
        const response = await fetch('/api/login', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email: email, password: pass }) 
        });
        const data = await response.json();
        
        if (data.success) { 
            localStorage.setItem('sharepoint_token', data.token); 
            currentToken = data.token; 
            setupDashboard(data); 
        } else { 
            appAlert(data.error, "Login Failed", true); 
        }
    } catch (e) { 
        appAlert("Network error. Please try again.", "Connection Failed", true); 
    }
    document.getElementById('loginBtn').innerText = "Login";
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
        const response = await fetch('/api/dashboard', { 
            headers: { 'Authorization': `Bearer ${currentToken}` } 
        });
        const data = await response.json();
        
        if (data.success) {
            setupDashboard(data);
        } else {
            logout(); // Token is invalid or expired
        }
    } catch (e) { 
        console.log("Silent network error on auto-login"); 
    }
}

function setupDashboard(data) {
    currentUser = data.user;
    
    // Hide Auth, Show Main App
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Populate Dashboard Balances
    document.getElementById('userNameDisplay').innerText = currentUser.username;
    document.getElementById('walletBalanceDisplay').innerText = `₦${currentUser.walletBalance.toLocaleString()}`;
    document.getElementById('withdrawableBalanceDisplay').innerText = `₦${currentUser.withdrawableBalance.toLocaleString()}`;
    document.getElementById('dashboardRefDisplay').innerText = data.referralCount;
    document.getElementById('referralCountDisplay').innerText = data.referralCount;
    
    // Populate Profile Data
    document.getElementById('profileName').innerText = currentUser.fullName || currentUser.username;
    document.getElementById('profileEmail').innerText = currentUser.email;
    document.getElementById('refLinkText').innerText = window.location.origin + "?ref=" + currentUser.id;

    // Withdraw Screen Banking Info setup
    const bankDisplay = document.getElementById('displayBankInfo');
    if (currentUser.bankName && currentUser.accountNumber) {
        bankDisplay.innerHTML = `<span class="text-neon">${currentUser.bankName}</span><br/>${currentUser.accountNumber} - ${currentUser.accountName}`;
    } else {
        bankDisplay.innerHTML = `Not Set - Please update settings`;
    }

    // Set PIN Status Tag
    const pinTag = document.getElementById('pinStatus');
    if (currentUser.hasPin) {
        pinTag.className = "text-[9px] bg-[#00FF87]/20 text-neon px-2 py-1 rounded mr-2 uppercase";
        pinTag.innerText = "Secured";
    } else {
        pinTag.className = "text-[9px] bg-red-500/20 text-red-500 px-2 py-1 rounded mr-2 uppercase";
        pinTag.innerText = "Not Set";
    }

    // Pre-fill Edit Settings form
    document.getElementById('setFullName').value = currentUser.fullName || '';
    document.getElementById('setBankName').value = currentUser.bankName || '';
    document.getElementById('setAccNo').value = currentUser.accountNumber || '';
    document.getElementById('setAccName').value = currentUser.accountName || '';

    // Admin Access
    if (currentUser.role === 'admin') {
        document.getElementById('profileAdminBtn').classList.remove('hidden');
        document.getElementById('profileAdminBtn').classList.add('flex');
    }

    renderPlans(data.plans);
    renderPortfolio(data.investments);
}

function switchTab(tabId) {
    const allViews = ['dashboard', 'shares', 'portfolio', 'referral', 'profile', 'admin', 'deposit', 'withdraw', 'support', 'settings', 'security', 'transactions'];
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
    
    // Hide Bottom Nav on sub-pages
    if (['deposit', 'withdraw', 'admin', 'support', 'settings', 'security', 'transactions'].includes(tabId)) {
        document.getElementById('bottomNav').classList.add('hidden');
    } else { 
        document.getElementById('bottomNav').classList.remove('hidden'); 
    }
    
    window.scrollTo(0,0);
}

// ==========================================
// PROFILE & HISTORY LOGIC
// ==========================================
async function saveProfileDetails() {
    const fullName = document.getElementById('setFullName').value;
    const bankName = document.getElementById('setBankName').value;
    const accNo = document.getElementById('setAccNo').value;
    const accName = document.getElementById('setAccName').value;
    
    document.getElementById('saveProfileBtn').innerText = "Saving...";
    try {
        await fetch('/api/user/update', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ fullName, bankName, accountNumber: accNo, accountName: accName }) 
        });
        
        appAlert("Bank and Profile details updated successfully!", "Settings Saved");
        loadDashboard(); // Refresh data
        switchTab('profile');
    } catch(e) { 
        appAlert("Failed to update profile.", "Update Error", true); 
    }
    document.getElementById('saveProfileBtn').innerText = "Save Changes";
}

async function savePin() {
    const pin = document.getElementById('newPin').value;
    if (pin.length !== 4) return appAlert("Your PIN must be exactly 4 digits.", "Invalid PIN", true);
    
    document.getElementById('savePinBtn').innerText = "Securing...";
    try {
        await fetch('/api/user/pin', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ pin }) 
        });
        
        appAlert("Your withdrawal PIN has been securely set.", "Security Updated");
        loadDashboard();
        document.getElementById('newPin').value = "";
        switchTab('profile');
    } catch(e) { 
        appAlert("Failed to save PIN.", "Security Error", true); 
    }
    document.getElementById('savePinBtn').innerText = "Secure Account";
}

async function loadTransactions() {
    switchTab('transactions');
    document.getElementById('txList').innerHTML = `<p class="text-center text-[#4A7A66] mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i><br/>Loading history...</p>`;
    
    try {
        const res = await fetch('/api/user/transactions', { 
            headers: { 'Authorization': `Bearer ${currentToken}` } 
        });
        const data = await res.json();
        
        if (data.transactions.length > 0) {
            document.getElementById('txList').innerHTML = data.transactions.map(tx => {
                const isCredit = tx.type === 'credit';
                const color = isCredit ? 'text-neon' : 'text-red-500';
                const icon = isCredit ? 'fa-arrow-down' : 'fa-arrow-up';
                const dateObj = new Date(tx.date);
                
                return `
                <div class="card p-4 rounded-xl flex justify-between items-center shadow-md">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-[#143D2F] flex items-center justify-center border border-[#143D2F]">
                            <i class="fa-solid ${icon} ${color}"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-white">${tx.title}</p>
                            <p class="text-[10px] text-[#4A7A66] font-bold uppercase tracking-widest mt-1">${dateObj.toLocaleDateString()} - ${tx.status}</p>
                        </div>
                    </div>
                    <p class="font-black ${color}">${isCredit ? '+' : '-'}₦${tx.amount.toLocaleString()}</p>
                </div>`;
            }).join('');
        } else {
            document.getElementById('txList').innerHTML = `<p class="text-center text-[#4A7A66] mt-10 font-medium">No recent transactions.</p>`;
        }
    } catch(e) { 
        document.getElementById('txList').innerHTML = `<p class="text-center text-red-500 mt-10">Failed to load history.</p>`; 
    }
}

// ==========================================
// TRANSACTIONS (DEPOSIT, WITHDRAW, BUY)
// ==========================================
function setAmount(amount) { 
    document.getElementById('depositAmount').value = amount; 
}

async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    if (!amount || amount < 100) return appAlert("Minimum deposit amount is ₦100.", "Invalid Amount", true);

    document.getElementById('generateLinkBtn').innerText = "Connecting to Gateway..."; 
    document.getElementById('generateLinkBtn').disabled = true;

    try {
        const response = await fetch('/api/fund', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ amount: amount }) 
        });
        const result = await response.json();
        
        if (result.success) {
            window.location.href = result.checkoutUrl;
        } else { 
            appAlert(result.error, "Deposit Failed", true); 
        }
    } catch (error) { 
        appAlert("Network error. Could not connect to payment gateway.", "Connection Error", true); 
    }
    
    document.getElementById('generateLinkBtn').innerText = "Proceed to Pay"; 
    document.getElementById('generateLinkBtn').disabled = false;
}

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const pin = document.getElementById('withdrawPin').value;

    if (!amount || amount < 1000) return appAlert("Minimum withdrawal is ₦1,000.", "Invalid Amount", true);
    if (!pin) return appAlert("Please enter your 4-digit security PIN.", "Security Required", true);

    document.getElementById('withdrawBtn').innerText = "Processing Request..."; 
    document.getElementById('withdrawBtn').disabled = true;

    try {
        const response = await fetch('/api/withdraw', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify({ amount, pin }) 
        });
        const result = await response.json();
        
        if (result.success) {
            appAlert("Your withdrawal request has been sent securely!", "Success");
            document.getElementById('withdrawPin').value = "";
            document.getElementById('withdrawAmount').value = "";
            switchTab('dashboard'); 
            loadDashboard();
        } else { 
            appAlert(result.error, "Withdrawal Failed", true); 
        }
    } catch (e) { 
        appAlert("Network error. Please try again.", "Error", true); 
    }
    
    document.getElementById('withdrawBtn').innerText = "Request Payout";
    document.getElementById('withdrawBtn').disabled = false;
}

function buyDynamicShare(planId, planName, cost) {
    appConfirm(`Are you sure you want to purchase the ${planName} plan for ₦${cost.toLocaleString()}?`, async () => {
        try {
            const res = await fetch('/api/buy-share', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
                body: JSON.stringify({ planId: planId }) 
            });
            const result = await res.json();
            
            if (result.success) { 
                appAlert("Asset purchased successfully. You can track its earnings in your Portfolio.", "Transaction Successful"); 
                loadDashboard(); 
                switchTab('portfolio'); 
            } else { 
                appAlert(result.error, "Purchase Failed", true); 
            }
        } catch (e) { 
            appAlert("Transaction failed due to network error.", "Error", true); 
        }
    }, "Confirm Purchase");
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
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Daily Return:</span> <span class="font-bold text-white">₦${plan.dailyRet
