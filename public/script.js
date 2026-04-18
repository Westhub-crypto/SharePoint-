const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); 

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
const SUPPORT_BOT_LINK = "https://t.me/SharePoint_support_system_bot";

// ==========================================
// 1. INSTANT BOOT SEQUENCE
// ==========================================
window.onload = function() {
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
    
    document.getElementById('userNameDisplay').innerText = USER_NAME;
    loadDashboard();
};

// ==========================================
// 2. SUPPORT BOT LINK
// ==========================================
function openSupportBot() {
    tg.HapticFeedback.impactOccurred('light');
    tg.openTelegramLink(SUPPORT_BOT_LINK);
}

// ==========================================
// 3. LOAD & RENDER DATA (NAIRA ONLY)
// ==========================================
async function loadDashboard() {
    tg.MainButton.text = "Syncing Network..."; tg.MainButton.show(); tg.MainButton.showProgress();
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, name: USER_NAME, referredBy: REFERRED_BY })
        });
        
        tg.MainButton.hide();

        if (!res.ok) return tg.showAlert("Server is offline. Try again.");

        const data = await res.json();

        if (data.error === "Banned") {
            document.body.innerHTML = "<h2 style='color:#EF4444; text-align:center; margin-top:50px;'>Account Suspended</h2>";
            return;
        }

        renderUI(data);
        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { tg.MainButton.hide(); }
}

function renderUI(data) {
    document.getElementById('walletBalanceDisplay').innerText = `₦${data.user.walletBalance.toLocaleString()}`;
    document.getElementById('withdrawableBalanceDisplay').innerText = `₦${data.user.withdrawableBalance.toLocaleString()}`;
    document.getElementById('referralCountDisplay').innerText = data.referralCount;
    document.getElementById('refLinkText').innerText = MY_REF_LINK;

    const plansList = document.getElementById('dynamicPlansList');
    if (data.plans && data.plans.length > 0) {
        plansList.innerHTML = data.plans.map(plan => {
            return `
            <div class="glass-card p-5 hover:border-blue-500/50 transition">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center relative shadow-inner">
                            <i class="fa-solid ${plan.icon} text-blue-400 text-xl drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"></i>
                        </div>
                        <div>
                            <h4 class="font-extrabold text-white text-lg tracking-tight text-glow">${plan.name}</h4>
                            <p class="text-xs text-blue-200 font-medium">Duration: ${plan.duration} Days</p>
                        </div>
                    </div>
                    <div class="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        + ₦${plan.dailyReturn.toLocaleString()} / Day
                    </div>
                </div>
                
                <div class="w-full bg-black/40 rounded-full h-1.5 mb-5 shadow-inner">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full w-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                </div>
                
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Investment Cost</p>
                        <p class="text-xl font-extrabold text-white mt-0.5">₦${plan.cost.toLocaleString()}</p>
                    </div>
                    <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="btn-glow px-7 py-3 rounded-full text-sm font-extrabold shadow-lg">Purchase</button>
                </div>
            </div>`
        }).join('');
    } else {
        plansList.innerHTML = `<div class="glass-card p-8 text-center border-dashed border-2 border-blue-500/20"><p class="text-blue-300 text-sm font-bold">No assets available right now.</p></div>`;
    }

    const invList = document.getElementById('investmentsList');
    if (data.investments && data.investments.length > 0) {
        invList.innerHTML = data.investments.map(inv => `
            <div class="glass-card p-5 flex justify-between items-center border-l-4 border-l-blue-500 hover:bg-white/5 transition">
                <div class="flex items-center gap-4">
                     <div class="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                         <i class="fa-solid fa-chart-pie text-xl drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"></i>
                     </div>
                     <div>
                        <h4 class="font-extrabold text-white text-base text-glow">${inv.shareName}</h4>
                        <p class="text-xs text-emerald-400 font-bold mt-1">+₦${inv.dailyReturn.toLocaleString()} Daily</p>
                     </div>
                </div>
                <div class="text-right">
                    <p class="text-3xl font-black text-white text-glow">${inv.daysLeft}</p>
                    <p class="text-[9px] text-blue-300 uppercase tracking-widest font-bold">Days Left</p>
                </div>
            </div>
        `).join('');
    } else { invList.innerHTML = `<div class="glass-card p-8 text-center border-dashed border-2 border-blue-500/20"><p class="text-blue-300 text-sm font-bold">No active portfolio.</p></div>`; }
}

