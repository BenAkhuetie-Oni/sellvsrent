// Outdoor Financial Freedom - Sell vs Rent Calculator
// Logic matched to Excel Appendix Calculation

const $ = (id) => document.getElementById(id);
const fmtMoney = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDecimal = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let chartInstance = null;

function getInputs() {
  const val = (id) => Number($(id).value);
  const dateVal = (id) => new Date($(id).value);

  // Parse percentages carefully (User inputs 8.0 for 8%)
  return {
    saleDate: dateVal('saleDate'),
    salePrice: val('salePrice'),
    
    loanBal: val('loanBal'),
    mortgageRate: val('mortgageRate') / 100,
    loanEndDate: dateVal('loanEndDate'),
    monthlyPI: val('monthlyPI'),
    monthlyTaxIns: val('monthlyTaxIns'),
    monthlyHOA: val('monthlyHOA'),
    
    monthlyRent: val('monthlyRent'),
    
    // Optional
    sellingCostsPct: val('sellingCostsPct') / 100,
    originalPrice: $( 'originalPrice' ).value ? val('originalPrice') : val('salePrice'),
    
    // Rental Exp
    maintPct: val('maintPct') / 100,
    capexPct: val('capexPct') / 100,
    vacancyPct: val('vacancyPct') / 100,
    mgmtPct: val('mgmtPct') / 100,
    landlordUtils: val('landlordUtils'),
    otherExp: val('otherExp'),

    // Taxes/Market
    filingStatus: $('filingStatus').value,
    primaryRes: $('primaryRes').value === 'yes',
    capGainsRate: val('capGainsRate') / 100,
    rentalTaxRate: val('rentalTaxRate') / 100,
    stockReturn: val('stockReturn') / 100,
    inflationRate: val('inflationRate') / 100
  };
}

