function runModel() {
  const years = 30;

  const homeValue0 = num("homeValue");
  const loanBalance = num("loanBalance");
  const mortgageRate = num("mortgageRate") / 100;
  const monthlyRent = num("monthlyRent");
  const monthlyTaxes = num("monthlyTaxes");
  const monthlyInsurance = num("monthlyInsurance");

  const homeAppreciation = num("homeAppreciation", 3) / 100;
  const rentGrowth = num("rentGrowth", 3) / 100;
  const maintenanceRate = num("maintenanceRate", 1) / 100;
  const vacancyRate = num("vacancyRate", 5) / 100;
  const managementRate = num("managementRate", 0) / 100;
  const sellingCosts = num("sellingCosts", 6) / 100;
  const stockReturn = num("stockReturn", 7) / 100;

  const loanEnd = document.getElementById("loanEndDate").value;
  const now = new Date();
  const end = new Date(loanEnd + "-01");
  const remainingMonths = Math.max(1,
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth())
  );

  // Monthly mortgage payment (remaining balance amortization)
  const r = mortgageRate / 12;
  const monthlyPI =
    loanBalance * (r * Math.pow(1 + r, remainingMonths)) /
    (Math.pow(1 + r, remainingMonths) - 1);

  const monthlyMortgage = monthlyPI + monthlyTaxes + monthlyInsurance;

  let sellStocks = [];
  let rentStocks = [];
  let rentEquity = [];

  let sellStockBalance = homeValue0 * (1 - sellingCosts) - loanBalance;
  let rentStockBalance = 0;
  let homeValue = homeValue0;

  for (let y = 0; y <= years; y++) {
    // SELL scenario
    if (y > 0) {
      sellStockBalance *= (1 + stockReturn);
      sellStockBalance += (monthlyMortgage * 12); // avoided payment invested
    }
    sellStocks.push(sellStockBalance);

    // RENT scenario
    const grossRent = monthlyRent * Math.pow(1 + rentGrowth, y) * 12;
    const netRent =
      grossRent *
      (1 - vacancyRate - managementRate) -
      homeValue * maintenanceRate;

    if (y > 0) {
      rentStockBalance = rentStockBalance * (1 + stockReturn) + netRent;
      homeValue *= (1 + homeAppreciation);
    }

    rentStocks.push(rentStockBalance);
    rentEquity.push(homeValue);
  }

  renderResults(
    sellStocks,
    rentStocks,
    rentEquity,
    monthlyMortgage,
    monthlyRent
  );
}

function renderResults(sell, rentStocks, rentEquity, mortgage, rent) {
  const tbody = document.querySelector("#resultsTable tbody");
  tbody.innerHTML = "";

  for (let y = 0; y <= 30; y++) {
    const sellNW = sell[y];
    const rentNW = rentStocks[y] + rentEquity[y];

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>
        <strong>${fmt(sellNW)}</strong><br/>
        (${fmt(sell[y])} stocks)
      </td>
      <td>
        <strong>${fmt(rentNW)}</strong><br/>
        (${fmt(rentStocks[y])} stocks, ${fmt(rentEquity[y])} home)
      </td>
    `;
    tbody.appendChild(tr);
  }

  const summary = document.getElementById("resultsSummary");
  summary.innerHTML = "";

  const better =
    sell[30] > rentStocks[30] + rentEquity[30] ? "SELL" : "RENT";
  const diff = Math.abs(
    sell[30] - (rentStocks[30] + rentEquity[30])
  );

  summary.innerHTML = `
    <li><strong>Net Worth (Year 30):</strong> ${better} results in a higher net worth
      (${fmt(better === "SELL" ? sell[30] : rentStocks[30] + rentEquity[30])})
      vs. ${better === "SELL" ? "RENT" : "SELL"}
      (${fmt(better === "SELL" ? rentStocks[30] + rentEquity[30] : sell[30])})
      (+${fmt(diff)} difference)
    </li>
    <li><strong>Rental Cash Flow:</strong> Monthly rent assumed at ${fmt(rent)}
      per month. Net rental cash flow is invested in stocks in RENT scenario.
      Avoided mortgage payments are invested in stocks in SELL scenario.
    </li>
  `;

  document.getElementById("assumptionsList").innerHTML = `
    <li>Current mortgage payment assumed: ${fmt(mortgage * 12)} / year</li>
    <li>Includes principal, interest, taxes, and insurance</li>
  `;
}

function num(id, fallback = 0) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? fallback : v;
}

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(n / 1000)}K`;
}
