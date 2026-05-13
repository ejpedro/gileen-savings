const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkoPiBQT342QDfsOiltj9G6xg97Umt83hmiVCBJotl8gxMSd0qXrTEHw4qao51dvPPdQ/exec';

// 1. LOAD DATA ON STARTUP
let state = JSON.parse(localStorage.getItem('stardew_savings')) || {
    total: 0,
    categories: [] 
};

// Initialize the app
window.onload = () => {
    updateUI();
};

function saveToLocalStorage() {
    localStorage.setItem('stardew_savings', JSON.stringify(state));
}

// 2. DEPOSIT LOGIC
function depositGold() {
    const input = document.getElementById('gold-input');
    const amount = parseFloat(input.value);

    if (amount > 0) {
        state.total += amount;
        updateUI();
        sendToSheet("Deposit", "Main", amount);
        input.value = '';
        saveToLocalStorage(); // Persist!
    }
}

// 3. CATEGORY LOGIC
function addNewCategory() {
    const nameInput = document.getElementById('new-cat-name');
    const name = nameInput.value.trim();
    
    if (name) {
        state.categories.push({ name: name, allocated: 0 });
        nameInput.value = '';
        updateUI();
        saveToLocalStorage();
    }
}

function allocateToCategory(index, amount) {
    let freeMoney = calculateFreeMoney();
    if (freeMoney >= amount) {
        state.categories[index].allocated += amount;
        updateUI();
        saveToLocalStorage();
        sendToSheet("Allocate", state.categories[index].name, amount);
    } else {
        alert("Not enough unallocated gold!");
    }
}

// 4. THE CALCULATION ENGINE (Fixes the "Not Updating" issue)
function calculateFreeMoney() {
    const totalAllocated = state.categories.reduce((sum, cat) => sum + cat.allocated, 0);
    return state.total - totalAllocated;
}

function updateUI() {
    // Update Top Numbers
    document.getElementById('total-gold').innerText = `$${state.total.toLocaleString()}`;
    const free = calculateFreeMoney();
    document.getElementById('free-money').innerText = `$${free.toLocaleString()}`;

    // Update Category List
    const list = document.getElementById('category-list');
    list.innerHTML = ''; // Clear current list

    state.categories.forEach((cat, index) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'category-card';
        catDiv.innerHTML = `
            <h3>${cat.name}</h3>
            <p>Saved: $${cat.allocated}</p>
            <button onclick="allocateToCategory(${index}, 10)">+ $10</button>
            <button onclick="allocateToCategory(${index}, 50)">+ $50</button>
        `;
        list.appendChild(catDiv);
    });
}

// 5. SEND TO GOOGLE SHEETS
async function sendToSheet(action, category, amount) {
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action, category, amount })
        });
    } catch (e) {
        console.error("Sheet Sync Failed", e);
    }
}
