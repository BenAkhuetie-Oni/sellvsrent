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

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function roundTo1K(n) { return Math.round(Number(n) / 1000) * 1000; }

// Format a number as "$123K" or "$1.2M" (nearest $1K, 1 decimal for M)
function moneyKM(n) {
  const x = roundTo1K(n);
  if (!Number.isFinite(x)) return "—";
  const sign = x < 0 ? "-" : "";
  const ax = Math.abs(x);

  if (ax >= 1_000_000) {
    const m = ax / 1_000_000;
    const text = (m >= 10) ? m.toFixed(0) : m.toFixed(1);
    return `${sign}$${text}M`;
  }
  return `${sign}$${Math.round(ax / 1000)}K`;
}

function formatNetWorthBreakdown(stocks, homeEquity) {
  const s = roundTo1K(stocks);
  const e = roundTo1K(homeEquity);
  const total = s + e;
  return `${moneyKM(total)} (${moneyKM(s)} stocks, ${moneyKM(e)} home equity)`;
}

function mortgagePayment(principal, annualRateDecimal, termMonths) {
  if (termMonths <= 0 || principal <= 0) return 0;
  const r = annualRateDecimal / 12;
  if (r === 0) return principal / termMonths;
  return principal * (r / (1 - Math.pow(1 + r, -termMonths)));
}

// -----------------------------
// Date helpers (month inputs)
// -----------------------------
function parseMonthInput(value) {
  if (!value || typeof value !== "string" || !value.includes("-")) return null;
  const [y, m] = value.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, 1);
}
function monthsBetween(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return null;
  const sy = startDate.getFullYear();
  const sm = startDate.getMonth();
  const ey = endDate.getFullYear();
  const em = endDate.getMonth();
  return (ey - sy) * 12 + (em - sm);
}
function yearsBetween(startDate, endDate) {
  const m = monthsBetween(startDate, endDate);
  if (m == null) return null;
  return Math.max(0, m / 12);
}
function getTodayMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// -----------------------------
// Constants
// -----------------------------
const YEARS = 30;
const MONTHS = YEARS * 12;

// -----------------------------
// Inputs
// -----------------------------
function parseInputs() {
  const required = {
    homeValue: clampNumber($("homeValue").value),
    loanBalance: clampNumber($("loanBalance").value),
    monthlyRent: clampNumber($("monthlyRent").value),

    movedIn: parseMonthInput($("movedIn").value),
    movedOut: parseMonthInput($("movedOut").value),

    currRate: clampNumber($("currRate").value),
    loanEnd: parseMonthInput($("loanEnd").value),
    taxesMonthly: clampNumber($("taxesMonthly").value),
    insMonthly: clampNumber($("insMonthly").value),
  };

  const optional = {
    saleClosingPct: clampNumber($("saleClosingPct").value, 6),
    marketReturn: clampNumber($("marketReturn").value, 7),
    homeAppreciation: clampNumber($("homeAppreciation").value, 3),
    inflation: clampNumber($("inflation").value, 3),

    vacancyPct: clampNumber($("vacancyPct").value, 5),
    maintPct: clampNumber($("maintPct").value, 5),
    capexPct: clampNumber($("capexPct").value, 5),
    pmPct: clampNumber($("pmPct").value, 0),

    rentalTaxRate: clampNumber($("rentalTaxRate").value, 0),

    capGainsRate: clampNumber($("capGainsRate").value, 15),

    costBasis: $("costBasis").value.trim() === "" ? null : clampNumber($("costBasis").value),
    overridePIAmount: $("overridePIAmount").value.trim() === "" ? null : clampNumber($("overridePIAmount").value),
  };

  return { required, optional };
}

function computeDerived(required) {
  const yearsLived =
    (required.movedIn && required.movedOut)
      ? yearsBetween(required.movedIn, required.movedOut)
      : null;

  const today = getTodayMonthStart();
  const monthsRemaining = (required.loanEnd) ? monthsBetween(today, required.loanEnd) : null;

  return { yearsLived, monthsRemaining };
}

