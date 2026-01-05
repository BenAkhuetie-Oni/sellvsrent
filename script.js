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
function moneyK(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const rounded = Math.round(x / 1000); // nearest $1K
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded)}K`;
}
function roundTo1K(n) { return Math.round(Number(n) / 1000) * 1000; }

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
  // value like "2026-01"
  if (!value || typeof value !== "string" || !value.includes("-")) return null;
  const [y, m] = value.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  // Use first day of month
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
    stillLiveHere: $("stillLiveHere").checked,

    currRate: clampNumber($("currRate").value),
    loanEnd: parseMonthInput($("loanEnd").value),
    taxesMonthly: clampNumber($("taxesMonthly").value),
    insMonthly: clampNumber($("insMonthly").value),

    refiRate: clampNumber($("refiRate").value),
    refiCashIn: clampNumber($("refiCashIn").value),
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

    refiTermYears: clampNumber($("refiTermYears").value, 30),
    refiClosingPct: clampNumber($("refiClosingPct").value, 2),

    withdrawalRate: clampNumber($("withdrawalRate").value, 4),
    capGainsRate: clampNumber($("capGainsRate").value, 15),

    costBasis: $("costBasis").value.trim() === "" ? null : clampNumber($("costBasis").value),

    overridePIAmount: $("overridePIAmount").value.trim() === "" ? null : clampNumber($("overridePIAmount").value),
  };

  return { required, optional };
}

function computeDerived(required) {
  // years lived from dates
  const movedIn = required.movedIn;
  const endForResidence = required.stillLiveHere ? getTodayMonthStart() : required.movedOut;
  const yearsLived = (movedIn && endForResidence) ? yearsBetween(movedIn, endForResidence) : null;

  // years remaining from loan end date
  const loanEnd = required.loanEnd;
  const today = getTodayMonthStart();
  const monthsRemaining = (loanEnd) ? monthsBetween(today, loanEnd) : null;
  const yearsRemaining = (monthsRemaining == null) ? null : Math.max(0, monthsRemaining / 12);

  return { yearsLived, monthsRemaining, yearsRemaining };
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
  if (!required.stillLiveHere && !required.movedOut) errors.push("Month/year moved out is required (or check “I still live here”)");
  if (derived.yearsLived == null) errors.push("Could not compute years lived from dates");

  reqPos("Current interest rate", required.currRate);
  if (!required.loanEnd) errors.push("Month/year loan ends is required");
  if (derived.monthsRemaining == null) errors.push("Could not compute months remaining from loan end date");
  if (derived.monthsRemaining <= 0) errors.push("Loan end date must be in the future (at least 1 month from now)");

  if (required.taxesMonthly < 0) errors.push("Monthly property taxes must be ≥ 0");
  if (required.insMonthly < 0) errors.push("Monthly insurance must be ≥ 0");

  reqPos("Refi interest rate", required.refiRate);
  if (required.refiCashIn < 0) errors.push("Cash-in paydown must be ≥ 0");

  if (optional.refiTermYears <= 0) errors.push("Refi term years must be > 0");

  if (optional.overridePIAmount != null && !(optional.overridePIAmount > 0)) {
    errors.push("Override P&I must be > 0 if provided");
  }

  return { errors, derived };
}

// -----------------------------
// Simulation
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

  const refiClose = pctToDecimal(optional.refiClosingPct);
  const refiTermMonths = Math.round(optional.refiTermYears * 12);

  const currRateAnnual = pctToDecimal(required.currRate);
  const currTermMonths = Math.round(derived.monthsRemaining);
  const currPIComputed = mortgagePayment(required.loanBalance, currRateAnnual, currTermMonths);
  const currPIForCashFlow = (optional.overridePIAmount != null) ? optional.overridePIAmount : currPIComputed;

  const refiRateAnnual = pctToDecimal(required.refiRate);

  // Equal starting net worth: assume refi cash-in exists in all scenarios at Year 0
  const startingCash = Math.max(0, required.refiCashIn);
  const baselineEquity = required.homeValue - required.loanBalance;
  const baselineNW = baselineEquity + startingCash;

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
      invest: startingCash,
      oop: 0, // negative drag
      yearCashFlows: Array(YEARS + 1).fill(0) // year 1..YEARS
    };
  }

  const sell = makeScenario("SELL");
  const rentKeep = makeScenario("RENT_NO_REFI");
  const rentRefi = makeScenario("RENT_WITH_REFI");

  // Series (0..YEARS)
  const series = {
    years: Array.from({ length: YEARS + 1 }, (_, i) => i),
    sellNW: Array(YEARS + 1).fill(0),
    rentKeepNW: Array(YEARS + 1).fill(0),
    rentRefiNW: Array(YEARS + 1).fill(0),

    sellIncome: Array(YEARS + 1).fill(0),
    rentKeepIncome: Array(YEARS + 1).fill(0),
    rentRefiIncome: Array(YEARS + 1).fill(0),

    // extra for summary
    rentKeepYear1AnnualCF: 0,
    rentRefiYear1AnnualCF: 0
  };

  // Year 0 equal
  series.sellNW[0] = baselineNW;
  series.rentKeepNW[0] = baselineNW;
  series.rentRefiNW[0] = baselineNW;

  // Apply decisions at start of Month 1 (so Year 0 remains equal)
  // SELL transaction
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

  // RENT_WITH_REFI transaction
  {
    const cashIn = Math.min(rentRefi.invest, required.refiCashIn);
    rentRefi.invest -= cashIn;
    rentRefi.loanBal = Math.max(0, rentRefi.loanBal - cashIn);

    const closingCosts = rentRefi.loanBal * refiClose;
    if (rentRefi.invest >= closingCosts) rentRefi.invest -= closingCosts;
    else {
      const shortfall = closingCosts - rentRefi.invest;
      rentRefi.invest = 0;
      rentRefi.oop -= shortfall;
    }
  }

  const refiPI = mortgagePayment(rentRefi.loanBal, refiRateAnnual, refiTermMonths);

  // Track immediate SELL net worth “hit” due to transaction costs (nearest $1K)
  // Hit = baselineNW - SELL net worth right after the sale transaction (before any compounding)
  const sellNWAfterTransaction = sell.invest + sell.oop;
  const sellTransactionHit = roundTo1K(baselineNW - sellNWAfterTransaction);

  // Monthly evolving values
  let rent = required.monthlyRent;
  let taxes = required.taxesMonthly;
  let ins = required.insMonthly;

  for (let m = 1; m <= MONTHS; m++) {
    rent *= (1 + inflM);
    taxes *= (1 + inflM);
    ins *= (1 + inflM);

    rentKeep.homeValue *= (1 + homeAppM);
    rentRefi.homeValue *= (1 + homeAppM);

    sell.invest *= (1 + marketM);
    rentKeep.invest *= (1 + marketM);
    rentRefi.invest *= (1 + marketM);

    // RENT (w/o REFI)
    {
      const opCosts = rent * (vacancy + maint + capex + pm);

      let piCash = 0;
      if (rentKeep.loanBal > 0) {
        piCash = currPIForCashFlow;

        const interest = rentKeep.loanBal * (currRateAnnual / 12);
        const principalPaid = Math.max(0, currPIComputed - interest);
        rentKeep.loanBal = Math.max(0, rentKeep.loanBal - principalPaid);
      }

      let net = rent - opCosts - piCash - taxes - ins;
      if (net > 0 && rentalTax > 0) net *= (1 - rentalTax);

      if (net >= 0) rentKeep.invest += net;
      else rentKeep.oop += net;

      const year = Math.ceil(m / 12);
      rentKeep.yearCashFlows[year] += net;
    }

    // RENT (w/ REFI)
    {
      const opCosts = rent * (vacancy + maint + capex + pm);

      let piCash = 0;
      if (rentRefi.loanBal > 0) {
        piCash = refiPI;

        const interest = rentRefi.loanBal * (refiRateAnnual / 12);
        const principalPaid = Math.max(0, refiPI - interest);
        rentRefi.loanBal = Math.max(0, rentRefi.loanBal - principalPaid);
      }

      let net = rent - opCosts - piCash - taxes - ins;
      if (net > 0 && rentalTax > 0) net *= (1 - rentalTax);

      if (net >= 0) rentRefi.invest += net;
      else rentRefi.oop += net;

      const year = Math.ceil(m / 12);
      rentRefi.yearCashFlows[year] += net;
    }

    // end of year snapshots
    if (m % 12 === 0) {
      const y = m / 12;

      series.sellNW[y] = sell.invest + sell.oop;
      series.rentKeepNW[y] = (rentKeep.homeValue - rentKeep.loanBal) + rentKeep.invest + rentKeep.oop;
      series.rentRefiNW[y] = (rentRefi.homeValue - rentRefi.loanBal) + rentRefi.invest + rentRefi.oop;

      const wd = pctToDecimal(optional.withdrawalRate);
      series.sellIncome[y] = sell.invest * wd;
      series.rentKeepIncome[y] = rentKeep.yearCashFlows[y];
      series.rentRefiIncome[y] = rentRefi.yearCashFlows[y];

      if (y === 1) {
        series.rentKeepYear1AnnualCF = rentKeep.yearCashFlows[1];
        series.rentRefiYear1AnnualCF = rentRefi.yearCashFlows[1];
      }
    }
  }

  return {
    series,
    meta: {
      baselineNW,
      startingCash,
      yearsLived: derived.yearsLived,
      currPIComputed,
      currPIForCashFlow,
      refiPI,
      sellTransactionHit,
      saleClosePct: optional.saleClosingPct,
      taxLine: (derived.yearsLived ?? 0) >= 2
        ? "Sale tax: assumed 0% capital gains tax because time in home ≥ 2 years (simplified rule)."
        : (optional.costBasis == null
          ? "Sale tax: time in home < 2 years, but cost basis blank ⇒ assumes no capital gain (simplified rule)."
          : `Sale tax: time in home < 2 years ⇒ applies ${optional.capGainsRate.toFixed(1)}% to (sale price − cost basis).`)
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
  if (key === "rentKeep") return "RENT (w/o REFI)";
  if (key === "rentRefi") return "RENT (w/ REFI)";
  return "—";
}

function pickWinnerAtYear(series, y, which) {
  const vals = [
    { key: "sell", v: which === "income" ? series.sellIncome[y] : series.sellNW[y] },
    { key: "rentKeep", v: which === "income" ? series.rentKeepIncome[y] : series.rentKeepNW[y] },
    { key: "rentRefi", v: which === "income" ? series.rentRefiIncome[y] : series.rentRefiNW[y] }
  ].sort((a, b) => b.v - a.v);
  return { top: vals[0], bottom: vals[2] };
}

function renderWinners(series) {
  const nw = pickWinnerAtYear(series, YEARS, "nw");
  const inc = pickWinnerAtYear(series, YEARS, "income");

  $("netWorthWinner").textContent = `${labelScenario(nw.top.key)} (${money(nw.top.v)})`;
  $("incomeWinner").textContent = `${labelScenario(inc.top.key)} (${money(nwIncToAnnual(inc.top.v))})`;
}

function nwIncToAnnual(v) {
  // income values already annual. Keep as is, but normalize NaN.
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
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
        { label: "RENT (w/o REFI)", data: series.rentKeepNW, tension: 0.25, pointRadius: 0, borderWidth: 2 },
        { label: "RENT (w/ REFI)", data: series.rentRefiNW, tension: 0.25, pointRadius: 0, borderWidth: 2 }
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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>${money(series.sellNW[y])}</td>
      <td>${money(series.rentKeepNW[y])}</td>
      <td>${money(series.rentRefiNW[y])}</td>
      <td>${money(series.sellIncome[y])}</td>
      <td>${money(series.rentKeepIncome[y])}</td>
      <td>${money(series.rentRefiIncome[y])}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderResultsSummary(series, meta) {
  const y = YEARS;

  const nw = pickWinnerAtYear(series, y, "nw");
  const inc = pickWinnerAtYear(series, y, "income");

  const nwTop = labelScenario(nw.top.key);
  const nwBottom = labelScenario(nw.bottom.key);

  const incTop = labelScenario(inc.top.key);
  const incBottom = labelScenario(inc.bottom.key);

  const sellHit = meta.sellTransactionHit; // already rounded to $1K

  const rentNoRefiYear1Annual = roundTo1K(series.rentKeepYear1AnnualCF);
  const rentWithRefiYear1Annual = roundTo1K(series.rentRefiYear1AnnualCF);

  const rentNoRefiMonthly = roundTo1K(rentNoRefiYear1Annual / 12);
  const rentWithRefiMonthly = roundTo1K(rentWithRefiYear1Annual / 12);

  const ul = $("resultsSummary");
  ul.innerHTML = "";

  const li = (text) => {
    const el = document.createElement("li");
    el.textContent = text;
    ul.appendChild(el);
  };

  li(`Net Worth: ${nwTop} results in your highest net worth in ${y} years, while ${nwBottom} resulted in your lowest net worth.`);
  li(`Portfolio Income: ${incTop} results in your highest income potential in ${y} years, while ${incBottom} resulted in your lowest income potential.`);
  li(`SELL: Your net worth takes a ~${moneyK(sellHit)} hit due to total transaction costs.`);
  li(`RENT (w/o REFI): Renting your home (without refinancing) results in an estimated net income of ${moneyK(rentNoRefiMonthly)} per month (${moneyK(rentNoRefiYear1Annual)} per year) in year 1.`);
  li(`RENT (w/ REFI): Renting your home (with refinancing) results in an estimated net income of ${moneyK(rentWithRefiMonthly)} per month (${moneyK(rentWithRefiYear1Annual)} per year) in year 1.`);
}

function renderAssumptionNote(meta, inputs) {
  const { required, optional } = inputs;
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
      ${piLine}<br/>
      Refi P&amp;I (computed): ${money(meta.refiPI)} · Refi closing costs: ${optional.refiClosingPct.toFixed(1)}% of new loan<br/>
      Starting net worth is equal at Year 0 (we assume the refi cash-in amount exists in all scenarios at Year 0).
    </div>
  `;
}