// ==========================================
// 4. ADMIN PANEL LOGIC 
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

        document.getElementById('adminWithdrawalList').innerHTML = data.pendingWithdrawals.map(w => `
            <div class="glass-card p-5 border-l-4 border-l-rose-500">
                <p class="text-[10px] text-blue-300 font-bold mb-2">ID: ${w.refId}</p>
                <p class="font-extrabold text-white text-base mb-1">${w.userName} requested <span class="text-emerald-400 text-glow">₦${w.amount.toLocaleString()}</span></p>
                <p class="text-xs text-blue-200 font-medium mb-4">${w.bankName} - ${w.accountNumber}</p>
                <div class="flex gap-3">
                    <button onclick="resolveWithdrawal('${w.refId}', 'approve')" class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl text-xs font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.4)] transition">Approve</button>
                    <button onclick="resolveWithdrawal('${w.refId}', 'reject')" class="flex-1 bg-black/40 border border-white/10 text-white py-3 rounded-xl text-xs font-bold hover:bg-white/10 transition">Reject</button>
                </div>
            </div>
        `).join('') || `<div class="glass-card p-6 text-center border-dashed border-2 border-rose-500/20"><p class="text-rose-300 text-sm font-bold">No pending requests.</p></div>`;

        document.getElementById('adminUsersList').innerHTML = data.users.map(u => `
            <div class="glass-card p-4 flex justify-between items-center mb-3">
                <div>
                    <p class="font-bold text-white text-sm">${u.username || 'Unknown'}</p>
                    <p class="text-[10px] text-blue-300 uppercase font-bold mt-1.5">Bal: ₦${u.walletBalance.toLocaleString()} | Earn: ₦${u.withdrawableBalance.toLocaleString()}</p>
                </div>
                <button onclick="toggleBan('${u.tgId}', ${!u.isBanned})" class="px-5 py-2.5 rounded-full text-xs font-bold transition ${u.isBanned ? 'bg-black/40 text-slate-400 border border-white/10' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white shadow-[0_0_10px_rgba(225,29,72,0.3)]'}">${u.isBanned ? 'Unban' : 'Ban User'}</button>
            </div>
        `).join('');

    } catch (e) {}
}

async function adminAddPlan() {
    const name = document.getElementById('newPlanName').value;
    const icon = document.getElementById('newPlanIcon').value || "fa-gem";
    const cost = Number(document.getElementById('newPlanCost').value);
    const dailyReturn = Number(document.getElementById('newPlanDaily').value);
    const duration = Number(document.getElementById('newPlanDuration').value);

    if(!name || !cost || !dailyReturn || !duration) return tg.showAlert("Fill all fields.");

    tg.MainButton.text = "Adding..."; tg.MainButton.show();
    
    await fetch('/api/admin/plan/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID },
        body: JSON.stringify({ name: name, cost: cost, dailyReturn: dailyReturn, duration: duration, icon: icon })
    });
    
    tg.MainButton.hide(); 
    tg.showAlert("Plan Published!"); 
    
    document.getElementById('newPlanName').value = "";
    document.getElementById('newPlanCost').value = "";
    document.getElementById('newPlanDaily').value = "";
    document.getElementById('newPlanDuration').value = "";
    loadDashboard();
}

async function resolveWithdrawal(refId, action) {
    tg.showConfirm(`Are you sure you want to ${action} this request?`, async (conf) => {
        if (!conf) return;
        tg.MainButton.text = "Processing..."; tg.MainButton.show();
        await fetch('/api/admin/withdraw/resolve', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID },
            body: JSON.stringify({ refId: refId, action: action })
        });
        tg.MainButton.hide(); tg.showAlert("Resolved!"); loadAdminStats(); loadDashboard();
    });
}

async function toggleBan(tgId, banStatus) {
    tg.showConfirm(`Change ban status?`, async (conf) => {
        if(!conf) return;
        await fetch('/api/admin/ban', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID },
            body: JSON.stringify({ tgId: tgId, banStatus: banStatus })
        });
        tg.showAlert("Updated!"); loadAdminStats();
    });
}

