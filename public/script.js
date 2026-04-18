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
// 1. CURRENCY LOGIC
// ==========================================
let currentCurrency = 'USD';
const EXCHANGE_RATE = 1200; // 1 USD = 1200 NGN. Adjust this if you want.

// Converts base NGN from DB to the display currency
function formatMoney(amountInNGN) {
    if (currentCurrency === 'USD') {
        let usdVal = amountInNGN / EXCHANGE_RATE;
        return '$' + usdVal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    } else {
        return '₦' + amountInNGN.toLocaleString('en-US');
    }
}

// Fired when user changes the dropdown in the header
function toggleCurrency() {
    tg.HapticFeedback.selectionChanged();
    currentCurrency = document.getElementById('currencySelector').value;
    
    // Update Quick Deposit buttons
    const symbol = currentCurrency === 'USD' ? '$' : '₦';
    document.getElementById('depCurrencySymbol').innerText = symbol;
    document.getElementById('witCurrencySymbol').innerText = symbol;
    
    document.getElementById('depBtn1').innerText = currentCurrency === 'USD' ? '10' : '10,000';
    document.getElementById('depBtn2').innerText = currentCurrency === 'USD' ? '50' : '50,000';
    document.getElementById('depBtn3').innerText = currentCurrency === 'USD' ? '100' : '100,000';
    
    // Re-render everything with new currency
    if(window.appData) renderUI(window.appData);
}

// ==========================================
// 2. INSTANT BOOT SEQUENCE
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
// 3. SUPPORT DESK LOGIC
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

    tg.MainButton.text = "Sending Ticket..."; tg.MainButton.show();
    btn.disabled = true;

    try {
        const res = await fetch('/api/support/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, username: USER_NAME, topic: topic, message: message })
        });
        const result = await res.json();
        
        tg.MainButton.hide(); btn.disabled = false;
        
        if (result.success) {
            tg.HapticFeedback.notificationOccurred('success');
            tg.showAlert("✅ Ticket submitted! Support will reply via bot.");
            closeSupportModal();
            document.getElementById('supportMessage').value = ""; 
            document.getElementById('supportTopic').value = ""; 
        } else { tg.showAlert("❌ Error sending message."); }
    } catch (e) {
        tg.MainButton.hide(); btn.disabled = false;
        tg.showAlert("Network error. Try again.");
    }
}

// ==========================================
// 4. LOAD & RENDER DATA
// ==========================================
async function loadDashboard() {
    tg.MainButton.text = "Syncing Data..."; tg.MainButton.show(); tg.MainButton.showProgress();
    
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

        window.appData = data; // Store globally for instant currency toggling
        renderUI(data);

        if(USER_ID === ADMIN_ID) loadAdminStats();

    } catch (error) { tg.MainButton.hide(); }
}

function renderUI(data) {
    document.getElementById('walletBalanceDisplay').innerText = formatMoney(data.user.walletBalance);
    document.getElementById('withdrawableBalanceDisplay').innerText = formatMoney(data.user.withdrawableBalance);
    document.getElementById('referralCountDisplay').innerText = data.referralCount;
    document.getElementById('refLinkText').innerText = MY_REF_LINK;

    const plansList = document.getElementById('dynamicPlansList');
    if (data.plans && data.plans.length > 0) {
        plansList.innerHTML = data.plans.map(plan => {
            return `
            <div class="card-solid p-5">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center relative shadow-inner">
                            <i class="fa-solid ${plan.icon} text-blue-400 text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-white text-base">${plan.name}</h4>
                            <p class="text-xs text-slate-400">Duration: ${plan.duration} Days</p>
                        </div>
                    </div>
                    <div class="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-400">
                        + ${formatMoney(plan.dailyReturn)} / Day
                    </div>
                </div>
                
                <div class="w-full bg-[#1E293B] rounded-full h-1 mb-4">
                    <div class="bg-blue-500 h-1 rounded-full w-full"></div>
                </div>
                
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Investment Cost</p>
                        <p class="text-lg font-bold text-white mt-0.5">${formatMoney(plan.cost)}</p>
                    </div>
                    <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-lg">Purchase</button>
                </div>
            </div>`
        }).join('');
    } else {
        plansList.innerHTML = `<div class="card-solid p-6 text-center border-dashed border-2 border-slate-700"><p class="text-slate-400 text-sm">No assets available right now.</p></div>`;
    }

    const invList = document.getElementById('investmentsList');
    if (data.investments && data.investments.length > 0) {
        invList.innerHTML = data.investments.map(inv => `
            <div class="card-solid p-4 flex justify-between items-center border-l-2 border-l-blue-500">
                <div class="flex items-center gap-3">
                     <div class="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-blue-400">
                         <i class="fa-solid fa-chart-line"></i>
                     </div>
                     <div>
                        <h4 class="font-bold text-white text-sm">${inv.shareName}</h4>
                        <p class="text-xs text-emerald-400 font-medium">+${formatMoney(inv.dailyReturn)} Daily</p>
                     </div>
                </div>
                <div class="text-right">
                    <p class="text-xl font-extrabold text-white">${inv.daysLeft}</p>
                    <p class="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Days Left</p>
                </div>
            </div>
        `).join('');
    } else { invList.innerHTML = `<div class="card-solid p-6 text-center border-dashed border-2 border-slate-700"><p class="text-slate-400 text-sm">No active portfolio.</p></div>`; }
}

