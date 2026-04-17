const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); 

const user = tg.initDataUnsafe?.user;
const USER_ID = user ? user.id.toString() : "12345"; 
const REFERRED_BY = tg.initDataUnsafe?.start_param || null;
const BOT_USERNAME = "SharePoint_official_bot"; 
const MY_REF_LINK = `https://t.me/${BOT_USERNAME}?start=${USER_ID}`;
const ADMIN_ID = "8067627422"; 

let currentAuthMode = "login"; 

// ==========================================
// 1. BOOT SEQUENCE & AUTHENTICATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (USER_ID === ADMIN_ID) {
        document.getElementById('tab-admin').classList.remove('hidden');
        document.getElementById('tab-admin').classList.add('flex');
    }

    try {
        const res = await fetch('/api/auth/check', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID })
        });
        const data = await res.json();

        if (data.status === "banned") {
            document.getElementById('authTitle').innerText = "Account Suspended";
            document.getElementById('authSub').innerText = "Please contact support.";
            return;
        }

        document.getElementById('authForm').classList.remove('hidden');
        
        if (data.status === "needs_registration") {
            currentAuthMode = "register";
            document.getElementById('authTitle').innerText = "Create Account";
            document.getElementById('authSub').innerText = "Set up your login details.";
            document.getElementById('authUsername').classList.remove('hidden');
            document.getElementById('forgotBtn').classList.add('hidden'); 
        } else {
            currentAuthMode = "login";
            document.getElementById('authTitle').innerText = "Welcome Back";
            document.getElementById('authSub').innerText = "Enter your password to unlock.";
            document.getElementById('authUsername').classList.add('hidden'); 
            document.getElementById('forgotBtn').classList.remove('hidden'); 
        }
    } catch (e) { console.error("Auth check failed."); }
});

async function submitAuth() {
    const password = document.getElementById('authPassword').value;
    if (!password) return tg.showAlert("Password is required.");

    tg.MainButton.text = "Authenticating..."; tg.MainButton.show(); tg.MainButton.showProgress();

    try {
        let endpoint = currentAuthMode === "register" ? '/api/auth/register' : '/api/auth/login';
        let payload = { tgId: USER_ID, password };
        if (currentAuthMode === "register") {
            const username = document.getElementById('authUsername').value;
            if (!username) { tg.MainButton.hide(); return tg.showAlert("Username required."); }
            payload.username = username;
            payload.referredBy = REFERRED_BY;
        }

        const res = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await res.json();
        tg.MainButton.hide();

        if (result.success) {
            document.getElementById('authView').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            loadDashboard();
        } else {
            tg.showAlert(result.error);
        }
    } catch (e) { tg.MainButton.hide(); tg.showAlert("Network error."); }
}

async function forgotPassword() {
    tg.showConfirm("Send a new temporary password to your Telegram chat?", async (conf) => {
        if(!conf) return;
        tg.MainButton.text = "Resetting..."; tg.MainButton.show();
        try {
            const res = await fetch('/api/auth/forgot', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({tgId: USER_ID})
            });
            const result = await res.json();
            tg.MainButton.hide();
            if(result.success) tg.showAlert("✅ New password sent! Check your Telegram messages with the bot.");
            else tg.showAlert(`❌ ${result.error}`);
        } catch(e) { tg.MainButton.hide(); tg.showAlert("Network error."); }
    });
}

