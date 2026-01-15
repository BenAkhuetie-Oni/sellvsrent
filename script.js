'use strict';

const YEARS = 30;
const MONTHS = YEARS * 12;
const $ = id => document.getElementById(id);
const pct = x => Number(x || 0) / 100;
const mRate = a => Math.pow(1 + a, 1 / 12) - 1;

function fmt(n) {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return Math.round(n / 1e3) + 'K';
}

function pmt(principal, rate, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = rate / 12;
  return principal * (r / (1 - Math.pow(1 + r, -months)));
}

function run() {
  const homeValue = +$('homeValue').value;
  const loanBalance = +$('loanBalance').value;
  const rentStart = +$('monthlyRent').value;

  const rate = pct($('currRate').value);
  const taxes0 = +$('taxesMonthly').value;
  const ins0 = +$('insMonthly').value;

  const loanEnd = new Date($('loanEnd').value + '-01');
  const monthsLeft = Math.max(1, (loanEnd - new Date()) / 2628e6);
  const mortgage = pmt(loanBalance, rate, monthsLeft);

  const market = pct($('marketReturn').value);
  const appreciation = pct($('homeAppreciation').value);
  const inflation = pct($('inflation').value);
  const vacancy = pct($('vacancyPct').value);
  const maint = pct($('maintPct').value);
  const capex = pct($('capexPct').value);
  const pm = pct($('pmPct').value);
  const close = pct($('saleClosingPct').value);

  let sellStocks = homeValue * (1 - close) - loanBalance;
  let rentStocks = 0;
  let rentHome = homeValue;
  let rentLoan = loanBalance;

  let rent = rentStart;
  let taxes = taxes0;
  let ins = ins0;

  const sellNW = [];
  const rentNW = [];

  for (let m = 1; m <= MONTHS; m++) {
    sellStocks *= 1 + mRate(market);
    rentStocks *= 1 + mRate(market);
    rentHome *= 1 + mRate(appreciation);

    rent *= 1 + mRate(inflation);
    taxes *= 1 + mRate(inflation);
    ins *= 1 + mRate(inflation);

    if (rentLoan > 0) {
      const interest = rentLoan * (rate / 12);
      rentLoan = Math.max(0, rentLoan - (mortgage - interest));
    }

    const netCashFlow =
      rent -
      rent * (vacancy + maint + capex + pm) -
      mortgage -
      taxes -
      ins;

    if (netCashFlow >= 0) {
      rentStocks += netCashFlow;
    } else {
      sellStocks += -netCashFlow;
    }

    if (m % 12 === 0) {
      const y = m / 12;
      sellNW[y] = sellStocks;
      rentNW[y] = rentStocks + (rentHome - rentLoan);
    }
  }

  $('cardResults').classList.remove('hidden');
  $('cardTable').classList.remove('hidden');

  const winner = sellNW[30] > rentNW[30] ? 'SELL' : 'RENT';
  const diff = Math.abs(sellNW[30] - rentNW[30]);

  $('resultsSummary').innerHTML = `
    <li><strong>Net Worth (Year 30):</strong> ${winner} results in a higher net worth (${fmt(diff)} difference).</li>
    <li><strong>Cash Flow Treatment:</strong> Negative rental cash flow is invested in SELL; positive cash flow is invested in RENT.</li>
  `;

  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = '';

  [0, 1, 5, 10, 30].forEach(y => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${y}</td>
      <td><strong>${fmt(sellNW[y] || 0)}</strong> (${fmt(sellNW[y] || 0)} stocks)</td>
      <td><strong>${fmt(rentNW[y] || 0)}</strong> (${fmt(rentStocks)} stocks, ${fmt(rentHome - rentLoan)} home equity)</td>
    `;
    tbody.appendChild(tr);
  });

  $('assumptionNote').innerHTML = `
    <ul>
      <li>Market return ${$('marketReturn').value}%, home appreciation ${$('homeAppreciation').value}%</li>
      <li>Inflation / rent growth ${$('inflation').value}% annually</li>
      <li>Rental costs modeled as % of rent (vacancy, maintenance, CapEx, management)</li>
    </ul>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  $('optionalBody').style.display = 'none';
  $('toggleOptional').onclick = () => {
    const b = $('optionalBody');
    b.style.display = b.style.display === 'block' ? 'none' : 'block';
  };
  $('btnRun').onclick = run;
  $('btnReset').onclick = () => location.reload();
});
