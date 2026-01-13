"use strict";

// -----------------------------
// Utilities
// -----------------------------
const $ = (id) => document.getElementById(id);

function clampNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function pctToDecimal(pct) { return clampNumber(pct, 0) / 100; }
function annualToMonthlyRate(annualDecimal) { return Math.pow(1 + annualDecimal, 1 / 12) - 1; }

function parseMonthInput(val) {
  // expects "YYYY-MM" from <input type="month">
  if (!val || typeof val !== "string" || !/^\d{4}-\d{2}$/.test(val)) return null;
  const [y, m] = val.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return { y, m };
}
function monthsBetween(a, b) {
  // a, b: {y,m} with m 1-12
  return (b.y - a.y) * 12 + (b.m - a.m);
}

function money0(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function moneyAbbrev(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  return `${sign}$${Math.round(abs / 1000)}K`;
}
function moneyBreakdown(total, stocks, equity) {
  // Total net worth bold; breakdown on next line not bold
  return `<div class="nwCell"><div class="nwTotal"><strong>${moneyAbbrev(total)}</strong></div><div class="nwParts">(${moneyAbbrev(stocks)} stocks, ${moneyAbbrev(equity)} home equity)</div></div>`;
}

function mortgagePayment(principal, annualRateDec, nMonths) {
  const P = Math.max(0, principal);
  const r = Math.max(0, annualRateDec) / 12;
  const N = Math.max(0, Math.round(nMonths));
  if (P === 0 || N === 0) return 0;
  if (r === 0) return P / N;
  return P * (r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
}

// -----------------------------
// Inputs
// -----------------------------
function readInputs() {
  const required = {
    homeValue: clampNumber($("homeValue").value, 0),
    loanBalance: clampNumber($("loanBalance").value, 0),
    monthlyRent: clampNumber($("monthlyRent").value, 0),
    currRate: clampNumber($("currRate").value, 0),
    loanEnd: parseMonthInput($("loanEnd").value),
    taxesMonthly: clampNumber($("taxesMonthly").value, 0),
    insMonthly: clampNumber($("insMonthly").value, 0),
    movedIn: parseMonthInput($("movedIn").value),
    movedOut: parseMonthInput($("movedOut").value),
  };

  const optional = {
    saleClosingPct: clampNumber($("saleClosingPct").value, 0),
    marketReturn: clampNumber($("marketReturn").value, 0),
    homeAppreciation: clampNumber($("homeAppreciation").value, 0),
    inflation: clampNumber($("inflation").value, 0),
    vacancyPct: clampNumber($("vacancyPct").value, 0),
    maintPct: clampNumber($("maintPct").value, 0),
    capexPct: clampNumber($("capexPct").value, 0),
    pmPct: clampNumber($("pmPct").value, 0),
    rentalTaxRate: clampNumber($("rentalTaxRate").value, 0),
    capGainsRate: clampNumber($("capGainsRate").value, 0),
    costBasis: $("costBasis").value === "" ? null : clampNumber($("costBasis").value, 0),
    overridePIAmount: $("overridePIAmount").value === "" ? null : clampNumber($("overridePIAmount").value, 0),
  };

  return { required, optional };
}

function computeDerived(required) {
  const now = new Date();
  const nowMonth = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const loanEnd = required.loanEnd;

  let monthsRemaining = 0;
  if (loanEnd) monthsRemaining = Math.max(0, monthsBetween(nowMonth, loanEnd));

  let yearsLived = 0;
  if (required.movedIn && required.movedOut) {
    const livedMonths = Math.max(0, monthsBetween(required.movedIn, required.movedOut));
    yearsLived = livedMonths / 12;
  }
  return { nowMonth, monthsRemaining, yearsLived };
}

function computeSaleTax(salePrice, derived, optional) {
  // Simplified rule:
  // If lived >= 2 years => 0.
  // If lived < 2 years and cost basis provided => cap gains tax on max(0, salePrice - costBasis) at capGainsRate.
  if ((derived.yearsLived ?? 0) >= 2) return 0;
  if (optional.costBasis == null) return 0;
  const gain = Math.max(0, salePrice - optional.costBasis);
  return gain * pctToDecimal(optional.capGainsRate);
}

// -----------------------------
// Simulation (SELL vs RENT)
// -----------------------------
function runSimulation(inputs, derived) {
  const { required, optional } = inputs;

  const YEARS = 30;
  const MONTHS = YEARS * 12;

  const marketM = annualToMonthlyRate(pctToDecimal(optional.marketReturn));
  const homeAppM = annualToMonthlyRate(pctToDecimal(optional.homeAppreciation));
  const inflM = annualToMonthlyRate(pctToDecimal(optional.inflation));

  const vacancy = pctToDecimal(optional.vacancyPct);
  const maint = pctToDecimal(optional.maintPct);
  const capex = pctToDecimal(optional.capexPct);
  const pm = pctToDecimal(optional.pmPct);
  const rentalTax = pctToDecimal(optional.rentalTaxRate);

  const saleClose = pctToDecimal(optional.saleClosingPct);

  // Current mortgage payment (or override)
  const currRateAnnual = pctToDecimal(required.currRate);
  const nMonths = Math.max(0, Math.round(derived.monthsRemaining));
  const piComputed = mortgagePayment(required.loanBalance, currRateAnnual, nMonths);
  const piCash = (optional.overridePIAmount != null) ? optional.overridePIAmount : piComputed;

  // Scenario state
  const sell = { invest: 0, avoidedNegCF: 0 };
  const rent = { homeValue: required.homeValue, loanBal: required.loanBalance, invest: 0 };

  // SELL transaction at month 0
  {
    const salePrice = required.homeValue;
    const closingCosts = salePrice * saleClose;
    const saleTax = computeSaleTax(salePrice, derived, optional);
    const netAfter = salePrice - closingCosts - saleTax;
    const payoff = Math.min(netAfter, required.loanBalance);
    const proceeds = netAfter - payoff;
    sell.invest = Math.max(0, proceeds); // if proceeds negative, clamp to 0 (simplification)
  }

  // Series (yearly)
  const series = {
    sellStocks: Array(YEARS + 1).fill(0),
    sellEquity: Array(YEARS + 1).fill(0),
    sellNW: Array(YEARS + 1).fill(0),
    rentStocks: Array(YEARS + 1).fill(0),
    rentEquity: Array(YEARS + 1).fill(0),
    rentNW: Array(YEARS + 1).fill(0),
    avoidedNegCF: Array(YEARS + 1).fill(0),
    rentNetAtYear0: 0,
    rentNetFirstMonthOfYear: Array(YEARS + 1).fill(null),
    meta: {
      currPIComputed: piComputed,
    }
  };

    let rentNetCFTotal = 0;

// Year 0 snapshot
  series.sellStocks[0] = sell.invest;
  series.sellEquity[0] = 0;
  series.sellNW[0] = sell.invest;

  series.rentStocks[0] = rent.invest;
  series.rentEquity[0] = Math.max(0, rent.homeValue - rent.loanBal);
  series.rentNW[0] = series.rentStocks[0] + series.rentEquity[0];
  series.avoidedNegCF[0] = 0;

  // Monthly loop
  for (let m = 1; m <= MONTHS; m++) {
    // Grow investments monthly
    sell.invest *= (1 + marketM);
    rent.invest *= (1 + marketM);

    // RENT: home appreciation
    rent.homeValue *= (1 + homeAppM);

    // RENT: mortgage amortization (while loan remaining)
    let interest = 0;
    let principalPaid = 0;
    if (rent.loanBal > 0 && piCash > 0) {
      interest = rent.loanBal * (currRateAnnual / 12);
      principalPaid = Math.max(0, piCash - interest);
      principalPaid = Math.min(principalPaid, rent.loanBal);
      rent.loanBal -= principalPaid;
    }

    // RENT: cash flow
    const rentGross = required.monthlyRent * Math.pow(1 + inflM, m - 1);
    const effectiveRent = rentGross * (1 - vacancy);

    // Operating costs as % of rentGross (simplified)
    const opCosts = rentGross * (maint + capex + pm);
    const taxes = required.taxesMonthly * Math.pow(1 + inflM, m - 1);
    const ins = required.insMonthly * Math.pow(1 + inflM, m - 1);

    let net = effectiveRent - opCosts - piCash - taxes - ins;

    // Apply rental tax to positive net only (simplified)
    if (net > 0 && rentalTax > 0) net *= (1 - rentalTax);

    // Track rental cash flow (for summary)
    rentNetCFTotal += net;

    // Year 0 = first month net
    if (m === 1) series.rentNetAtYear0 = net;

    // First month of each year for break-even detection
    const yIdx = Math.floor((m - 1) / 12);
    if ((m - 1) % 12 === 0) series.rentNetFirstMonthOfYear[yIdx] = net;

if (net >= 0) {
      rent.invest += net;
    } else {
      const avoided = Math.abs(net);
      sell.invest += avoided;
      sell.avoidedNegCF += avoided;
      rent.invest = Math.max(0, rent.invest);
    }

    // Year-end snapshots
    if (m % 12 === 0) {
      const y = m / 12;

      series.sellStocks[y] = Math.max(0, sell.invest);
      series.sellEquity[y] = 0;
      series.sellNW[y] = series.sellStocks[y];

      series.rentStocks[y] = Math.max(0, rent.invest); // stocks cannot be < 0
      series.rentEquity[y] = Math.max(0, rent.homeValue - rent.loanBal);
      series.rentNW[y] = series.rentStocks[y] + series.rentEquity[y];

      series.avoidedNegCF[y] = sell.avoidedNegCF;
    }
  }

    series.meta.rentNetCFTotal = rentNetCFTotal;

return series;
}

// -----------------------------
// Rendering
// -----------------------------
let chart = null;

function renderWinner(series) {
  const sell30 = series.sellNW[30];
  const rent30 = series.rentNW[30];
  const winner = sell30 >= rent30 ? "SELL" : "RENT";
  $("netWorthWinner").textContent = winner;
}

function renderSummary(series) {
  const el = $("resultsSummary");

  const sell30 = series.sellNW[30];
  const rent30 = series.rentNW[30];

  const sellLabel = "SELL";
  const rentLabel = "RENT";

  const winner = sell30 >= rent30 ? sellLabel : rentLabel;
  const loser = sell30 >= rent30 ? rentLabel : sellLabel;
  const winnerVal = sell30 >= rent30 ? sell30 : rent30;
  const loserVal = sell30 >= rent30 ? rent30 : sell30;
  const diff = Math.abs(winnerVal - loserVal);

  // Rental cash flow summary
  const netY0 = Number(series.rentNetAtYear0 ?? 0);
  const netTotal = Number(series.meta.rentNetCFTotal ?? 0);

  let breakEvenText = "";
  if (netY0 < 0) {
    let breakEvenYear = null;
    for (let y = 0; y <= 29; y++) {
      const v = series.rentNetFirstMonthOfYear[y];
      if (typeof v === "number" && v >= 0) { breakEvenYear = y; break; }
    }
    breakEvenText = breakEvenYear == null
      ? "does not break even by Year 30"
      : `until breaking even at Year ${breakEvenYear}`;
  }

  const netY0PerMonth = moneyAbbrev(netY0);
  const netTotalText = moneyAbbrev(netTotal);

  const nwBullet = `Net Worth (Year 30): ${winner} (${moneyAbbrev(winnerVal)}) results in a higher net worth vs. ${loser} (${moneyAbbrev(loserVal)}) (+${moneyAbbrev(diff)} difference).`;

  const cashFlowBullet = (netY0 < 0)
    ? `Rental Cash Flow: RENT results in negative cash flow (${netY0PerMonth}/month at Y0) ${breakEvenText}. (Net Rental Cash Flow, Y0–Y30: ${netTotalText}). Negative cash flow is accounted for in SELL scenario as “Avoided Negative Cash Flow” that is invested in stocks. Positive cash flow is accounted for in RENT scenario as additional cash invested in stocks.`
    : `Rental Cash Flow: RENT results in positive cash flow (${netY0PerMonth}/month at Y0; Net Rental Cash Flow, Y0–Y30: ${netTotalText}). RENT assumes positive cash flow is invested in stocks.`;

  el.innerHTML = `<li>${nwBullet}</li><li>${cashFlowBullet}</li>`;
}

function renderTable(series) {
  const years = [0, 1, 5, 10, 30];
  const tbody = $("summaryTable").querySelector("tbody");
  tbody.innerHTML = "";

  years.forEach((y) => {
    const sellText = moneyBreakdown(
      series.sellNW[y],
      series.sellStocks[y],
      series.sellEquity[y]
    );
    const rentText = moneyBreakdown(
      series.rentNW[y],
      series.rentStocks[y],
      series.rentEquity[y]
    );

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>${sellText}</td>
      <td>${rentText}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderNotes(inputs, derived, series) {
  const noteSummary = document.getElementById("resultsNotesSummary");
  const noteTable = document.getElementById("resultsNotesTable");
  if (!noteSummary && !noteTable) return;

  const optional = inputs.optional;

  const items = [
    `Market return: ${optional.marketReturnPct.toFixed(1)}%`,
    `Home appreciation: ${optional.homeAppreciationPct.toFixed(1)}%`,
    `Inflation/rent growth: ${optional.inflationPct.toFixed(1)}%`,
    `Rental costs: Vacancy ${optional.vacancyPct.toFixed(1)}%, Maint ${optional.maintPct.toFixed(1)}%, CapEx ${optional.capexPct.toFixed(1)}%, PM ${optional.pmPct.toFixed(1)}%`,
    `Rental tax on positive cash flow: ${optional.rentalTaxRate.toFixed(1)}%`,
    `Sale closing costs: ${optional.saleClosingPct.toFixed(1)}%`,
    `Current P&I: computed as ${money(derived.pAndI)} from balance/rate/loan-end date.`,
    `Avoided Negative Cash Flow: When RENT net cash flow is negative, we assume SELL avoids that outflow and invests the same amount in stocks at the market return.`
  ];

  const notesHtml = `
    <div class="noteTitle">Key assumptions (editable in Optional assumptions):</div>
    <ul>
      ${items.map((t) => `<li>${t}</li>`).join("")}
    </ul>
  `;

  if (noteSummary) noteSummary.innerHTML = notesHtml;
  if (noteTable) noteTable.innerHTML = notesHtml;
}

function renderChart(series) {
  const ctx = $("nwChart").getContext("2d");
  const labels = Array.from({ length: 31 }, (_, i) => i);
  const sellData = labels.map((y) => series.sellNW[y]);
  const rentData = labels.map((y) => series.rentNW[y]);

  if (typeof Chart === "undefined") return;

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = sellData;
    chart.data.datasets[1].data = rentData;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "SELL", data: sellData, tension: 0.15 },
        { label: "RENT", data: rentData, tension: 0.15 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        y: {
          ticks: {
            callback: (v) => moneyAbbrev(v)
          }
        }
      }
    },
  });
}

// -----------------------------
// CSV download
// -----------------------------
function downloadCsv(series) {
  const headers = [
    "Year",
    "Sell_NetWorth",
    "Sell_Stocks",
    "Sell_HomeEquity",
    "Rent_NetWorth",
    "Rent_Stocks",
    "Rent_HomeEquity",
    "Avoided_Negative_Cash_Flow_Cumulative"
  ];

  const rows = [headers.join(",")];
  for (let y = 0; y <= 30; y++) {
    rows.push([
      y,
      Math.round(series.sellNW[y]),
      Math.round(series.sellStocks[y]),
      Math.round(series.sellEquity[y]),
      Math.round(series.rentNW[y]),
      Math.round(series.rentStocks[y]),
      Math.round(series.rentEquity[y]),
      Math.round(series.avoidedNegCF[y]),
    ].join(","));
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sell_vs_rent_net_worth.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// -----------------------------
// UI wiring
// -----------------------------
function showResults() {
  $("cardResults").classList.remove("hidden");
  $("cardSummary").classList.remove("hidden");
  $("cardTable").classList.remove("hidden");
}

function resetAll() {
  if (chart) { chart.destroy(); chart = null; }
  $("cardResults").classList.add("hidden");
  $("cardSummary").classList.add("hidden");
  $("cardTable").classList.add("hidden");
  $("netWorthWinner").textContent = "—";
  $("resultsSummary").innerHTML = "<li>—</li>";
  $("summaryTable").querySelector("tbody").innerHTML = "";
  $("resultsNotes").innerHTML = "";
}

function setOptionalOpen(isOpen){
  const btn = $("toggleOptional");
  const body = $("optionalBody");
  const chev = btn.querySelector(".chev");
  btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  body.classList.toggle("open", isOpen);
  if (chev) chev.textContent = isOpen ? "▴" : "▾";
}

function toggleOptional(){
  const btn = $("toggleOptional");
  const isOpen = btn.getAttribute("aria-expanded") === "true";
  setOptionalOpen(!isOpen);
}
function run() {
  const inputs = readInputs();
  const derived = computeDerived(inputs.required);
  const series = runSimulation(inputs, derived);

  renderWinner(series);
  renderChart(series);
  renderSummary(series);
  renderTable(series);
  renderNotes(inputs, derived, series);
  showResults();

  // Attach csv callback with latest series
  $("btnCsv").onclick = () => downloadCsv(series);
}

function init() {
  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("toggleOptional").addEventListener("click", toggleOptional);

  // Closed by default
  if (typeof setOptionalOpen === "function") setOptionalOpen(false);

  // Footer year
  const yearEl = document.getElementById("yearNow");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  resetAll();
}

document.addEventListener("DOMContentLoaded", init);
