/* ===================== GLOBAL ===================== */

let ALL_CALLS = [];
let charts = [];
let registrySort = { field: null, asc: true };

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Akvilon2026";

function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("mainContent").classList.remove("hidden");
    errorMsg.textContent = "";
  } else {
    errorMsg.textContent = "Неверный логин или пароль";
  }
}

// Allow Enter key to login
document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") login();
    });
  }
});

/* ===================== DOM ===================== */

const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const filterManager = document.getElementById("filterManager");
const btnShow = document.getElementById("btnShow");
const loadHint = document.getElementById("loadHint");

const dashboard = document.getElementById("dashboard");
const registry = document.getElementById("registry");
const dashboardFilters = document.getElementById("dashboardFilters");

const metrics = document.getElementById("metrics");
const tableBody = document.getElementById("tableBody");
const registryBody = document.getElementById("registryBody");

const chartCount = document.getElementById("chartCount");
const chartAvg = document.getElementById("chartAvg");
const chartGood = document.getElementById("chartGood");

/* ===================== HELPERS ===================== */

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function isValidManager(name) {
  if (!name) return false;
  return !["менеджер", "неизвестно", "unknown", "—"].includes(
    name.toLowerCase(),
  );
}

function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
}

// Функция для создания кликабельного текста рекомендаций
function renderRecommendation(text, index) {
  if (!text || text === "—") return "—";

  const MAX_LENGTH = 120;
  if (text.length <= MAX_LENGTH) {
    return text;
  }

  const shortText = text.substring(0, MAX_LENGTH);
  const id = `rec-${index}`;

  return `
    <span class="recommendation-expandable" onclick="toggleRecommendation('${id}')" title="Нажмите чтобы развернуть">
      <span id="${id}-short">${shortText}...</span>
      <span id="${id}-full" class="hidden">${text}</span>
    </span>
  `;
}

// Функция для переключения показа рекомендаций
function toggleRecommendation(id) {
  const shortEl = document.getElementById(id + "-short");
  const fullEl = document.getElementById(id + "-full");
  const container = shortEl.parentElement;

  if (shortEl && fullEl) {
    const isExpanded = !shortEl.classList.contains("hidden");

    if (isExpanded) {
      // Сворачиваем
      shortEl.classList.add("hidden");
      fullEl.classList.remove("hidden");
      container.title = "Нажмите чтобы свернуть";
      container.classList.add("expanded");
    } else {
      // Разворачиваем
      shortEl.classList.remove("hidden");
      fullEl.classList.add("hidden");
      container.title = "Нажмите чтобы развернуть";
      container.classList.remove("expanded");
    }
  }
}

/* ===================== ОСНОВНЫЕ ИМЕНА ===================== */

// Focused managers requested: only these will be shown in dashboard/registry
const FOCUS_MANAGERS = new Set([
  "Анастасия",
  "Светлана",
  "Жанна",
  "Ертай",
  "Нургуль",
]);

/* ===================== НОРМАЛИЗАЦИЯ ===================== */

function normalizeManagerName(raw) {
  let name = clean(raw)
    .toLowerCase()
    .replace(/[^a-zа-яё ]/gi, "")
    .trim();

  if (!name) return "";

  if (/(гул|гуль|кул|куль|голь)/.test(name)) return "Нургуль";
  if (["анна", "аня"].includes(name)) return "Анна";
  if (name.startsWith("анаст") || name.startsWith("наст")) return "Анастасия";
  if (name.includes("ерт")) return "Ертай";
  if (name.startsWith("жан")) return "Жанна";

  const normalized = name[0].toUpperCase() + name.slice(1);
  return normalized;
}

/* ===================== LOAD DATA ===================== */

function handleLoadedData(data) {
  ALL_CALLS = Array.isArray(data) ? data : [];

  const dates = ALL_CALLS.map((c) => clean(c.datetime).slice(0, 10))
    .filter(Boolean)
    .sort();

  if (dates.length) {
    // Set dashboard dates
    document.getElementById("dashboardDateFrom").value = dates[0];
    document.getElementById("dashboardDateTo").value = dates[dates.length - 1];

    // Set registry dates
    document.getElementById("dateFrom").value = dates[0];
    document.getElementById("dateTo").value = dates[dates.length - 1];
  }

  btnShow.disabled = false;
  loadHint.textContent = `Загружено ${ALL_CALLS.length} звонков`;
  buildRegistry(ALL_CALLS);
}

