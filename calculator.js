function runCalc() {
  const years = 30;
  const marketReturn = parseFloat(document.getElementById('marketReturn').value) / 100;
  const homeAppreciation = parseFloat(document.getElementById('homeAppreciation').value) / 100;

  let sell = [];
  let rent = [];

  let sellNW = 60000;
  let rentNW = 60000;

  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      sellNW *= (1 + marketReturn);
      rentNW *= (1 + marketReturn);
    }
    sell.push(Math.round(sellNW));
    rent.push(Math.round(rentNW + Math.pow(1 + homeAppreciation, y) * 456000 * 0.2));
  }

  window.chartData = { sell, rent };
  renderChart();

  document.getElementById('summary').innerHTML =
    `<strong>Year 30:</strong> SELL $${sell[30].toLocaleString()} vs RENT $${rent[30].toLocaleString()}`;
}
