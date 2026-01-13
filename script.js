// Sell vs Rent Calculator (Outside Financial Freedom)
// Pure client-side model. Not financial/tax advice.

const YEARS = 30;

function $(id){ return document.getElementById(id); }

function numVal(id){
  const el = $(id);
  if(!el) return 0;
  const v = String(el.value ?? '').trim();
  if(v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function pctToDec(p){ return (p ?? 0) / 100; }

function moneyAbbrev(n){
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if(a >= 1_000_000){
    return sign + "$" + (a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1) + "M";
  }
  if(a >= 1_000){
    return sign + "$" + (a / 1_000).toFixed(0) + "K";
  }
  return sign + "$" + a.toFixed(0);
}

function money(n){
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  return sign + "$" + a.toLocaleString(undefined, {maximumFractionDigits:0});
}

function monthsBetween(a, b){
  // a, b: {y, m} where m is 1-12. Returns count of months from a to b (inclusive end not assumed).
  return (b.y - a.y) * 12 + (b.m - a.m);
}

function parseMonthInput(val){
  // 'YYYY-MM' -> {y,m}
  if(!val) return null;
  const [y, m] = val.split("-").map(Number);
  if(!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return {y, m};
}

function calcMonthlyPI(balance, aprPct, loanEndYM){
  const now = new Date();
  const nowYM = { y: now.getFullYear(), m: now.getMonth() + 1 };

  if(!loanEndYM) return {pi: 0, monthsRemaining: 0};
  const monthsRemaining = Math.max(1, monthsBetween(nowYM, loanEndYM));
  const r = (aprPct/100) / 12;

  if(balance <= 0) return {pi: 0, monthsRemaining};
  if(r <= 0){
    return {pi: balance / monthsRemaining, monthsRemaining};
  }
  const pi = balance * (r * Math.pow(1 + r, monthsRemaining)) / (Math.pow(1 + r, monthsRemaining) - 1);
  return {pi, monthsRemaining};
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

function getInputs(){
  const homeValue = numVal("homeValue");
  const loanBalance = numVal("loanBalance");
  const rentMonthly = numVal("rentMonthly");

  const currRate = numVal("currRate");
  const loanEnd = parseMonthInput($("loanEnd").value);

  const taxesMonthly = numVal("taxesMonthly");
  const insMonthly = numVal("insMonthly");

  const movedIn = parseMonthInput($("movedIn").value);
  const movedOut = parseMonthInput($("movedOut").value);

  // Optionals
  const saleClosingPct = numVal("saleClosingPct");
  const marketReturn = numVal("marketReturn");
  const homeAppreciation = numVal("homeAppreciation");
  const inflation = numVal("inflation");

  const vacancyPct = numVal("vacancyPct");
  const maintPct = numVal("maintPct");
  const capexPct = numVal("capexPct");
  const pmPct = numVal("pmPct");

  const rentalTaxRate = numVal("rentalTaxRate");
  const capGainsRate = numVal("capGainsRate");

  const costBasisRaw = $("costBasis").value.trim();
  const costBasis = costBasisRaw === "" ? null : Number(costBasisRaw);

  const overridePIRaw = $("overridePI").value.trim();
  const overridePI = overridePIRaw === "" ? null : Number(overridePIRaw);

  const required = { homeValue, loanBalance, rentMonthly, currRate, loanEnd, taxesMonthly, insMonthly, movedIn, movedOut };
  const optional = {
    saleClosingPct, marketReturn, homeAppreciation, inflation,
    vacancyPct, maintPct, capexPct, pmPct,
    rentalTaxRate, capGainsRate, costBasis, overridePI
  };
  return {required, optional};
}

function yearsInHome(movedIn, movedOut){
  if(!movedIn || !movedOut) return null;
  const months = monthsBetween(movedIn, movedOut);
  if(!Number.isFinite(months)) return null;
  return Math.max(0, months / 12);
}

function computeSaleTax(homeValue, costBasis, yearsLived, capGainsRatePct){
  // Simplified rule:
  // If time in home >= 2 years => assume 0% cap gains (primary residence exclusion simplification).
  // If < 2 years => apply cap gains rate to (sale price - cost basis) IF cost basis provided; if blank, assume no gain.
  if(yearsLived === null) return {tax: 0, ruleText: "Sale tax: dates blank ⇒ assume no capital gain (simplified rule)."};
  if(yearsLived >= 2) return {tax: 0, ruleText: "Sale tax: time in home ≥ 2 years ⇒ assume 0% capital gains tax (simplified rule)."};
  if(costBasis === null || !Number.isFinite(costBasis)){
    return {tax: 0, ruleText: "Sale tax: time in home < 2 years, but cost basis blank ⇒ assume no capital gain (simplified rule)."};
  }
  const gain = Math.max(0, homeValue - costBasis);
  const tax = gain * (capGainsRatePct/100);
  return {tax, ruleText: `Sale tax: time in home < 2 years ⇒ applies ${capGainsRatePct.toFixed(1)}% to (sale price − cost basis) (simplified rule).`};
}

function runSimulation(required, optional){
  const hv0 = required.homeValue;
  const loan0 = required.loanBalance;
  const rent0 = required.rentMonthly;

  const saleClose = pctToDec(optional.saleClosingPct);
  const rMarketM = Math.pow(1 + (optional.marketReturn/100), 1/12) - 1;
  const rHomeM = Math.pow(1 + (optional.homeAppreciation/100), 1/12) - 1;
  const rInflM = Math.pow(1 + (optional.inflation/100), 1/12) - 1;

  const vacancy = pctToDec(optional.vacancyPct);
  const maint = pctToDec(optional.maintPct);
  const capex = pctToDec(optional.capexPct);
  const pm = pctToDec(optional.pmPct);
  const rentalTax = pctToDec(optional.rentalTaxRate);

  const yearsLived = yearsInHome(required.movedIn, required.movedOut);
  const {tax: saleTax, ruleText: saleTaxRule} = computeSaleTax(hv0, optional.costBasis, yearsLived, optional.capGainsRate);

  const loanEndYM = required.loanEnd;
  const amort = calcMonthlyPI(loan0, required.currRate, loanEndYM);
  const computedPI = amort.pi;
  const piForCashFlow = (optional.overridePI !== null && Number.isFinite(optional.overridePI)) ? optional.overridePI : computedPI;

  // SELL: proceeds invested in stocks
  const saleClosingCost = hv0 * saleClose;
  const netProceeds = Math.max(0, hv0 - saleClosingCost - loan0 - saleTax);

  let sellStocks = netProceeds;
  let avoidedNegCFStocks = 0;

  // RENT: keep home + invest net cash flow in stocks
  let rentStocks = 0;
  let loanBal = loan0;
  let homeVal = hv0;

  let rentCashFlowTotal = 0;
  let rentNetAtY0 = 0;
  const rentNetFirstMonthOfYear = Array(YEARS + 1).fill(null);

  const nwSell = Array(YEARS + 1).fill(0);
  const nwRent = Array(YEARS + 1).fill(0);

  // Year 0 snapshot (before any monthly evolution)
  const equity0 = Math.max(0, hv0 - loan0);
  nwSell[0] = sellStocks;              // all stocks
  nwRent[0] = rentStocks + equity0;    // equity + stocks

  for(let m = 1; m <= YEARS * 12; m++){
    // update market stocks
    sellStocks *= (1 + rMarketM);
    avoidedNegCFStocks *= (1 + rMarketM);
    rentStocks *= (1 + rMarketM);

    // update home value
    homeVal *= (1 + rHomeM);

    // mortgage amortization (interest on current balance, principal from computedPI)
    let piPay = 0;
    if(loanBal > 0){
      piPay = computedPI;
      const r = (required.currRate/100)/12;
      const interest = loanBal * r;
      const principal = Math.max(0, piPay - interest);
      loanBal = Math.max(0, loanBal - principal);
    }

    // rent + expenses for this month
    const rent = rent0 * Math.pow(1 + rInflM, (m - 1));
    const taxes = required.taxesMonthly * Math.pow(1 + rInflM, (m - 1));
    const ins = required.insMonthly * Math.pow(1 + rInflM, (m - 1));

    const opCosts = rent * (vacancy + maint + capex + pm);
    let netCF = rent - opCosts - piForCashFlow - taxes - ins;
    if(netCF > 0 && rentalTax > 0) netCF *= (1 - rentalTax);

    rentCashFlowTotal += netCF;

    // store Year 0 first-month net and first month of each year
    if(m === 1) rentNetAtY0 = netCF;
    const yIdx = Math.floor((m - 1) / 12);
    if((m - 1) % 12 === 0) rentNetFirstMonthOfYear[yIdx] = netCF;

    if(netCF >= 0){
      rentStocks += netCF; // invest
    } else {
      // Negative cash flow: RENT requires out-of-pocket. We credit SELL with "Avoided Negative Cash Flow" invested in stocks.
      const avoided = -netCF;
      avoidedNegCFStocks += avoided;
      // Stocks cannot go negative for rent
      rentStocks = Math.max(0, rentStocks);
    }

    if(m % 12 === 0){
      const y = m / 12;
      const equity = Math.max(0, homeVal - loanBal);
      nwSell[y] = sellStocks + avoidedNegCFStocks;
      nwRent[y] = rentStocks + equity;
    }
  }

  // break-even year: first year where first-month net >= 0
  let breakEvenYear = null;
  for(let y = 0; y <= YEARS; y++){
    const v = rentNetFirstMonthOfYear[y];
    if(typeof v === "number" && v >= 0){ breakEvenYear = y; break; }
  }

  return {
    nwSell, nwRent,
    meta: {
      netProceeds,
      saleClosingCost,
      saleTax,
      saleTaxRule,
      computedPI,
      piForCashFlow,
      rentNetAtY0,
      breakEvenYear,
      rentCashFlowTotal,
      yearsLived
    },
    optional
  };
}

let chart = null;

function renderChart(series){
  const ctx = $("nwChart").getContext("2d");
  const labels = Array.from({length: YEARS + 1}, (_, i) => i);
  const dataSell = series.nwSell.map(v => v/1000);
  const dataRent = series.nwRent.map(v => v/1000);

  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:"line",
    data:{
      labels,
      datasets:[
        {label:"SELL", data:dataSell, tension:0.2},
        {label:"RENT", data:dataRent, tension:0.2}
      ]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ position:"top" } },
      scales:{
        y:{ ticks:{ callback:(v)=>"$" + v + "K" } },
        x:{ ticks:{ maxTicksLimit: 10 } }
      }
    }
  });
}

