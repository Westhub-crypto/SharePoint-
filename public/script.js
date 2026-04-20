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
    // Show Dashboard instantly to prevent getting stuck on blank page
    switchTab('dashboard');
    document.getElementById('userNameDisplay').innerText = USER_NAME;

    // Admin Tab Visibility
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

    loadDashboard();
};

// ==========================================
// 2. SUPPORT BOT REDIRECT
// ==========================================
function openSupportBot() {
    tg.HapticFeedback.impactOccurred('medium');
    tg.openTelegramLink(SUPPORT_BOT_LINK);
}

// ==========================================
// 3. LOAD DASHBOARD & RENDER PLANS
// ==========================================
async function loadDashboard() {
    tg.MainButton.text = "Syncing Data..."; tg.MainButton.show(); tg.MainButton.showProgress();
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, name: USER_NAME, referredBy: REFERRED_BY })
        });
        
        tg.MainButton.hide();

        if (!res.ok) return tg.showAlert("Server is offline. Try again.");

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

                return `
                <div class="card rounded-[24px] p-6 mb-5 hover:border-[#D4AF37] transition shadow-md">
                    <div class="flex justify-between items-center mb-5">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-inner">
                                <i class="fa-solid ${plan.icon} text-[#D4AF37] text-2xl drop-shadow-sm"></i>
                            </div>
                            <div>
                                <h4 class="text-xl font-black text-gray-900">${plan.name}</h4>
                                <p class="text-xs text-[#D4AF37] font-bold tracking-widest uppercase">Cost: ₦${plan.cost.toLocaleString()}</p>
                            </div>
                        </div>
                        <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="btn-gold px-5 py-2.5 rounded-xl text-sm font-extrabold shadow-lg">Buy</button>
                    </div>
                    
                    <div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 border border-gray-200">
                        <div class="flex justify-between border-b border-gray-200 pb-2 mb-2">
                            <span class="font-semibold text-gray-500">Daily Return:</span> 
                            <span class="font-bold text-gray-900">₦${plan.dailyReturn.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between pt-1">
                            <span class="font-semibold text-gray-500">Total Yield (${plan.duration} Days):</span> 
                            <span class="font-extrabold text-gold">₦${totalEarn.toLocaleString()}</span>
                        </div>
                    </div>
                </div>`
            }).join('');
        } else {
            plansList.innerHTML = `<div class="card p-8 text-center rounded-2xl border-dashed border-2 border-gray-300"><p class="text-gray-500 font-bold text-sm">No plans available right now.</p></div>`;
        }

        const invList = document.getElementById('investmentsList');
        if (data.investments && data.investments.length > 0) {
            invList.innerHTML = data.investments.map(inv => `
                <div class="card rounded-2xl p-5 flex justify-between items-center border-l-4 border-l-gold shadow-sm">
                    <div>
                        <h4 class="font-extrabold text-gray-900 text-base">${inv.shareName}</h4>
                        <p class="text-xs text-[#D4AF37] font-bold mt-1">+₦${inv.dailyReturn.toLocaleString()} Daily</p>
                    </div>
                    <div class="text-right">
                        <p class="text-3xl font-black text-gray-900">${inv.daysLeft}</p>
                        <p class="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Days Left</p>
                    </div>
                </div>
            `).join('');
        } else { invList.innerHTML = `<div class="card p-8 text-center rounded-2xl border-dashed border-2 border-gray-300"><p class="text-gray-500 font-bold text-sm">No active investments.</p></div>`; }

        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { 
        tg.MainButton.hide();
        tg.showAlert("Network error. Please try again."); 
    }
}