function runModel(inp) {
  const months = 360; 
  const monthlyStockRet = Math.pow(1 + inp.stockReturn, 1/12) - 1;
  const monthlyInflation = Math.pow(1 + inp.inflationRate, 1/12) - 1;

  // --- 1. INITIAL SETUP (YEAR 0) ---
  // Note: Excel "Year 0" usually represents the "Start State" before the transaction (Pre-sale).
  // So Year 0 NW = Equity.
  const initialEquity = inp.salePrice - inp.loanBal;
  
  // Calculate Net Proceeds (triggered at Month 1 in logic, but calculated for Sell Basis)
  const exclusion = inp.primaryRes ? (inp.filingStatus === 'married' ? 500000 : 250000) : 0;
  const grossGain = inp.salePrice - (inp.salePrice * inp.sellingCostsPct) - inp.originalPrice;
  const taxableGain = Math.max(0, grossGain - exclusion);
  const capGainsTax = taxableGain * inp.capGainsRate;
  
  const closingCosts = inp.salePrice * inp.sellingCostsPct;
  const sellProceeds = inp.salePrice - closingCosts - inp.loanBal - capGainsTax;

  // --- 2. RUNNING VARIABLES ---
  
  // RENT SCENARIO STATE
  let r_HomeVal = inp.salePrice;
  let r_LoanBal = inp.loanBal;
  let r_Rent = inp.monthlyRent;
  // Expenses that inflate
  let r_TaxIns = inp.monthlyTaxIns;
  let r_HOA = inp.monthlyHOA;
  let r_Utils = inp.landlordUtils;
  let r_Other = inp.otherExp;
  
  let r_StockBal = 0; // Starts at 0, accumulates cash flow

  // SELL SCENARIO STATE
  let s_StockBal = sellProceeds; // Starts with cash from sale

  // Date Logic for Loan Payoff
  // Calculate months remaining on loan based on dates
  let monthsRem = 0;
  if (inp.loanEndDate && inp.saleDate) {
      // rough calc of months difference
      monthsRem = (inp.loanEndDate.getFullYear() - inp.saleDate.getFullYear()) * 12;
      monthsRem += (inp.loanEndDate.getMonth() - inp.saleDate.getMonth());
  }
  
  const monthData = [];

  // PUSH YEAR 0 DATA (Start State)
  monthData.push({
      month: 0,
      year: 0,
      homeVal: inp.salePrice,
      loanBal: inp.loanBal,
      rentCF: 0,
      sellPort: 0, // In Excel Year 0 this is usually 0 or Equity, but technically Sell Port doesn't exist yet
      rentPort: 0,
      sellNW: initialEquity, // Standardize comparison start point
      rentNW: initialEquity
  });

  // --- 3. MONTHLY LOOP ---
  for (let m = 1; m <= months; m++) {
    
    // --- RENT SCENARIO CALCULATIONS ---
    
    // Expenses
    const expMaint = r_Rent * inp.maintPct;
    const expCapex = r_Rent * inp.capexPct;
    const expVac = r_Rent * inp.vacancyPct;
    const expMgmt = r_Rent * inp.mgmtPct;
    
    // Loan Calculation (Amortization)
    let interest = 0;
    let principal = 0;
    let p_and_i = 0;
    
    if (r_LoanBal > 0) {
        p_and_i = inp.monthlyPI;
        // If loan end date passed, PI is 0
        if (m > monthsRem) p_and_i = 0;
        
        interest = r_LoanBal * (inp.mortgageRate / 12);
        principal = p_and_i - interest;
        
        // Check for payoff
        if (principal > r_LoanBal) {
            principal = r_LoanBal;
            p_and_i = principal + interest;
        }
        if (r_LoanBal <= 0.1) {
            r_LoanBal = 0;
            p_and_i = 0;
            interest = 0;
            principal = 0;
        }
    }
    
    const totalCashExpense = p_and_i + r_TaxIns + r_HOA + r_Utils + r_Other + expMaint + expCapex + expVac + expMgmt;
    
    // Tax on Rent Logic (NOI - Interest)
    // NOI = Rent - (All Ops Excl Loan)
    const opEx = r_TaxIns + r_HOA + r_Utils + r_Other + expMaint + expCapex + expVac + expMgmt;
    const noi = r_Rent - opEx;
    const taxableIncome = Math.max(0, noi - interest);
    const taxBill = taxableIncome * inp.rentalTaxRate;
    
    // Net Cash Flow
    const netCashFlow = r_Rent - totalCashExpense - taxBill;
    
    // Update Rent Portfolio
    // Logic: Grow previous balance, then add new cash flow
    r_StockBal = (r_StockBal * (1 + monthlyStockRet)) + netCashFlow;
    
    // Update Home Equity
    r_HomeVal = r_HomeVal * (1 + monthlyInflation);
    r_LoanBal = r_LoanBal - principal;
    if(r_LoanBal < 0) r_LoanBal = 0;
    
    // --- SELL SCENARIO CALCULATIONS ---
    
    // Logic: If Rent Scenario has NEGATIVE cash flow, that is money the user "saved" by selling.
    // That "saved" money is added to the Sell Portfolio.
    // If Rent Scenario has POSITIVE cash flow, the seller "missed out" on that income? 
    // No, standard gap analysis:
    // Sell Injection = Max(0, -NetCashFlowFromRent)
    
    const sellInjection = netCashFlow < 0 ? Math.abs(netCashFlow) : 0;
    
    s_StockBal = (s_StockBal * (1 + monthlyStockRet)) + sellInjection;
    
    // --- INFLATION FOR NEXT MONTH ---
    r_Rent *= (1 + monthlyInflation);
    r_TaxIns *= (1 + monthlyInflation);
    r_HOA *= (1 + monthlyInflation);
    r_Utils *= (1 + monthlyInflation);
    r_Other *= (1 + monthlyInflation);
    
    // --- SNAPSHOT ---
    const rentEquity = r_HomeVal - r_LoanBal;
    const rentNW = rentEquity + r_StockBal;
    const sellNW = s_StockBal;
    
    monthData.push({
        month: m,
        year: Math.ceil(m/12),
        homeVal: r_HomeVal,
        loanBal: r_LoanBal,
        rentCF: netCashFlow,
        sellPort: s_StockBal,
        rentPort: r_StockBal,
        sellNW: sellNW,
        rentNW: rentNW
    });
  }

  return monthData;
}

