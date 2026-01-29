/* ===================== GLOBAL ===================== */

let ALL_CALLS = [];
let charts = [];

/* ===================== HELPERS ===================== */

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function isValidManager(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return !["менеджер","неизвестно","unknown","—"].includes(n);
}

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

/* ===================== ОСНОВНЫЕ ИМЕНА ===================== */

const MAIN_MANAGERS = new Set([
  "Марина","Ирина","Светлана","Анастасия","Нургуль","Сара","Жанна",
  "Анна","Иван","Алексей","Александр","Мария","Максим","Евгений",
  "Роман","Наталья","Вера","Надежда","Илья","Сергей","Игорь","Ольга","Татьяна","Ертай"
]);

/* ===================== НОРМАЛИЗАЦИЯ ===================== */

function normalizeManagerName(raw) {
  let name = clean(raw)
    .toLowerCase()
    .replace(/[^a-zа-яё ]/gi, "")
    .trim();

  if (!name) return "";

  /* ===== НУРГУЛЬ (ВКЛЮЧАЯ МАРГУЛЬ) ===== */
  if (/(гул|гуль|кул|куль|голь)/.test(name)) {
    return "Нургуль";
  }

  /* ===== АННА ===== */
  if (["анна","аня"].includes(name)) {
    return "Анна";
  }

  /* ===== АНАСТАСИЯ ===== */
  if (
    name.startsWith("анаст") ||
    name.startsWith("наст") ||
    name.startsWith("анти") ||
    name.startsWith("анфи")
  ) {
    return "Анастасия";
  }

  /* ===== ЕРТАЙ ===== */
  if (
    name.includes("ерт") ||
    name.includes("ярт") ||
    name.includes("юрт") ||
    name === "рта" ||
    name === "рт"
  ) {
    return "Ертай";
  }

  /* ===== ЖАННА (С ОТСЕЧКАМИ) ===== */
  if (name.startsWith("жан")) {
    return "Жанна";
  }

  /* ===== ПРОЧИЕ ИЗ БЕЛОГО СПИСКА ===== */
  const normalized = name.charAt(0).toUpperCase() + name.slice(1);
  return MAIN_MANAGERS.has(normalized) ? normalized : "";
}

/* ===================== LOAD DATA ===================== */

fetch("call_registry.json", { cache: "no-store" })
  .then(r => r.json())
  .then(data => {
    ALL_CALLS = Array.isArray(data) ? data : [];

    const dates = ALL_CALLS
      .map(c => clean(c.datetime).slice(0,10))
      .filter(Boolean)
      .sort();

    if (dates.length) {
      dateFrom.value = dates[0];
      dateTo.value = dates[dates.length - 1];
    }

    btnShow.disabled = false;
    loadHint.textContent = `Загружено ${ALL_CALLS.length} звонков`;
    buildRegistry(ALL_CALLS);
  });

/* ===================== TABS ===================== */

function switchTab(id) {
  dashboard.classList.toggle("hidden", id !== "dashboard");
  registry.classList.toggle("hidden", id !== "registry");
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  event.target.classList.add("active");
}

/* ===================== FILTER ===================== */

function showDashboard() {
  const f = dateFrom.value;
  const t = dateTo.value;

  const calls = ALL_CALLS.filter(c => {
    const d = clean(c.datetime).slice(0,10);
    return d && d >= f && d <= t;
  });

  buildDashboard(calls);
  buildRegistry(calls);
  switchTab("dashboard");
}

/* ===================== DASHBOARD ===================== */

function buildDashboard(calls) {
  destroyCharts();
  dashboard.classList.remove("hidden");

  const byManager = {};

  calls.forEach(c => {
    const m = normalizeManagerName(c.manager);
    if (!isValidManager(m)) return;
    byManager[m] ??= [];
    byManager[m].push(c);
  });

  const managers = Object.keys(byManager);
  const counts = managers.map(m => byManager[m].length);
  const avgScores = managers.map(m => {
    const s = byManager[m].map(c => Number(c.ai?.score) || 0);
    return s.reduce((a,b)=>a+b,0) / (s.length || 1);
  });
  const goodPct = managers.map(m => {
    const arr = byManager[m];
    return arr.filter(c => (Number(c.ai?.score)||0) >= 4).length / arr.length * 100;
  });
  const durations = calls
  .map(c => Number(c.duration_sec) || 0)
  .filter(d => d > 0);

const avgDuration = durations.length
  ? Math.round(durations.reduce((a,b)=>a+b,0) / durations.length)
  : 0;


  metrics.innerHTML = `
    <div class="metric">Звонков<b>${calls.length}</b></div>
    <div class="metric">Средняя оценка<b>${(
      calls.map(c=>Number(c.ai?.score)||0).reduce((a,b)=>a+b,0) /
      (calls.length||1)
    ).toFixed(2)}</b></div>
  `;

  charts.push(new Chart(chartCount, {
    type: "bar",
    data: { labels: managers, datasets: [{ data: counts }] },
    options: { plugins:{ legend:{ display:false } } }
  }));

  charts.push(new Chart(chartAvg, {
    type: "bar",
    data: { labels: managers, datasets: [{ data: avgScores }] },
    options: { scales:{ y:{ max:10 } }, plugins:{ legend:{ display:false } } }
  }));

  charts.push(new Chart(chartGood, {
    type: "bar",
    data: { labels: managers, datasets: [{ data: goodPct }] },
    options: { scales:{ y:{ max:100 } }, plugins:{ legend:{ display:false } } }
  }));

  tableBody.innerHTML = managers.map((m,i)=>`
    <tr>
      <td>${m}</td>
      <td>${counts[i]}</td>
      <td>${avgScores[i].toFixed(2)}</td>
      <td>${goodPct[i].toFixed(1)}%</td>
    </tr>
  `).join("");
}

/* ===================== REGISTRY ===================== */

function renderDialog(dialog = []) {
  if (!Array.isArray(dialog) || !dialog.length) return "—";

  return dialog.map(d => `
    <div>
      <b>${d.speaker}:</b> ${d.text}
    </div>
  `).join("");
}

function buildRegistry(calls){
  registryBody.innerHTML = calls.map(c => `
    <tr>
      <td>${clean(c.datetime).replace("T"," ")}</td>
      <td>${normalizeManagerName(c.manager) || "—"}</td>
      <td>${clean(c.call_type)}</td>
      <td>${clean(c.duration_sec)}</td>
      <td>${clean(c.ai?.score)}</td>
      <td>${renderDialog(c.dialog)}</td>
    </tr>
  `).join("");
}



