// 1. GLOBAL ERROR CATCHER (Forces errors to show on your screen instead of failing silently)
window.onerror = function(msg, url, lineNo) {
    alert("System Error: " + msg + " (Line " + lineNo + ")");
    return false;
};

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); 

// 2. SAFE USER ID EXTRACTION
let user = null;
if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
    user = window.Telegram.WebApp.initDataUnsafe.user;
}

const USER_ID = user ? user.id.toString() : "12345"; 
const USER_NAME = user ? user.first_name : "User";

let REFERRED_BY = null;
if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.start_param) {
    REFERRED_BY = window.Telegram.WebApp.initDataUnsafe.start_param;
}

const BOT_USERNAME = "SharePoint_official_bot"; 
const MY_REF_LINK = "https://t.me/" + BOT_USERNAME + "?start=" + USER_ID;
const ADMIN_ID = "8067627422"; 

// ==========================================
// 3. INSTANT BOOT SEQUENCE
// ==========================================
// We do NOT use window.onload anymore. We run this instantly.
function initApp() {
    try {
        // SECURITY PURGE & ADMIN CHECK
        if (USER_ID !== ADMIN_ID) {
            var adminView = document.getElementById('adminView');
            var tabAdmin = document.getElementById('tab-admin');
            if (adminView) adminView.remove(); 
            if (tabAdmin) tabAdmin.remove();   
        } else {
            var adminTab = document.getElementById('tab-admin');
            if (adminTab) {
                adminTab.classList.remove('hidden');
                adminTab.classList.add('flex');
                var buttons = document.querySelectorAll('#navFlexContainer button');
                for(var i = 0; i < buttons.length; i++) {
                    buttons[i].classList.remove('w-1/4');
                    buttons[i].classList.add('w-1/5');
                }
            }
        }

        // Show Welcome Modal if first time
        if (!sessionStorage.getItem('welcomeSeen')) {
            var wModal = document.getElementById('welcomeModal');
            if (wModal) wModal.classList.remove('hidden');
        }

        // Force dashboard load immediately
        loadDashboard();
    } catch(e) {
        alert("Boot Error: " + e.message);
    }
}

// EXECUTE INSTANTLY
initApp();

function closeWelcomeModal() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('welcomeModal').classList.add('hidden');
    sessionStorage.setItem('welcomeSeen', 'true');
}

// ==========================================
// 4. SUPPORT DESK LOGIC
// ==========================================
function openSupportModal() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('supportModal').classList.remove('hidden');
}

function closeSupportModal() {
    document.getElementById('supportModal').classList.add('hidden');
}

async function sendSupportMessage() {
    var topic = document.getElementById('supportTopic').value;
    var message = document.getElementById('supportMessage').value;
    var btn = document.getElementById('supportBtn');

    if (!topic || !message) return tg.showAlert("Please select a topic and write a message.");

    btn.innerText = "Sending..."; btn.disabled = true;

    try {
        const res = await fetch('/api/support/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, username: USER_NAME, topic: topic, message: message })
        });
        const result = await res.json();
        
        btn.innerText = "Send to Admin"; btn.disabled = false;
        
        if (result.success) {
            tg.showAlert("✅ Message sent! The Admin will reply to you in your Telegram chat shortly.");
            closeSupportModal();
            document.getElementById('supportMessage').value = ""; 
        } else {
            tg.showAlert("❌ Error sending message.");
        }
    } catch (e) {
        btn.innerText = "Send to Admin"; btn.disabled = false;
        tg.showAlert("Network error. Try again.");
    }
}

