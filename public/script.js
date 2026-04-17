// ==========================================
// 1. TELEGRAM WEB APP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;

// Tell Telegram the app is ready and expand to full screen
tg.ready();
tg.expand(); 

// Extract the real user data from Telegram
const user = tg.initDataUnsafe?.user;

// If opened in Telegram, use real ID. Fallback for testing
const USER_ID = user ? user.id.toString() : "12345"; 
const USER_NAME = user ? user.first_name : "Test User";

// ==========================================
// 2. APP STARTUP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchUserData();
});

// Fetch latest balance from your Render backend
async function fetchUserData() {
    try {
        const response = await fetch(`/api/user/${USER_ID}`);
        const data = await response.json();
        
        if(data.balance !== undefined) {
            document.getElementById('balanceDisplay').innerText = `₦${data.balance.toLocaleString()}`;
        } else {
            document.getElementById('balanceDisplay').innerText = `₦0`;
        }
    } catch (error) {
        console.error("Error fetching data", error);
    }
}

// ==========================================
// 3. BUY SHARE LOGIC
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
            
            tg.MainButton.hideProgress();
            tg.MainButton.hide();

            if (result.success) {
                tg.HapticFeedback.notificationOccurred('success');
                tg.showAlert("✅ Share purchased successfully! You will now earn daily.");
                document.getElementById('balanceDisplay').innerText = `₦${result.newBalance.toLocaleString()}`;
            } else {
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            tg.MainButton.hideProgress();
            tg.MainButton.hide();
            tg.showAlert("Transaction failed. Please check your connection.");
        }
    });
}

// ==========================================
// 4. FUND WALLET LOGIC (UPGRADED WITH VISUAL FEEDBACK)
// ==========================================
async function fundWallet() {
    const amountInput = document.getElementById('depositAmount').value;
    const amount = Number(amountInput);
    
    // Grab the actual HTML button so we can change its text
    const btn = document.querySelector('button[onclick="fundWallet()"]');

    if (!amount || amount < 100) {
        tg.showAlert("Please enter a valid amount (Minimum ₦100).");
        return;
    }

    // Vibrate phone
    tg.HapticFeedback.impactOccurred('medium');
    
    // Change button text to show it is working
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating Link...";
    btn.disabled = true; // Stop them from clicking it twice

    try {
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, amount: amount })
        });
        
        const result = await response.json();
        
        // Reset button text
        btn.innerText = originalText;
        btn.disabled = false;

        if (result.success) {
            // Open the SquadCo payment page securely inside Telegram
            tg.openLink(result.checkoutUrl);
        } else {
            tg.showAlert(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        // Reset button if the server is sleeping or crashes
        btn.innerText = originalText;
        btn.disabled = false;
        tg.showAlert("Network error. Please wait a moment and try again.");
    }
            }
