// Outdoor Financial Freedom - Sell vs Rent Calculator Logic
const $ = (id) => document.getElementById(id);
const fmtMoney = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

let chartInstance = null;

function getInputs() {
  // Helpers
  const val = (id) => Number($(id).value);
  const dateVal = (id) => new Date($(id).value);

  return {
    // Required
    saleDate: dateVal('saleDate'),
    salePrice: val('salePrice'),
    loanBal: val('loanBal'),
    mortgageRate: val('mortgageRate') / 100,
    loanEndDate: dateVal('loanEndDate'),
    monthlyPI: val('monthlyPI'),
    monthlyTaxIns: val('monthlyTaxIns'),
    monthlyHOA: val('monthlyHOA'),
    monthlyRent: val('monthlyRent'),

    // Optional - Sell
    sellingCostsPct: val('sellingCostsPct') / 100,
    originalPrice: $( 'originalPrice' ).value ? val('originalPrice') : val('salePrice'), // Default to sale price if empty (no gain)

    // Optional - Rent
    maintPct: val('maintPct') / 100,
    capexPct: val('capexPct') / 100,
    vacancyPct: val('vacancyPct') / 100,
    mgmtPct: val('mgmtPct') / 100,
    landlordUtils: val('landlordUtils'),
    otherExp: val('otherExp'),

    // Taxes & Market
    filingStatus: $('filingStatus').value,
    primaryRes: $('primaryRes').value === 'yes',
    capGainsRate: val('capGainsRate') / 100,
    rentalTaxRate: val('rentalTaxRate') / 100,
    stockReturn: val('stockReturn') / 100,
    inflationRate: val('inflationRate') / 100,

    // Refi
    doRefi: $('doRefi').checked,
    refiYears: val('refiYears'),
    refiPaydown: val('refiPaydown'),
    refiCostPct: val('refiCostPct') / 100,
    refiRate: val('refiRate') / 100
  };
}

