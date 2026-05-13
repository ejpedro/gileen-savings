const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkoPiBQT342QDfsOiltj9G6xg97Umt83hmiVCBJotl8gxMSd0qXrTEHw4qao51dvPPdQ/exec';

// SETUP THE SOUNDS
const coinSound = new Audio('coin.wav'); 
const chestSound = new Audio('openChest.wav');
const trashSound = new Audio('trashcan.wav');

// Default state
let state = {
    total: 0,
    categories: []
};

// 1. INITIAL LOAD
// We try to load from LocalStorage for speed, then fetch from Cloud to sync
const localData = localStorage.getItem('stardew_savings_v2');
if (localData) {
    state = JSON.parse(localData);
    updateUI();
}

// Automatically check Cloud for updates when app opens
fetchCloudData();

async function fetchCloudData() {
    const statusEl = document.getElementById('sync-status');
    try {
        statusEl.innerText = "Syncing with Cloud...";
        const response = await fetch(SCRIPT_URL);
        const cloudRows = await response.json();
        
        // RECONSTRUCT STATE FROM SHEET ROWS
        // Sheet format: [Date, Action, Category, Amount]
        let newTotal = 0;
        let categoryMap = {}; // Temporary map to hold totals per category

        // Skip header row if it exists
        cloudRows.forEach((row, index) => {
            if (index === 0 && isNaN(row[3])) return; 
            
            const action = row[1];
            const catName = row[2];
            const amount = parseFloat(row[3]);

            if (action === "Deposit" || action === "Withdraw") {
                newTotal += amount;
            } else if (action === "Allocate" || action === "De-allocate" || action === "Delete Category") {
                // For categories, we just need to know which categories exist and their current totals
                if (!categoryMap[catName] && action !== "Delete Category") {
                    categoryMap[catName] = 0;
                }
                if (categoryMap[catName] !== undefined) {
                    categoryMap[catName] += amount;
                }
            }
        });

        // Convert map back to state array
        let newCategories = [];
        for (const [name, allocated] of Object.entries(categoryMap)) {
            if (allocated >= 0 || name !== "Main") {
                 newCategories.push({ name, allocated });
            }
        }

        state.total = newTotal;
        state.categories = newCategories;
        
        save(false); // Save to local but don't loop back to cloud
        statusEl.innerText = "Cloud Sync Active";
    } catch (e) {
        console.error("Sync error:", e);
        statusEl.innerText = "Offline Mode";
    }
}

function save(syncToCloud = true) {
    localStorage.setItem('stardew_savings_v2', JSON.stringify(state));
    updateUI();
}

function depositGold() {
    const input = document.getElementById('main-input');
    const amount = parseFloat(input.value);
    if (amount > 0) {
        state.total += amount;
        input.value = '';
        triggerCoinEffect();
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
        trashSound.play();
        sendToSheet("Withdraw", "Main", -amount);
        save();
    } else if (amount > free) {
        alert("Not enough 'Free Gold'!");
    }
}

function createCategory() {
    const input = document.getElementById('cat-name-input');
    const name = input.value.trim();
    if (name) {
        // Only create if it doesn't exist
        if (!state.categories.find(c => c.name === name)) {
            state.categories.push({ name: name, allocated: 0 });
            // Log creation to cloud with 0 amount
            sendToSheet("Allocate", name, 0); 
            chestSound.play();
            save();
        }
        input.value = '';
    }
}

function deleteCategory(index) {
    const catName = state.categories[index].name;
    const amountSaved = state.categories[index].allocated;
    
    if (confirm(`Delete "${catName}"? Gold ($${amountSaved}) returns to Free pool.`)) {
        sendToSheet("Delete Category", catName, -amountSaved);
        state.categories.splice(index, 1);
        trashSound.play();
        save();
    }
}

function allocate(index, amount) {
    const free = calculateFree();
    const catName = state.categories[index].name;

    if (amount > 0 && free >= amount) {
        state.categories[index].allocated += amount;
        triggerCoinEffect();
        sendToSheet("Allocate", catName, amount);
        save();
    } 
    else if (amount < 0 && state.categories[index].allocated >= Math.abs(amount)) {
        state.categories[index].allocated += amount;
        triggerCoinEffect();
        sendToSheet("De-allocate", catName, amount);
        save();
    } else {
        alert("Gold check failed!");
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

function triggerCoinEffect() {
    coinSound.currentTime = 0; 
    coinSound.play();
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
    } catch (e) { console.log("Cloud update failed", e); }
}
