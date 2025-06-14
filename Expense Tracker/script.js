const form = document.getElementById("transaction-form");
const tableBody = document.getElementById("transaction-table");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const balanceEl = document.getElementById("balance");
const monthFilter = document.getElementById("month-filter");
const darkToggle = document.getElementById("darkModeToggle");

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value.trim();

  if (!type || !category || isNaN(amount)) return;

  const transaction = {
    type,
    category,
    amount,
    description,
    date: new Date().toISOString()
  };

  transactions.push(transaction);
  localStorage.setItem("transactions", JSON.stringify(transactions));
  form.reset();
  renderTransactions();
});

monthFilter.addEventListener("change", renderTransactions);

function renderTransactions() {
  const selectedMonth = monthFilter.value;
  tableBody.innerHTML = "";

  let totalIncome = 0;
  let totalExpense = 0;
  let filtered = transactions;

  if (selectedMonth) {
    filtered = transactions.filter(t => t.date.startsWith(selectedMonth));
  }

  filtered.forEach((t, index) => {
    const row = document.createElement("tr");
    const date = new Date(t.date);
    row.innerHTML = `
      <td>${date.toLocaleDateString()}</td>
      <td>${t.type}</td>
      <td>${t.category}</td>
      <td>₹${t.amount.toFixed(2)}</td>
      <td>${t.description}</td>
      <td class="actions">
        <button class="edit" onclick="editTransaction(${index})">Edit</button>
        <button class="delete" onclick="deleteTransaction(${index})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);

    if (t.type === "Income") totalIncome += t.amount;
    else totalExpense += t.amount;
  });

  incomeEl.textContent = totalIncome.toFixed(2);
  expenseEl.textContent = totalExpense.toFixed(2);
  balanceEl.textContent = (totalIncome - totalExpense).toFixed(2);

  renderCharts(filtered);
}

function deleteTransaction(index) {
  if (confirm("Are you sure you want to delete this transaction?")) {
    transactions.splice(index, 1);
    localStorage.setItem("transactions", JSON.stringify(transactions));
    renderTransactions();
  }
}

function editTransaction(index) {
  const t = transactions[index];
  document.getElementById("type").value = t.type;
  document.getElementById("category").value = t.category;
  document.getElementById("amount").value = t.amount;
  document.getElementById("description").value = t.description;

  transactions.splice(index, 1);
  localStorage.setItem("transactions", JSON.stringify(transactions));
  renderTransactions();
}

function renderCharts(data) {
  const monthlyTotals = {};
  const categoryTotals = {};

  data.forEach(t => {
    const month = new Date(t.date).toLocaleString('default', { month: 'short' });
    monthlyTotals[month] = (monthlyTotals[month] || 0) + t.amount;
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const barCtx = document.getElementById("barChart").getContext("2d");
  const pieCtx = document.getElementById("pieChart").getContext("2d");

  if (window.barChart) window.barChart.destroy();
  if (window.pieChart) window.pieChart.destroy();

  window.barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(monthlyTotals),
      datasets: [{
        label: '₹ Amount',
        data: Object.values(monthlyTotals),
        backgroundColor: '#27ae60'
      }]
    }
  });

  window.pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(categoryTotals),
      datasets: [{
        data: Object.values(categoryTotals),
        backgroundColor: ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f', '#2ecc71']
      }]
    }
  });
}

function exportCSV() {
  let csv = "Date,Type,Category,Amount,Description\n";
  transactions.forEach(t => {
    const date = new Date(t.date).toLocaleDateString();
    csv += `${date},${t.type},${t.category},${t.amount},${t.description}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "expense_tracker.csv";
  link.click();
}

// Dark Mode
if (localStorage.getItem("darkMode") === "enabled") {
  document.body.classList.add("dark");
  darkToggle.checked = true;
}

darkToggle.addEventListener("change", () => {
  if (darkToggle.checked) {
    document.body.classList.add("dark");
    localStorage.setItem("darkMode", "enabled");
  } else {
    document.body.classList.remove("dark");
    localStorage.setItem("darkMode", "disabled");
  }
});

renderTransactions();