function updateUI(data) {
    const final = data[data.length - 1];
    const diff = final.sellNW - final.rentNW;
    const winner = diff > 0 ? "SELL" : "RENT";
    
    // Pills
    $('recPill').innerText = `Winner: ${winner}`;
    $('recPill').style.backgroundColor = winner === 'SELL' ? 'var(--forest)' : 'var(--sage)';
    $('recPill').style.color = '#fff';
    $('diffPill').innerText = `Difference Year 30: ${fmtMoney(Math.abs(diff))}`;
    
    // Chart
    const ctx = $('nwChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    // Extract Year data (every 12th month)
    const yearlyData = data.filter(d => d.month % 12 === 0);
    // Ensure Year 0 is there
    if(yearlyData[0].month !== 0) yearlyData.unshift(data[0]);
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: yearlyData.map(d => `Year ${d.month/12}`),
            datasets: [
                {
                    label: 'Sell Net Worth',
                    data: yearlyData.map(d => d.sellNW),
                    borderColor: '#2E5638',
                    backgroundColor: '#2E5638',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'Rent Net Worth',
                    data: yearlyData.map(d => d.rentNW),
                    borderColor: '#6b7e59',
                    backgroundColor: '#6b7e59',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: { y: { ticks: { callback: (v) => '$' + (v/1000).toFixed(0) + 'k' } } }
        }
    });

    // Main Results Table (Years 1, 5, 10, 30)
    const tbody = $('resultsBody');
    tbody.innerHTML = '';
    const showYears = [1, 5, 10, 30];
    
    yearlyData.filter(d => showYears.includes(d.month/12)).forEach(d => {
        const rowDiff = d.sellNW - d.rentNW;
        const rowWin = rowDiff > 0 ? "SELL" : "RENT";
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Year ${d.month/12}</td>
            <td style="font-weight:700; color:${rowWin === 'SELL' ? 'var(--forest)' : 'var(--sage)'}">${rowWin}</td>
            <td>${fmtMoney(d.sellNW)}</td>
            <td>${fmtMoney(d.rentNW)}</td>
            <td>${fmtMoney(Math.abs(rowDiff))}</td>
        `;
        tbody.appendChild(tr);
    });
    $('resultsTable').classList.remove('hidden');

    // Appendix Table (Monthly)
    const appBody = $('appendixBody');
    appBody.innerHTML = '';
    // Limit DOM nodes for performance, maybe show first 60 months and then yearly? 
    // User requested "Monthly values for QC". We will render all, but user beware of long scroll.
    
    data.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.month}</td>
            <td>${fmtDecimal(d.homeVal)}</td>
            <td>${fmtDecimal(d.loanBal)}</td>
            <td style="color:${d.rentCF < 0 ? 'red' : 'inherit'}">${fmtDecimal(d.rentCF)}</td>
            <td>${fmtDecimal(d.sellPort)}</td>
            <td>${fmtDecimal(d.rentPort)}</td>
            <td>${fmtDecimal(d.sellNW)}</td>
            <td>${fmtDecimal(d.rentNW)}</td>
        `;
        appBody.appendChild(tr);
    });

    // CSV Export
    $('csvBtn').disabled = false;
    $('csvBtn').onclick = () => {
        let csv = "Month,HomeVal,LoanBal,Rent_NetCF,Sell_Port,Rent_Port,Sell_NW,Rent_NW\n";
        data.forEach(d => {
            csv += `${d.month},${d.homeVal.toFixed(2)},${d.loanBal.toFixed(2)},${d.rentCF.toFixed(2)},${d.sellPort.toFixed(2)},${d.rentPort.toFixed(2)},${d.sellNW.toFixed(2)},${d.rentNW.toFixed(2)}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "sell_vs_rent_model_dump.csv";
        a.click();
    };
}

function init() {
    $('yearNow').innerText = new Date().getFullYear();
    
    $('calcBtn').addEventListener('click', () => {
        const inputs = getInputs();
        const results = runModel(inputs);
        updateUI(results);
    });
}

init();