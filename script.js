const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvl2g3B4PNAl0IRT5j5Sa6AxDBAO61T3pv63a7R1E9Ajkc0tf6j-9zcdccrJFcGHTLog/exec';

// SETUP THE SOUNDS
const dialSound = new Audio('moneyDial.wav'); 
const coinSound = new Audio('coin.wav'); 
const chestSound = new Audio('openChest.wav');
const trashSound = new Audio('trashcan.wav');
const stardropSound = new Audio('stardrop.wav');

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
            } else if (action === "Allocate" || action === "De-allocate" || action === "Delete Category" || action === "Set Goal") {
                if (!categoryMap[catName]) {
                    categoryMap[catName] = { allocated: 0, goal: 0 };
                }
                
                if (action === "Set Goal") {
                    categoryMap[catName].goal = amount;
                } else {
                    categoryMap[catName].allocated += amount;
                }
            }
        });

        let newCategories = [];
        for (const [name, data] of Object.entries(categoryMap)) {
            if (name !== "Main" && data.allocated > 0) {
                 newCategories.push({ name, allocated: data.allocated, goal: data.goal });
            }
        }

        state.total = newTotal;
        state.categories = newCategories;
        
        localStorage.setItem('stardew_savings_v2', JSON.stringify(state));
        updateUI();
        statusEl.innerText = "Cloud Sync Active";
    } catch (e) {
        statusEl.innerText = "Offline Mode";
    }
}

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
        dialSound.currentTime = 0;
        dialSound.play();
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
        dialSound.play();
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
        if (!state.categories.find(c => c.name === name)) {
            let goalAmount = 0;
            const hasGoal = confirm(`Would you like to set a savings goal for "${name}"?`);
            
            if (hasGoal) {
                const goalInput = prompt("Enter the goal amount:");
                goalAmount = parseFloat(goalInput) || 0;
            }

            state.categories.push({ name: name, allocated: 0.01, goal: goalAmount });
            
            sendToSheet("Allocate", name, 0.01); 
            if (goalAmount > 0) {
                sendToSheet("Set Goal", name, goalAmount);
            }

            chestSound.play();
            save();
        }
        input.value = '';
    }
}

function deleteCategory(index) {
    const cat = state.categories[index];
    if (confirm(`Delete "${cat.name}"? Gold ($${Math.floor(cat.allocated)}) returns to Free pool.`)) {
        sendToSheet("Delete Category", cat.name, -cat.allocated);
        state.categories.splice(index, 1);
        trashSound.play();
        save();
    }
}

function allocate(index, amount) {
    const free = calculateFree();
    const cat = state.categories[index];
    const prevAllocated = cat.allocated;

    if (amount > 0 && free >= amount) {
        cat.allocated += amount;
        
        if (cat.goal > 0 && prevAllocated < cat.goal && cat.allocated >= cat.goal) {
            stardropSound.play();
            alert(`Congratulations! You completed saving up for ${cat.name.toUpperCase()}!`);
        } else {
            coinSound.currentTime = 0;
            coinSound.play();
        }

        sendToSheet("Allocate", cat.name, amount);
        save();
    } 
    else if (amount < 0 && cat.allocated >= Math.abs(amount)) {
        cat.allocated += amount;
        coinSound.currentTime = 0;
        coinSound.play();
        sendToSheet("De-allocate", cat.name, amount);
        save();
    } else {
        alert("Gold check failed!");
    }
}

// --- UPDATED MATH HERE ---
function calculateFree() {
    // Math.floor(cat.allocated) ensures the 0.01 is ignored for the total
    const used = state.categories.reduce((sum, cat) => sum + Math.floor(cat.allocated), 0);
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
        
        let progressText = `Saved: $${Math.floor(cat.allocated)}`;
        if (cat.goal > 0) {
            progressText = `Progress: $${Math.floor(cat.allocated)} / $${cat.goal}`;
        }

        const amounts = [1, 5, 10, 25, 50];
        const addButtons = amounts.map(amt => `<button onclick="allocate(${i}, ${amt})">+${amt}</button>`).join('');
        const subButtons = amounts.map(amt => `<button class="remove" onclick="allocate(${i}, -${amt})">-${amt}</button>`).join('');

        div.innerHTML = `
            <button class="delete-btn" onclick="deleteCategory(${i})">X</button>
            <h3>${cat.name.toUpperCase()}</h3>
            <p class="stat-text">${progressText}</p>
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
