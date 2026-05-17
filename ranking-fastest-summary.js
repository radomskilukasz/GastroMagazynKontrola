/*
  Ranking pracowników — skrót na podsumowaniu ma pokazywać pełne parametry
  i domyślnie sortować po najszybszym średnim czasie.
*/

try {
  workerSortKey = "avgTime";
  workerSortDirection = "asc";
} catch(e) {}

function renderSummaryPanels(data) {
  const last = data.slice(0, 6);

  summaryRecentHistory.innerHTML = last.length
    ? last.map(x => {
        const status = normalizeStatus(x.status);
        return `
          <div class="settingRow">
            <div>
              <b class="clickable" onclick="openDetails(${sessions.findIndex(s => s.id === x.id)})">${escapeHtml(x.bag_qr || "-")}</b>
              <div class="small">${escapeHtml(getWorkerDisplayName(x.user_login || "-"))} • ${formatDateTime(x.closed_at)}</div>
            </div>
            ${statusBadgeHtml(status)}
          </div>
        `;
      }).join("")
    : `<div class="small">Brak danych.</div>`;

  const workers = window.workerStats.slice(0, 5);

  summaryTopWorkers.innerHTML = workers.length
    ? workers.map((w, index) => {
        const avg = w.durationCount
          ? Math.round(w.duration / w.durationCount)
          : 0;

        return `
          <div class="settingRow workerSummaryRow">
            <div>
              <b>${getRankBadge(index)} ${escapeHtml(w.worker)}</b>
              <div class="small">
                Razem: <b>${w.total}</b> •
                OK: <b class="ok">${w.correct}</b> •
                Źle: <b class="bad">${w.bad}</b> •
                Braki: <b class="warn">${w.braki}</b> •
                Czas: <b>${formatDuration(avg)}</b>
              </div>
            </div>
            <span class="pill bluePill">${formatDuration(avg)}</span>
          </div>
        `;
      }).join("")
    : `<div class="small">Brak danych.</div>`;
}