function netWorthCell(total, stocks, equity){
  return `
    <div class="nwCell">
      <div class="nwTotal"><strong>${moneyAbbrev(total)}</strong></div>
      <div class="nwParts">(${moneyAbbrev(stocks)} stocks, ${moneyAbbrev(equity)} home equity)</div>
    </div>
  `;
}

function renderTable(series){
  const tbody = $("summaryTable").querySelector("tbody");
  tbody.innerHTML = "";

  const years = [0,1,5,10,30];
  for(const y of years){
    const sellTotal = series.nwSell[y];
    const rentTotal = series.nwRent[y];

    // SELL has all stocks (including avoided neg cash flow), no equity
    const sellStocks = sellTotal;
    const sellEq = 0;

    // RENT has stocks + equity; equity = total - stocks. We don't track stocks separately by year directly,
    // but we can approximate via chart series by recomputing: for year y, equity = current home value - loanBal
    // Instead: show stocks as max(0, total - equity proxy) is not available.
    // So we will compute RENT stocks as: total - equity is unknown -> We compute via series from simulation? Not stored.
    // To keep this accurate, we store rentStocks and equity snapshots in simulation next.
    // (We patch below by storing them.)
    const rentStocks = series.rentStocksByYear ? series.rentStocksByYear[y] : 0;
    const rentEq = Math.max(0, rentTotal - rentStocks);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${y}</td>
      <td>${netWorthCell(sellTotal, sellStocks, sellEq)}</td>
      <td>${netWorthCell(rentTotal, rentStocks, rentEq)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderNotes(meta, optional){
  const noteSummary = $("resultsNotesSummary");
  const noteTable = $("resultsNotesTable");

  const lines = [
    `Market return: ${optional.marketReturn.toFixed(1)}%`,
    `Home appreciation: ${optional.homeAppreciation.toFixed(1)}%`,
    `Inflation/rent growth: ${optional.inflation.toFixed(1)}%`,
    `Rental costs: Vacancy ${optional.vacancyPct.toFixed(1)}%, Maint ${optional.maintPct.toFixed(1)}%, CapEx ${optional.capexPct.toFixed(1)}%, PM ${optional.pmPct.toFixed(1)}%`,
    `Rental tax on positive cash flow: ${optional.rentalTaxRate.toFixed(1)}%`,
    `Sale closing costs: ${optional.saleClosingPct.toFixed(1)}%`,
    `Current P&I: computed as ${money(meta.computedPI)} from balance/rate/loan-end date.`,
    `Avoided Negative Cash Flow: When RENT net cash flow is negative, we assume SELL avoids that outflow and invests the same amount in stocks at the market return.`
  ];

  const html = `
    <div class="noteTitle">Key assumptions (editable in Optional assumptions):</div>
    <ul>${lines.map(x => `<li>${x}</li>`).join("")}</ul>
  `;

  noteSummary.innerHTML = html;
  noteTable.innerHTML = html;
}

function renderSummary(series, meta){
  const y30Sell = series.nwSell[30];
  const y30Rent = series.nwRent[30];

  const winner = y30Sell >= y30Rent ? "SELL" : "RENT";
  const loser = winner === "SELL" ? "RENT" : "SELL";
  const wVal = winner === "SELL" ? y30Sell : y30Rent;
  const lVal = winner === "SELL" ? y30Rent : y30Sell;

  $("winnerText").textContent = winner;

  const diff = wVal - lVal;

  // Rental cash flow line
  const netY0 = meta.rentNetAtY0;
  const netTotal = meta.rentCashFlowTotal;

  let cashFlowText = "";
  const perMo = moneyAbbrev(Math.abs(netY0));
  if(netY0 < 0){
    const be = meta.breakEvenYear;
    const beText = (be === null) ? "not breaking even within 30 years" : `breaking even at Year ${be}`;
    cashFlowText = `Rental Cash Flow: RENT results in negative cash flow (-${perMo}/month at Y0) until ${beText} (Net Rental Cash Flow, Y0–Y30: ${moneyAbbrev(netTotal)}). Negative cash flow is accounted for in SELL scenario as “Avoided Negative Cash Flow” that is invested in stocks.`;
  } else {
    cashFlowText = `Rental Cash Flow: RENT results in positive cash flow (+${perMo}/month at Y0; Net Rental Cash Flow, Y0–Y30: ${moneyAbbrev(netTotal)}). RENT assumes positive cash flow is invested in stocks.`;
  }

  const bullets = [
    `Net Worth (Year 30): ${winner} (${moneyAbbrev(wVal)}) results in a higher net worth vs. ${loser} (${moneyAbbrev(lVal)}) (+${moneyAbbrev(diff)} difference).`,
    cashFlowText
  ];

  $("resultsSummary").innerHTML = bullets.map(b => `<li>${b}</li>`).join("");
}

function run(){
  const {required, optional} = getInputs();

  // Basic validation
  const reqNums = [required.homeValue, required.loanBalance, required.rentMonthly, required.currRate, required.taxesMonthly, required.insMonthly];
  if(reqNums.some(v => !Number.isFinite(v))){
    alert("Please fill out required numeric inputs.");
    return;
  }

  const sim = runSimulation(required, optional);

  // Store accurate RENT stocks/equity snapshots for table
  // We recreate quickly from NW series and the known SELL stocks, but for RENT we need stocks.
  // We'll estimate by replaying with same logic to capture by-year values.
  // For simplicity, we re-run a lightweight pass that stores rentStocksByYear in the sim result.
  sim.rentStocksByYear = estimateRentStocksByYear(required, optional);

  $("cardResults").style.display = "";
  $("cardSummary").style.display = "";
  $("cardTable").style.display = "";

  renderChart(sim);
  renderSummary(sim, sim.meta);
  renderNotes(sim.meta, sim.optional);
  renderTable(sim);
}

function estimateRentStocksByYear(required, optional){
  // Re-run just the rent stock accumulation to capture stocks at each year end.
  const rent0 = required.rentMonthly;

  const rMarketM = Math.pow(1 + (optional.marketReturn/100), 1/12) - 1;
  const rInflM = Math.pow(1 + (optional.inflation/100), 1/12) - 1;

  const vacancy = pctToDec(optional.vacancyPct);
  const maint = pctToDec(optional.maintPct);
  const capex = pctToDec(optional.capexPct);
  const pm = pctToDec(optional.pmPct);
  const rentalTax = pctToDec(optional.rentalTaxRate);

  const loanEndYM = required.loanEnd;
  const amort = calcMonthlyPI(required.loanBalance, required.currRate, loanEndYM);
  const computedPI = amort.pi;
  const piForCashFlow = (optional.overridePI !== null && Number.isFinite(optional.overridePI)) ? optional.overridePI : computedPI;

  let rentStocks = 0;
  const byYear = Array(YEARS + 1).fill(0);
  byYear[0] = 0;

  for(let m=1; m<=YEARS*12; m++){
    rentStocks *= (1 + rMarketM);

    const rent = rent0 * Math.pow(1 + rInflM, (m - 1));
    const taxes = required.taxesMonthly * Math.pow(1 + rInflM, (m - 1));
    const ins = required.insMonthly * Math.pow(1 + rInflM, (m - 1));

    const opCosts = rent * (vacancy + maint + capex + pm);
    let netCF = rent - opCosts - piForCashFlow - taxes - ins;
    if(netCF > 0 && rentalTax > 0) netCF *= (1 - rentalTax);

    if(netCF >= 0) rentStocks += netCF;
    else rentStocks = Math.max(0, rentStocks);

    if(m % 12 === 0){
      byYear[m/12] = rentStocks;
    }
  }
  return byYear;
}

function resetAll(){
  $("cardResults").style.display = "none";
  $("cardSummary").style.display = "none";
  $("cardTable").style.display = "none";
  $("resultsSummary").innerHTML = "<li>—</li>";
  $("winnerText").textContent = "—";
  if(chart){ chart.destroy(); chart = null; }
}

function downloadCSV(){
  // CSV of yearly net worth
  const {required, optional} = getInputs();
  const sim = runSimulation(required, optional);
  const rows = [["Year","SELL_NetWorth","RENT_NetWorth"]];
  for(let y=0;y<=YEARS;y++){
    rows.push([y, Math.round(sim.nwSell[y]), Math.round(sim.nwRent[y])]);
  }
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sell-vs-rent-results.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function init(){
  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("btnCsv").addEventListener("click", downloadCSV);
  $("toggleOptional").addEventListener("click", toggleOptional);

  setOptionalOpen(false);
  const yearEl = $("yearNow");
  if(yearEl) yearEl.textContent = String(new Date().getFullYear());

  resetAll();
}

document.addEventListener("DOMContentLoaded", init);