// ==========================================
// 5. USER ACTIONS
// ==========================================
function buyDynamicShare(planId, planName, cost) {
    tg.showConfirm(`Purchase ${planName} for ₦${cost.toLocaleString()}?`, async (confirmed) => {
        if (!confirmed) return;
        tg.MainButton.text = "Processing Payment..."; tg.MainButton.show();
        try {
            const res = await fetch('/api/buy-share', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, planId: planId })
            });
            const result = await res.json();
            tg.MainButton.hide();
            if (result.success) { 
                tg.HapticFeedback.notificationOccurred('success');
                tg.showAlert("✅ Success! Asset added to portfolio."); 
                loadDashboard(); 
                switchTab('portfolio'); 
            }
            else { tg.showAlert(`❌ ${result.error}`); }
        } catch (e) { tg.MainButton.hide(); tg.showAlert("Transaction Failed."); }
    });
}

// NAVIGATION TABS
function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    
    var ids = ['dashboard', 'shares', 'portfolio', 'referral', 'admin'];
    for(var i=0; i<ids.length; i++) {
        var viewEl = document.getElementById(ids[i] + 'View');
        var tabEl = document.getElementById('tab-' + ids[i]);
        if(viewEl) viewEl.classList.add('hidden');
        
        if(tabEl) {
            if (ids[i] === 'admin') tabEl.className = "flex flex-col items-center justify-center text-rose-500/50 hover:text-rose-400 w-1/5 h-16 transition";
            else tabEl.className = "flex flex-col items-center justify-center text-slate-500 hover:text-blue-300 " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " h-16 transition";
            
            var icon = tabEl.querySelector('i');
            if(icon) {
                icon.classList.remove('drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]');
                icon.classList.remove('text-2xl');
                icon.classList.add('text-xl');
            }
            
            var text = tabEl.querySelector('span');
            if(text) { text.classList.remove('font-extrabold'); text.classList.add('font-bold'); }
        }
    }

    var selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');

    var selectedTab = document.getElementById('tab-' + tabId);
    if(selectedTab) {
        selectedTab.className = "flex flex-col items-center justify-center text-blue-400 " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " h-16 transition";
        var iconActive = selectedTab.querySelector('i');
        if(iconActive) {
            iconActive.classList.add('drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]');
            iconActive.classList.remove('text-xl');
            iconActive.classList.add('text-2xl');
        }
        
        var textActive = selectedTab.querySelector('span');
        if(textActive) { textActive.classList.remove('font-bold'); textActive.classList.add('font-extrabold'); }
    }
    window.scrollTo(0, 0);
}

function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('depositView').classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showWithdrawPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('withdrawView').classList.remove('hidden');
    window.scrollTo(0, 0);
}

function goBackToHome() {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositView').classList.add('hidden');
    document.getElementById('withdrawView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    document.getElementById('bottomNav').classList.remove('hidden');
}

function setAmount(amount) {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositAmount').value = amount;
}

function copyRefLink() {
    tg.HapticFeedback.impactOccurred('medium');
    const tempInput = document.createElement("input"); tempInput.value = MY_REF_LINK; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
    tg.showAlert("✅ Link copied successfully!");
}
function shareLink() {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent(MY_REF_LINK) + "&text=Join my premium network on SharePoint and start earning daily yields!";
    tg.openTelegramLink(shareUrl);
}

async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    if (!amount || amount < 100) return tg.showAlert("Minimum deposit is ₦100.");
    
    const btn = document.getElementById('generateLinkBtn');
    tg.HapticFeedback.impactOccurred('medium');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating Gateway..."; btn.disabled = true; 

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
        btn.innerText = originalText; btn.disabled = false; tg.showAlert("Network connection error.");
    }
}

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const bank = document.getElementById('withdrawBank').value;
    const accNo = document.getElementById('withdrawAccNo').value;
    const accName = document.getElementById('withdrawAccName').value;
    
    if (!amount || amount < 1000) return tg.showAlert("Minimum withdrawal is ₦1,000.");
    if (!bank || !accNo || !accName) return tg.showAlert("Please fill all banking details.");

    const btn = document.getElementById('withdrawBtn');
    tg.MainButton.text = "Sending Request..."; tg.MainButton.show(); tg.MainButton.showProgress();
    btn.disabled = true;

    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, userName: USER_NAME, amount: amount, bankName: bank, accNo: accNo, accName: accName })
        });
        const result = await response.json();
        tg.MainButton.hide(); btn.disabled = false;

        if (result.success) {
            tg.HapticFeedback.notificationOccurred('success');
            tg.showAlert("✅ Withdrawal request submitted successfully!");
            goBackToHome();
            loadDashboard();
        } else { tg.showAlert(`❌ Error: ${result.error}`); }
    } catch (e) { tg.MainButton.hide(); btn.disabled = false; tg.showAlert("Network connection error."); }
                                }