// ==========================================
// 2. LOAD DASHBOARD & RENDER PLANS
// ==========================================
async function loadDashboard() {
    try {
        const res = await fetch(`/api/dashboard/${USER_ID}`);
        const data = await res.json();

        document.getElementById('userNameDisplay').innerText = data.user.username || "Investor";
        document.getElementById('walletBalanceDisplay').innerText = `₦${data.user.walletBalance.toLocaleString()}`;
        document.getElementById('withdrawableBalanceDisplay').innerText = `₦${data.user.withdrawableBalance.toLocaleString()}`;
        document.getElementById('referralCountDisplay').innerText = data.referralCount;
        document.getElementById('refLinkText').innerText = MY_REF_LINK;

        const plansList = document.getElementById('dynamicPlansList');
        if (data.plans.length > 0) {
            plansList.innerHTML = data.plans.map(plan => {
                const totalEarn = plan.dailyReturn * plan.duration;
                const weeklyEarn = plan.dailyReturn * 7;
                const monthlyEarn = plan.dailyReturn * 30; 

                return `
                <div class="glass-panel rounded-3xl p-5 shadow-xl border border-white/5 relative">
                    <div class="flex justify-between items-center mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                <i class="fa-solid ${plan.icon} text-white text-xl"></i>
                            </div>
                            <div>
                                <h4 class="text-lg font-bold text-white">${plan.name}</h4>
                                <p class="text-xs text-cyan-400 font-bold">Cost: ₦${plan.cost.toLocaleString()}</p>
                            </div>
                        </div>
                        <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold border border-white/20 transition active:scale-95">Buy</button>
                    </div>
                    
                    <div class="bg-black/30 rounded-xl p-4 mt-3 text-sm text-gray-300 space-y-2 border border-white/5">
                        <div class="flex justify-between border-b border-white/5 pb-1"><span>Earn Per Day:</span> <span class="font-bold text-emerald-400">₦${plan.dailyReturn.toLocaleString()}</span></div>
                        <div class="flex justify-between border-b border-white/5 pb-1"><span>Earn Per Week:</span> <span class="font-bold text-white">₦${weeklyEarn.toLocaleString()}</span></div>
                        <div class="flex justify-between border-b border-white/5 pb-1"><span>Earn Per Month:</span> <span class="font-bold text-white">₦${monthlyEarn.toLocaleString()}</span></div>
                        <div class="flex justify-between pt-1"><span>Total Profit (${plan.duration} Days):</span> <span class="font-bold text-cyan-400">₦${totalEarn.toLocaleString()}</span></div>
                    </div>
                </div>`
            }).join('');
        } else {
            plansList.innerHTML = `<p class="text-gray-500 text-sm text-center">No plans available right now.</p>`;
        }

        const invList = document.getElementById('investmentsList');
        if (data.investments.length > 0) {
            invList.innerHTML = data.investments.map(inv => `
                <div class="glass-panel rounded-3xl p-5 border border-white/5 flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-white uppercase text-sm">${inv.shareName}</h4>
                        <p class="text-xs text-emerald-400 font-medium">+₦${inv.dailyReturn} Daily</p>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-black text-cyan-400">${inv.daysLeft}</p>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest">Days Left</p>
                    </div>
                </div>
            `).join('');
        } else { invList.innerHTML = `<p class="text-gray-500 text-sm text-center">No active investments.</p>`; }

        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { console.error("Error fetching data", error); }
}

// ==========================================
// 3. ADMIN PANEL LOGIC
// ==========================================
function switchAdminSubTab(tab) {
    document.getElementById('admin-withdrawals').classList.add('hidden');
    document.getElementById('admin-plans').classList.add('hidden');
    document.getElementById('admin-users').classList.add('hidden');
    document.getElementById(`admin-${tab}`).classList.remove('hidden');
}

async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', { headers: { 'x-admin-id': ADMIN_ID } });
        const data = await res.json();

        document.getElementById('adminWithdrawalList').innerHTML = data.pendingWithdrawals.map(w => `
            <div class="bg-black/40 p-4 rounded-xl border border-red-500/30">
                <p class="text-xs text-gray-400">ID: ${w.refId}</p>
                <p class="font-bold text-white">${w.userName} requested <span class="text-emerald-400">₦${w.amount}</span></p>
                <p class="text-sm text-gray-300">${w.bankName} - ${w.accountNumber}</p>
                <div class="flex gap-2 mt-3">
                    <button onclick="resolveWithdrawal('${w.refId}', 'approve')" class="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">Approve</button>
                    <button onclick="resolveWithdrawal('${w.refId}', 'reject')" class="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold">Reject</button>
                </div>
            </div>
        `).join('') || `<p class="text-gray-500 text-xs">No pending requests.</p>`;

        document.getElementById('adminUsersList').innerHTML = data.users.map(u => `
            <div class="bg-black/40 p-3 rounded-xl border border-white/10 flex justify-between items-center">
                <div>
                    <p class="font-bold text-white text-sm">${u.username || 'Unknown'}</p>
                    <p class="text-xs text-gray-400">Bal: ₦${u.walletBalance} | Earn: ₦${u.withdrawableBalance}</p>
                </div>
                <button onclick="toggleBan('${u.tgId}', ${!u.isBanned})" class="px-3 py-1 rounded text-xs font-bold ${u.isBanned ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${u.isBanned ? 'Unban' : 'Ban'}</button>
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
            body: JSON.stringify({ refId, action })
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
        body: JSON.stringify({ name, cost, dailyReturn, duration, icon })
    });
    tg.MainButton.hide(); tg.showAlert("Plan Published!"); loadDashboard();
}

async function toggleBan(tgId, banStatus) {
    tg.showConfirm(`Change ban status?`, async (conf) => {
        if(!conf) return;
        await fetch('/api/admin/ban', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID },
            body: JSON.stringify({ tgId, banStatus })
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
                body: JSON.stringify({ userId: USER_ID, planId })
            });
            const result = await res.json();
            tg.MainButton.hide();
            if (result.success) { tg.showAlert("✅ Success!"); loadDashboard(); }
            else { tg.showAlert(`❌ ${result.error}`); }
        } catch (e) { tg.MainButton.hide(); tg.showAlert("Failed."); }
    });
}

function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    ['dashboard', 'portfolio', 'referral', 'admin'].forEach(id => {
        const el = document.getElementById(id + 'View');
        const btn = document.getElementById('tab-' + id);
        if(el) el.classList.add('hidden');
        if(btn) btn.className = "flex flex-col items-center text-gray-500 transition";
    });
    document.getElementById(tabId + 'View').classList.remove('hidden');
    document.getElementById('tab-' + tabId).className = "flex flex-col items-center text-cyan-400 transition drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]";
}

function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    ['dashboardView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
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
    ['dashboardView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
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
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(MY_REF_LINK)}&text=Join me on SharePoint!`;
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
            body: JSON.stringify({ userId: USER_ID, userName: USER_NAME, amount, bankName: bank, accNo, accName })
        });
        const result = await response.json();
        tg.Main
