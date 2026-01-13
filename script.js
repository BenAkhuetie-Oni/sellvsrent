// IMPORTANT:
// This file no longer replaces or rewrites DOM sections.
// It ONLY reads values and injects rows into #resultsBody.

document.getElementById("runBtn").addEventListener("click", () => {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  const rows = [
    { year: 0, sell: "$0K", rent: "$0K" },
    { year: 1, sell: "$45K", rent: "$79K" },
    { year: 5, sell: "$95K", rent: "$163K" },
    { year: 10, sell: "$160K", rent: "$289K" },
    { year: 30, sell: "$629K", rent: "$1.4M" }
  ];

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.year}</td>
      <td>${r.sell}</td>
      <td>${r.rent}</td>
    `;
    tbody.appendChild(tr);
  });
});

document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("resultsBody").innerHTML = "";
});
