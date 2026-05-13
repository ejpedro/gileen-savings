const SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';
const coinSound = new Audio('https://www.myinstants.com/media/sounds/stardew-valley-level-up.mp3');

let state = {
    total: 0,
    categories: [
        { name: "Emergency Fund", saved: 0 },
        { name: "New PC", saved: 0 }
    ]
};

function depositGold() {
    const input = document.getElementById('gold-input');
    const amount = parseFloat(input.value);

    if (amount > 0) {
        state.total += amount;
        
        // Play sound and animate
        coinSound.play();
        const display = document.getElementById('total-gold');
        display.classList.add('bounce');
        setTimeout(() => display.classList.remove('bounce'), 500);

        updateUI();
        sendToSheet("Deposit", "General", amount);
        input.value = '';
    }
}

async function sendToSheet(action, category, amount) {
    await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action, category, amount })
    });
}

function updateUI() {
    document.getElementById('total-gold').innerText = `$${state.total}`;
    // Calculate "Free to Allocate" logic here...
}