// ==========================================
// 1. TELEGRAM WEB APP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;

// Tell Telegram the app is ready and expand to full screen
tg.ready();
tg.expand(); 

// Extract the real user data from Telegram
const user = tg.initDataUnsafe?.user;

// If opened in Telegram, use real ID. If opened in browser for testing, fallback to "12345"
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
            // If the user is new and not in the database yet
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
    // Use Telegram's native confirmation popup instead of standard browser alert
    tg.showConfirm(`Are you sure you want to buy the ${shareType} share for ₦10,000?`, async (confirmed) => {
        if (!confirmed) return;

        try {
            // Show a loading state on Telegram's Main Button
            tg.MainButton.text = "Processing Transaction...";
            tg.MainButton.show();
            tg.MainButton.showProgress();

            // Send purchase request to Render backend
            const response = await fetch('/api/buy-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Notice we are sending the USER_NAME now too, so the backend knows who they are
                body: JSON.stringify({ userId: USER_ID, userName: USER_NAME, shareType: shareType })
            });
            
            const result = await response.json();
            
            // Hide loading state
            tg.MainButton.hideProgress();
            tg.MainButton.hide();

            if (result.success) {
                // Success haptic vibration
                tg.HapticFeedback.notificationOccurred('success');
                tg.showAlert("✅ Share purchased successfully! You will now earn daily.");
                
                // Update the balance on the screen instantly
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
// 4. FUND WALLET LOGIC
// ==========================================
function fundWallet() {
    // Small vibration when tapping the button
    tg.HapticFeedback.impactOccurred('medium');

    const details = document.getElementById('fundingDetails');
    
    // We display their real Telegram name in the transfer instructions
    details.innerHTML = `Transfer to: <b>0123456789</b> (GTBank)<br>Name: SharePoint - ${USER_NAME}`;
    details.classList.remove('hidden');
    }
