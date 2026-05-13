const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkoPiBQT342QDfsOiltj9G6xg97Umt83hmiVCBJotl8gxMSd0qXrTEHw4qao51dvPPdQ/exec';

// Load from local storage or start fresh
let state = JSON.parse(localStorage.getItem('stardew_data')) || {
    total: 0,
    categories: []
};

// Initial Render
updateUI();

function save() {
    localStorage.setItem('stardew_data', JSON.stringify(state));
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
    if (free >= amount) {
        state.categories[index].allocated += amount;
        sendToSheet("Allocate", state.categories[index].name, amount);
        save();
    } else {
        alert("Not enough gold!");
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
        div.innerHTML = `
            <h3>${cat.name.toUpperCase()}</h3>
            <p class="stat-text">SAVED: $${cat.allocated}</p>
            <button onclick="allocate(${i}, 10)">+10</button>
            <button onclick="allocate(${i}, 50)">+50</button>
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
    if (SCRIPT_URL.includes('PASTE_YOUR')) return; // Don't run if URL isn't set
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action, category, amount })
        });
    } catch (e) { console.log("Sheet error", e); }
}