function validateInputs(inputs) {
  const { required, optional } = inputs;
  const derived = computeDerived(required);
  const errors = [];

  const reqPos = (name, val) => { if (!(val > 0)) errors.push(`${name} must be > 0`); };

  reqPos("Home value", required.homeValue);
  if (required.loanBalance < 0) errors.push("Remaining loan balance must be ≥ 0");
  if (required.monthlyRent < 0) errors.push("Estimated monthly rent must be ≥ 0");

  if (!required.movedIn) errors.push("Month/year moved in is required");
  if (!required.movedOut) errors.push("Month/year moved out is required (can be a future planned date)");
  if (derived.yearsLived == null) errors.push("Could not compute years lived from moved in/out dates");
  if (derived.yearsLived < 0) errors.push("Moved out date must be after moved in date");

  reqPos("Current interest rate", required.currRate);
  if (!required.loanEnd) errors.push("Month/year loan ends is required");
  if (derived.monthsRemaining == null) errors.push("Could not compute months remaining from loan end date");
  if (derived.monthsRemaining <= 0) errors.push("Loan end date must be in the future (at least 1 month from now)");

  if (required.taxesMonthly < 0) errors.push("Monthly property taxes must be ≥ 0");
  if (required.insMonthly < 0) errors.push("Monthly insurance must be ≥ 0");

  if (optional.overridePIAmount != null && !(optional.overridePIAmount > 0)) {
    errors.push("Override P&I must be > 0 if provided");
  }

  return { errors, derived };
}

// -----------------------------
// Simulation (SELL vs RENT)
// -----------------------------
function runSimulation(inputs, derived) {
  const { required, optional } = inputs;

  const marketAnnual = pctToDecimal(optional.marketReturn);
  const homeAppAnnual = pctToDecimal(optional.homeAppreciation);
  const inflAnnual = pctToDecimal(optional.inflation);

  const marketM = annualToMonthlyRate(marketAnnual);
  const homeAppM = annualToMonthlyRate(homeAppAnnual);
  const inflM = annualToMonthlyRate(inflAnnual);

  const vacancy = pctToDecimal(optional.vacancyPct);
  const maint = pctToDecimal(optional.maintPct);
  const capex = pctToDecimal(optional.capexPct);
  const pm = pctToDecimal(optional.pmPct);
  const rentalTax = pctToDecimal(optional.rentalTaxRate);

  const saleClose = pctToDecimal(optional.saleClosingPct);
  const capGainsRate = pctToDecimal(optional.capGainsRate);

  const currRateAnnual = pctToDecimal(required.currRate);
  const currTermMonths = Math.round(derived.monthsRemaining);
  const currPIComputed = mortgagePayment(required.loanBalance, currRateAnnual, currTermMonths);
  const currPIForCashFlow = (optional.overridePIAmount != null) ? optional.overridePIAmount : currPIComputed;

  const baselineEquity = required.homeValue - required.loanBalance;
  const baselineNW = baselineEquity;

  function computeSaleTax(salePrice) {
    const yearsLived = derived.yearsLived ?? 0;
    if (yearsLived >= 2) return 0;
    if (optional.costBasis == null) return 0;
    const gain = Math.max(0, salePrice - optional.costBasis);
    return gain * capGainsRate;
  }

  function makeScenario(kind) {
    return {
      kind,
      homeValue: required.homeValue,
      loanBal: required.loanBalance,
      invest: 0,   // stocks / liquid investments
      oop: 0       // out-of-pocket drag (negative CF)
    };
  }

  const sell = makeScenario("SELL");
  const rent = makeScenario("RENT");

  const series = {
    years: Array.from({ length: YEARS + 1 }, (_, i) => i),

    // totals
    sellNW: Array(YEARS + 1).fill(0),
    rentNW: Array(YEARS + 1).fill(0),

    // breakdowns
    sellStocks: Array(YEARS + 1).fill(0),
    sellEquity: Array(YEARS + 1).fill(0),

    rentStocks: Array(YEARS + 1).fill(0),
    rentEquity: Array(YEARS + 1).fill(0),
  };

  // Year 0 (equal starting net worth)
  series.sellNW[0] = baselineNW;
  series.rentNW[0] = baselineNW;

  series.sellStocks[0] = 0;
  series.sellEquity[0] = baselineNW;

  series.rentStocks[0] = 0;
  series.rentEquity[0] = baselineNW;

  // SELL transaction at start of Month 1
  {
    const salePrice = sell.homeValue;
    const saleClosingCosts = salePrice * saleClose;
    const saleTax = computeSaleTax(salePrice);
    const netAfterCloseTax = salePrice - saleClosingCosts - saleTax;

    const payoff = Math.min(netAfterCloseTax, sell.loanBal);
    const remainingProceeds = netAfterCloseTax - payoff;

    sell.loanBal = 0;
    sell.homeValue = 0;

    if (remainingProceeds >= 0) sell.invest += remainingProceeds;
    else sell.oop += remainingProceeds; // negative
  }

  // Net worth “hit” due to transaction costs (nearest $1K)
  const sellNWAfterTransaction = sell.invest + sell.oop;
  const sellTransactionHit = roundTo1K(baselineNW - sellNWAfterTransaction);

  // Track rents + costs inflated monthly
  let rentIncome = required.monthlyRent;
  let taxes = required.taxesMonthly;
  let ins = required.insMonthly;

  for (let m = 1; m <= MONTHS; m++) {
    rentIncome *= (1 + inflM);
    taxes *= (1 + inflM);
    ins *= (1 + inflM);

    // Appreciate home value (RENT scenario only)
    rent.homeValue *= (1 + homeAppM);

    // Grow investment accounts
    sell.invest *= (1 + marketM);
    rent.invest *= (1 + marketM);

    // RENT scenario monthly cash flow
    {
      const opCosts = rentIncome * (vacancy + maint + capex + pm);

      let piCash = 0;
      if (rent.loanBal > 0) {
        piCash = currPIForCashFlow;

        const interest = rent.loanBal * (currRateAnnual / 12);
        const principalPaid = Math.max(0, currPIComputed - interest);
        rent.loanBal = Math.max(0, rent.loanBal - principalPaid);
      }

      let net = rentIncome - opCosts - piCash - taxes - ins;
      if (net > 0 && rentalTax > 0) net *= (1 - rentalTax);

      if (net >= 0) rent.invest += net;
      else rent.oop += net;
    }

    // Year-end snapshots
    if (m % 12 === 0) {
      const y = m / 12;

      // SELL (all in stocks; no home equity)
      series.sellStocks[y] = sell.invest + sell.oop;
      series.sellEquity[y] = 0;
      series.sellNW[y] = series.sellStocks[y] + series.sellEquity[y];

      // RENT (split between stocks + home equity)
      const equity = (rent.homeValue - rent.loanBal);
      const stocks = rent.invest + rent.oop;

      series.rentEquity[y] = equity;
      series.rentStocks[y] = stocks;
      series.rentNW[y] = equity + stocks;
    }
  }

  const taxLine = (derived.yearsLived ?? 0) >= 2
    ? "Sale tax: assumed 0% capital gains tax because time in home ≥ 2 years (simplified rule)."
    : (optional.costBasis == null
      ? "Sale tax: time in home < 2 years, but cost basis blank ⇒ assumes no capital gain (simplified rule)."
      : `Sale tax: time in home < 2 years ⇒ applies ${optional.capGainsRate.toFixed(1)}% to (sale price − cost basis).`);

  return {
    series,
    meta: {
      baselineNW,
      yearsLived: derived.yearsLived,
      currPIComputed,
      currPIForCashFlow,
      sellTransactionHit,
      taxLine
    }
  };
}

