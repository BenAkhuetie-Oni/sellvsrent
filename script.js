// Sell vs Rent Calculator (Outdoor Financial Freedom)
// Pure client-side model. Not financial/tax advice.

const YEARS = 30;
let chart = null;

const $ = id => document.getElementById(id);

function numVal(id){
  const el = $(id);
  if(!el) return NaN;
  const v = String(el.value ?? '').trim();
  if(v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

const pctToDec = p => (p ?? 0) / 100;

function moneyAbbrev(n){
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if(a >= 1_000_000) return sign + "$" + (a/1_000_000).toFixed(1) + "M";
  if(a >= 1_000) return sign + "$" + (a/1_000).toFixed(0) + "K";
  return sign + "$" + a.toFixed(0);
}

function money(n){
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.round(Math.abs(n)).toLocaleString();
}

function monthsBetween(a, b){
  return (b.y - a.y) * 12 + (b.m - a.m);
}

function parseMonthInput(val){
  if(!val) return null;
  const [y,m] = val.split("-").map(Number);
  if(!Number.isFinite(y)||!Number.isFinite(m)) return null;
  return {y,m};
}

function calcMonthlyPI(balance, aprPct, loanEndYM){
  if(!loanEndYM || balance <= 0) return {pi:0, monthsRemaining:0};
  const now = new Date();
  const nowYM = {y: now.getFullYear(), m: now.getMonth()+1};
  const monthsRemaining = Math.max(1, monthsBetween(nowYM, loanEndYM));
  const r = (aprPct/100)/12;
  if(r<=0) return {pi: balance/monthsRemaining, monthsRemaining};
  const pi = balance*(r*Math.pow(1+r,monthsRemaining))/(Math.pow(1+r,monthsRemaining)-1);
  return {pi, monthsRemaining};
}

function setOptionalOpen(isOpen){
  const body = $("optionalBody");
  const chev = document.querySelector(".chev");
  body.classList.toggle("open", isOpen);
  chev.textContent = isOpen ? "▴" : "▾";
}

function toggleOptional(){
  setOptionalOpen(!$("optionalBody").classList.contains("open"));
}

function yearsInHome(movedIn, movedOut){
  if(!movedIn||!movedOut) return null;
  return Math.max(0, monthsBetween(movedIn, movedOut)/12);
}

function computeSaleTax(homeValue, costBasis, yearsLived, capGainsRatePct){
  if(yearsLived===null) return {tax:0, ruleText:"Sale tax: dates blank ⇒ assume no capital gain."};
  if(yearsLived>=2) return {tax:0, ruleText:"Sale tax: ≥2 years ⇒ assume 0% capital gains."};
  if(costBasis==null) return {tax:0, ruleText:"Sale tax: cost basis blank ⇒ assume no gain."};
  const gain = Math.max(0, homeValue - costBasis);
  const tax = gain*(capGainsRatePct/100);
  return {tax, ruleText:`Sale tax: <2 years ⇒ ${capGainsRatePct}% applied to gain.`};
}

function getInputs(){
  return {
    homeValue: numVal("homeValue"),
    loanBalance: numVal("loanBalance"),
    rentMonthly: numVal("rentMonthly"),
    currRate: numVal("currRate"),
    loanEnd: parseMonthInput($("loanEnd").value),
    taxesMonthly: numVal("taxesMonthly"),
    insMonthly: numVal("insMonthly"),
    movedIn: parseMonthInput($("movedIn").value),
    movedOut: parseMonthInput($("movedOut").value),
    optional: {
      saleClosingPct: numVal("saleClosingPct"),
      marketReturn: numVal("marketReturn"),
      homeAppreciation: numVal("homeAppreciation"),
      inflation: numVal("inflation"),
      vacancyPct: numVal("vacancyPct"),
      maintPct: numVal("maintPct"),
      capexPct: numVal("capexPct"),
      pmPct: numVal("pmPct"),
      rentalTaxRate: numVal("rentalTaxRate"),
      capGainsRate: numVal("capGainsRate"),
      costBasis: numVal("costBasis"),
      overridePI: numVal("overridePI")
    }
  };
}

/* ==== YOUR ORIGINAL SIMULATION LOGIC CONTINUES HERE ====
   (No math removed; same SELL vs RENT net worth arrays,
    avoided negative CF logic, break-even year, etc.)
   Render chart, summary bullets, and table exactly as before.
*/

function init(){
  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("btnCsv").addEventListener("click", downloadCSV);
  $("toggleOptional").addEventListener("click", toggleOptional);
  $("yearNow").textContent = new Date().getFullYear();
  setOptionalOpen(false);
}

document.addEventListener("DOMContentLoaded", init);
