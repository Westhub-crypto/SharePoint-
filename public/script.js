let currentUser = null;
let currentToken = null;
let confirmCallback = null;
let setupImageBase64 = null;
let adminGlobalData = null;

function appAlert(message, title = "Notification", isError = false) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    document.getElementById('modalIcon').className = isError ? "fa-solid fa-triangle-exclamation text-2xl text-red-500" : "fa-solid fa-bell text-2xl text-neon";
    document.getElementById('modalIconBox').className = isError ? "w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4" : "w-16 h-16 mx-auto bg-[#00FF87]/10 rounded-full flex items-center justify-center mb-4";
    document.getElementById('modalButtons').innerHTML = `<button onclick="closeAppModal()" class="w-full ${isError ? 'bg-red-500 text-white' : 'btn-neon'} font-black py-3.5 rounded-full text-sm">OK</button>`;
    document.getElementById('customModal').classList.add('modal-active');
    document.getElementById('customModalContent').classList.add('modal-content-active');
}

function appConfirm(message, callback, title = "Please Confirm") {
    confirmCallback = callback;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    document.getElementById('modalIcon').className = "fa-solid fa-circle-question text-2xl text-[#4A7A66]";
    document.getElementById('modalIconBox').className = "w-16 h-16 mx-auto bg-[#143D2F] rounded-full flex items-center justify-center mb-4";
    document.getElementById('modalButtons').innerHTML = `<button onclick="closeAppModal()" class="w-1/2 bg-transparent border border-[#143D2F] text-[#4A7A66] font-bold py-3.5 rounded-full text-sm">Cancel</button><button onclick="executeConfirm()" class="w-1/2 btn-neon font-black py-3.5 rounded-full text-sm">Yes, Proceed</button>`;
    document.getElementById('customModal').classList.add('modal-active');
    document.getElementById('customModalContent').classList.add('modal-content-active');
}

function closeAppModal() { document.getElementById('customModal').classList.remove('modal-active'); document.getElementById('customModalContent').classList.remove('modal-content-active'); }
function executeConfirm() { closeAppModal(); if (confirmCallback) confirmCallback(); }

window.onload = () => { const t = localStorage.getItem('sharepoint_token'); if (t) { currentToken = t; loadDashboard(); } };

function toggleAuth(type) {
    document.getElementById('loginBox').classList.add('hidden'); document.getElementById('registerBox').classList.add('hidden');
    if (type === 'register') document.getElementById('registerBox').classList.remove('hidden'); else document.getElementById('loginBox').classList.remove('hidden');
}

async function handleRegister() {
    const user = document.getElementById('regUsername').value; const email = document.getElementById('regEmail').value; const pass = document.getElementById('regPassword').value;
    if(!user || !email || !pass) return appAlert("Fill all fields.", "Error", true);
    document.getElementById('regBtn').innerText = "Processing...";
    try {
        const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, email, password: pass}) });
        const data = await res.json();
        if (data.success) { appAlert("Account created! Please sign in.", "Success"); toggleAuth('login'); } else appAlert(data.error, "Error", true);
    } catch(e) { appAlert("Network error", "Error", true); }
    document.getElementById('regBtn').innerText = "Register";
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value; const pass = document.getElementById('loginPassword').value;
    if(!email || !pass) return appAlert("Enter email and password.", "Error", true);
    document.getElementById('loginBtn').innerText = "Authenticating...";
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password: pass}) });
        const data = await res.json();
        if (data.success) { localStorage.setItem('sharepoint_token', data.token); currentToken = data.token; loadDashboard(); } else appAlert(data.error, "Error", true);
    } catch(e) { appAlert("Network error", "Error", true); }
    document.getElementById('loginBtn').innerText = "Login";
}

function logout() { localStorage.removeItem('sharepoint_token'); window.location.reload(); }

async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard', { headers: { 'Authorization': `Bearer ${currentToken}` } });
        const data = await res.json();
        if (data.success) setupDashboard(data); else logout();
    } catch (e) { console.log("Error loading dash"); }
}

