let currentUser = null;
let currentToken = null;

// On Page Load: Check if already logged in
window.onload = function() {
    const savedToken = localStorage.getItem('sharepoint_token');
    if (savedToken) {
        currentToken = savedToken;
        loadDashboard(); // Auto-login
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

    if(!user || !email || !pass) return alert("Please fill all fields.");
    
    document.getElementById('regBtn').innerText = "Processing...";
    try {
        const response = await fetch('/api/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass, ref: ref })
        });
        const result = await response.json();
        if (result.success) {
            alert("Success! Please sign in.");
            toggleAuth('login');
        } else { alert(result.error); }
    } catch (e) { alert("Network error."); }
    document.getElementById('regBtn').innerText = "Register";
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    
    if(!email || !pass) return alert("Please fill all fields.");
    
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
            currentUser = data.user;
            setupDashboard(data);
        } else { alert(data.error); }
    } catch (e) { alert("Network error."); }
    document.getElementById('loginBtn').innerText = "Login";
}

function logout() {
    localStorage.removeItem('sharepoint_token');
    window.location.reload();
}

async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            setupDashboard(data);
        } else {
            logout(); // Token expired or invalid
        }
    } catch (e) { alert("Network error. Please refresh."); }
}

function setupDashboard(data) {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    document.getElementById('userNameDisplay').innerText = currentUser.username;
    document.getElementById('walletBalanceDisplay').innerText = `₦${currentUser.walletBalance.toLocaleString()}`;
    document.getElementById('withdrawableBalanceDisplay').innerText = `₦${currentUser.withdrawableBalance.toLocaleString()}`;
    
    // Website Referral Link format
    const refLink = window.location.origin + "?ref=" + currentUser.id;
    document.getElementById('refLinkText').innerText = refLink;
    document.getElementById('referralCountDisplay').innerText = data.referralCount;

    // Admin Controls
    if (currentUser.role === 'admin') {
        document.getElementById('tab-admin').classList.remove('hidden');
        document.getElementById('tab-admin').classList.add('flex');
        const buttons = document.querySelectorAll('#navFlexContainer button');
        buttons.forEach(btn => { btn.classList.remove('w-1/4'); btn.classList.add('w-1/5'); });
    }

    renderPlans(data.plans);
    renderPortfolio(data.investments);
}

function renderPlans(plans) {
    const plansList = document.getElementById('dynamicPlansList');
    if (plans && plans.length > 0) {
        plansList.innerHTML = plans.map(plan => {
            const totalProfit = plan.dailyReturn * plan.duration;
            const totalReturn = plan.cost + totalProfit;
            return `
            <div class="card rounded-[24px] p-6 mb-5 hover:border-[#00FF87] transition shadow-lg">
                <div class="flex justify-between items-center mb-5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-[#00FF87]/10 flex items-center justify-center border border-[#00FF87]/30"><i class="fa-solid ${plan.icon || 'fa-gem'} text-neon text-xl drop-shadow-sm"></i></div>
                        <div><h4 class="text-xl font-black text-white">${plan.name}</h4><p class="text-[11px] text-neon font-bold tracking-widest uppercase">Cost: ₦${plan.cost.toLocaleString()}</p></div>
                    </div>
                </div>
                <div class="bg-[#061410] rounded-xl p-4 text-sm text-gray-300 border border-[#143D2F] mb-5">
                    <p class="text-[10px] text-neon font-bold mb-3 uppercase tracking-widest">Earning Structure</p>
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Daily:</span> <span class="font-bold text-white">₦${plan.dailyReturn.toLocaleString()}</span></div>
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Duration:</span> <span class="font-bold text-white">${plan.duration} Days</span></div>
                    <div class="flex justify-between border-b border-[#143D2F] pb-2 mb-2"><span class="font-medium text-[#4A7A66]">Profit:</span> <span class="font-bold text-white">₦${totalProfit.toLocaleString()}</span></div>
                    <div class="flex justify-between pt-1"><span class="font-bold text-neon">Total Return:</span> <span class="font-black text-neon text-base">₦${totalReturn.toLocaleString()}</span></div>
                </div>
                <button onclick="buyDynamicShare('${plan._id}', '${plan.name}', ${plan.cost})" class="w-full btn-neon py-3.5 rounded-full text-sm font-black shadow-lg uppercase tracking-wide">Purchase Plan</button>
            </div>`
        }).join('');
    }
}

function renderPortfolio(investments) {
    const invList = document.getElementById('investmentsList');
    if (investments && investments.length > 0) {
        invList.innerHTML = investments.map(inv => `
            <div class="card rounded-2xl p-5 flex justify-between items-center border-l-4 border-l-[#00FF87] mb-3">
                <div><h4 class="font-extrabold text-white text-base">${inv.shareName}</h4><p class="text-xs text-neon font-bold mt-1">+₦${inv.dailyReturn.toLocaleString()} Daily</p></div>
                <div class="text-right"><p class="text-3xl font-black text-white">${inv.daysLeft}</p><p class="text-[9px] text-[#4A7A66] uppercase tracking-widest font-bold">Days Left</p></div>
            </div>
        `).join('');
    }
}

function switchTab(tabId) {
    const ids = ['dashboard', 'shares', 'portfolio', 'referral', 'admin'];
    ids.forEach(id => {
        const viewEl = document.getElementById(id + 'View');
        if(viewEl) viewEl.classList.add('hidden');
    });
    const selectedView = document.getElementById(tabId + 'View');
    if(selectedView) selectedView.classList.remove('hidden');
    window.scrollTo(0,0);
}

function copyRefLink() {
    navigator.clipboard.writeText(document.getElementById('refLinkText').innerText);
    alert("✅ Link copied!");
}
function shareLink() {
    const url = encodeURIComponent(document.getElementById('refLinkText').innerText);
    window.open(`https://api.whatsapp.com/send?text=Join SharePoint Premium! ${url}`);
    }
