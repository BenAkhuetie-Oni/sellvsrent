'use strict';

const YEARS = 30;
const MONTHS = YEARS * 12;
const $ = id => document.getElementById(id);
const pct = x => Number(x || 0) / 100;
const mRate = a => Math.pow(1 + a, 1 / 12) - 1;

let chart;

function fmt(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return Math.round(n / 1e3) + 'K';
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

  const loanEnd = new Date($('loanEnd').value + '-01');
  const monthsLeft = Math.max(1, (loanEnd - new Date()) / 2628e6);
  const mortgage = pmt(lb, rate, monthsLeft);

  const mkt = pct($('marketReturn').value);
  const app = pct($('homeAppreciation').value);
  const infl = pct($('inflation').value);
  const vac = pct($('vacancyPct').value);
  const maint = pct($('maintPct').value);
  const cap = pct($('capexPct').value);
  const pm = pct($('pmPct').value);
  const close = pct($('saleClosingPct').value);

  let sellStocks = hv * (1 - close) - lb;
  let rentStocks = 0;
  let rentHome = hv;
  let rentLoan = lb;

  let rent = rent0;
  let taxes = taxes0;
  let ins = ins0;

  const sellNW = [];
  const rentNW = [];
  const sellSeries = [];
  const rentSeries = [];

  let breakEvenYear = null;
  let netRentalCF = 0;
  const y0CashFlow =
    rent0 - rent0 * (vac + maint + cap + pm) - mortgage - taxes0 - ins0;

  for (let m = 1; m <= MONTHS; m++) {
    sellStocks *= 1 + mRate(mkt);
    rentStocks *= 1 + mRate(mkt);
    rentHome *= 1 + mRate(app);

    rent *= 1 + mRate(infl);
    taxes *= 1 + mRate(infl);
    ins *= 1 + mRate(infl);

    if (rentLoan > 0) {
      const interest = rentLoan * (rate / 12);
      rentLoan = Math.max(0, rentLoan - (mortgage - interest));
    }

    const netCF =
      rent - rent * (vac + maint + cap + pm) - mortgage - taxes - ins;

    netRentalCF += netCF;

    if (netCF >= 0) {
      rentStocks += netCF;
      if (!breakEvenYear) breakEvenYear = Math.ceil(m / 12);
    } else {
      sellStocks += -netCF;
    }

    if (m % 12 === 0) {
      const y = m / 12;
      sellNW[y] = sellStocks;
      rentNW[y] = rentStocks + (rentHome - rentLoan);
      sellSeries.push(sellNW[y]);
      rentSeries.push(rentNW[y]);
    }
  }

  $('cardResults').classList.remove('hidden');
  $('cardTable').classList.remove('hidden');

  const winner = sellNW[30] > rentNW[30] ? 'SELL' : 'RENT';
  const loser = winner === 'SELL' ? 'RENT' : 'SELL';
  const diff = Math.abs(sellNW[30] - rentNW[30]);

  const cashFlowLine =
    y0CashFlow < 0
      ? `RENT results in negative cash flow (${fmt(y0CashFlow)}/month at Y0) until breaking even at Year ${breakEvenYear} (Net Rental Cash Flow, Y0–Y30: ${fmt(netRentalCF)}). Negative cash flow is accounted for in SELL as “Avoided Negative Cash Flow” invested in stocks.`
      : `RENT results in positive cash flow (${fmt(y0CashFlow)}/month at Y0; Net Rental Cash Flow, Y0–Y30: ${fmt(netRentalCF)}). RENT assumes positive cash flow is invested in stocks.`;

  $('resultsSummary').innerHTML = `
    <li><strong>Net Worth (Year 30):</strong> ${winner} (${fmt(winner === 'SELL' ? sellNW[30] : rentNW[30])}) results in a higher net worth vs. ${loser} (${fmt(loser === 'SELL' ? sellNW[30] : rentNW[30])}) (+${fmt(diff)} difference)</li>
    <li><strong>Rental Cash Flow:</strong> ${cashFlowLine}</li>
  `;

  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = '';
  [0, 1, 5, 10, 30].forEach(y => {
    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td>${y}</td>
        <td><strong>${fmt(sellNW[y] || 0)}</strong> (${fmt(sellNW[y] || 0)} stocks)</td>
        <td><strong>${fmt(rentNW[y] || 0)}</strong> (${fmt(rentStocks)} stocks, ${fmt(rentHome - rentLoan)} home equity)</td>
      </tr>`
    );
  });

  $('assumptionNote').innerHTML = `
    <li>Market return ${$('marketReturn').value}%, home appreciation ${$('homeAppreciation').value}%</li>
    <li>Inflation / rent growth ${$('inflation').value}% annually</li>
    <li>Rental costs: ${$('vacancyPct').value}% vacancy, ${$('maintPct').value}% maintenance, ${$('capexPct').value}% CapEx, ${$('pmPct').value}% management</li>
  `;

  if (chart) chart.destroy();
  chart = new Chart($('nwChart'), {
    type: 'line',
    data: {
      labels: Array.from({ length: 30 }, (_, i) => i + 1),
      datasets: [
        { label: 'SELL', data: sellSeries, borderWidth: 2 },
        { label: 'RENT', data: rentSeries, borderWidth: 2 }
      ]
    }
  });
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