// ==========================================
// 5. LOAD DASHBOARD & PROFILE DATA
// ==========================================
async function loadDashboard() {
    // Visual indicator that we are trying to reach the server
    var nameDisplay = document.getElementById('userNameDisplay');
    if(nameDisplay) nameDisplay.innerText = "Waking Server... ⏳";
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, name: USER_NAME, referredBy: REFERRED_BY })
        });
        
        if (!res.ok) { 
            if(nameDisplay) nameDisplay.innerText = "Server Offline";
            tg.showAlert("Server is offline. Please try again in 30 seconds."); 
            return; 
        }

        const data = await res.json();
        if (data.error === "Banned") {
            document.body.innerHTML = "<h2 style='color:red; text-align:center; margin-top:50px;'>Account Suspended</h2>"; 
            return;
        }

        // Populate Dashboard
        if(nameDisplay) nameDisplay.innerText = data.user.username || "Investor";
        
        var wBal = document.getElementById('walletBalanceDisplay');
        if(wBal) wBal.innerText = `₦${data.user.walletBalance.toLocaleString()}`;
        
        var earnBal = document.getElementById('withdrawableBalanceDisplay');
        if(earnBal) earnBal.innerText = `₦${data.user.withdrawableBalance.toLocaleString()}`;
        
        var refCount = document.getElementById('referralCountDisplay');
        if(refCount) refCount.innerText = data.referralCount;
        
        var refLink = document.getElementById('refLinkText');
        if(refLink) refLink.innerText = MY_REF_LINK;

        // Populate Profile Fields
        if(data.user.fullName) document.getElementById('profFullName').value = data.user.fullName;
        if(data.user.bankName) document.getElementById('profBankName').value = data.user.bankName;
        if(data.user.accountNumber) document.getElementById('profAccNo').value = data.user.accountNumber;
        if(data.user.accountName) document.getElementById('profAccName').value = data.user.accountName;
        if(data.user.hasPin) document.getElementById('profPin').placeholder = "PIN Saved (Enter new to change)";

        // Render Plans
        const plansList = document.getElementById('dynamicPlansList');
        if (plansList) {
            if (data.plans && data.plans.length > 0) {
                plansList.innerHTML = data.plans.map(plan => {
                    const totalEarn = plan.dailyReturn * plan.duration;
                    const weeklyEarn = plan.dailyReturn * 7;
                    const monthlyEarn = plan.dailyReturn * 30; 
                    return `
                    <div class="card rounded-3xl p-5 mb-4 border border-[#222834]">
                        <div class="flex justify-between items-center mb-4">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                                    <i class="fa-solid ${plan.icon} text-blue-400 text-xl"></i>
                                </div>
                                <div>
                                    <h4 class="text-lg font-bold text-white">${plan.name}</h4>
                                    <p class="text-xs text-emerald-400 font-bold">Cost: ₦${plan.cost.toLocaleString()}</p>
                                </div>
                            </div>
                            <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition active:scale-95 shadow-lg">Buy</button>
                        </div>
                        
                        <div class="bg-[#0B0E14] rounded-xl p-4 text-sm text-gray-300 space-y-2 border border-[#222834]">
                            <div class="flex justify-between border-b border-[#222834] pb-1"><span>Daily Return:</span> <span class="font-bold text-emerald-400">₦${plan.dailyReturn.toLocaleString()}</span></div>
                            <div class="flex justify-between border-b border-[#222834] pb-1"><span>Weekly Return:</span> <span class="font-bold text-white">₦${weeklyEarn.toLocaleString()}</span></div>
                            <div class="flex justify-between border-b border-[#222834] pb-1"><span>Monthly Return:</span> <span class="font-bold text-white">₦${monthlyEarn.toLocaleString()}</span></div>
                            <div class="flex justify-between pt-1"><span>Total Profit (${plan.duration} Days):</span> <span class="font-bold text-blue-400">₦${totalEarn.toLocaleString()}</span></div>
                        </div>
                    </div>`
                }).join('');
            } else {
                plansList.innerHTML = `<div class="card p-6 text-center rounded-2xl border border-[#222834]"><p class="text-gray-500 text-sm">No plans available right now.</p></div>`;
            }
        }

        // Render Portfolio
        const invList = document.getElementById('investmentsList');
        if (invList) {
            if (data.investments && data.investments.length > 0) {
                invList.innerHTML = data.investments.map(inv => `
                    <div class="card rounded-2xl p-5 flex justify-between items-center border border-[#222834]">
                        <div>
                            <h4 class="font-bold text-white text-sm">${inv.shareName}</h4>
                            <p class="text-xs text-emerald-400 font-medium">+₦${inv.dailyReturn} Daily</p>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold text-blue-400">${inv.daysLeft}</p>
                            <p class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Days Left</p>
                        </div>
                    </div>
                `).join('');
            } else { 
                invList.innerHTML = `<div class="card p-6 text-center rounded-2xl border border-[#222834]"><p class="text-gray-500 text-sm">No active investments.</p></div>`; 
            }
        }

        // Load admin stats if applicable
        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { 
        if(nameDisplay) nameDisplay.innerText = "Connection Failed";
        tg.showAlert("Network error. Make sure your internet is stable and try again."); 
    }
}

