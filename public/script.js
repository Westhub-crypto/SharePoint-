// In a real Telegram Mini App, we get the ID from Telegram Web App data
// For this test, we are hardcoding the mock user ID "12345"
const USER_ID = "12345"; 

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Tell Telegram the app is ready
    if(window.Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    }
    fetchUserData();
});

// Fetch latest balance from backend
async function fetchUserData() {
    try {
        const response = await fetch(`/api/user/${USER_ID}`);
        const data = await response.json();
        if(data.balance !== undefined) {
            document.getElementById('balanceDisplay').innerText = `₦${data.balance.toLocaleString()}`;
        }
    } catch (error) {
        console.error("Error fetching data", error);
    }
}

// Handle Buy Button
async function buyShare(shareType) {
    if(!confirm(`Are you sure you want to buy the ${shareType} share?`)) return;

    try {
        const response = await fetch('/api/buy-share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, shareType: shareType })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert("Share purchased successfully! You will now earn daily.");
            document.getElementById('balanceDisplay').innerText = `₦${result.newBalance.toLocaleString()}`;
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert("Transaction failed.");
    }
}

// Handle Fund Wallet Button
function fundWallet() {
    // In reality, this would fetch from the backend
    const details = document.getElementById('fundingDetails');
    details.innerHTML = `Transfer to: <b>0123456789</b> (GTBank)<br>Name: SharePoint - Godwin`;
    details.classList.remove('hidden');
                          }
