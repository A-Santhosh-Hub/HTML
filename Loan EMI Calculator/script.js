let chart;

function calculateEMI() {
  const principal = parseFloat(document.getElementById('loanAmount').value);
  const annualRate = parseFloat(document.getElementById('interestRate').value);
  const years = parseInt(document.getElementById('duration').value);

  if (isNaN(principal) || isNaN(annualRate) || isNaN(years)) {
    alert("Please enter valid input values!");
    return;
  }

  const monthlyRate = annualRate / 12 / 100;
  const months = years * 12;

  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
              (Math.pow(1 + monthlyRate, months) - 1);

  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;

  document.getElementById('emi').innerText = emi.toFixed(2);
  document.getElementById('totalPayment').innerText = totalPayment.toFixed(2);
  document.getElementById('totalInterest').innerText = totalInterest.toFixed(2);

  showPieChart(principal, totalInterest);
  showAmortizationTable(principal, monthlyRate, months, emi);

  // Save inputs to localStorage
  localStorage.setItem("loanAmount", principal);
  localStorage.setItem("interestRate", annualRate);
  localStorage.setItem("duration", years);
}

function showPieChart(principal, interest) {
  const ctx = document.getElementById('pieChart').getContext('2d');

  if (chart) chart.destroy(); // Reset previous chart

  chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Principal', 'Interest'],
      datasets: [{
        data: [principal, interest],
        backgroundColor: ['#4caf50', '#f44336'],
      }]
    }
  });
}

function showAmortizationTable(principal, monthlyRate, months, emi) {
  const tbody = document.querySelector("#amortizationTable tbody");
  tbody.innerHTML = "";

  let balance = principal;

  for (let i = 1; i <= months; i++) {
    const interest = balance * monthlyRate;
    const principalPart = emi - interest;
    balance -= principalPart;
    if (balance < 0.01) balance = 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i}</td>
      <td>₹${principalPart.toFixed(2)}</td>
      <td>₹${interest.toFixed(2)}</td>
      <td>₹${balance.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  }
}

// Dark mode toggle
const darkToggle = document.getElementById("darkModeToggle");

darkToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark", darkToggle.checked);
  localStorage.setItem("darkMode", darkToggle.checked);
});

// Load saved theme & inputs on load
window.addEventListener("load", () => {
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    darkToggle.checked = true;
  }

  document.getElementById("loanAmount").value = localStorage.getItem("loanAmount") || "";
  document.getElementById("interestRate").value = localStorage.getItem("interestRate") || "";
  document.getElementById("duration").value = localStorage.getItem("duration") || "";
});

// Export to PDF
document.getElementById("exportBtn").addEventListener("click", () => {
  const result = document.querySelector(".container");
  html2pdf().from(result).save("loan-emi-result.pdf");
});
