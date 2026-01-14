function $(id) {
  return document.getElementById(id);
}

let chart = null;

function toggleOptional() {
  const body = $("optionalBody");
  const chev = document.querySelector(".chev");
  const open = body.classList.toggle("open");
  chev.textContent = open ? "▴" : "▾";
}

function run() {
  const ctx = $("nwChart").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [0, 5, 10, 20, 30],
      datasets: [
        {
          label: "SELL",
          data: [200, 420, 720, 1300, 2100]
        },
        {
          label: "RENT",
          data: [200, 380, 650, 1100, 1850]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" }
      },
      scales: {
        y: {
          ticks: {
            callback: v => "$" + v + "k"
          }
        }
      }
    }
  });

  $("cardResults").style.display = "block";
}

function resetAll() {
  $("cardResults").style.display = "none";
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

function init() {
  $("btnRun").addEventListener("click", run);
  $("btnReset").addEventListener("click", resetAll);
  $("btnCsv").addEventListener("click", () =>
    alert("CSV export will be wired next.")
  );
  $("toggleOptional").addEventListener("click", toggleOptional);

  $("yearNow").textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", init);