function setupDashboard(data) {
    currentUser = data.user;
    document.getElementById('authContainer').classList.add('hidden');
    
    // COMPULSORY DP CHECK
    if (!currentUser.profilePicture || currentUser.profilePicture === '') {
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('setupView').classList.remove('hidden');
        document.getElementById('setupView').classList.add('flex');
        return;
    }

    document.getElementById('setupView').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Set UI Data
    document.getElementById('userNameDisplay').innerText = currentUser.fullName || currentUser.username;
    document.getElementById('walletBalanceDisplay').innerText = `₦${currentUser.walletBalance.toLocaleString()}`;
    document.getElementById('withdrawableBalanceDisplay').innerText = `₦${currentUser.withdrawableBalance.toLocaleString()}`;
    document.getElementById('dashboardRefDisplay').innerText = data.referralCount;
    
    // Display DPs
    const dpHtml = `<img src="${currentUser.profilePicture}" class="dp-image">`;
    document.getElementById('dashDpContainer').innerHTML = dpHtml;
    document.getElementById('profileDpContainer').innerHTML = dpHtml;

    document.getElementById('profileName').innerText = currentUser.fullName || currentUser.username;
    document.getElementById('profileEmail').innerText = currentUser.email;

    // PIN & Admin Check
    const pinTag = document.getElementById('pinStatus');
    if (currentUser.hasPin) { pinTag.className = "text-[9px] bg-[#00FF87]/20 text-neon px-2 py-1 rounded mr-2 uppercase"; pinTag.innerText = "Secured"; } 
    else { pinTag.className = "text-[9px] bg-red-500/20 text-red-500 px-2 py-1 rounded mr-2 uppercase"; pinTag.innerText = "Not Set"; }

    if (currentUser.role === 'admin') { document.getElementById('profileAdminBtn').classList.remove('hidden'); document.getElementById('profileAdminBtn').classList.add('flex'); }

    renderBanks(); renderPlans(data.plans); renderPortfolio(data.investments); renderUserTickets(data.supportTickets);
}