// ==========================================
// 6. PROFILE & TRANSACTIONS
// ==========================================
async function saveProfile() {
    var fName = document.getElementById('profFullName').value;
    var bName = document.getElementById('profBankName').value;
    var accNo = document.getElementById('profAccNo').value;
    var accName = document.getElementById('profAccName').value;
    var pin = document.getElementById('profPin').value;
    var btn = document.getElementById('saveProfileBtn');

    if (!fName || !bName || !accNo || !accName) return tg.showAlert("Please fill out all bank details.");

    btn.innerText = "Saving..."; btn.disabled = true;

    try {
        const res = await fetch('/api/profile/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, fullName: fName, bankName: bName, accountNumber: accNo, accountName: accName, withdrawalPin: pin })
        });
        const result = await res.json();
        btn.innerText = "Save Profile"; btn.disabled = false;
        
        if (result.success) {
            tg.HapticFeedback.notificationOccurred('success');
            tg.showAlert("✅ Profile updated successfully!");
            document.getElementById('profPin').value = ""; 
        } else { tg.showAlert("❌ Error saving profile."); }
    } catch (e) { btn.innerText = "Save Profile"; btn.disabled = false; tg.showAlert("Network error."); }
}

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const pin = document.getElementById('withdrawPin').value;
    const btn = document.getElementById('withdrawBtn');

    if (!amount || amount < 1000) return tg.showAlert("Min ₦1,000");
    if (!pin) return tg.showAlert("Please enter your Withdrawal PIN.");

    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, userName: USER_NAME, amount: amount, pin: pin })
        });
        const result = await response.json();
        btn.innerText = "Request Payout"; btn.disabled = false;

        if (result.success) {
            tg.HapticFeedback.notificationOccurred('success');
            tg.showAlert("✅ Withdrawal request sent!");
            document.getElementById('withdrawAmount').value = "";
            document.getElementById('withdrawPin').value = "";
            loadDashboard(); tg.BackButton.click(); 
        } else { 
            tg.HapticFeedback.notificationOccurred('error');
            tg.showAlert(`❌ Error: ${result.error}`); 
        }
    } catch (e) { btn.innerText = "Request Payout"; btn.disabled = false; tg.showAlert("Network error."); }
}

function buyDynamicShare(planId, planName, cost) {
    tg.showConfirm(`Buy ${planName} for ₦${cost.toLocaleString()}?`, async (confirmed) => {
        if (!confirmed) return;
        try {
            const res = await fetch('/api/buy-share', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, planId: planId })
            });
            const result = await res.json();
            if (result.success) { 
                tg.showAlert("✅ Success!"); 
                loadDashboard(); 
                switchTab('portfolio'); 
            }
            else { tg.showAlert(`❌ ${result.error}`); }
        } catch (e) { tg.showAlert("Failed."); }
    });
}

