const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvl2g3B4PNAl0IRT5j5Sa6AxDBAO61T3pv63a7R1E9Ajkc0tf6j-9zcdccrJFcGHTLog/exec';

// SETUP THE SOUNDS
const dialSound = new Audio('moneyDial.wav'); 
const coinSound = new Audio('coin.wav'); 
const chestSound = new Audio('openChest.wav');
const trashSound = new Audio('trashcan.wav');

let state = {
    total: 0,
    categories: []
};

// INITIAL LOAD
const localData = localStorage.getItem('stardew_savings_v2');
if (localData) {
    state = JSON.parse(localData);
    updateUI();
}

fetchCloudData();

async function fetchCloudData() {
    const statusEl = document.getElementById('sync-status');
    try {
        statusEl.innerText = "Syncing with Cloud...";
        const response = await fetch(SCRIPT_URL);
        const cloudRows = await response.json();
        
        let newTotal = 0;
        let categoryMap = {};

        cloudRows.forEach((row, index) => {
            if (index === 0 && isNaN(row[3])) return; 
            const action = row[1];
            const catName = row[2];
            const amount = parseFloat(row[3]);

            if (action === "Deposit" || action === "Withdraw") {
                newTotal += amount;
            } else if (action === "Allocate" || action === "De-allocate" || action === "Delete Category") {
                if (!categoryMap[catName] && action !== "Delete Category") {
                    categoryMap[catName] = 0;
                }
                if (categoryMap[catName] !== undefined) {
                    categoryMap[catName] += amount;
                }
            }
        });

        let newCategories = [];
        for (const [name, allocated] of Object.entries(categoryMap)) {
            newCategories.push({ name, allocated });
        }

        state.total = newTotal;
        state.categories = newCategories;
        save(false);
        statusEl.innerText = "Cloud Sync Active";
    } catch (e) {
        statusEl.innerText = "Offline Mode";
    }
}

function save() {
    localStorage.setItem('stardew_savings_v2', JSON.stringify(state));
    updateUI();
}

// MAIN ACTIONS (Play moneyDial.wav)
function depositGold() {
    const input = document.getElementById('main-input');
    const amount = parseFloat(input.value);
    if (amount > 0) {
        state.total += amount;
        input.value = '';
        dialSound.currentTime = 0;
        dialSound.play(); // PLAY DIAL SOUND
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
        dialSound.currentTime = 0;
        dialSound.play(); // PLAY DIAL SOUND
        sendToSheet("Withdraw", "Main", -amount);
        save();
    } else if (amount > free) {
        alert("Not enough 'Free Gold'!");
    }
}

// CATEGORY ACTIONS (Keep specific sounds)
function createCategory() {
    const input = document.getElementById('cat-name-input');
    const name = input.value.trim();
    if (name) {
        if (!state.categories.find(c => c.name === name)) {
            state.categories.push({ name: name, allocated: 0 });
            sendToSheet("Allocate", name, 0); 
            chestSound.play(); // PLAY CHEST SOUND
            save();
        }
        input.value = '';
    }
}

function deleteCategory(index) {
    const catName = state.categories[index].name;
    const amountSaved = state.categories[index].allocated;
    if (confirm(`Delete "${catName}"?`)) {
        sendToSheet("Delete Category", catName, -amountSaved);
        state.categories.splice(index, 1);
        trashSound.play(); // PLAY TRASH SOUND
        save();
    }
}

function allocate(index, amount) {
    const free = calculateFree();
    if (amount > 0 && free >= amount) {
        state.categories[index].allocated += amount;
        coinSound.currentTime = 0;
        coinSound.play(); // PLAY COIN SOUND
        sendToSheet("Allocate", state.categories[index].name, amount);
        save();
    } 
    else if (amount < 0 && state.categories[index].allocated >= Math.abs(amount)) {
        state.categories[index].allocated += amount;
        coinSound.currentTime = 0;
        coinSound.play(); // PLAY COIN SOUND
        sendToSheet("De-allocate", state.categories[index].name, amount);
        save();
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
            <div class="button-grid">${addButtons}</div>
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
    } catch (e) { console.log("Sync failed", e); }
}