function calculateMortgagePmt(principal, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function runModel(inp) {
  const months = 360; // 30 Years Analysis
  const monthlyStockRet = Math.pow(1 + inp.stockReturn, 1/12) - 1;
  const monthlyInflation = Math.pow(1 + inp.inflationRate, 1/12) - 1;

  // --- SCENARIO 1: SELL ---
  // Net Proceeds = Price - Closing Costs - Loan Bal - Capital Gains Tax
  
  // Cap Gains Calc
  const exclusion = inp.primaryRes ? (inp.filingStatus === 'married' ? 500000 : 250000) : 0;
  const grossGain = inp.salePrice - (inp.salePrice * inp.sellingCostsPct) - inp.originalPrice; // Simplified basis
  const taxableGain = Math.max(0, grossGain - exclusion);
  const capGainsTax = taxableGain * inp.capGainsRate;

  const sellProceeds = inp.salePrice - (inp.salePrice * inp.sellingCostsPct) - inp.loanBal - capGainsTax;
  
  // Sell Scenario Arrays
  let sellStockBal = Math.max(0, sellProceeds); // If negative proceeds, we assume 0 to invest
  const sellNetWorth = []; // Only Stocks

  // --- SCENARIO 2: RENT ---
  let rentStockBal = 0;
  // If we sell, we pay off loan. If we rent, we might Refi.
  
  let currentLoanBal = inp.loanBal;
  let currentPI = inp.monthlyPI;
  let currentRate = inp.mortgageRate;
  
  // Handle Refi Logic
  if (inp.doRefi) {
    const refiCosts = (currentLoanBal - inp.refiPaydown) * inp.refiCostPct; // Cost on new loan amt? Or old? Excel says "Refinance Closing Costs (% of Refinanced Loan Amount)"
    // New Loan Amount = Old Bal - Paydown + Costs
    const newLoanAmount = currentLoanBal - inp.refiPaydown + refiCosts;
    currentLoanBal = newLoanAmount;
    currentRate = inp.refiRate;
    currentPI = calculateMortgagePmt(newLoanAmount, currentRate, inp.refiYears);
    
    // In Rent Scenario, we "avoided" the negative cash flow of the paydown, so that money stays in our pocket?
    // Actually, usually models assume we HAD the cash for paydown. 
    // In "Sell", we keep that cash. In "Rent", we spent it.
    // So Rent Stock Balance starts NEGATIVE or Sell starts Higher.
    // To match Excel "Avoided Refinance Cost to invest" logic usually implies comparison baseline.
    // We will decrement Rent Stock Bal by Paydown amount to represent the cash outlay.
    rentStockBal -= inp.refiPaydown; 
    rentStockBal -= (currentLoanBal * 0); // Logic check: Excel "Avoided Refinance Cost" usually means if you SELL, you avoid these costs.
    // To keep simple: Sell Scenario gets the Paydown cash added to its starting balance because it didn't spend it.
    sellStockBal += inp.refiPaydown; 
  }

  let homeValue = inp.salePrice;
  let rent = inp.monthlyRent;
  let taxIns = inp.monthlyTaxIns;
  let hoa = inp.monthlyHOA;
  let utils = inp.landlordUtils;
  let other = inp.otherExp;

  const rentNetWorth = [];

  // Determine months remaining on current loan if not refi
  let monthsRem = 0;
  if (!inp.doRefi && inp.loanEndDate && inp.saleDate) {
    monthsRem = (inp.loanEndDate.getFullYear() - inp.saleDate.getFullYear()) * 12 + (inp.loanEndDate.getMonth() - inp.saleDate.getMonth());
  } else if (inp.doRefi) {
    monthsRem = inp.refiYears * 12;
  }

  // --- MONTHLY LOOP ---
  for (let m = 1; m <= months; m++) {
    // 1. SELL SIDE UPDATE
    sellStockBal *= (1 + monthlyStockRet);
    sellNetWorth.push(sellStockBal);

    // 2. RENT SIDE UPDATE
    // A. Expenses
    // Inflating items
    const monthlyRent = rent;
    const expMaint = monthlyRent * inp.maintPct;
    const expCapex = monthlyRent * inp.capexPct;
    const expVacancy = monthlyRent * inp.vacancyPct;
    const expMgmt = monthlyRent * inp.mgmtPct;
    
    // Fixed P&I, Inflating others
    const totalExp = currentPI + taxIns + hoa + utils + other + expMaint + expCapex + expVacancy + expMgmt;
    
    // B. Cash Flow
    const noi = monthlyRent - (totalExp - currentPI); // NOI excludes debt service
    const cashFlowPreTax = monthlyRent - totalExp;
    
    // Tax on Rent (Simplified: CashFlow * Rate, ignoring depreciation for simplicity as per prompt constraint to follow Excel inputs which usually simplifies this)
    // Excel Appendix had "Rental income tax ($)" column. Often strictly (NOI - Interest) * Rate.
    // We need Interest portion of P&I.
    let interestPayment = 0;
    let principalPayment = 0;
    
    if (currentLoanBal > 0) {
      interestPayment = currentLoanBal * (currentRate / 12);
      principalPayment = currentPI - interestPayment;
      if (principalPayment > currentLoanBal) {
        principalPayment = currentLoanBal;
        interestPayment = 0; // Close enough at end
      }
    }
    
    // Taxable Income estimate
    const taxableIncome = Math.max(0, noi - interestPayment); 
    const taxBill = taxableIncome * inp.rentalTaxRate;
    
    const netCashFlow = cashFlowPreTax - taxBill;

    // C. Invest Cash Flow
    rentStockBal *= (1 + monthlyStockRet); // Grow existing
    rentStockBal += netCashFlow; // Add new (or subtract if negative)

    // D. Home Equity
    // Appreciation
    homeValue *= (1 + monthlyInflation);
    
    // Amortization
    if (currentLoanBal > 0) {
      currentLoanBal -= principalPayment;
      if (currentLoanBal < 0) currentLoanBal = 0;
      // If loan ends naturally
      if (!inp.doRefi && m > monthsRem) {
        currentPI = 0; // Stop paying
      } else if (inp.doRefi && m > (inp.refiYears * 12)) {
        currentPI = 0;
      }
      // Hard stop if balance 0
      if (currentLoanBal <= 0.1) currentPI = 0;
    }

    // E. Inflation Updates for NEXT month
    rent *= (1 + monthlyInflation);
    taxIns *= (1 + monthlyInflation);
    hoa *= (1 + monthlyInflation);
    utils *= (1 + monthlyInflation);
    other *= (1 + monthlyInflation);

    // Snapshot
    const equity = homeValue - currentLoanBal;
    // Note: To be fair comparison, Sell Net Worth assumes getting out.
    // Rent Net Worth should theoretically account for selling costs to be liquid comparable?
    // Usually Net Worth tracks Equity.
    rentNetWorth.push(equity + rentStockBal);
  }

  // Generate Year Snapshots (0, 1, 2... 30)
  const results = [];
  
  // Year 0
  results.push({
    year: 0,
    sellNW: Math.max(0, sellProceeds + (inp.doRefi ? inp.refiPaydown : 0)), // Initial state
    rentNW: (inp.salePrice - (inp.doRefi ? (inp.loanBal - inp.refiPaydown) : inp.loanBal)) - (inp.doRefi ? inp.refiPaydown : 0) // Complex logic for initial equity vs cash
    // Simplified:
    // Sell NW Year 0 = Proceeds.
    // Rent NW Year 0 = Current Equity. 
  });
  // Actually, simplest is just push the month 12, 24, 36...
  
  for(let y=1; y<=30; y++){
    const idx = (y*12) - 1;
    results.push({
      year: y,
      sellNW: sellNetWorth[idx],
      rentNW: rentNetWorth[idx]
    });
  }

  return results;
}

function updateUI(rows) {
  const final = rows[rows.length - 1];
  const diff = final.sellNW - final.rentNW;
  const winner = diff > 0 ? "SELL" : "RENT";
  
  // Update Pills
  $('recPill').innerText = `Financial Winner: ${winner}`;
  $('recPill').style.backgroundColor = winner === 'SELL' ? 'var(--forest)' : 'var(--sage)';
  $('recPill').style.color = '#fff';
  
  $('diffPill').innerText = `Difference at Year 30: ${fmtMoney(Math.abs(diff))}`;
  $('resultTop').innerHTML = `Based on your inputs, <b>${winner}ing</b> results in higher net worth after 30 years.`;

  // Chart
  const ctx = $('nwChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => `Year ${r.year}`),
      datasets: [
        {
          label: 'Sell (Net Worth)',
          data: rows.map(r => r.sellNW),
          borderColor: '#2E5638', // Forest
          backgroundColor: '#2E5638',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: 'Rent (Net Worth)',
          data: rows.map(r => r.rentNW),
          borderColor: '#6b7e59', // Sage
          backgroundColor: '#6b7e59',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtMoney(c.raw)}` }
        },
        legend: { position: 'bottom' }
      },
      scales: {
        y: {
          ticks: { callback: (v) => '$' + (v/1000).toFixed(0) + 'k' }
        }
      }
    }
  });

  // Table
  const tbody = $('resultsBody');
  tbody.innerHTML = '';
  // Show Years 1, 5, 10, 20, 30
  const showYears = [1, 5, 10, 20, 30];
  
  rows.filter(r => showYears.includes(r.year)).forEach(r => {
    const rowDiff = r.sellNW - r.rentNW;
    const rowWin = rowDiff > 0 ? "SELL" : "RENT";
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Year ${r.year}</td>
      <td style="font-weight:700; color:${rowWin === 'SELL' ? 'var(--forest)' : 'var(--sage)'}">${rowWin}</td>
      <td>${fmtMoney(r.sellNW)}</td>
      <td>${fmtMoney(r.rentNW)}</td>
      <td>${fmtMoney(Math.abs(rowDiff))}</td>
    `;
    tbody.appendChild(tr);
  });
  
  $('resultsTable').classList.remove('hidden');
  
  // CSV Download
  $('csvBtn').disabled = false;
  $('csvBtn').onclick = () => {
    let csvContent = "data:text/csv;charset=utf-8,Year,Sell_NetWorth,Rent_NetWorth,Difference\n";
    rows.forEach(r => {
      csvContent += `${r.year},${r.sellNW.toFixed(2)},${r.rentNW.toFixed(2)},${(r.sellNW - r.rentNW).toFixed(2)}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sell_vs_rent_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

function init() {
  // Set default date to today and loan end date to 30 years from now
  const today = new Date();
  $('saleDate').valueAsDate = today;
  
  const future = new Date();
  future.setFullYear(today.getFullYear() + 27); // approx match example
  $('loanEndDate').valueAsDate = future;
  $('yearNow').innerText = today.getFullYear();

  // Refi Toggle
  $('doRefi').addEventListener('change', (e) => {
    if(e.target.checked) $('refiInputs').classList.remove('hidden');
    else $('refiInputs').classList.add('hidden');
  });

  // Calculate
  $('calcBtn').addEventListener('click', () => {
    const inputs = getInputs();
    const results = runModel(inputs);
    updateUI(results);
  });

  // Reset
  $('resetBtn').addEventListener('click', () => {
    location.reload(); 
  });
}

init();