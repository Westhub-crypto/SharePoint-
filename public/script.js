const tg = window.Telegram.WebApp;

tg.ready();
tg.expand(); 

const user = tg.initDataUnsafe?.user;
const USER_ID = user ? user.id.toString() : "12345"; 
const USER_NAME = user ? user.first_name : "Test User";

const REFERRED_BY = tg.initDataUnsafe?.start_param || null;
const BOT_USERNAME = "SharePoint_official_bot"; 
const MY_REF_LINK = `https://t.me/${BOT_USERNAME}?start=${USER_ID}`;

// NAVIGATION LOGIC
function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('portfolioView').classList.add('hidden');
    document.getElementById('referralView').classList.add('hidden');
    document.getElementById('depositView').classList.add('hidden');
    document.getElementById('withdrawView').classList.add('hidden');
    
    document.getElementById('tab-dashboard').className = "flex flex-col items-center text-stone-500 hover:text-yellow-500/50 transition";
    document.getElementById('tab-portfolio').className = "flex flex-col items-center text-stone-500 hover:text-yellow-500/50 transition";
    document.getElementById('tab-referral').className = "flex flex-col items-center text-stone-500 hover:text-yellow-500/50 transition";
    
    // Highlight active tab with GOLD glow
    document.getElementById(tabId + 'View').classList.remove('hidden');
    document.getElementById('tab-' + tabId).className = "flex flex-col items-center text-yellow-500 transition drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]";
}

function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('portfolioView').classList.add('hidden');
    document.getElementById('referralView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden'); 
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
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('portfolioView').classList.add('hidden');
    document.getElementById('referralView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden'); 
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

// APP STARTUP & SMART LOGIN
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').innerText = USER_NAME;
    document.getElementById('refLinkText').innerText = MY_REF_LINK;
    fetchUserData();
});

async function fetchUserData() {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tgId: USER_ID, name: USER_NAME, referredBy: REFERRED_BY })
        });
        
        const data = await response.json();
        
        let wBal = data.walletBalance || 0;
        let earnBal = data.withdrawableBalance || 0;
        let refCount = data.referrals || 0;
        
        document.getElementById('walletBalanceDisplay').innerText = `₦${wBal.toLocaleString()}`;
        document.getElementById('withdrawableBalanceDisplay').innerText = `₦${earnBal.toLocaleString()}`;
        document.getElementById('referralCountDisplay').innerText = refCount;

        // RENDER PORTFOLIO (GOLD THEME UPDATE)
        const invList = document.getElementById('investmentsList');
        if (data.investments && data.investments.length > 0) {
            invList.innerHTML = data.investments.map(inv => {
                const daysPassed = 30 - inv.daysLeft;
                const totalEarnedSoFar = daysPassed * inv.dailyReturn;
                return `
                <div class="bg-gradient-to-br from-stone-800 to-stone-900 rounded-3xl p-5 border border-yellow-500/20 shadow-xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl -z-10"></div>
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30">
                                <i class="fa-solid fa-chart-line text-yellow-500 text-sm"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-white uppercase tracking-wide text-sm">${inv.shareType} Plan</h4>
                                <p class="text-xs text-emerald-400 font-medium">+₦${inv.dailyReturn} Daily</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-black text-yellow-400">${inv.daysLeft}</p>
                            <p class="text-[10px] text-stone-400 uppercase tracking-widest">Days Left</p>
                        </div>
                    </div>
                    <div class="bg-black/50 rounded-xl p-3 border border-stone-700 flex justify-between items-center">
                        <span class="text-xs text-stone-400 font-medium uppercase tracking-wider">Total Earned</span>
                        <span class="text-emerald-400 font-bold text-lg">₦${totalEarnedSoFar.toLocaleString()}</span>
                    </div>
                </div>`
            }).join('');
        } else {
            invList.innerHTML = `
                <div class="bg-stone-800/50 border border-dashed border-stone-600 p-8 rounded-3xl text-center">
                    <i class="fa-solid fa-vault text-3xl text-yellow-500/50 mb-3"></i>
                    <p class="text-stone-400 text-sm">You have no active investments.</p>
                </div>`;
        }
    } catch (error) {
        console.error("Error fetching data", error);
    }
}

// REFERRAL ACTIONS
function copyRefLink() {
    tg.HapticFeedback.impactOccurred('medium');
    const tempInput = document.createElement("input");
    tempInput.value = MY_REF_LINK;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    tg.showAlert("✅ Link copied! Send it to your friends to earn bonuses.");
}

function shareLink() {
    tg.HapticFeedback.impactOccurred('light');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(MY_REF_LINK)}&text=${encodeURIComponent('Join me on SharePoint!')}`;
    tg.openTelegramLink(shareUrl);
}

// TRANSACTION LOGIC
function buyShare(shareType) {
    tg.showConfirm(`Buy ${shareType} share for ₦10,000?`, async (confirmed) => {
        if (!confirmed) return;
        tg.MainButton.text = "Processing..."; tg.MainButton.show(); tg.MainButton.showProgress();
        try {
            const response = await fetch('/api/buy-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, shareType: shareType })
            });
            const result = await response.json();
            tg.MainButton.hide();
            if (result.success) {
                tg.HapticFeedback.notificationOccurred('success');
                tg.showAlert("✅ Share purchased successfully!");
                fetchUserData(); 
            } else {
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            tg.MainButton.hide(); tg.showAlert("Transaction failed.");
        }
    });
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

    if (!amount || amount < 1000) return tg.showAlert("Minimum withdrawal is ₦1,000");
    if (!bank || !accNo || !accName) return tg.showAlert("Please fill all bank details.");

    tg.MainButton.text = "Sending Request..."; tg.MainButton.show(); tg.MainButton.showProgress();
    btn.disabled = true;

    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, userName: USER_NAME, amount, bankName: bank, accNo, accName })
        });
        
        const result = await response.json();
        tg.MainButton.hide(); btn.disabled = false;

        if (result.success) {
            tg.HapticFeedback.notificationOccurred('success');
            tg.showAlert("✅ Withdrawal request sent! You will receive your funds soon.");
            fetchUserData(); 
            tg.BackButton.click(); 
        } else {
            tg.showAlert(`❌ Error: ${result.error}`);
        }
    } catch (e) {
        tg.MainButton.hide(); btn.disabled = false;
        tg.showAlert("Network error. Try again.");
    }
        }
