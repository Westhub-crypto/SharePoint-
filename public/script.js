// ==========================================
// 1. TELEGRAM WEB APP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand(); 

const user = tg.initDataUnsafe?.user;
const USER_ID = user ? user.id.toString() : "12345"; 
const USER_NAME = user ? user.first_name : "Test User";

// ==========================================
// 2. UI NAVIGATION LOGIC
// ==========================================
function showDepositPage() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('depositView').classList.remove('hidden');
    
    // Show Telegram's native Back Button
    tg.BackButton.show();
    tg.BackButton.onClick(showDashboard);
}

function showDashboard() {
    tg.HapticFeedback.impactOccurred('light');
    document.getElementById('depositView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    
    // Hide Telegram's native Back Button
    tg.BackButton.hide();
    tg.BackButton.offClick(showDashboard);
}

// Fills the input box when a preset button is tapped
function setAmount(amount) {
    tg.HapticFeedback.selectionChanged();
    document.getElementById('depositAmount').value = amount;
}

// ==========================================
// 3. APP STARTUP & DATA FETCHING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchUserData();
});

async function fetchUserData() {
    try {
        const response = await fetch(`/api/user/${USER_ID}`);
        const data = await response.json();
        
        // Extract the two separate balances
        let wBal = data.walletBalance !== undefined ? data.walletBalance : 0;
        let earnBal = data.withdrawableBalance !== undefined ? data.withdrawableBalance : 0;
        
        // Update the screen
        document.getElementById('walletBalanceDisplay').innerText = `₦${wBal.toLocaleString()}`;
        document.getElementById('withdrawableBalanceDisplay').innerText = `₦${earnBal.toLocaleString()}`;
    } catch (error) {
        console.error("Error fetching data", error);
    }
}

// ==========================================
// 4. BUY SHARE LOGIC
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
                tg.showAlert("✅ Share purchased successfully!");
                fetchUserData(); // Refresh balances immediately
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
// 5. FUND WALLET LOGIC
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
        tg.showAlert("Network error. Please wait a moment and try again.");
    }
    }
