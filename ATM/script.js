let currentUser = null;
let users = JSON.parse(localStorage.getItem("atm_users")) || {};

function login() {
  const username = document.getElementById("username-input").value.trim();
  const pin = document.getElementById("pin-input").value.trim();
  const errorText = document.getElementById("login-error");

  if (!username || !pin) {
    errorText.textContent = "Enter username and PIN!";
    return;
  }

  if (!users[username]) {
    // Create new user
    users[username] = {
      pin,
      balance: 1000,
      history: []
    };
    saveUsers();
  }

  if (users[username].pin === pin) {
    currentUser = username;
    errorText.textContent = "";
    document.getElementById("login-page").style.display = "none";
    document.getElementById("atm-page").style.display = "block";
    document.getElementById("user-display").textContent = currentUser;
    updateBalance();
    renderHistory();
  } else {
    errorText.textContent = "Incorrect PIN!";
  }
}

function checkBalance() {
  document.getElementById("atm-message").textContent = `Your balance is ₹${users[currentUser].balance.toFixed(2)}`;
}

function deposit() {
  const amount = parseFloat(document.getElementById("amount").value);
  const message = document.getElementById("atm-message");

  if (amount > 0) {
    users[currentUser].balance += amount;
    addTransaction(`Deposited ₹${amount.toFixed(2)}`);
    updateBalance();
    saveUsers();
    message.style.color = "#00ff88";
    message.textContent = `₹${amount.toFixed(2)} deposited successfully!`;
  } else {
    message.style.color = "#ff4444";
    message.textContent = "Enter a valid amount!";
  }
}

function withdraw() {
  const amount = parseFloat(document.getElementById("amount").value);
  const message = document.getElementById("atm-message");

  if (amount > 0 && amount <= users[currentUser].balance) {
    users[currentUser].balance -= amount;
    addTransaction(`Withdrew ₹${amount.toFixed(2)}`);
    updateBalance();
    saveUsers();
    message.style.color = "#00ff88";
    message.textContent = `₹${amount.toFixed(2)} withdrawn successfully!`;
  } else {
    message.style.color = "#ff4444";
    message.textContent = "Invalid amount or insufficient balance!";
  }
}

function logout() {
  currentUser = null;
  document.getElementById("login-page").style.display = "block";
  document.getElementById("atm-page").style.display = "none";
  document.getElementById("username-input").value = "";
  document.getElementById("pin-input").value = "";
  document.getElementById("atm-message").textContent = "";
  document.getElementById("history-list").innerHTML = "";
}

function updateBalance() {
  document.getElementById("balance").textContent = users[currentUser].balance.toFixed(2);
}

function addTransaction(text) {
  users[currentUser].history.push(`${new Date().toLocaleString()}: ${text}`);
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";
  const history = users[currentUser].history.slice().reverse();
  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
}

function saveUsers() {
  localStorage.setItem("atm_users", JSON.stringify(users));
}