if (window.Worker) {
  loadHint.textContent = "Загружаю данные (в фоне)...";
  try {
    const worker = new Worker("parseWorker.js");
    worker.postMessage("start");
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "loaded") {
        handleLoadedData(m.data);
        worker.terminate();
      } else if (m.type === "error") {
        loadHint.textContent = "Ошибка загрузки данных";
        console.error(m.error);
        worker.terminate();
      }
    };
    worker.onerror = (err) => {
      loadHint.textContent = "Ошибка загрузки данных";
      console.error(err);
      worker.terminate();
    };
  } catch (err) {
    // fallback to main-thread fetch
    loadHint.textContent = "Загружаю данные...";
    fetch("call_registry.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => handleLoadedData(data))
      .catch((err) => {
        loadHint.textContent = "Ошибка загрузки данных";
        console.error(err);
      });
  }
} else {
  loadHint.textContent = "Загружаю данные...";
  fetch("call_registry.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => handleLoadedData(data))
    .catch((err) => {
      loadHint.textContent = "Ошибка загрузки данных";
      console.error(err);
    });
}

/* ===================== TABS ===================== */

function switchTab(id, el) {
  dashboard.classList.toggle("hidden", id !== "dashboard");
  registry.classList.toggle("hidden", id !== "registry");
  dashboardFilters.classList.toggle("hidden", id !== "dashboard");

  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
}

/* ===================== FILTER ===================== */

function showDashboard() {
  const f = document.getElementById("dashboardDateFrom").value;
  const t = document.getElementById("dashboardDateTo").value;

  const calls = ALL_CALLS.filter((c) => {
    const d = clean(c.datetime).slice(0, 10);
    return d && d >= f && d <= t;
  });

  buildDashboard(calls);
}

/* ===================== DASHBOARD ===================== */

function buildDashboard(calls) {
  destroyCharts();
  dashboard.classList.remove("hidden");

  const byManager = {};

  calls.forEach((c) => {
    const m = normalizeManagerName(c.manager);
    if (!isValidManager(m)) return;
    if (!FOCUS_MANAGERS.has(m)) return;
    byManager[m] ??= [];
    byManager[m].push(c);
  });

  const managers = Object.keys(byManager);
  const counts = managers.map((m) => byManager[m].length);

  const avgScores = managers.map((m) => {
    const s = byManager[m].map((c) => Number(c.ai?.score) || 0);
    return s.reduce((a, b) => a + b, 0) / (s.length || 1);
  });

  const goodPct = managers.map(
    (m) =>
      (byManager[m].filter((c) => (Number(c.ai?.score) || 0) >= 4).length /
        byManager[m].length) *
      100,
  );

  metrics.innerHTML = `
    <div class="metric">Звонков<b>${calls.length}</b></div>
    <div class="metric">Средняя оценка<b>${(
      calls.map((c) => Number(c.ai?.score) || 0).reduce((a, b) => a + b, 0) /
      (calls.length || 1)
    ).toFixed(2)}</b></div>
  `;

  charts.push(
    new Chart(chartCount, {
      type: "bar",
      data: { labels: managers, datasets: [{ data: counts }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    }),
  );

  charts.push(
    new Chart(chartAvg, {
      type: "bar",
      data: { labels: managers, datasets: [{ data: avgScores }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { max: 10 } },
        plugins: { legend: { display: false } },
      },
    }),
  );

  charts.push(
    new Chart(chartGood, {
      type: "bar",
      data: { labels: managers, datasets: [{ data: goodPct }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { max: 100 } },
        plugins: { legend: { display: false } },
      },
    }),
  );

  tableBody.innerHTML = managers
    .map(
      (m, i) => `
    <tr>
      <td>${m}</td>
      <td>${counts[i]}</td>
      <td>${avgScores[i].toFixed(2)}</td>
      <td>${goodPct[i].toFixed(1)}%</td>
    </tr>
  `,
    )
    .join("");
}

/* ===================== REGISTRY ===================== */

function renderDialog(dialog = [], rowId) {
  if (!Array.isArray(dialog) || !dialog.length)
    return `<button class='expand-btn' onclick='toggleDialog(${rowId})'><b>Показать диалог</b></button>`;
  return `<button class='expand-btn' onclick='toggleDialog(${rowId})'><b>Показать диалог (${dialog.length})</b></button><div id='dialog-${rowId}' class='dialog-content' style='display:none'>${dialog.map((d) => `<div><b>${d.speaker}:</b> ${d.text}</div>`).join("")}</div>`;
}

function toggleDialog(rowId) {
  const dialogEl = document.getElementById("dialog-" + rowId);
  if (dialogEl) {
    dialogEl.style.display =
      dialogEl.style.display === "none" ? "block" : "none";
  }
}

function sortRegistry(field) {
  if (registrySort.field === field) {
    registrySort.asc = !registrySort.asc;
  } else {
    registrySort.field = field;
    registrySort.asc = true;
  }
  buildRegistry(ALL_CALLS);
}

function buildRegistry(calls) {
  // Show all calls without manager filtering
  if (!Array.isArray(calls) || calls.length === 0) {
    registryBody.innerHTML = "";
    return;
  }

  // Filter by date range
  const dateFromVal = document.getElementById("dateFrom").value;
  const dateToVal = document.getElementById("dateTo").value;
  let filtered = calls;

  if (dateFromVal || dateToVal) {
    filtered = calls.filter((c) => {
      const d = clean(c.datetime).slice(0, 10);
      if (dateFromVal && d < dateFromVal) return false;
      if (dateToVal && d > dateToVal) return false;
      return true;
    });
  }

  // Filter by selected manager if any
  const selectedManager = filterManager.value;
  if (selectedManager) {
    filtered = filtered.filter((c) => {
      const m = normalizeManagerName(c.manager);
      return FOCUS_MANAGERS.has(m) && m === selectedManager;
    });
  }

  let sorted = [...filtered];

  // Apply sorting
  if (registrySort.field) {
    sorted.sort((a, b) => {
      let aVal, bVal;

      if (registrySort.field === "manager") {
        aVal = FOCUS_MANAGERS.has(normalizeManagerName(a.manager))
          ? normalizeManagerName(a.manager)
          : "менеджер";
        bVal = FOCUS_MANAGERS.has(normalizeManagerName(b.manager))
          ? normalizeManagerName(b.manager)
          : "менеджер";
        return registrySort.asc
          ? aVal.localeCompare(bVal, "ru")
          : bVal.localeCompare(aVal, "ru");
      } else if (registrySort.field === "datetime") {
        aVal = clean(a.datetime).slice(0, 19);
        bVal = clean(b.datetime).slice(0, 19);
        return registrySort.asc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else if (registrySort.field === "type") {
        aVal = clean(a.call_type);
        bVal = clean(b.call_type);
        return registrySort.asc
          ? aVal.localeCompare(bVal, "ru")
          : bVal.localeCompare(aVal, "ru");
      } else if (registrySort.field === "duration") {
        aVal = Number(a.duration_sec) || 0;
        bVal = Number(b.duration_sec) || 0;
        return registrySort.asc ? aVal - bVal : bVal - aVal;
      } else if (registrySort.field === "score") {
        aVal = Number(a.ai?.score) || 0;
        bVal = Number(b.ai?.score) || 0;
        return registrySort.asc ? aVal - bVal : bVal - aVal;
      } else if (registrySort.field === "recommendation") {
        aVal = clean(a.ai?.recommendation) || "";
        bVal = clean(b.ai?.recommendation) || "";
        return registrySort.asc
          ? aVal.localeCompare(bVal, "ru")
          : bVal.localeCompare(aVal, "ru");
      }
      return 0;
    });
  }

  const LIMIT = 500;
  const useAll = sorted.length <= LIMIT;
  const rows = (useAll ? sorted : sorted.slice(0, LIMIT))
    .map(
      (c, idx) => `
    <tr>
      <td>${clean(c.datetime).replace("T", " ")}</td>
      <td>${(() => {
        const m = normalizeManagerName(c.manager);
        return FOCUS_MANAGERS.has(m) ? m : "менеджер";
      })()}</td>
      <td>${clean(c.call_type)}</td>
      <td>${clean(c.duration_sec)}</td>
      <td>${clean(c.ai?.score)}</td>
      <td class="recommendation-cell">${renderRecommendation(clean(c.ai?.recommendation), idx)}</td>
      <td>${renderDialog(c.dialog, idx)}</td>
    </tr>
  `,
    )
    .join("");

  registryBody.innerHTML = rows;

  if (!useAll) {
    registryBody.insertAdjacentHTML(
      "beforeend",
      `
      <tr class="load-more-row">
        <td colspan="7" style="text-align:center;padding:12px">
          <button id="loadMoreRegistry">Показать все (${sorted.length})</button>
        </td>
      </tr>
    `,
    );
    const btn = document.getElementById("loadMoreRegistry");
    if (btn) btn.addEventListener("click", () => buildRegistry(calls));
  }
}

/* ===================== FILTER LISTENERS ===================== */

dateFrom.addEventListener("change", () => buildRegistry(ALL_CALLS));
dateTo.addEventListener("change", () => buildRegistry(ALL_CALLS));
filterManager.addEventListener("change", () => buildRegistry(ALL_CALLS));