function buildCsv(series) {
  const header = [
    "Year",
    "SELL_NetWorth",
    "RENT_wo_REFI_NetWorth",
    "RENT_w_REFI_NetWorth",
    "SELL_Income",
    "RENT_wo_REFI_Income",
    "RENT_w_REFI_Income"
  ];
  const rows = [header.join(",")];

  for (let y = 0; y <= YEARS; y++) {
    rows.push([
      y,
      series.sellNW[y],
      series.rentKeepNW[y],
      series.rentRefiNW[y],
      series.sellIncome[y],
      series.rentKeepIncome[y],
      series.rentRefiIncome[y]
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
function updateYearsPreview() {
  const inputs = parseInputs();
  const { derived } = validateInputs(inputs); // returns derived even if errors
  const preview = $("yearsLivedPreview");
  if (!inputs.required.movedIn) {
    preview.textContent = "Years lived: —";
    return;
  }
  const end = inputs.required.stillLiveHere ? getTodayMonthStart() : inputs.required.movedOut;
  if (!end) {
    preview.textContent = "Years lived: —";
    return;
  }
  const y = yearsBetween(inputs.required.movedIn, end);
  preview.textContent = `Years lived: ${y.toFixed(2)}`;
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

  renderChart(result.series);
  renderTable(result.series);

  // Winners @ year 30
  const nw = pickWinnerAtYear(result.series, YEARS, "nw");
  const inc = pickWinnerAtYear(result.series, YEARS, "income");
  $("netWorthWinner").textContent = `${labelScenario(nw.top.key)} (${money(nw.top.v)})`;
  $("incomeWinner").textContent = `${labelScenario(inc.top.key)} (${money(inc.top.v)})`;

  renderResultsSummary(result.series, result.meta);
  renderAssumptionNote(result.meta, inputs);
}

function resetAll() {
  [
    "homeValue","loanBalance","monthlyRent",
    "movedIn","movedOut","currRate","loanEnd",
    "taxesMonthly","insMonthly","refiRate","refiCashIn"
  ].forEach(id => { $(id).value = ""; });

  $("stillLiveHere").checked = false;
  $("overridePIAmount").value = "";
  $("yearsLivedPreview").textContent = "Years lived: —";

  $("netWorthWinner").textContent = "—";
  $("incomeWinner").textContent = "—";
  $("resultsSummary").innerHTML = "<li>—</li>";
  $("summaryTable").querySelector("tbody").innerHTML = "";
  $("assumptionNote").innerHTML = "";

  if (chart) chart.destroy();
  chart = null;
  lastResult = null;
}

function init() {
  $("yearNow").textContent = new Date().getFullYear();

  wireOptionalAccordion();

  // Residence date interactions
  $("stillLiveHere").addEventListener("change", (e) => {
    $("movedOut").disabled = e.target.checked;
    if (e.target.checked) $("movedOut").value = "";
    updateYearsPreview();
  });
  $("movedIn").addEventListener("change", updateYearsPreview);
  $("movedOut").addEventListener("change", updateYearsPreview);

  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("btnCsv").addEventListener("click", () => {
    if (!lastResult) return alert("Run a calculation first.");
    const csv = buildCsv(lastResult.result.series);
    downloadText("sell-vs-rent-my-house-30y.csv", csv);
  });

  updateYearsPreview();
}

document.addEventListener("DOMContentLoaded", init);
