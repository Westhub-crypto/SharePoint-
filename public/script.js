// ==========================================
// 4. FUND WALLET LOGIC
// ==========================================
async function fundWallet() {
    // Grab the amount typed into the box
    const amountInput = document.getElementById('depositAmount').value;
    const amount = Number(amountInput);

    if (!amount || amount < 100) {
        tg.showAlert("Please enter a valid amount (Minimum ₦100).");
        return;
    }

    tg.HapticFeedback.impactOccurred('medium');
    
    // Show a loading bar on the main button
    tg.MainButton.text = "Generating Payment Link...";
    tg.MainButton.show();
    tg.MainButton.showProgress();

    try {
        // Send request to your backend
        const response = await fetch('/api/fund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, amount: amount })
        });
        
        const result = await response.json();
        
        // Hide the loading state
        tg.MainButton.hideProgress();
        tg.MainButton.hide();

        if (result.success) {
            // Open the SquadCo payment page securely inside Telegram
            tg.openLink(result.checkoutUrl);
        } else {
            tg.showAlert(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        tg.MainButton.hideProgress();
        tg.MainButton.hide();
        tg.showAlert("Network error. Please try again.");
    }
}
