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
// 1. BOOT SEQUENCE & SECURITY PURGE
// ==========================================
window.onload = async () => {
    // SECURITY PURGE: If the user is NOT the admin, physically delete the HTML from their app.
    if (USER_ID !== ADMIN_ID) {
        const adminViewElement = document.getElementById('adminView');
        const adminTabElement = document.getElementById('tab-admin');
        if (adminViewElement) adminViewElement.remove(); // Deletes it forever
        if (adminTabElement) adminTabElement.remove();   // Deletes it forever
    } else {
        // If it IS you, unhide the button and adjust nav spacing
        const adminTab = document.getElementById('tab-admin');
        if (adminTab) {
            adminTab.classList.remove('hidden');
            adminTab.classList.add('flex');
            // Adjust widths to fit 5 buttons instead of 4
            document.querySelectorAll('#navFlexContainer button').forEach(btn => {
                btn.classList.remove('w-1/4');
                btn.classList.add('w-1/5');
            });
        }
    }

    document.getElementById('authTitle').innerText = "Waking Server...";
    document.getElementById('authSub').innerText = "Please wait a moment...";

    try {
        const res = await fetch('/api/auth/check', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID })
        });

        if (!res.ok) throw new Error("Server not responding.");

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
            if(document.getElementById('authUsername')) document.getElementById('authUsername').classList.remove('hidden');
            if(document.getElementById('forgotBtn')) document.getElementById('forgotBtn').classList.add('hidden'); 
        } else {
            currentAuthMode = "login";
            document.getElementById('authTitle').innerText = "Welcome Back";
            document.getElementById('authSub').innerText = "Enter your password to unlock.";
            if(document.getElementById('authUsername')) document.getElementById('authUsername').classList.add('hidden'); 
            if(document.getElementById('forgotBtn')) document.getElementById('forgotBtn').classList.remove('hidden'); 
        }
    } catch (e) { 
        document.getElementById('authTitle').innerText = "Connecting... ⏳";
        document.getElementById('authSub').innerText = "Server is waking up. Tap retry in 15 seconds.";
        document.getElementById('authForm').innerHTML = `<button onclick="window.location.reload()" class="w-full bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-95">Tap to Retry</button>`;
        document.getElementById('authForm').classList.remove('hidden');
    }
};

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

        // Render Plans inside the NEW Shares Tab
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

        // Only load admin stats if user is the admin
        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { console.error("Error fetching dashboard data", error); }
}

// ==========================================
// 3. ADMIN PANEL LOGIC
// ==========================================
function switchAdminSubTab(tab) {
    document.getElementById('admin-withdrawals')?.classList.add('hidden');
    document.getElementById('admin-plans')?.classList.add('hidden');
    document.getElementById('admin-users')?.classList.add('hidden');
    document.getElementById(`admin-${tab}`)?.classList.remove('hidden');
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
            if (result.success) { 
                tg.showAlert("✅ Success!"); 
                loadDashboard(); 
                switchTab('portfolio'); // Automatically jump to portfolio to see it
            }
            else { tg.showAlert(`❌ ${result.error}`); }
        } catch (e) { tg.MainButton.hide(); tg.showAlert("Failed."); }
    });
}

// NAVIGATION TABS
function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    
    // Hide everything first
    ['dashboard', 'shares', 'portfolio', 'referral', 'admin'].forEach(id => {
        const viewEl = document.getElementById(id + 'View');
        const tabEl = document.getElementById('tab-' + id);
        if(viewEl) viewEl.classList.add('hidden');
        
        // Reset inactive tab styles (Admin stays red if inactive)
        if(tabEl) {
            if (id === 'admin') tabEl.className = "flex flex-col items-center text-red-500 w-1/5 opacity-50 transition";
            else tabEl.className = `flex flex-col items-center text-gray-500 ${USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4'} transition`;
        }
    });

    // Show selected view
    const selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');

    // Highlight selected tab
    const selectedTab = document.getElementById('tab-' + tabId);
    if(selectedTab) {
        if (tabId === 'admin') selectedTab.className = "flex flex-col items-center text-red-500 w-1/5 opacity-100 transition";
        else selectedTab.className = `flex flex-col items-center text-blue-500 ${USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4'} transition drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]`;
    }
}

// SUB-PAGES
function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    ['dashboardView', 'sharesView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'].forEach(id => {
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
    ['dashboardView', 'sharesView', 'portfolioView', 'referralView', 'adminView', 'bottomNav'].forEach(id => {
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

// SQUADCO DEPOSIT
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

// WITHDRAWAL
async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    cons