// ==========================================
// 5. ADMIN PANEL LOGIC 
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
            <div class="card-solid p-4 border-l-2 border-l-rose-500">
                <p class="text-[10px] text-slate-500 mb-1">ID: ${w.refId}</p>
                <p class="font-bold text-white text-sm mb-1">${w.userName} requested <span class="text-emerald-400">₦${w.amount.toLocaleString()}</span></p>
                <p class="text-xs text-slate-400 mb-3">${w.bankName} - ${w.accountNumber}</p>
                <div class="flex gap-2">
                    <button onclick="resolveWithdrawal('${w.refId}', 'approve')" class="flex-1 btn-primary py-2 rounded-lg text-xs font-bold shadow-sm">Approve</button>
                    <button onclick="resolveWithdrawal('${w.refId}', 'reject')" class="flex-1 bg-[#1E293B] text-slate-300 py-2 rounded-lg text-xs font-bold shadow-sm">Reject</button>
                </div>
            </div>
        `).join('') || `<p class="text-slate-500 text-sm text-center py-4 border border-dashed border-slate-700 rounded-xl">No pending requests.</p>`;

        document.getElementById('adminUsersList').innerHTML = data.users.map(u => `
            <div class="card-solid p-4 flex justify-between items-center">
                <div>
                    <p class="font-bold text-white text-sm">${u.username || 'Unknown'}</p>
                    <p class="text-[10px] text-slate-400 uppercase mt-1">Bal: ₦${u.walletBalance.toLocaleString()} | Earn: ₦${u.withdrawableBalance.toLocaleString()}</p>
                </div>
                <button onclick="toggleBan('${u.tgId}', ${!u.isBanned})" class="px-4 py-2 rounded-lg text-xs font-bold ${u.isBanned ? 'bg-[#1E293B] text-slate-400' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}">${u.isBanned ? 'Unban' : 'Ban'}</button>
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
// 6. USER ACTIONS
// ==========================================
function buyDynamicShare(planId, planName, costInNGN) {
    const displayCost = formatMoney(costInNGN);
    tg.showConfirm(`Purchase ${planName} for ${displayCost}?`, async (confirmed) => {
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
            if (ids[i] === 'admin') tabEl.className = "flex flex-col items-center justify-center text-slate-600 w-1/5 h-16 transition";
            else tabEl.className = "flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " h-16 transition";
            
            var icon = tabEl.querySelector('i');
            if(icon) icon.classList.remove('drop-shadow-md');
            
            var text = tabEl.querySelector('span');
            if(text) { text.classList.remove('font-bold'); text.classList.add('font-medium'); }
        }
    }

    var selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');

    var selectedTab = document.getElementById('tab-' + tabId);
    if(selectedTab) {
        selectedTab.className = "flex flex-col items-center justify-center text-blue-500 " + (USER_ID === ADMIN_ID ? 'w-1/5' : 'w-1/4') + " h-16 transition";
        var iconActive = selectedTab.querySelector('i');
        if(iconActive) iconActive.classList.add('drop-shadow-md');
        
        var textActive = selectedTab.querySelector('span');
        if(textActive) { textActive.classList.remove('font-medium'); textActive.classList.add('font-bold'); }
    }
}

function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('depositView').classList.remove('hidden');
}

function showWithdrawPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('withdrawView').classList.remove('hidden');
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
    const finalAmount = currentCurrency === 'USD' ? amount : amount * 1000;
    document.getElementById('depositAmount').value = finalAmount;
}

function copyRefLink() {
    tg.HapticFeedback.impactOccurred('medium');
    const tempInput = document.createElement("input"); tempInput.value = MY_REF_LINK; document.body.appendChild(tempInput);
    tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput);
    tg.showAlert("✅ Link copied!");
}
function shareLink() {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent(MY_REF_LINK) + "&text=Join my network on SharePoint!";
    tg.openTelegramLink(shareUrl);
}

async function fundWallet() {
    const inputAmount = Number(document.getElementById('depositAmount').value);
    if (!inputAmount || inputAmount <= 0) return tg.showAlert("Enter a valid amount.");
    
    // Always convert to base NGN for the backend
    const amountNGN = currentCurrency === 'USD' ? inputAmount * EXCHANGE_RATE : inputAmount;
    
    if (amountNGN < 100) return tg.showAlert(`Min deposit is ${formatMoney(100)}`);
    
    const btn = document.getElementById('generateLinkBtn');
    tg.HapticFeedback.impactOccurred('medium');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating..."; btn.disabled = true; 

    try {
        const response = await fetch('/api/fund', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, amount: amountNGN })
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
    const inputAmount = Number(document.getElementBy
