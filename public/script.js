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

// ==========================================
// 1. INSTANT BOOT SEQUENCE
// ==========================================
window.onload = function() {
    // SECURITY PURGE
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

    // Go straight into loading the dashboard
    loadDashboard();
};

// ==========================================
// 2. LOAD DASHBOARD & RENDER PLANS
// ==========================================
async function loadDashboard() {
    tg.MainButton.text = "Loading data..."; tg.MainButton.show(); tg.MainButton.showProgress();
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, name: USER_NAME, referredBy: REFERRED_BY })
        });
        
        tg.MainButton.hide();

        if (!res.ok) {
            tg.showAlert("Server is offline. Try again.");
            return;
        }

        const data = await res.json();

        if (data.error === "Banned") {
            document.body.innerHTML = "<h2 style='color:red; text-align:center; margin-top:50px;'>Account Suspended</h2>";
            return;
        }

        document.getElementById('userNameDisplay').innerText = data.user.username || "Investor";
        document.getElementById('walletBalanceDisplay').innerText = `₦${data.user.walletBalance.toLocaleString()}`;
        document.getElementById('withdrawableBalanceDisplay').innerText = `₦${data.user.withdrawableBalance.toLocaleString()}`;
        document.getElementById('referralCountDisplay').innerText = data.referralCount;
        document.getElementById('refLinkText').innerText = MY_REF_LINK;

        const plansList = document.getElementById('dynamicPlansList');
        if (data.plans && data.plans.length > 0) {
            plansList.innerHTML = data.plans.map(plan => {
                const totalEarn = plan.dailyReturn * plan.duration;
                const weeklyEarn = plan.dailyReturn * 7;
                const monthlyEarn = plan.dailyReturn * 30; 

                return `
                <div class="card rounded-3xl p-5 mb-4">
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
                        <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition active:scale-95">Buy</button>
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
            plansList.innerHTML = `<div class="card p-6 text-center rounded-2xl"><p class="text-gray-500 text-sm">No plans available right now.</p></div>`;
        }

        const invList = document.getElementById('investmentsList');
        if (data.investments && data.investments.length > 0) {
            invList.innerHTML = data.investments.map(inv => `
                <div class="card rounded-2xl p-5 flex justify-between items-center">
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
        } else { invList.innerHTML = `<div class="card p-6 text-center rounded-2xl"><p class="text-gray-500 text-sm">No active investments.</p></div>`; }

        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { 
        tg.MainButton.hide();
        tg.showAlert("Network error. Please wait for the server to wake up."); 
    }
}

// ==========================================
// 3. ADMIN PANEL LOGIC
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
            <div class="card p-4 rounded-xl border-l-4 border-l-blue-500">
                <p class="text-xs text-gray-400">ID: ${w.refId}</p>
                <p class="font-bold text-white">${w.userName} requested <span class="text-emerald-400">₦${w.amount}</span></p>
                <p class="text-sm text-gray-300">${w.bankName} - ${w.accountNumber}</p>
                <div class="flex gap-2 mt-3">
                    <button onclick="resolveWithdrawal('${w.refId}', 'approve')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">Approve</button>
                    <button onclick="resolveWithdrawal('${w.refId}', 'reject')" class="flex-1 bg-[#1A222C] border border-[#222834] text-white py-2 rounded-lg text-xs font-bold">Reject</button>
                </div>
            </div>
        `).join('') || `<p class="text-gray-500 text-xs">No pending requests.</p>`;

        document.getElementById('adminUsersList').innerHTML = data.users.map(u => `
            <div class="card p-3 rounded-xl flex justify-between items-center">
                <div>
                    <p class="font-bold text-white text-sm">${u.username || 'Unknown'}</p>
                    <p class="text-[10px] text-gray-400 uppercase">Bal: ₦${u.walletBalance} | Earn: ₦${u.withdrawableBalance}</p>
                </div>
                <button onclick="toggleBan('${u.tgId}', ${!u.isBanned})" class="px-3 py-2 rounded-lg text-xs font-bold ${u.isBanned ? 'bg-[#1A222C] text-gray-300 border border-[#222834]' : 'bg-red-500/20 text-red-400'}">${u.isBanned ? 'Unban' : 'Ban'}</button>
            </div>
        `).join('');

    } catch (e) {}
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
    tg.MainButton.hide(); tg.showAlert("Plan Published!"); loadDashboard();
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
// 4. USER ACTIONS (BUY, DEPOSIT, WITHDRAW)
// ==========================================
function buyDynamicShare(planId, planName, cost) {
    tg.showConfirm(`Buy ${planName} for ₦${cost.toLocaleString()}?`, async (confirmed) => {
        if (!confirmed) return;
        tg.MainButton.text = "Processing..."; tg.MainButton.show();
        try {
            const res = await fetch('/api/buy-share', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, planId: planId })
            });
            const result = await res.json();
            tg.MainButton.hide();
            if (result.success) { 
                tg.showAlert("✅ Success!"); 
                loadDashboard(); 
                switchTab('portfolio'); 
            }
            else { tg.showAlert(`❌ ${result.error}`); }
        } catch (e) { tg.MainButton.hide(); tg.showAlert("Failed."); }
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
    var ids = ['dashboardView', 'sharesView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'];
    for(var i=0; i<ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if(el) el.classList.add('hidden');
    }
    document.getElementById('depositView').classList.remove('hidden');
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        document.getElementById('depositView').classList.add('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
        switchTab('dashboard');
        tg.BackButton.hide();
    });
}

function showWithdrawPage() {
    tg.HapticFeedback.impactOccurred('light');
    var ids = ['dashboardView', 'sharesView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'];
    for(var i=0; i<ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if(el) el.classList.add('hidden');
    }
    document.getElementById('withdrawView').classList.remove('hidden');
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        document.getElementById('withdrawView').classList.add('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
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
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent(MY_REF_LINK) + "&text=Join me on SharePoint!";
    tg.openTelegramLink(shareUrl);
}

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

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const bank = document.getElementById('withdrawBank').value;
    const accNo = document.getElementById('withdrawAccNo').value;
    const accName = document.getElementById('withdrawAccName').value;
    const btn = document.getElementById('withdrawBtn');

    if (!amount || amount < 1000) return tg.showAlert("Min ₦1,000");
    if (!bank || !accNo || !accName) return tg.showAlert("Fill all fields.");

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
            tg.showAlert("✅ Withdrawal request sent!");
            loadDashboard(); tg.BackButton.click(); 
        } else { tg.showAlert(`❌ Error: ${result.error}`); }
    } catch (e) { tg.MainButton.hide(); btn.disabled = false; tg.showAlert("Network error."); }
                                 }