// -----------------------------
// Winners + rendering
// -----------------------------
let chart = null;
let lastResult = null;

function labelScenario(key) {
  if (key === "sell") return "SELL";
  if (key === "rent") return "RENT";
  return "—";
}

function pickWinnerAtYear(series, y) {
  const vals = [
    { key: "sell", v: series.sellNW[y] },
    { key: "rent", v: series.rentNW[y] },
  ].slice().sort((a, b) => b.v - a.v);

  return { top: vals[0], bottom: vals[1] };
}

function renderChart(series) {
  const ctx = $("nwChart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.years,
      datasets: [
        { label: "SELL", data: series.sellNW, tension: 0.25, pointRadius: 0, borderWidth: 2 },
        { label: "RENT", data: series.rentNW, tension: 0.25, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => `Year ${items[0].label}`,
            label: (item) => `${item.dataset.label}: ${money(item.raw)}`
          }
        },
        legend: { position: "top" }
      },
      scales: {
        y: {
          ticks: {
            callback: (v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return "";
              return "$" + (n / 1000).toFixed(0) + "k";
            }
          }
        }
      }
    }
  });
}

function renderTable(series) {
  const years = [0, 1, 5, 10, 30];
  const tbody = $("summaryTable").querySelector("tbody");
  tbody.innerHTML = "";

  years.forEach((y) => {
    const sellText = formatNetWorthBreakdown(series.sellStocks[y], series.sellEquity[y]);
    const rentText = formatNetWorthBreakdown(series.rentStocks[y], series.rentEquity[y]);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>${sellText}</td>
      <td>${rentText}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderResultsSummary(series, meta) {
  const y = YEARS;
  const nw = pickWinnerAtYear(series, y);

  const nwTop = labelScenario(nw.top.key);
  const nwBottom = labelScenario(nw.bottom.key);

  const ul = $("resultsSummary");
  ul.innerHTML = "";

  const li = (text) => {
    const el = document.createElement("li");
    el.textContent = text;
    ul.appendChild(el);
  };

  li(`Net Worth: ${nwTop} results in your highest net worth in ${y} years, while ${nwBottom} resulted in your lowest net worth.`);
  li(`SELL: Your net worth takes a ~${moneyKM(meta.sellTransactionHit)} hit due to total transaction costs.`);

  const notes = $("resultsNotes");
  notes.innerHTML = `
    <div class="noteTitle">Additional details</div>
    <div class="noteBody">
      <strong>RENT net worth</strong> includes both stocks (your liquid investment account) and home equity (home value minus remaining loan balance).<br/>
      <strong>SELL net worth</strong> is modeled as fully liquid (stocks) after sale proceeds (net of closing costs, simplified sale tax, and mortgage payoff) are invested in the market.<br/>
      ${meta.taxLine}
    </div>
  `;
}

function renderAssumptionNote(meta, inputs) {
  const { optional } = inputs;
  const note = $("assumptionNote");

  const piLine = (optional.overridePIAmount != null)
    ? `Current P&I for cash flow: overridden to ${money(meta.currPIForCashFlow)} (payoff still uses computed payment ${money(meta.currPIComputed)}).`
    : `Current P&I: computed as ${money(meta.currPIComputed)} from balance/rate/loan-end date.`;

  note.innerHTML = `
    <div class="muted">
      <strong>Key assumptions (editable in Optional Assumptions):</strong><br/>
      Market return: ${optional.marketReturn.toFixed(1)}% · Home appreciation: ${optional.homeAppreciation.toFixed(1)}% · Inflation/rent growth: ${optional.inflation.toFixed(1)}%<br/>
      Rental costs: Vacancy ${optional.vacancyPct.toFixed(1)}%, Maint ${optional.maintPct.toFixed(1)}%, CapEx ${optional.capexPct.toFixed(1)}%, PM ${optional.pmPct.toFixed(1)}% · Rental tax rate: ${optional.rentalTaxRate.toFixed(1)}%<br/>
      ${meta.taxLine}<br/>
      ${piLine}
    </div>
  `;
}

function buildCsv(series) {
  const header = [
    "Year",
    "SELL_NetWorth",
    "SELL_Stocks",
    "SELL_HomeEquity",
    "RENT_NetWorth",
    "RENT_Stocks",
    "RENT_HomeEquity"
  ];
  const rows = [header.join(",")];

  for (let y = 0; y <= YEARS; y++) {
    rows.push([
      y,
      series.sellNW[y],
      series.sellStocks[y],
      series.sellEquity[y],
      series.rentNW[y],
      series.rentStocks[y],
      series.rentEquity[y]
    ].join(","));
  }
  return rows.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// -----------------------------
// UI wiring
// -----------------------------
function setResultsVisible(visible) {
  $("cardResults").classList.toggle("hidden", !visible);
  $("cardSummary").classList.toggle("hidden", !visible);
  $("cardTable").classList.toggle("hidden", !visible);
}

function wireOptionalAccordion() {
  const btn = $("toggleOptional");
  const body = $("optionalBody");

  btn.addEventListener("click", () => {
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", expanded ? "false" : "true");
    body.style.display = expanded ? "none" : "block";
    btn.querySelector(".chev").textContent = expanded ? "▾" : "▴";
  });

  body.style.display = "none";
}

function run() {
  const inputs = parseInputs();
  const { errors, derived } = validateInputs(inputs);

  if (errors.length) {
    alert("Please fix:\n\n- " + errors.join("\n- "));
    return;
  }

  const result = runSimulation(inputs, derived);
  lastResult = { inputs, derived, result };

  setResultsVisible(true);

  // Net Worth Winner pill (Year 30) — label only
  const nwWinner = pickWinnerAtYear(result.series, YEARS);
  $("netWorthWinner").textContent = labelScenario(nwWinner.top.key);

  renderChart(result.series);
  renderResultsSummary(result.series, result.meta);
  renderTable(result.series);
  renderAssumptionNote(result.meta, inputs);

  $("cardResults").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAll() {
  [
    "homeValue","loanBalance","monthlyRent",
    "movedIn","movedOut","currRate","loanEnd",
    "taxesMonthly","insMonthly"
  ].forEach(id => { $(id).value = ""; });

  $("overridePIAmount").value = "";

  $("netWorthWinner").textContent = "—";
  $("resultsSummary").innerHTML = "<li>—</li>";
  $("resultsNotes").innerHTML = "";
  $("summaryTable").querySelector("tbody").innerHTML = "";
  $("assumptionNote").innerHTML = "";

  if (chart) chart.destroy();
  chart = null;
  lastResult = null;

  setResultsVisible(false);
}

function init() {
  $("yearNow").textContent = new Date().getFullYear();

  wireOptionalAccordion();
  setResultsVisible(false);

  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("btnCsv").addEventListener("click", () => {
    if (!lastResult) return alert("Run a calculation first.");
    const csv = buildCsv(lastResult.result.series);
    downloadText("sell-vs-rent-my-house-30y.csv", csv);
  });
}

document.addEventListener("DOMContentLoaded", init);