// ==========================================
// COMPULSORY PROFILE & BANKS
// ==========================================
function previewDp(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            setupImageBase64 = e.target.result;
            document.getElementById('setupDpPreview').innerHTML = `<img src="${setupImageBase64}" class="dp-image">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveInitialSetup() {
    const fullName = document.getElementById('setupFullName').value;
    if (!setupImageBase64) return appAlert("You must upload a profile picture.", "Required", true);
    if (!fullName) return appAlert("Please enter your full name.", "Required", true);
    
    document.getElementById('setupBtn').innerText = "Saving...";
    try {
        await fetch('/api/user/setup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ profilePicture: setupImageBase64, fullName }) });
        appAlert("Profile setup complete!", "Success");
        loadDashboard();
    } catch(e) { appAlert("Error saving profile.", "Error", true); }
}

function renderBanks() {
    const list = document.getElementById('bankAccountsList');
    if (currentUser.banks.length > 0) {
        list.innerHTML = currentUser.banks.map(b => `
            <div class="card p-4 rounded-xl border-l-4 border-l-neon mb-2">
                <p class="font-bold text-white text-sm">${b.bankName}</p>
                <p class="text-xs text-[#4A7A66]">${b.accountNumber} - ${b.accountName}</p>
            </div>`).join('');
    } else { list.innerHTML = `<p class="text-[#4A7A66] text-sm">No banks added yet.</p>`; }
}

async function addBankAccount() {
    const bankName = document.getElementById('newBankName').value; const accountNumber = document.getElementById('newBankAccNo').value; const accountName = document.getElementById('newBankAccName').value;
    if(!bankName || !accountNumber || !accountName) return appAlert("Fill all bank details.");
    
    document.getElementById('addBankBtn').innerText = "Saving...";
    try {
        await fetch('/api/user/add-bank', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ bankName, accountNumber, accountName }) });
        appAlert("Bank Added!", "Success");
        document.getElementById('newBankName').value=""; document.getElementById('newBankAccNo').value=""; document.getElementById('newBankAccName').value="";
        loadDashboard();
    } catch(e) { appAlert("Error adding bank", "Error", true); }
    document.getElementById('addBankBtn').innerText = "Save Bank";
}

// ==========================================
// WITHDRAWAL FLOW
// ==========================================
function withdrawCheck() {
    if (!currentUser.banks || currentUser.banks.length === 0) {
        appConfirm("You must add a Bank Account before withdrawing. Add one now?", () => { switchTab('banks'); }, "Bank Required");
        return;
    }
    const select = document.getElementById('withdrawBankSelect');
    select.innerHTML = currentUser.banks.map(b => `<option value="${b._id}">${b.bankName} - ${b.accountNumber}</option>`).join('');
    switchTab('withdraw');
}

async function processWithdrawal() {
    const amount = Number(document.getElementById('withdrawAmount').value);
    const pin = document.getElementById('withdrawPin').value;
    const bankId = document.getElementById('withdrawBankSelect').value;

    if (!amount || amount < 1000) return appAlert("Min withdrawal is ₦1,000.", "Error", true);
    if (!pin) return appAlert("Enter your 4-digit PIN.", "Error", true);

    document.getElementById('withdrawBtn').innerText = "Processing...";
    try {
        const res = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ amount, pin, bankId }) });
        const data = await res.json();
        if (data.success) { appAlert("Withdrawal sent to admin!", "Success"); document.getElementById('withdrawPin').value = ""; switchTab('dashboard'); loadDashboard(); }
        else appAlert(data.error, "Failed", true);
    } catch(e) { appAlert("Network error.", "Error", true); }
    document.getElementById('withdrawBtn').innerText = "Request Payout";
}

// ==========================================
// GENERAL USER FUNCTIONS
// ==========================================
async function fundWallet() {
    const amount = Number(document.getElementById('depositAmount').value);
    if (!amount || amount < 100) return appAlert("Min deposit is ₦100.", "Error", true);
    document.getElementById('generateLinkBtn').innerText = "Connecting..."; 
    try {
        const res = await fetch('/api/fund', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ amount }) });
        const data = await res.json();
        if (data.success) window.location.href = data.checkoutUrl; else appAlert(data.error, "Error", true);
    } catch (e) { appAlert("Gateway error", "Error", true); }
    document.getElementById('generateLinkBtn').innerText = "Proceed to Pay"; 
}

function buyDynamicShare(planId, planName, cost) {
    appConfirm(`Buy ${planName} for ₦${cost.toLocaleString()}?`, async () => {
        try {
            const res = await fetch('/api/buy-share', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ planId }) });
            const result = await res.json();
            if (result.success) { appAlert("Purchased successfully.", "Success"); loadDashboard(); switchTab('portfolio'); } else appAlert(result.error, "Error", true);
        } catch (e) { appAlert("Error.", "Error", true); }
    });
}

async function loadTransactions() {
    switchTab('transactions');
    document.getElementById('txList').innerHTML = `<p class="text-center text-[#4A7A66] mt-10">Loading...</p>`;
    try {
        const res = await fetch('/api/user/transactions', { headers: { 'Authorization': `Bearer ${currentToken}` } });
        const data = await res.json();
        if (data.transactions.length > 0) {
            document.getElementById('txList').innerHTML = data.transactions.map(tx => {
                const isC = tx.type === 'credit';
                return `<div class="card p-4 rounded-xl flex justify-between items-center shadow-md">
                    <div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-[#143D2F] flex items-center justify-center"><i class="fa-solid ${isC ? 'fa-arrow-down text-neon' : 'fa-arrow-up text-red-500'}"></i></div>
                    <div><p class="text-sm font-bold text-white">${tx.title}</p><p class="text-[10px] text-[#4A7A66] uppercase">${new Date(tx.date).toLocaleDateString()} - ${tx.status}</p></div></div>
                    <p class="font-black ${isC ? 'text-neon' : 'text-red-500'}">${isC ? '+' : '-'}₦${tx.amount.toLocaleString()}</p>
                </div>`;
            }).join('');
        } else { document.getElementById('txList').innerHTML = `<p class="text-center text-[#4A7A66] mt-10">No transactions.</p>`; }
    } catch(e) {}
}

async function savePin() {
    const pin = document.getElementById('newPin').value;
    if (pin.length !== 4) return appAlert("PIN must be 4 digits.");
    try {
        await fetch('/api/user/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ pin }) });
        appAlert("PIN Saved!", "Success"); document.getElementById('newPin').value = ""; loadDashboard(); switchTab('profile');
    } catch(e) {}
}

async function sendSupportMessage() {
    const msg = document.getElementById('supportMessage').value;
    if(!msg) return;
    try {
        await fetch('/api/support/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ message: msg }) });
        appAlert("Message sent to Admin.", "Success"); document.getElementById('supportMessage').value = ""; loadDashboard();
    } catch(e){}
}

function renderUserTickets(tickets) {
    if(tickets && tickets.length > 0) {
        document.getElementById('userTicketsList').innerHTML = tickets.map(t => `
            <div class="card p-4 rounded-xl mb-2 border ${t.status==='replied' ? 'border-neon' : 'border-[#143D2F]'}">
                <p class="text-sm text-white mb-2"><b>You:</b> ${t.message}</p>
                ${t.reply ? `<div class="bg-[#143D2F]/50 p-3 rounded-lg"><p class="text-xs text-neon mb-1 font-bold">Admin Reply:</p><p class="text-sm text-gray-300">${t.reply}</p></div>` : `<p class="text-xs text-[#4A7A66] italic">Awaiting reply...</p>`}
            </div>
        `).join('');
    }
}

// ==========================================
// ADMIN DASHBOARD ENGINE
// ==========================================
async function loadAdminDashboard() {
    switchTab('admin');
    try {
        const res = await fetch('/api/admin/data', { headers: { 'Authorization': `Bearer ${currentToken}` } });
        adminGlobalData = await res.json();
        
        // Populate Users Dropdown
        document.getElementById('topupUserSelect').innerHTML = adminGlobalData.users.map(u => `<option value="${u._id}">${u.username} (Bal: ₦${u.walletBalance})</option>`).join('');
        
        // Populate Users List
        document.getElementById('adminUsersList').innerHTML = adminGlobalData.users.map(u => `
            <div class="bg-[#0C221A] p-3 rounded-lg border border-[#143D2F] flex justify-between items-center">
                <div><p class="text-sm text-white font-bold">${u.username}</p><p class="text-[10px] text-[#4A7A66]">${u.email}</p></div>
                <div class="text-right"><p class="text-xs text-neon">Bal: ₦${u.walletBalance}</p><p class="text-xs text-white">Earned: ₦${u.withdrawableBalance}</p></div>
            </div>`).join('');

        // Populate Support Tickets
        document.getElementById('adminSupportList').innerHTML = adminGlobalData.tickets.map(t => `
            <div class="card p-4 rounded-xl border border-red-500/30">
                <p class="text-xs text-neon font-bold mb-1">From: ${t.userName}</p>
                <p class="text-sm text-white mb-3">"${t.message}"</p>
                <textarea id="reply_${t._id}" class="w-full input-box rounded-lg p-2 text-xs mb-2 h-16" placeholder="Type reply..."></textarea>
                <button onclick="adminReplySupport('${t._id}')" class="bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold">Send Reply</button>
            </div>`).join('');

    } catch(e) { appAlert("Admin access denied.", "Error", true); }
}

async function adminTopUpUser() {
    const userId = document.getElementById('topupUserSelect').value;
    const amount = Number(document.getElementById('topupAmount').value);
    if (!amount) return;
    
    appConfirm(`Top up this user with ₦${amount.toLocaleString()}?`, async () => {
        await fetch('/api/admin/user/topup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ userId, amount }) });
        appAlert("Top-Up Successful", "Admin"); document.getElementById('topupAmount').value = ""; loadAdminDashboard();
    });
}

async function adminReplySupport(ticketId) {
    const replyMessage = document.getElementById(`reply_${ticketId}`).value;
    if(!replyMessage) return;
    await fetch('/api/admin/support/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ ticketId, replyMessage }) });
    appAlert("Reply sent.", "Admin"); loadAdminDashboard();
}

async function adminAddPlan() {
    const name = document.getElementById('newPlanName').value; const cost = Number(document.getElementById('newPlanCost').value);
    const dailyReturn = Number(document.getElementById('newPlanDaily').value); const duration = Number(document.getElementById('newPlanDuration').value);
    if(!name || !cost) return;
    await fetch('/api/admin/plan/add', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ name, cost, dailyReturn, duration, icon: 'fa-gem' }) });
    appAlert("Plan Published!", "Admin"); loadDashboard();
}

async function adminDeletePlan(planId) {
    appConfirm("Delete this plan forever?", async () => {
        await fetch('/api/admin/plan/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ planId }) });
        appAlert("Plan 
