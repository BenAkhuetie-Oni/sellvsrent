const $ = id => document.getElementById(id);

let chart;

function monthsRemaining(end) {
  const now = new Date();
  const endDate = new Date(end + "-01");
  return Math.max(
    1,
    (endDate.getFullYear() - now.getFullYear()) * 12 +
    (endDate.getMonth() - now.getMonth())
  );
}

function mortgagePayment(balance, rate, months) {
  const r = rate / 100 / 12;
  return balance * r / (1 - Math.pow(1 + r, -months));
}

function formatK(n) {
  return "$" + (n / 1000).toFixed(0) + "K";
}

$("runBtn").onclick = () => {
  const home = +$("homeValue").value || +$("homeValue").placeholder;
  const balance = +$("loanBalance").value || +$("loanBalance").placeholder;
  const rent = +$("rent").value || +$("rent").placeholder;
  const rate = +$("rate").value || +$("rate").placeholder;
  const taxes = +$("taxes").value || +$("taxes").placeholder;
  const insurance = +$("insurance").value || +$("insurance").placeholder;
  const end = $("loanEnd").value;

  const market = (+$("marketReturn").value || 7) / 100;
  const appreciation = (+$("appreciation").value || 3) / 100;
  const rentGrowth = (+$("rentGrowth").value || 3) / 100;

  const months = monthsRemaining(end);
  const pi = mortgagePayment(balance, rate, months);
  const piti = pi + taxes + insurance;

  const years = 30;
  let sellStocks = 0;
  let rentStocks = 0;
  let rentValue = home;

  const sellNW = [];
  const rentNW = [];

  let netRentalCF = 0;
  let breakevenYear = null;

  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      sellStocks = (sellStocks + (piti * 12)) * (1 + market);
      rentStocks = (rentStocks + (rent * 12 - piti * 12)) * (1 + market);
      rentValue *= 1 + appreciation;
      rent *= 1 + rentGrowth;
    }

    const cf = rent - piti;
    netRentalCF += cf * 12;
    if (cf >= 0 && breakevenYear === null) breakevenYear = y;

    sellNW.push(sellStocks);
    rentNW.push(rentStocks + rentValue);
  }

  // Summary bullets
  $("summary").innerHTML = `
    <li><strong>Net Worth (Year 30):</strong>
      ${rentNW[30] > sellNW[30] ? "RENT" : "SELL"}
      (${formatK(Math.max(rentNW[30], sellNW[30]))})
      results in a higher net worth vs.
      ${rentNW[30] > sellNW[30] ? "SELL" : "RENT"}
      (${formatK(Math.min(rentNW[30], sellNW[30]))})
      (+${formatK(Math.abs(rentNW[30] - sellNW[30]))} difference)
    </li>
    <li><strong>Rental Cash Flow:</strong>
      ${netRentalCF < 0
        ? `RENT results in negative cash flow (${formatK((rent - piti) * 12)}/month at Y0)
           until breaking even at Year ${breakevenYear}
           (Net Rental Cash Flow, Y0–Y30: ${formatK(netRentalCF)}).
           Negative cash flow is accounted for in SELL as “Avoided Negative Cash Flow”
           invested in stocks.`
        : `RENT results in positive cash flow (${formatK((rent - piti) * 12)}/month at Y0;
           Net Rental Cash Flow, Y0–Y30: ${formatK(netRentalCF)}).
           RENT assumes positive cash flow is invested in stocks.`}
    </li>
  `;

  // Table
  const rows = [0, 1, 5, 10, 30];
  $("tableBody").innerHTML = rows.map(y => `
    <tr>
      <td>${y}</td>
      <td><strong>${formatK(sellNW[y])}</strong><br/>(${formatK(sellNW[y])} stocks)</td>
      <td><strong>${formatK(rentNW[y])}</strong><br/>
        (${formatK(rentStocks)} stocks, ${formatK(rentValue)} home equity)
      </td>
    </tr>
  `).join("");

  // Assumptions
  $("assumptionsList").innerHTML = `
    <li>Market return: 7%</li>
    <li>Home appreciation: 3%</li>
    <li>Inflation / rent growth: 3% annually</li>
    <li>Rental costs: 5% vacancy, 5% maintenance, 5% CapEx, 0% management</li>
    <li><strong>Current Mortgage Payment (Assumed):</strong>
      ${formatK(piti * 12 / 12)} / month
      (${formatK(pi * 12 / 12)} principal & interest,
       ${formatK(taxes * 12 / 12)} taxes,
       ${formatK(insurance * 12 / 12)} insurance)
    </li>
  `;

  if (chart) chart.destroy();
  chart = new Chart($("chart"), {
    type: "line",
    data: {
      labels: Array.from({length: years + 1}, (_, i) => i),
      datasets: [
        { label: "SELL", data: sellNW, borderColor: "#4da3ff", fill: false },
        { label: "RENT", data: rentNW, borderColor: "#ff6b8a", fill: false }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: { y: { ticks: { callback: v => "$" + (v/1000) + "K" } } }
    }
  });
};

$("resetBtn").onclick = () => location.reload();
