const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkoPiBQT342QDfsOiltj9G6xg97Umt83hmiVCBJotl8gxMSd0qXrTEHw4qao51dvPPdQ/exec';

// Load existing data or start a new game
let state = JSON.parse(localStorage.getItem('stardew_savings_v2')) || {
    total: 0,
    categories: []
};

// Start the UI
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
        triggerBounce();
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
        save();
    }
}

function allocate(index, amount) {
    const free = calculateFree();
    
    // Adding to category
    if (amount > 0 && free >= amount) {
        state.categories[index].allocated += amount;
        sendToSheet("Allocate", state.categories[index].name, amount);
        save();
    } 
    // Subtracting from category
    else if (amount < 0 && state.categories[index].allocated >= Math.abs(amount)) {
        state.categories[index].allocated += amount;
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
        
        const addButtons = amounts.map(amt => 
            `<button onclick="allocate(${i}, ${amt})">+${amt}</button>`
        ).join('');
        
        const subButtons = amounts.map(amt => 
            `<button class="remove" onclick="allocate(${i}, -${amt})">-${amt}</button>`
        ).join('');

        div.innerHTML = `
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

function triggerBounce() {
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
