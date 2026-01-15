'use strict';

const YEARS = 30;
const MONTHS = YEARS * 12;

const $ = id => document.getElementById(id);
const pct = x => Number(x) / 100;
const mRate = r => Math.pow(1 + r, 1 / 12) - 1;

let chart;

function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(n / 1_000)}K`;
}

function pmt(p, r, m) {
  const mr = r / 12;
  return p * (mr / (1 - Math.pow(1 + mr, -m)));
}

function run() {
  const hv = +$('homeValue').value;
  const lb = +$('loanBalance').value;
  const rent0 = +$('monthlyRent').value;
  const rate = pct($('currRate').value);
  const taxes0 = +$('taxesMonthly').value;
  const ins0 = +$('insMonthly').value;

  const market = 0.07;
  const appreciation = 0.03;
  const inflation = 0.03;

  const mortgage = pmt(lb, rate, 360);

  // --- YEAR 0 ---
  let sellStocks = hv - lb;
  let rentStocks = 0;
  let homeValue = hv;
  let loan = lb;

  const sell = {};
  const rent = {};

  sell[0] = { stocks: sellStocks, equity: 0 };
  rent[0] = { stocks: 0, equity: hv - lb };

  let rentCash = rent0;
  let taxes = taxes0;
  let ins = ins0;

  for (let m = 1; m <= MONTHS; m++) {
    sellStocks *= 1 + mRate(market);
    rentStocks *= 1 + mRate(market);
    homeValue *= 1 + mRate(appreciation);

    rentCash *= 1 + mRate(inflation);
    taxes *= 1 + mRate(inflation);
    ins *= 1 + mRate(inflation);

    if (loan > 0) {
      const interest = loan * rate / 12;
      loan = Math.max(0, loan - (mortgage - interest));
    }

    const netCF = rentCash - mortgage - taxes - ins;

    if (netCF > 0) rentStocks += netCF;
    else sellStocks += -netCF;

    if (m % 12 === 0) {
      const y = m / 12;
      sell[y] = { stocks: sellStocks, equity: 0 };
      rent[y] = { stocks: rentStocks, equity: homeValue - loan };
    }
  }

  $('cardResults').classList.remove('hidden');
  $('cardTable').classList.remove('hidden');

  const sell30 = sell[30].stocks;
  const rent30 = rent[30].stocks + rent[30].equity;

  $('resultsSummary').innerHTML = `
    <li><strong>Net Worth (Year 30):</strong>
      ${rent30 > sell30 ? 'RENT' : 'SELL'} wins —
      ${fmt(Math.max(sell30, rent30))} vs ${fmt(Math.min(sell30, rent30))}
    </li>
  `;

  const tbody = $('summaryTable');
  tbody.innerHTML = '';

  [0, 1, 5, 10, 30].forEach(y => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${y}</td>
        <td><strong>${fmt(sell[y].stocks)}</strong>
          (${fmt(sell[y].stocks)} stocks)
        </td>
        <td><strong>${fmt(rent[y].stocks + rent[y].equity)}</strong>
          (${fmt(rent[y].stocks)} stocks, ${fmt(rent[y].equity)} home equity)
        </td>
      </tr>
    `);
  });

  $('assumptionNote').innerHTML = `
    <li>Market return: 7%</li>
    <li>Home appreciation: 3%</li>
    <li>Inflation / rent growth: 3%</li>
  `;

  if (chart) chart.destroy();

  chart = new Chart($('nwChart'), {
    type: 'line',
    data: {
      labels: Array.from({ length: 31 }, (_, i) => i),
      datasets: [
        {
          label: 'SELL',
          data: Object.values(sell).map(v => v.stocks),
          borderWidth: 2
        },
        {
          label: 'RENT',
          data: Object.values(rent).map(v => v.stocks + v.equity),
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}`
          }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('btnRun').onclick = run;
  $('btnReset').onclick = () => location.reload();
});
