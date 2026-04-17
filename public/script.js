const tg = window.Telegram.WebApp;

tg.ready();
tg.expand(); 

const user = tg.initDataUnsafe?.user;
const USER_ID = user ? user.id.toString() : "12345"; 
const USER_NAME = user ? user.first_name : "Test User";

// UI NAVIGATION
function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('depositView').classList.remove('hidden');
    tg.BackButton.show();
    tg.BackButton.onClick(showDashboard);
}

function showDashboard() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('depositView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    tg.BackButton.hide();
    tg.BackButton.offClick(showDashboard);
}

function setAmount(amount) {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositAmount').value = amount;
}

// APP STARTUP & DATA FETCHING
document.addEventListener('DOMContentLoaded', () => {
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

        // RENDER ACTIVE INVESTMENTS
        const invList = document.getElementById('investmentsList');
        if (data.investments && data.investments.length > 0) {
            invList.innerHTML = data.investments.map(inv => `
                <div class="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-white uppercase tracking-wide">${inv.shareType}</h4>
                        <p class="text-sm text-green-400 font-medium">+₦${inv.dailyReturn} / day</p>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold text-blue-400 leading-none">${inv.daysLeft}</p>
                        <p class="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Days Left</p>
                    </div>
                </div>
            `).join('');
        } else {
            invList.innerHTML = `<p class="text-gray-500 text-sm text-center italic mt-2 border border-dashed border-gray-700 p-4 rounded-xl">No active shares yet.</p>`;
        }

    } catch (error) {
        console.error("Error fetching data", error);
    }
}

// BUY SHARE LOGIC
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
                tg.showAlert("✅ Share purchased successfully!");
                fetchUserData(); // Refresh balances AND investments automatically
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

// FUND WALLET LOGIC
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
        tg.showAlert("Network error. Please wait a moment and try again.");
    }
        }