// ==========================================
// 7. NAVIGATION & UI HELPERS
// ==========================================
function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    
    if(tabId === 'profile' || tabId === 'admin') document.getElementById('mainHeader').classList.add('hidden');
    else document.getElementById('mainHeader').classList.remove('hidden');

    var ids = ['dashboard', 'profile', 'shares', 'portfolio', 'referral', 'admin'];
    for(var i=0; i<ids.length; i++) {
        var viewEl = document.getElementById(ids[i] + 'View');
        var tabEl = document.getElementById('tab-' + ids[i]);
        if(viewEl) viewEl.classList.add('hidden');
        if(tabEl) {
            if (ids[i] === 'admin') tabEl.className = "flex flex-col items-center text-red-500 w-1/5 opacity-50 transition";
            else tabEl.className = "flex flex-col items-center text-gray-500 " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " transition";
        }
    }

    var selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');

    var selectedTab = document.getElementById('tab-' + tabId);
    if(selectedTab) {
        if (tabId === 'admin') selectedTab.className = "flex flex-col items-center text-red-500 w-1/5 opacity-100 transition";
        else selectedTab.className = "flex flex-col items-center text-blue-500 " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " transition drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]";
    }
}

function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('mainHeader').classList.add('hidden');
    var ids = ['dashboardView', 'profileView', 'sharesView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'];
    for(var i=0; i<ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if(el) el.classList.add('hidden');
    }
    document.getElementById('depositView').classList.remove('hidden');
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        document.getElementById('depositView').classList.add('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
        document.getElementById('mainHeader').classList.remove('hidden');
        switchTab('dashboard');
        tg.BackButton.hide();
    });
}

function showWithdrawPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('mainHeader').classList.add('hidden');
    var ids = ['dashboardView', 'profileView', 'sharesView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'];
    for(var i=0; i<ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if(el) el.classList.add('hidden');
    }
    document.getElementById('withdrawView').classList.remove('hidden');
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        document.getElementById('withdrawView').classList.add('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
        document.getElementById('mainHeader').classList.remove('hidden');
        switchTab('dashboard');
        tg.BackButton.hide();
    });
}

function setAmount(amount) {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositAmount').value = amount;
}

function copyRefLink() {
    tg.HapticFeedback.impactOccurred('medium');
    const tempInput = document.createElement("input"); tempInput.value = MY_REF_LINK; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
    tg.showAlert("✅ Link copied!");
}
function shareLink() {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent(MY_REF_LINK) + "&text=Join me on SharePoint Premium!";
    tg.openTelegramLink(shareUrl);
}

// SQUADCO FUNDING
async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    const btn = document.getElementById('generateLinkBtn');
    if (!amount || amount < 100) { tg.showAlert("Min ₦100."); return; }
    
    tg.HapticFeedback.impactOccurred('medium');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating..."; btn.disabled = true; 

    try {
        const response = await fetch('/api/fund', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, amount: amount })
        });
        const result = await response.json();
        btn.innerText = originalText; btn.disabled = false;

        if (result.success) tg.openLink(result.checkoutUrl);
        else tg.showAlert(`❌ Error: ${result.error}`);
    } catch (error) {
        btn.innerText = originalText; btn.disabled = false; tg.showAlert("Network error.");
    }
}

// ==========================================
// 8. ADMIN DASHBOARD LOGIC
// ==========================================
function switchAdminSubTab(tab) {
    var tabs = ['withdrawals', 'plans', 'users'];
    for(var i=0; i<tabs.length; i++) {
        var el = document.getElementById('admin-' + tabs[i]);
        if (el) el.classList.add('hidden');
    }
    var activeTab = document.getElementById('admin-' + tab);
    if(activeTab) activeTab.classList.remove('hidden');
}

async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', { headers: { 'x-admin-id': ADMIN_ID } });
        const data = await res.json();

        var wdList = document.getElementById('adminWithdrawalList');
        if (wdList) {
            wdList.i