// ==========================================
// 4. ADMIN PANEL 
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
            <div class="card p-5 rounded-2xl border-l-4 border-l-red-500 shadow-sm">
                <p class="text-xs text-gray-400 font-bold">ID: ${w.refId}</p>
                <p class="font-extrabold text-gray-900 mt-1">${w.userName} requested <span class="text-emerald-500">₦${w.amount.toLocaleString()}</span></p>
                <p class="text-sm text-gray-600 mb-3">${w.bankName} - ${w.accountNumber}</p>
                <div class="flex gap-3">
                    <button onclick="resolveWithdrawal('${w.refId}', 'approve')" class="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-md">Approve</button>
                    <button onclick="resolveWithdrawal('${w.refId}', 'reject')" class="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-bold">Reject</button>
                </div>
            </div>
        `).join('') || `<p class="text-gray-400 text-sm font-medium">No pending requests.</p>`;

        document.getElementById('adminUsersList').innerHTML = data.users.map(u => `
            <div class="card p-4 rounded-xl flex justify-between items-center mb-3">
                <div>
                    <p class="font-bold text-gray-900 text-sm">${u.username || 'Unknown'}</p>
                    <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">Bal: ₦${u.walletBalance.toLocaleString()} | Earn: ₦${u.withdrawableBalance.toLocaleString()}</p>
                </div>
                <button onclick="toggleBan('${u.tgId}', ${!u.isBanned})" class="px-4 py-2 rounded-lg text-xs font-bold ${u.isBanned ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-500 border border-red-200'}">${u.isBanned ? 'Unban' : 'Ban'}</button>
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

    tg.MainButton.text = "Publishing Plan..."; tg.MainButton.show();
    
    await fetch('/api/admin/plan/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID },
        body: JSON.stringify({ name: name, cost: cost, dailyReturn: dailyReturn, duration: duration, icon: icon })
    });
    
    tg.MainButton.hide(); 
    tg.showAlert("Plan Published Successfully!"); 
    
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
                tg.showAlert("✅ Success! Asset purchased."); 
                loadDashboard(); 
                switchTab('portfolio'); 
            }
            else { tg.showAlert(`❌ ${result.error}`); }
        } catch (e) { tg.MainButton.hide(); tg.showAlert("Transaction failed."); }
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
            if (ids[i] === 'admin') tabEl.className = "flex flex-col items-center text-red-300 hover:text-red-500 w-1/5 transition";
            else tabEl.className = "flex flex-col items-center text-gray-400 hover:text-[#D4AF37] " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " transition";
            
            var icon = tabEl.querySelector('i');
            if(icon) {
                icon.classList.remove('drop-shadow-md', 'text-2xl');
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
        if (tabId === 'admin') selectedTab.className = "flex flex-col items-center text-red-600 w-1/5 transition";
        else selectedTab.className = "flex flex-col items-center text-[#D4AF37] " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " transition";
        
        var iconActive = selectedTab.querySelector('i');
        if(iconActive) {
            iconActive.classList.add('drop-shadow-md', 'text-2xl');
            iconActive.classList.remove('text-xl');
        }
        var textActive = selectedTab.querySelector('span');
        if(textActive) { textActive.classList.remove('font-bold'); textActive.classList.add('font-extrabold'); }
    }
    window.scrollTo(0,0);
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
    window.scrollTo(0,0);
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
    window.scrollTo(0,0);
}

function setAmount(amount) {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositAmount').value = amount;
}

// ==========================================
// 6. REFERRAL LINK LOGIC
// ==========================================
function copyRefLink() {
    tg.HapticFeedback.impactOccurred('medium');
    const tempInput = document.createElement("input"); tempInput.value = MY_REF_LINK; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
    tg.showAlert("✅ Link copied!");
}

function shareLink() {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent(MY_REF_LINK) + "&text=Join my premium network on SharePoint and start earning daily returns!";
    tg.openTelegramLink(shareUrl);
}

// ==========================================
// 7. TRANSACTIONS
// ==========================================
async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    const btn = document.getElementById('generateLinkBtn');
    if (!amount || amount < 100) { tg.showAlert("Min deposit is ₦100."); return; }
    
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

    if (!amount || amount < 1000) return tg.showAlert("Min withdrawal is ₦1,000.");
    if (!bank || !accNo || !accName) return tg.showAlert("Fill all banking details.");

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
