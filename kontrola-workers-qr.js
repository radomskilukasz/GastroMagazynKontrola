/*
  Dodatkowe poprawki zakładki Pracownicy w kontroli:
  - usuwa potrzebę przycisku „+ Dodaj pracownika” z nagłówka,
  - dodaje akcję generowania nowego QR dla workera,
  - zostawia panel dodawania pracownika po prawej stronie.
*/

function escapeJsForWorkerQr(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function printWorkerQrToken(qrToken, displayName, userEmail) {
  const token = String(qrToken || "").trim();
  if (!token) return;

  const name = String(displayName || displayLogin(userEmail || "")).trim() || displayLogin(userEmail || "worker");
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=1&data=" + encodeURIComponent(token);

  const win = window.open("", "_blank", "width=520,height=720");

  if (!win) {
    alert("Wygenerowano nowy QR, ale przeglądarka zablokowała okno wydruku. Token: " + token);
    return;
  }

  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>Kod QR logowania</title>
      <style>
        @page { size: 80mm 110mm; margin: 0; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #fff;
          color: #111;
        }
        .label {
          width: 80mm;
          height: 110mm;
          padding: 6mm;
          border: 2px solid #111;
          border-radius: 6mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          text-align: center;
          overflow: hidden;
        }
        .logo {
          width: 16mm;
          height: auto;
          margin-bottom: 4mm;
        }
        h1 {
          font-size: 16px;
          line-height: 1.15;
          margin: 0 0 3mm;
          font-weight: 900;
        }
        .name {
          font-size: 20px;
          line-height: 1.1;
          font-weight: 900;
          margin-bottom: 5mm;
          word-break: break-word;
        }
        .qr {
          width: 42mm;
          height: 42mm;
          image-rendering: pixelated;
          margin-bottom: 5mm;
        }
        .help {
          font-size: 10px;
          line-height: 1.25;
          margin: 0 0 4mm;
        }
        .token {
          font-size: 7px;
          line-height: 1.15;
          word-break: break-all;
          max-width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="label">
        <img class="logo" src="logo.png" alt="logo">
        <h1>Kod QR logowania</h1>
        <div class="name">${escapeHtml(name)}</div>
        <img class="qr" src="${qrUrl}" alt="QR">
        <p class="help">Zeskanuj kod QR na ekranie logowania programu pakowania lub kontroli. Login i hasło nadal działają awaryjnie.</p>
        <div class="token">${escapeHtml(token)}</div>
      </div>
      <script>
        window.onload = () => setTimeout(() => window.print(), 500);
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

async function regenerateWorkerQr(userEmail, displayName) {
  const email = String(userEmail || "").trim().toLowerCase();
  const name = String(displayName || displayLogin(email)).trim();

  if (!email) return;

  const confirmed = confirm("Wygenerować nowy kod QR dla pracownika: " + name + "?\n\nStary kod QR przestanie działać.");
  if (!confirmed) return;

  try {
    setEmployeeStatus("⏳ Generuję nowy kod QR dla: " + name, "info");

    const { data, error } = await supabaseClient.rpc("manager_regenerate_worker_qr", {
      target_user_email: email
    });

    if (error) {
      setEmployeeStatus("❌ Nie udało się wygenerować QR: " + error.message, "error");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const status = String(row?.status || data || "");

    if (status !== "OK") {
      setEmployeeStatus("❌ Nie udało się wygenerować QR: " + (status || "Nieznany błąd."), "error");
      return;
    }

    const token = row?.qr_token || row?.token || row?.raw_token || "";

    setEmployeeStatus("✅ Wygenerowano nowy QR dla: " + name, "ok");

    await loadWorkerDirectory();
    renderEmployeeDirectory();

    if (token) {
      printWorkerQrToken(token, name, email);
    } else {
      alert("Wygenerowano nowy QR dla: " + name + ". Funkcja nie zwróciła pełnego tokenu do wydruku.");
    }

  } catch (err) {
    setEmployeeStatus("❌ Błąd generowania QR: " + err.message, "error");
  }
}

window.renderEmployeeDirectory = function renderEmployeeDirectory() {
  const directoryEl = document.getElementById("employeeDirectory");
  if (!directoryEl) return;

  const search = String(employeeSearch?.value || "").toLowerCase().trim();

  let rows = workerDirectory || [];

  rows = rows.filter(row => {
    const displayName = String(row.display_name || "").toLowerCase();
    const email = String(row.user_email || "").toLowerCase();
    const login = displayLogin(email).toLowerCase();

    return !search ||
      displayName.includes(search) ||
      email.includes(search) ||
      login.includes(search);
  });

  if (!rows.length) {
    directoryEl.innerHTML = `
      <div class="small">
        Brak workerów do pokazania albo nie udało się pobrać katalogu pracowników.
      </div>
    `;
    return;
  }

  directoryEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Nazwa</th>
          <th>Login</th>
          <th>Rola</th>
          <th>QR</th>
          <th>Ostatnie użycie QR</th>
          <th>Użyć</th>
          <th>Akcje</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => {
          const displayName = row.display_name || displayLogin(row.user_email || "-");
          const login = displayLogin(row.user_email || "-");
          const email = String(row.user_email || "").toLowerCase();

          return `
            <tr>
              <td><b>${escapeHtml(displayName)}</b></td>
              <td>${escapeHtml(login)}</td>
              <td><span class="pill bluePill">worker</span></td>
              <td>${qrStatusPill(row)}</td>
              <td>${row.qr_last_used_at ? formatDateTime(row.qr_last_used_at) : "-"}</td>
              <td>${Number(row.qr_use_count || 0)}</td>
              <td>
                <button
                  class="ghostBtn"
                  style="min-height:36px;padding:8px 10px;font-size:14px;white-space:nowrap;"
                  onclick="regenerateWorkerQr('${escapeJsForWorkerQr(email)}', '${escapeJsForWorkerQr(displayName)}')"
                >Nowy QR</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
};
