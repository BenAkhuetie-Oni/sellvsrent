// Sell vs Rent My House Calculator — client-side for GitHub Pages
// Deterministic monthly simulation, nominal assumptions, Chart.js rendering

"use strict";

// -----------------------------
// Utilities
// -----------------------------
const $ = (id) => document.getElementById(id);

function clampNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function pctToDecimal(pct) {
  return clampNumber(pct, 0) / 100;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function money2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function percent(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return (x * 100).toFixed(2) + "%";
}

function annualToMonthlyRate(annualDecimal) {
  // nominal monthly compounding
  return Math.pow(1 + annualDecimal, 1 / 12) - 1;
}

function mortgagePayment(principal, annualRateDecimal, termMonths) {
  if (termMonths <= 0) return 0;
  if (principal <= 0) return 0;
  const r = annualRateDecimal / 12;
  if (r === 0) return principal / termMonths;
  return principal * (r / (1 - Math.pow(1 + r, -termMonths)));
}

// -----------------------------
// Parsing inputs
// -----------------------------
function parseInputs() {
  const required = {
    homeValue: clampNumber($("homeValue").value),
    loanBalance: clampNumber($("loanBalance").value),
    monthlyRent: clampNumber($("monthlyRent").value),
    yearsLived: clampNumber($("yearsLived").value),

    currRate: clampNumber($("currRate").value),
    currYearsRemaining: clampNumber($("currYearsRemaining").value),
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
    overridePI: $("overridePI").checked,
    overridePIAmount: clampNumber($("overridePIAmount").value),
  };

  return { required, optional };
}

function validateInputs({ required, optional }) {
  const errors = [];
  function reqPositive(name, val) {
    if (!(val > 0)) errors.push(`${name} must be > 0`);
  }

  reqPositive("Home value", required.homeValue);
  if (required.loanBalance < 0) errors.push("Remaining loan balance must be ≥ 0");
  if (required.monthlyRent < 0) errors.push("Estimated monthly rent must be ≥ 0");

  reqPositive("Current interest rate", required.currRate);
  reqPositive("Years remaining on current loan", required.currYearsRemaining);

  if (required.taxesMonthly < 0) errors.push("Monthly property taxes must be ≥ 0");
  if (required.insMonthly < 0) errors.push("Monthly insurance must be ≥ 0");

  reqPositive("Refi interest rate", required.refiRate);
  if (required.refiCashIn < 0) errors.push("Cash-in paydown must be ≥ 0");

  if (optional.refiTermYears <= 0) errors.push("Refi term years must be > 0");

  if (optional.overridePI && !(optional.overridePIAmount > 0)) {
    errors.push("Override P&I amount must be > 0 when enabled");
  }

  return errors;
}

// -----------------------------
// Simulation
// -----------------------------
const YEARS = 50;
const MONTHS = YEARS * 12;

function runSimulation(inputs) {
  const { required, optional } = inputs;

  // Annual rates (decimals)
  const marketAnnual = pctToDecimal(optional.marketReturn);
  const homeAppAnnual = pctToDecimal(optional.homeAppreciation);
  const inflAnnual = pctToDecimal(optional.inflation);

  const marketM = annualToMonthlyRate(marketAnnual);
  const homeAppM = annualToMonthlyRate(homeAppAnnual);
  const inflM = annualToMonthlyRate(inflAnnual);

  // Rental expense percents (decimals)
  const vacancy = pctToDecimal(optional.vacancyPct);
  const maint = pctToDecimal(optional.maintPct);
  const capex = pctToDecimal(optional.capexPct);
  const pm = pctToDecimal(optional.pmPct);
  const rentalTax = pctToDecimal(optional.rentalTaxRate);

  // Sale assumptions
  const saleClose = pctToDecimal(optional.saleClosingPct);
  const capGainsRate = pctToDecimal(optional.capGainsRate);

  // Refi assumptions
  const refiClose = pctToDecimal(optional.refiClosingPct);
  const refiTermMonths = Math.round(optional.refiTermYears * 12);

  // Starting external cash pool to keep Year 0 equal across scenarios:
  // We assume cash-in used in refi exists in all scenarios at Year 0.
  const startingCash = Math.max(0, required.refiCashIn);

  // Baseline Year 0 net worth is identical (pre-decision)
  const baselineEquity = required.homeValue - required.loanBalance;
  const baselineNW = baselineEquity + startingCash;

  // Mortgage (current) amortization inputs
  const currRateAnnual = pctToDecimal(required.currRate);
  const currTermMonths = Math.round(required.currYearsRemaining * 12);
  const currPIComputed = mortgagePayment(required.loanBalance, currRateAnnual, currTermMonths);
  const currPIForCashFlow = optional.overridePI ? optional.overridePIAmount : currPIComputed;

  // Rental starting values
  const rent0 = required.monthlyRent;

  // Taxes + insurance start values (inflate monthly)
  const taxes0 = required.taxesMonthly;
  const ins0 = required.insMonthly;

  // Helper: sale tax simplified
  function computeSaleTax(salePrice) {
    if (required.yearsLived >= 2) return 0;
    // If cost basis provided, tax on gain; else assume no gain for simplicity.
    if (optional.costBasis == null) return 0;
    const gain = Math.max(0, salePrice - optional.costBasis);
    return gain * capGainsRate;
  }

  // Scenario state
  function makeScenario(kind) {
    return {
      kind,
      homeValue: required.homeValue,
      loanBal: required.loanBalance,

      // "investment" starts as the assumed starting cash pool (same in all scenarios at Year 0)
      invest: startingCash,

      // out-of-pocket is tracked separately (<=0 drag)
      oop: 0,

      // tracking for annual rental cash flow income
      yearCashFlows: Array(YEARS + 1).fill(0), // year index 1..50 used; year 0 = 0
    };
  }

  const sell = makeScenario("SELL");
  const rentKeep = makeScenario("RENT_KEEP");
  const rentRefi = makeScenario("RENT_REFI");

  // Record series (Year 0..50)
  const series = {
    years: Array.from({ length: YEARS + 1 }, (_, i) => i),
    sellNW: Array(YEARS + 1).fill(0),
    rentKeepNW: Array(YEARS + 1).fill(0),
    rentRefiNW: Array(YEARS + 1).fill(0),

    sellInvest: Array(YEARS + 1).fill(0),
    rentKeepInvest: Array(YEARS + 1).fill(0),
    rentRefiInvest: Array(YEARS + 1).fill(0),

    sellIncome: Array(YEARS + 1).fill(0),
    rentKeepIncome: Array(YEARS + 1).fill(0),
    rentRefiIncome: Array(YEARS + 1).fill(0),
  };

  // Set Year 0 equal across all scenarios
  series.sellNW[0] = baselineNW;
  series.rentKeepNW[0] = baselineNW;
  series.rentRefiNW[0] = baselineNW;

  series.sellInvest[0] = sell.invest;
  series.rentKeepInvest[0] = rentKeep.invest;
  series.rentRefiInvest[0] = rentRefi.invest;

  // -----------------------------
  // Apply decisions at start of Month 1 (so Year 0 stays equal)
  // -----------------------------

  // SELL: sell home and invest proceeds
  {
    const salePrice = sell.homeValue;
    const saleClosingCosts = salePrice * saleClose;
    const saleTax = computeSaleTax(salePrice);
    const netAfterCloseTax = salePrice - saleClosingCosts - saleTax;

    // Pay off loan balance from proceeds
    const payoff = Math.min(netAfterCloseTax, sell.loanBal);
    const remainingProceeds = netAfterCloseTax - payoff;

    sell.loanBal = 0;
    sell.homeValue = 0;

    // Invest remaining proceeds (can be negative if underwater + large closing costs; treat as oop)
    if (remainingProceeds >= 0) {
      sell.invest += remainingProceeds;
    } else {
      // If selling results in a shortfall, treat as out-of-pocket
      sell.oop += remainingProceeds; // negative
    }
  }

  // RENT_KEEP: no upfront transaction (keep home + loan)

  // RENT_REFI: execute refi + cash-in paydown + closing costs
  {
    // cash-in paydown comes from starting cash pool in this scenario
    const cashIn = Math.min(rentRefi.invest, required.refiCashIn);
    rentRefi.invest -= cashIn;

    rentRefi.loanBal = Math.max(0, rentRefi.loanBal - cashIn);

    // Closing costs on new loan (paid out-of-pocket from invest first, then oop)
    const closingCosts = rentRefi.loanBal * refiClose;
    if (rentRefi.invest >= closingCosts) {
      rentRefi.invest -= closingCosts;
    } else {
      const shortfall = closingCosts - rentRefi.invest;
      rentRefi.invest = 0;
      rentRefi.oop -= shortfall; // negative
    }

    // Refi resets term; rate changes; payment computed later in monthly loop using refi params
  }

  // Precompute refi payment (loan amount after paydown)
  const refiRateAnnual = pctToDecimal(required.refiRate);
  const refiPI = mortgagePayment(rentRefi.loanBal, refiRateAnnual, refiTermMonths);

  // -----------------------------
  // Monthly loop (Month 1..600)
  // -----------------------------
  let rent = rent0;
  let taxes = taxes0;
  let ins = ins0;

  for (let m = 1; m <= MONTHS; m++) {
    // Grow rent and non-financing costs monthly
    rent *= (1 + inflM);
    taxes *= (1 + inflM);
    ins *= (1 + inflM);

    // Grow home values monthly for rental scenarios
    rentKeep.homeValue *= (1 + homeAppM);
    rentRefi.homeValue *= (1 + homeAppM);

    // Grow investments monthly
    sell.invest *= (1 + marketM);
    rentKeep.invest *= (1 + marketM);
    rentRefi.invest *= (1 + marketM);

    // SELL has no rental cash flow; nothing to add
    // RENT_KEEP cash flow
    {
      const opCosts =
        rent * (vacancy + maint + capex + pm);

      // Current mortgage amortization step (cash flow uses currPIForCashFlow; amort uses computed schedule)
      let piCash = 0;
      if (rentKeep.loanBal > 0) {
        piCash = currPIForCashFlow;

        // amortize using computed schedule
        const interest = rentKeep.loanBal * (currRateAnnual / 12);
        const principalPaid = Math.max(0, currPIComputed - interest);
        rentKeep.loanBal = Math.max(0, rentKeep.loanBal - principalPaid);
      }

      let net = rent - opCosts - piCash - taxes - ins;

      // Optional rental tax on positive cash flow only
      if (net > 0 && rentalTax > 0) net *= (1 - rentalTax);

      // Invest surplus; deficit becomes out-of-pocket drag
      if (net >= 0) {
        rentKeep.invest += net;
      } else {
        rentKeep.oop += net; // negative
      }

      // Accumulate annual income (year index 1..50)
      const year = Math.ceil(m / 12);
      rentKeep.yearCashFlows[year] += net;
    }

    // RENT_REFI cash flow
    {
      const opCosts =
        rent * (vacancy + maint + capex + pm);

      // Refi amortization + payment
      let piCash = 0;
      if (rentRefi.loanBal > 0) {
        piCash = refiPI;

        const interest = rentRefi.loanBal * (refiRateAnnual / 12);
        const principalPaid = Math.max(0, refiPI - interest);
        rentRefi.loanBal = Math.max(0, rentRefi.loanBal - principalPaid);
      }

      let net = rent - opCosts - piCash - taxes - ins;

      if (net > 0 && rentalTax > 0) net *= (1 - rentalTax);

      if (net >= 0) {
        rentRefi.invest += net;
      } else {
        rentRefi.oop += net; // negative
      }

      const year = Math.ceil(m / 12);
      rentRefi.yearCashFlows[year] += net;
    }

    // Capture end-of-year snapshots
    if (m % 12 === 0) {
      const y = m / 12;

      // Net worth definitions
      series.sellNW[y] = sell.invest + sell.oop; // no home
      series.rentKeepNW[y] = (rentKeep.homeValue - rentKeep.loanBal) + rentKeep.invest + rentKeep.oop;
      series.rentRefiNW[y] = (rentRefi.homeValue - rentRefi.loanBal) + rentRefi.invest + rentRefi.oop;

      series.sellInvest[y] = sell.invest;
      series.rentKeepInvest[y] = rentKeep.invest;
      series.rentRefiInvest[y] = rentRefi.invest;

      // Income potential
      const wd = pctToDecimal(optional.withdrawalRate);
      series.sellIncome[y] = sell.invest * wd;
      series.rentKeepIncome[y] = rentKeep.yearCashFlows[y];
      series.rentRefiIncome[y] = rentRefi.yearCashFlows[y];
    }
  }

  // Also set Year 0 incomes as 0 for display
  series.sellIncome[0] = 0;
  series.rentKeepIncome[0] = 0;
  series.rentRefiIncome[0] = 0;

  // Carry Year 0 invest balances (already set)
  return {
    series,
    meta: {
      currPIComputed,
      currPIForCashFlow,
      refiPI,
      baselineNW,
      saleClose,
      yearsLived: required.yearsLived,
      capGainsUnder2: optional.capGainsRate,
      costBasis: optional.costBasis,
      startingCash,
    }
  };
}

// -----------------------------
// Winners + UI rendering
// -----------------------------
let chart = null;
let lastResult = null;

function scenarioName(key) {
  if (key === "sell") return "Sell";
  if (key === "rentKeep") return "Rent";
  if (key === "rentRefi") return "Rent+Refi";
  return key;
}

function pickWinnerAtYear(series, y) {
  const values = [
    { key: "sell", v: series.sellNW[y] },
    { key: "rentKeep", v: series.rentKeepNW[y] },
    { key: "rentRefi", v: series.rentRefiNW[y] },
  ].sort((a, b) => b.v - a.v);

  const top = values[0];
  const second = values[1];
  const diff = top.v - second.v;

  return { winnerKey: top.key, winnerValue: top.v, runnerUpValue: second.v, diff };
}

function renderWinners(series) {
  const years = [1, 5, 10, 30, 50];
  const grid = $("winnersGrid");
  grid.innerHTML = "";

  years.forEach((y) => {
    const w = pickWinnerAtYear(series, y);
    const el = document.createElement("div");
    el.className = "miniCard" + (y === 50 ? " emph" : "");
    el.innerHTML = `
      <div class="miniTop">
        <div class="miniYear">Year ${y}</div>
        <div class="miniWinner">${scenarioName(w.winnerKey)}</div>
      </div>
      <div class="miniVal">${money(w.winnerValue)}</div>
      <div class="miniSub">Lead vs #2: ${money(w.diff)}</div>
    `;
    grid.appendChild(el);
  });

  const long = pickWinnerAtYear(series, 50);
  $("longTermWinner").textContent = `${scenarioName(long.winnerKey)} (${money(long.winnerValue)})`;
}

function renderTable(series) {
  const years = [0, 1, 5, 10, 30, 50];
  const tbody = $("summaryTable").querySelector("tbody");
  tbody.innerHTML = "";

  years.forEach((y) => {
    const w = y === 0 ? { winnerKey: "—" } : pickWinnerAtYear(series, y);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>${money(series.sellNW[y])}</td>
      <td>${money(series.rentKeepNW[y])}</td>
      <td>${money(series.rentRefiNW[y])}</td>
      <td>${money(series.sellIncome[y])}</td>
      <td>${money(series.rentKeepIncome[y])}</td>
      <td>${money(series.rentRefiIncome[y])}</td>
      <td>${y === 0 ? "—" : scenarioName(w.winnerKey)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderChart(series) {
  const ctx = $("nwChart").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.years,
      datasets: [
        {
          label: "Sell",
          data: series.sellNW,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "Rent",
          data: series.rentKeepNW,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "Rent + Refi",
          data: series.rentRefiNW,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        }
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

function renderAssumptionNote(meta, inputs) {
  const { required, optional } = inputs;
  const note = $("assumptionNote");

  const taxLine =
    required.yearsLived >= 2
      ? "Sale tax: assumed 0% capital gains tax because years lived ≥ 2 (simplified rule)."
      : (optional.costBasis == null
          ? "Sale tax: years lived < 2, but cost basis blank ⇒ assumes no capital gain (simplified rule)."
          : `Sale tax: years lived < 2 ⇒ applies ${optional.capGainsRate.toFixed(1)}% to (sale price − cost basis).`);

  const piLine = optional.overridePI
    ? `Current P&I for cash flow: overridden to ${money(meta.currPIForCashFlow)} (amortization still uses computed payment ${money(meta.currPIComputed)}).`
    : `Current P&I: computed as ${money(meta.currPIComputed)} from balance/rate/term.`;

  note.innerHTML = `
    <div class="muted">
      <strong>Key assumptions (editable in Optional Assumptions):</strong><br/>
      Market return: ${optional.marketReturn.toFixed(1)}% · Home appreciation: ${optional.homeAppreciation.toFixed(1)}% · Inflation/rent growth: ${optional.inflation.toFixed(1)}%<br/>
      Rental costs: Vacancy ${optional.vacancyPct.toFixed(1)}%, Maint ${optional.maintPct.toFixed(1)}%, CapEx ${optional.capexPct.toFixed(1)}%, PM ${optional.pmPct.toFixed(1)}% · Rental tax rate: ${optional.rentalTaxRate.toFixed(1)}%<br/>
      ${taxLine}<br/>
      ${piLine}<br/>
      Refi P&amp;I (computed): ${money(meta.refiPI)} · Refi closing costs: ${optional.refiClosingPct.toFixed(1)}% of new loan<br/>
      Starting net worth is equal at Year 0 (we assume the refi cash-in amount exists in all scenarios at Year 0).
    </div>
  `;
}

function buildCsv(series) {
  const header = [
    "Year",
    "Sell_NetWorth",
    "Rent_NetWorth",
    "RentRefi_NetWorth",
    "Sell_Income",
    "Rent_Income",
    "RentRefi_Income"
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
// Events + init
// -----------------------------
function run() {
  const inputs = parseInputs();
  const errs = validateInputs(inputs);

  if (errs.length) {
    alert("Please fix:\n\n- " + errs.join("\n- "));
    return;
  }

  const result = runSimulation(inputs);
  lastResult = { inputs, result };

  renderWinners(result.series);
  renderChart(result.series);
  renderTable(result.series);
  renderAssumptionNote(result.meta, inputs);
}

function resetAll() {
  // Light reset: clear required fields; keep optional defaults
  ["homeValue","loanBalance","monthlyRent","yearsLived","currRate","currYearsRemaining","taxesMonthly","insMonthly","refiRate","refiCashIn"].forEach(id => {
    $(id).value = "";
  });
  $("overridePI").checked = false;
  $("overridePIAmount").value = "";
  $("overridePIInputs").style.display = "none";
  lastResult = null;

  // Clear results
  $("longTermWinner").textContent = "—";
  $("winnersGrid").innerHTML = "";
  $("summaryTable").querySelector("tbody").innerHTML = "";
  $("assumptionNote").innerHTML = "";

  if (chart) chart.destroy();
  chart = null;
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

  // start collapsed
  body.style.display = "none";
}

function wireOverridePI() {
  $("overridePI").addEventListener("change", (e) => {
    $("overridePIInputs").style.display = e.target.checked ? "grid" : "none";
  });
}

function init() {
  $("yearNow").textContent = new Date().getFullYear();

  wireOptionalAccordion();
  wireOverridePI();

  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("btnCsv").addEventListener("click", () => {
    if (!lastResult) {
      alert("Run a calculation first.");
      return;
    }
    const csv = buildCsv(lastResult.result.series);
    downloadText("sell-vs-rent-my-house.csv", csv);
  });

  // Nice defaults for a first render if user clicks Run without typing
  // (leave blank; placeholders guide them)
}

document.addEventListener("DOMContentLoaded", init);
