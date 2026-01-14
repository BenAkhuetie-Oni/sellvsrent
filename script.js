const YEARS = 30;
let chart = null;

const $ = id => document.getElementById(id);
const num = id => {
  const v = $(id)?.value;
  return v === "" || v == null ? NaN : Number(v);
};

const pct = v => (Number.isFinite(v) ? v / 100 : 0);

function toggleOptional() {
  $("optionalBody").classList.toggle("open");
  document.querySelector(".chev").textContent =
    $("optionalBody").classList.contains("open") ? "▴" : "▾";
}

function money(n) {
  return "$" + Math.round(n).toLocaleString();
}

function run() {
  const homeValue = num("homeValue");
  const loanBalance = num("loanBalance");
  const rentMonthly = num("rentMonthly");

  if (![homeValue, loanBalance, rentMonthly].every(Number.isFinite)) {
    alert("Please fill required inputs.");
    return;
  }

  const marketReturn = pct(num("marketReturn") || 7);
  const appreciation = pct(num("homeAppreciation") || 3);

  const sellNW = [];
  const rentNW = [];

  let sellStocks = homeValue - loanBalance;
  let rentStocks = 0;
  let homeVal = homeValue;

  for (let y = 0; y <= YEARS; y++) {
    if (y > 0) {
      sellStocks *= 1 + marketReturn;
      rentStocks *= 1 + marketReturn;
      homeVal *= 1 + appreciation;
      rentStocks += rentMonthly * 12 * 0.2; // simplified CF proxy
    }

    sellNW.push(sellStocks);
    rentNW.push(rentStocks + homeVal - loanBalance);
  }

  renderChart(sellNW, rentNW);
  renderSummary(sellNW, rentNW);
  renderTable(sellNW, rentNW);

  $("cardSummary").style.display = "";
  $("cardResults").style.display = "";
  $("cardTable").style.display = "";
}

function renderChart(sell, rent) {
  const ctx = $("nwChart").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: sell.length }, (_, i) => i),
      datasets: [
        { label: "SELL", data: sell, borderWidth: 2 },
        { label: "RENT", data: rent, borderWidth: 2 }
      ]
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${money(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: v => "$" + (v / 1000).toFixed(0) + "k"
          }
        }
      }
    }
  });
}

function renderSummary(sell, rent) {
  const y30Sell = sell[30];
  const y30Rent = rent[30];
  const winner = y30Sell > y30Rent ? "SELL" : "RENT";

  $("resultsSummary").innerHTML = `
    <li><strong>${winner}</strong> results in a higher net worth at Year 30.</li>
    <li>SELL: ${money(y30Sell)}</li>
    <li>RENT: ${money(y30Rent)}</li>
  `;
}

function renderTable(sell, rent) {
  const tbody = $("summaryTable");
  tbody.innerHTML = "";

  [0, 1, 5, 10, 20, 30].forEach(y => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>${money(sell[y])}</td>
      <td>${money(rent[y])}</td>
    `;
    tbody.appendChild(tr);
  });
}

function resetAll() {
  $("cardSummary").style.display = "none";
  $("cardResults").style.display = "none";
  $("cardTable").style.display = "none";
  if (chart) chart.destroy();
}

function init() {
  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("toggleOptional").addEventListener("click", toggleOptional);
  $("yearNow").textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", init);
