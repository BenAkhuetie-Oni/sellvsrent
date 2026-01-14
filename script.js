let chart;

function monthlyPI(balance, rate, months) {
  const r = rate / 100 / 12;
  return balance * r / (1 - Math.pow(1 + r, -months));
}

function run() {
  const years = 30;

  const homeValue = +homeValueInput();
  const loanBalance = +loanBalanceInput();
  const rent = +monthlyRentInput();
  const rate = +interestRateInput();
  const taxes = +monthlyTaxesInput();
  const insurance = +monthlyInsuranceInput();

  const marketReturn = +marketReturnInput() / 100;
  const appreciation = +homeAppreciationInput() / 100;
  const rentGrowth = +rentGrowthInput() / 100;
  const saleCost = +saleCostsInput() / 100;

  const vacancy = +vacancyRateInput() / 100;
  const maint = +maintenanceRateInput() / 100;
  const capex = +capexRateInput() / 100;
  const pm = +pmRateInput() / 100;
  const rentalTax = +rentalTaxRateInput() / 100;

  const monthsRemaining = 360;
  const pi = overridePIInput() || monthlyPI(loanBalance, rate, monthsRemaining);

  let sellNW = [];
  let rentNW = [];
  let rentCashFlows = [];

  let sellInvest = (homeValue - loanBalance) * (1 - saleCost);
  let rentInvest = sellInvest;
  let homeEquity = homeValue - loanBalance;

  for (let y = 0; y <= years; y++) {
    sellNW.push(sellInvest);
    rentNW.push(rentInvest + homeEquity);

    if (y < years) {
      sellInvest *= (1 + marketReturn);

      const grossRent = rent * 12 * Math.pow(1 + rentGrowth, y);
      const expenses = grossRent * (vacancy + maint + capex + pm) + (taxes + insurance + pi) * 12;
      let cashFlow = grossRent - expenses;

      rentCashFlows.push(cashFlow);

      if (cashFlow > 0) {
        rentInvest += cashFlow * (1 - rentalTax);
      } else {
        sellInvest += -cashFlow;
      }

      rentInvest *= (1 + marketReturn);
      homeEquity *= (1 + appreciation);
    }
  }

  renderChart(sellNW, rentNW);
  renderSummary(sellNW, rentNW, rentCashFlows);
  renderTable(sellNW, rentNW);
}

function renderChart(sell, rent) {
  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('chart'), {
    type: 'line',
    data: {
      labels: sell.map((_, i) => i),
      datasets: [
        { label: 'SELL', data: sell, borderColor: '#2f6f4e' },
        { label: 'RENT', data: rent, borderColor: '#e85d75' }
      ]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: $${Math.round(ctx.parsed.y / 1000)}K`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: v => `$${v/1000}K`
          }
        }
      }
    }
  });
}

function renderSummary(sell, rent, cashFlows) {
  const y30Sell = sell[30];
  const y30Rent = rent[30];
  const winner = y30Sell > y30Rent ? 'SELL' : 'RENT';

  document.getElementById('winnerBox').textContent =
    `Net Worth Winner (Year 30): ${winner}`;

  const bullets = document.getElementById('summaryBullets');
  bullets.innerHTML = '';

  bullets.innerHTML += `<li>Net Worth (Year 30): ${winner} ($${Math.round(Math.max(y30Sell,y30Rent)/1000)}K) results in a higher net worth vs. ${winner==='SELL'?'RENT':'SELL'} ($${Math.round(Math.min(y30Sell,y30Rent)/1000)}K).</li>`;

  const firstCF = cashFlows[0] / 12;
  if (firstCF < 0) {
    const breakEven = cashFlows.findIndex(v => v > 0);
    bullets.innerHTML += `<li>Rental Cash Flow: RENT results in negative cash flow (${Math.round(firstCF/1000)}K/month at Y0) until breaking even at Year ${breakEven}.</li>`;
  } else {
    bullets.innerHTML += `<li>Rental Cash Flow: RENT results in positive cash flow (+${Math.round(firstCF/1000)}K/month at Y0).</li>`;
  }

  document.getElementById('assumptionBullets').innerHTML = `
    <li>Market return: ${marketReturnInput()}%</li>
    <li>Home appreciation: ${homeAppreciationInput()}%</li>
    <li>Rent growth: ${rentGrowthInput()}%</li>
    <li>Sale closing costs: ${saleCostsInput()}%</li>
  `;
}

function renderTable(sell, rent) {
  const rows = [0,1,5,10,30];
  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = '';

  rows.forEach(y => {
    tbody.innerHTML += `
      <tr>
        <td>${y}</td>
        <td><strong>$${Math.round(sell[y]/1000)}K</strong> ($${Math.round(sell[y]/1000)}K stocks)</td>
        <td><strong>$${Math.round(rent[y]/1000)}K</strong> ($${Math.round(rent[y]/1000)}K total)</td>
      </tr>
    `;
  });
}

/* Helpers */
const q = id => document.getElementById(id).value;
const homeValueInput = () => q('homeValue');
const loanBalanceInput = () => q('loanBalance');
const monthlyRentInput = () => q('monthlyRent');
const interestRateInput = () => q('interestRate');
const monthlyTaxesInput = () => q('monthlyTaxes');
const monthlyInsuranceInput = () => q('monthlyInsurance');
const marketReturnInput = () => q('marketReturn');
const homeAppreciationInput = () => q('homeAppreciation');
const rentGrowthInput = () => q('rentGrowth');
const saleCostsInput = () => q('saleCosts');
const vacancyRateInput = () => q('vacancyRate');
const maintenanceRateInput = () => q('maintenanceRate');
const capexRateInput = () => q('capexRate');
const pmRateInput = () => q('pmRate');
const rentalTaxRateInput = () => q('rentalTaxRate');
const overridePIInput = () => +q('overridePI') || 0;

function resetAll() { location.reload(); }
