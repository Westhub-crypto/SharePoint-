// ==========================================
// 1. TELEGRAM SETUP
// ==========================================
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand(); 

const user = tg.initDataUnsafe?.user;
const USER_ID = user ? user.id.toString() : "12345"; 
const USER_NAME = user ? user.first_name : "Test User";

// ==========================================
// 2. NAVIGATION LOGIC (TABS & PAGES)
// ==========================================
function switchTab(tabId) {
    tg.HapticFeedback.selectionChanged();
    
    // Hide all main views
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('portfolioView').classList.add('hidden');
    document.getElementById('depositView').classList.add('hidden');
    
    // Reset tab colors
    document.getElementById('tab-dashboard').className = "flex flex-col items-center text-gray-500 hover:text-gray-300 transition";
    document.getElementById('tab-portfolio').className = "flex flex-col items-center text-gray-500 hover:text-gray-300 transition";
    
    // Show selected view and highlight tab
    document.getElementById(tabId + 'View').classList.remove('hidden');
    document.getElementById('tab-' + tabId).className = "flex flex-col items-center text-blue-400 transition drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]";
}

function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    
    // Hide everything and the bottom nav
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('portfolioView').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden'); // Hide tab bar during deposit
    
    // Show deposit page
    document.getElementById('depositView').classList.remove('hidden');
    
    // Activate Telegram native back button
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        document.getElementById('depositView').classList.add('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
        switchTab('dashboard');
        tg.BackButton.hide();
    });
}

function setAmount(amount) {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositAmount').value = amount;
}

// ==========================================
// 3. APP STARTUP & DATA FETCHING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').innerText = USER_NAME;
    fetchUserData();
});

async function fetchUserData() {
    try {
        const response = await fetch(`/api/user/${USER_ID}`);
        const data = await response.json();
        
        let wBal = data.walletBalance !== undefined ? data.walletBalance : 0;
        let earnBal = data.withdrawableBalance !== undefined ? data.withdrawableBalance : 0;
        
        document.getElementById('walletBalanceDisplay').innerText = `₦${wBal.toLocaleString()}`;
        document.getElementById('withdrawableBalanceDisplay').innerText = `₦${earnBal.toLocaleString()}`;

        // RENDER PORTFOLIO (WITH TOTAL EARNED CALCULATIONS)
        const invList = document.getElementById('investmentsList');
        if (data.investments && data.investments.length > 0) {
            invList.innerHTML = data.investments.map(inv => {
                
                // Calculate how much this specific share has earned
                // Assuming standard duration is 30 days
                const daysPassed = 30 - inv.daysLeft;
                const totalEarnedSoFar = daysPassed * inv.dailyReturn;
                
                return `
                <div class="bg-white/5 backdrop-blur-lg rounded-3xl p-5 border border-white/10 shadow-xl relative overflow-hidden">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                                <i class="fa-solid fa-chart-line text-blue-400 text-sm"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-white uppercase tracking-wide text-sm">${inv.shareType} Plan</h4>
                                <p class="text-xs text-emerald-400 font-medium">+₦${inv.dailyReturn} Daily</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-black text-white">${inv.daysLeft}</p>
                            <p class="text-[10px] text-gray-400 uppercase tracking-widest">Days Left</p>
                        </div>
                    </div>
                    
                    <div class="bg-black/30 rounded-xl p-3 border border-white/5 flex justify-between items-center">
                        <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Earned</span>
                        <span class="text-emerald-400 font-bold text-lg">₦${totalEarnedSoFar.toLocaleString()}</span>
                    </div>
                </div>
            `}).join('');
        } else {
            invList.innerHTML = `
                <div class="bg-white/5 border border-dashed border-white/20 p-8 rounded-3xl text-center">
                    <i class="fa-solid fa-box-open text-3xl text-gray-600 mb-3"></i>
                    <p class="text-gray-400 text-sm">You have no active investments.</p>
                    <button onclick="switchTab('dashboard')" class="mt-4 text-blue-400 text-sm font-bold">Explore Shares <i class="fa-solid fa-arrow-right text-xs"></i></button>
                </div>`;
        }

    } catch (error) {
        console.error("Error fetching data", error);
    }
}

// ==========================================
// 4. BUY LOGIC
// ==========================================
function buyShare(shareType) {
    tg.showConfirm(`Are you sure you want to buy the ${shareType} share for ₦10,000?`, async (confirmed) => {
        if (!confirmed) return;

        tg.MainButton.text = "Processing Transaction...";
        tg.MainButton.show();
        tg.MainButton.showProgress();

        try {
            const response = await fetch('/api/buy-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, userName: USER_NAME, shareType: shareType })
            });
            
            const result = await response.json();
            tg.MainButton.hideProgress(); tg.MainButton.hide();

            if (result.success) {
                tg.HapticFeedback.notificationOccurred('success');
                tg.showAlert("✅ Share purchased successfully! Check your Portfolio tab.");
                fetchUserData(); 
            } else {
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            tg.MainButton.hideProgress(); tg.MainButton.hide();
            tg.showAlert("Transaction failed. Please check your connection.");
        }
    });
}

// ==========================================
// 5. DEPOSIT LOGIC
// ==========================================
async function fundWallet() {
    const amountInput = document.getElementById('depositAmount').value;
    const amount = Number(amountInput);
    const btn = document.getElementById('generateLinkBtn');

    if (!amount || amount < 100) {
        tg.showAlert("Please enter a valid amount (Minimum ₦100).");
        return;
    }

    tg.HapticFeedback.impactOccurred('medium');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating Link...";
    btn.disabled = true; 

    try {
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, amount: amount })
        });
        
        const result = await response.json();
        
        btn.innerText = originalText;
        btn.disabled = false;

        if (result.success) {
            tg.openLink(result.checkoutUrl);
        } else {
            tg.showAlert(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        btn.innerText = originalText;
        btn.disabled = false;
        tg.showAlert("Network error. Please try again.");
    }
                          }
