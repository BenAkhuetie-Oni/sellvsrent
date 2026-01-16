let chart;
function renderChart() {
  const ctx = document.getElementById('netWorthChart');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...Array(window.chartData.sell.length).keys()],
      datasets: [
        {
          label: 'SELL',
          data: window.chartData.sell,
          borderWidth: 3
        },
        {
          label: 'RENT',
          data: window.chartData.rent,
          borderWidth: 3
        }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { enabled: true } }
    }
  });
}
