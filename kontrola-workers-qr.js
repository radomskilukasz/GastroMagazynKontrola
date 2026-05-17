/*
  Dodatkowe poprawki zakładki Pracownicy w kontroli:
  - usuwa potrzebę przycisku „+ Dodaj pracownika” z nagłówka,
  - dodaje akcję generowania nowego QR dla workera,
  - zostawia panel dodawania pracownika po prawej stronie,
  - druk QR jest taki sam jak w panelu admina.
*/

function escapeJsForWorkerQr(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function makeWorkerQrSvg(token, cellSize = 8, margin = 2) {
  if (!window.qrcode) {
    throw new Error("Biblioteka qrcode-generator nie wczytała się.");
  }

  const qr = window.qrcode(0, "M");
  qr.addData(String(token));
  qr.make();

  return qr.createSvgTag(cellSize, margin);
}

function printWorkerQrToken(qrToken, displayName, userEmail) {
  const token = String(qrToken || "").trim();
  if (!token) return;

  let qrSvg = "";

  try {
    qrSvg = makeWorkerQrSvg(token, 8, 2);
  } catch (err) {
    alert("Wygenerowano nowy QR, ale nie udało się narysować QR do druku: " + err.message + "\n\nToken: " + token);
    return;
  }

  const name = String(displayName || displayLogin(userEmail || "")).trim() || displayLogin(userEmail || "worker");
  const safeUser = escapeHtml(name);
  const safeToken = escapeHtml(token);

  const printWindow = window.open("", "_blank", "width=720,height=900");

  if (!printWindow) {
    alert("Wygenerowano nowy QR, ale przeglądarka zablokowała okno wydruku. Token: " + token);
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>QR logowania</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 30px;
          color: #111827;
        }

        .card {
          border: 3px solid #111827;
          border-radius: 24px;
          padding: 28px;
          display: inline-block;
          width: 420px;
          max-width: 100%;
        }

        img.logo {
          width: 80px;
          height: auto;
          margin-bottom: 10px;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 28px;
        }

        .login {
          font-size: 32px;
          font-weight: 900;
          margin: 12px 0 18px;
          word-break: break-word;
        }

        .qrBox {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 18px 0;
        }

        .qrBox svg {
          width: 300px !important;
          height: 300px !important;
          display: block;
        }

        .hint {
          margin-top: 18px;
          font-size: 15px;
          color: #374151;
          line-height: 1.45;
        }

        .token {
          margin-top: 14px;
          font-size: 11px;
          color: #6b7280;
          word-break: break-all;
        }

        @media print {
          body { padding: 0; }
          .card { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <img src="logo.png" class="logo" onerror="this.style.display='none'">
        <h1>Kod QR logowania</h1>
        <div class="login">${safeUser}</div>

        <div class="qrBox">
          ${qrSvg}
        </div>

        <div class="hint">
          Zeskanuj kod QR na ekranie logowania programu pakowania lub kontroli.
          Login i hasło nadal działają awaryjnie.
        </div>

        <div class="token">${safeToken}</div>
      </div>

      <script>
        setTimeout(function() {
          window.print();
        }, 300);
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
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