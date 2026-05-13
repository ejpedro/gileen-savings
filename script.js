const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkoPiBQT342QDfsOiltj9G6xg97Umt83hmiVCBJotl8gxMSd0qXrTEHw4qao51dvPPdQ/exec';

// SETUP THE COIN SOUND
const coinSound = new Audio('coin.wav'); 

let state = JSON.parse(localStorage.getItem('stardew_savings_v2')) || {
    total: 0,
    categories: []
};

updateUI();

function save() {
    localStorage.setItem('stardew_savings_v2', JSON.stringify(state));
    updateUI();
}

function depositGold() {
    const input = document.getElementById('main-input');
    const amount = parseFloat(input.value);
    if (amount > 0) {
        state.total += amount;
        input.value = '';
        triggerEffects(); // Play sound and bounce
        sendToSheet("Deposit", "Main", amount);
        save();
    }
}

function withdrawGold() {
    const input = document.getElementById('main-input');
    const amount = parseFloat(input.value);
    const free = calculateFree();
    
    if (amount > 0 && free >= amount) {
        state.total -= amount;
        input.value = '';
        coinSound.play(); // Play sound on remove too
        sendToSheet("Withdraw", "Main", -amount);
        save();
    } else if (amount > free) {
        alert("Not enough 'Free Gold'! Un-allocate some from categories first.");
    }
}

function createCategory() {
    const input = document.getElementById('cat-name-input');
    const name = input.value.trim();
    if (name) {
        state.categories.push({ name: name, allocated: 0 });
        input.value = '';
        coinSound.play();
        save();
    }
}

function deleteCategory(index) {
    const catName = state.categories[index].name;
    const amountSaved = state.categories[index].allocated;
    
    if (confirm(`Delete "${catName}"? Any saved gold ($${amountSaved}) will be moved back to Free to Allocate.`)) {
        sendToSheet("Delete Category", catName, -amountSaved);
        state.categories.splice(index, 1);
        coinSound.play();
        save();
    }
}

function allocate(index, amount) {
    const free = calculateFree();
    if (amount > 0 && free >= amount) {
        state.categories[index].allocated += amount;
        triggerEffects();
        sendToSheet("Allocate", state.categories[index].name, amount);
        save();
    } 
    else if (amount < 0 && state.categories[index].allocated >= Math.abs(amount)) {
        state.categories[index].allocated += amount;
        triggerEffects();
        sendToSheet("De-allocate", state.categories[index].name, amount);
        save();
    } else {
        alert("Transaction failed! Check your gold counts.");
    }
}

function calculateFree() {
    const used = state.categories.reduce((sum, cat) => sum + cat.allocated, 0);
    return state.total - used;
}

function updateUI() {
    document.getElementById('total-gold').innerText = `$${state.total.toLocaleString()}`;
    document.getElementById('free-money').innerText = `$${calculateFree().toLocaleString()}`;

    const list = document.getElementById('category-list');
    list.innerHTML = '';

    state.categories.forEach((cat, i) => {
        const div = document.createElement('div');
        div.className = 'category-card';
        
        const amounts = [1, 5, 10, 25, 50];
        const addButtons = amounts.map(amt => `<button onclick="allocate(${i}, ${amt})">+${amt}</button>`).join('');
        const subButtons = amounts.map(amt => `<button class="remove" onclick="allocate(${i}, -${amt})">-${amt}</button>`).join('');

        div.innerHTML = `
            <button class="delete-btn" onclick="deleteCategory(${i})">X</button>
            <h3>${cat.name.toUpperCase()}</h3>
            <p class="stat-text">Saved: $${cat.allocated}</p>
            <div class="grid-label">Add Funds:</div>
            <div class="button-grid">${addButtons}</div>
            <div class="grid-label">Remove Funds:</div>
            <div class="button-grid">${subButtons}</div>
        `;
        list.appendChild(div);
    });
}

function triggerEffects() {
    // Play Sound
    coinSound.currentTime = 0; // Reset sound if clicked rapidly
    coinSound.play();
    
    // Animate Gold Number
    const el = document.getElementById('total-gold');
    el.classList.add('bounce');
    setTimeout(() => el.classList.remove('bounce'), 300);
}

async function sendToSheet(action, category, amount) {
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action, category, amount })
        });
    } catch (e) { console.log("Sync error", e); }
}
