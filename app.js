const state = {
  rows: [],
  columns: [],
  numericColumns: [],
  dateColumns: [],
  categoricalColumns: [],
  filters: {},
  chart: null,
  sourceName: ""
};

const pcbState = {
  rows: [],
  filters: {
    design: "",
    status: "",
    designer: "",
    reviewer: ""
  },
  statusChart: null,
  issueChart: null
};

const ui = {
  fileInput: document.getElementById("file-input"),
  dropzone: document.getElementById("dropzone"),
  fileMeta: document.getElementById("file-meta"),
  dashboard: document.getElementById("dashboard"),
  chartType: document.getElementById("chart-type"),
  dimension: document.getElementById("dimension"),
  metric: document.getElementById("metric"),
  aggregation: document.getElementById("aggregation"),
  filterWrap: document.getElementById("filter-wrap"),
  chartCanvas: document.getElementById("chart"),
  chartCaption: document.getElementById("chart-caption"),
  insightsList: document.getElementById("insights-list"),
  loadDemo: document.getElementById("load-demo"),
  loadPcbDemo: document.getElementById("load-pcb-demo"),
  pcbFileInput: document.getElementById("pcb-file-input"),
  pcbDashboard: document.getElementById("pcb-dashboard"),
  pcbMeta: document.getElementById("pcb-meta"),
  pcbDesignFilter: document.getElementById("pcb-design-filter"),
  pcbStatusFilter: document.getElementById("pcb-status-filter"),
  pcbDesignerFilter: document.getElementById("pcb-designer-filter"),
  pcbReviewerFilter: document.getElementById("pcb-reviewer-filter"),
  kpiTotal: document.getElementById("kpi-total"),
  kpiOpen: document.getElementById("kpi-open"),
  kpiInProgress: document.getElementById("kpi-inprogress"),
  kpiResolved: document.getElementById("kpi-resolved"),
  pcbStatusChart: document.getElementById("pcb-status-chart"),
  pcbIssueChart: document.getElementById("pcb-issue-chart"),
  pcbInsightsList: document.getElementById("pcb-insights-list"),
  pcbTableBody: document.getElementById("pcb-table-body")
};

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[$,%\s,]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isLikelyDateColumn(values) {
  const nonEmpty = values.filter((value) => String(value || "").trim() !== "");
  if (!nonEmpty.length) return false;
  const dateHits = nonEmpty.filter((value) => toDate(value)).length;
  return dateHits / nonEmpty.length >= 0.7;
}

function detectColumnTypes(rows, columns) {
  const numericColumns = [];
  const dateColumns = [];
  const categoricalColumns = [];

  for (const column of columns) {
    const values = rows.map((row) => row[column]);
    const nonEmpty = values.filter((value) => String(value || "").trim() !== "");
    if (!nonEmpty.length) continue;

    const numericHits = nonEmpty.filter((value) => toNumber(value) !== null).length;
    const uniqueCount = new Set(nonEmpty.map((value) => String(value))).size;

    if (numericHits / nonEmpty.length >= 0.8) {
      numericColumns.push(column);
      continue;
    }

    if (isLikelyDateColumn(nonEmpty)) {
      dateColumns.push(column);
      continue;
    }

    if (uniqueCount <= Math.min(40, Math.max(6, Math.floor(rows.length * 0.5)))) {
      categoricalColumns.push(column);
    }
  }

  return { numericColumns, dateColumns, categoricalColumns };
}

function setSelectOptions(select, values, preferred, withAll = false) {
  select.innerHTML = "";
  if (withAll) {
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "All";
    select.appendChild(allOpt);
  }
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  if (preferred && values.includes(preferred)) {
    select.value = preferred;
  }
}

function buildFilterUI() {
  ui.filterWrap.innerHTML = "";
  state.filters = {};

  for (const column of state.categoricalColumns.slice(0, 4)) {
    const values = Array.from(new Set(state.rows.map((row) => String(row[column] || "").trim()).filter(Boolean))).sort();
    if (values.length <= 1 || values.length > 60) continue;

    const card = document.createElement("label");
    card.className = "filter-card";
    card.innerHTML = `<span>Filter: ${column}</span>`;

    const select = document.createElement("select");
    select.dataset.filterColumn = column;
    select.innerHTML = `<option value="">All</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    select.addEventListener("change", () => {
      state.filters[column] = select.value;
      refreshChartAndInsights();
    });

    card.appendChild(select);
    ui.filterWrap.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFilteredRows() {
  return state.rows.filter((row) => {
    for (const [column, filterValue] of Object.entries(state.filters)) {
      if (!filterValue) continue;
      if (String(row[column] || "").trim() !== filterValue) return false;
    }
    return true;
  });
}

function aggregateRows(rows, dimension, metric, aggregation) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[dimension] || "(blank)").trim() || "(blank)";
    const numeric = toNumber(row[metric]);

    if (!groups.has(label)) {
      groups.set(label, { sum: 0, count: 0, numericCount: 0 });
    }

    const entry = groups.get(label);
    entry.count += 1;
    if (numeric !== null) {
      entry.sum += numeric;
      entry.numericCount += 1;
    }
  }

  const points = Array.from(groups.entries()).map(([label, entry]) => {
    let value = 0;
    if (aggregation === "count") {
      value = entry.count;
    } else if (aggregation === "avg") {
      value = entry.numericCount ? entry.sum / entry.numericCount : 0;
    } else {
      value = entry.sum;
    }
    return { label, value: Number(value.toFixed(2)) };
  });

  const isDateDimension = state.dateColumns.includes(dimension);
  if (isDateDimension) {
    points.sort((a, b) => {
      const da = toDate(a.label);
      const db = toDate(b.label);
      if (!da || !db) return a.label.localeCompare(b.label);
      return da.getTime() - db.getTime();
    });
  } else {
    points.sort((a, b) => b.value - a.value);
  }

  return points.slice(0, 30);
}

function chartColors(size) {
  const palette = [
    "#6fe0b4", "#40c4f2", "#ffd480", "#ff9f9f", "#c3a5ff", "#8ef5ff",
    "#97d88a", "#8db7ff", "#ffc27a", "#f7a9d2", "#84e6c5", "#72c8ff"
  ];
  return Array.from({ length: size }, (_, idx) => palette[idx % palette.length]);
}

function renderChart(points, chartType, metric, dimension, aggregation) {
  if (state.chart) {
    state.chart.destroy();
  }

  const labels = points.map((point) => point.label);
  const values = points.map((point) => point.value);
  const colors = chartColors(values.length);

  state.chart = new Chart(ui.chartCanvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: `${aggregation.toUpperCase()} of ${metric}`,
          data: values,
          backgroundColor: chartType === "line" ? "rgba(111, 224, 180, 0.2)" : colors,
          borderColor: chartType === "line" ? "#6fe0b4" : colors,
          borderWidth: 2,
          tension: 0.3,
          fill: chartType === "line"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#eaf4ff" }
        }
      },
      scales: chartType === "pie" ? {} : {
        x: {
          ticks: { color: "#9ab2c5" },
          grid: { color: "rgba(130, 188, 214, 0.12)" }
        },
        y: {
          ticks: { color: "#9ab2c5" },
          grid: { color: "rgba(130, 188, 214, 0.12)" }
        }
      }
    }
  });

  ui.chartCaption.textContent = `${chartType.toUpperCase()} chart of ${metric} by ${dimension} (${aggregation}).`;
}

function inferMonthlyLabel(label) {
  const dt = toDate(label);
  if (!dt) return null;
  return dt.toLocaleString(undefined, { month: "long" });
}

function generateInsights(points, rows, dimension, metric, aggregation) {
  const insights = [];
  if (!points.length) {
    insights.push("No data points available after filters. Try broadening your filter selections.");
    return insights;
  }

  const best = points.reduce((max, point) => (point.value > max.value ? point : max), points[0]);
  const worst = points.reduce((min, point) => (point.value < min.value ? point : min), points[0]);
  const average = points.reduce((sum, point) => sum + point.value, 0) / points.length;

  const bestMonth = inferMonthlyLabel(best.label);
  if (bestMonth) {
    insights.push(`${metric} peaked in ${bestMonth} (${best.value.toLocaleString()}).`);
  } else {
    insights.push(`Top ${dimension} is ${best.label} at ${best.value.toLocaleString()} (${aggregation}).`);
  }

  insights.push(`Lowest ${dimension} is ${worst.label} at ${worst.value.toLocaleString()}.`);
  insights.push(`Average ${aggregation} value across displayed groups is ${average.toFixed(2)}.`);

  if (points.length >= 4) {
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const direction = last > first ? "increased" : last < first ? "decreased" : "stayed flat";
    const delta = Math.abs(last - first).toFixed(2);
    insights.push(`From first to last displayed group, ${metric} ${direction} by ${delta}.`);
  }

  const numericValid = rows.map((row) => toNumber(row[metric])).filter((value) => value !== null);
  if (numericValid.length) {
    const total = numericValid.reduce((sum, value) => sum + value, 0);
    insights.push(`Filtered dataset contains ${rows.length} records with total ${metric} of ${total.toLocaleString()}.`);
  } else {
    insights.push(`Filtered dataset contains ${rows.length} records.`);
  }

  return insights.slice(0, 5);
}

function refreshChartAndInsights() {
  const filtered = getFilteredRows();
  const chartType = ui.chartType.value;
  const dimension = ui.dimension.value;
  const metric = ui.metric.value;
  const aggregation = ui.aggregation.value;

  const points = aggregateRows(filtered, dimension, metric, aggregation);
  renderChart(points, chartType, metric, dimension, aggregation);

  const insights = generateInsights(points, filtered, dimension, metric, aggregation);
  ui.insightsList.innerHTML = insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("");
}

function setupControlListeners() {
  for (const control of [ui.chartType, ui.dimension, ui.metric, ui.aggregation]) {
    control.addEventListener("change", refreshChartAndInsights);
  }
}

function initializeControls() {
  const defaultDimension = state.dateColumns[0] || state.categoricalColumns[0] || state.columns[0];
  const defaultMetric = state.numericColumns[0] || state.columns[0];

  setSelectOptions(ui.dimension, state.columns, defaultDimension);
  setSelectOptions(ui.metric, state.numericColumns.length ? state.numericColumns : state.columns, defaultMetric);
  buildFilterUI();
}

function parseCsvText(csvText, sourceName) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message || "CSV parse error");
  }

  const rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value || "").trim() !== ""));
  if (!rows.length) {
    throw new Error("CSV has no usable rows.");
  }

  const columns = Object.keys(rows[0]);
  if (!columns.length) {
    throw new Error("CSV does not contain headers.");
  }

  const types = detectColumnTypes(rows, columns);

  state.rows = rows;
  state.columns = columns;
  state.numericColumns = types.numericColumns;
  state.dateColumns = types.dateColumns;
  state.categoricalColumns = types.categoricalColumns;
  state.sourceName = sourceName;

  ui.dashboard.classList.remove("hidden");
  ui.fileMeta.textContent = `${sourceName}: ${rows.length.toLocaleString()} rows, ${columns.length} columns detected.`;

  initializeControls();
  refreshChartAndInsights();
}

async function parseCsvFile(file) {
  const text = await file.text();
  parseCsvText(text, file.name);
}

function tallyBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const label = String(row[key] || "(blank)").trim() || "(blank)";
    map.set(label, (map.get(label) || 0) + 1);
  }
  return map;
}

function getFilteredPcbRows() {
  return pcbState.rows.filter((row) => {
    if (pcbState.filters.design && row["PCB Design"] !== pcbState.filters.design) return false;
    if (pcbState.filters.status && row["Status"] !== pcbState.filters.status) return false;
    if (pcbState.filters.designer && row["Designer"] !== pcbState.filters.designer) return false;
    if (pcbState.filters.reviewer && row["Reviewer"] !== pcbState.filters.reviewer) return false;
    return true;
  });
}

function renderPcbKpis(rows) {
  const open = rows.filter((row) => String(row["Status"]).toLowerCase() === "open").length;
  const inProgress = rows.filter((row) => String(row["Status"]).toLowerCase() === "in progress").length;
  const resolved = rows.filter((row) => String(row["Status"]).toLowerCase() === "resolved").length;

  ui.kpiTotal.textContent = rows.length.toLocaleString();
  ui.kpiOpen.textContent = open.toLocaleString();
  ui.kpiInProgress.textContent = inProgress.toLocaleString();
  ui.kpiResolved.textContent = resolved.toLocaleString();
}

function renderPcbStatusChart(rows) {
  const statusMap = tallyBy(rows, "Status");
  const labels = Array.from(statusMap.keys());
  const values = Array.from(statusMap.values());

  if (pcbState.statusChart) pcbState.statusChart.destroy();
  pcbState.statusChart = new Chart(ui.pcbStatusChart, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: chartColors(values.length),
        borderColor: "rgba(6, 19, 31, 0.8)",
        borderWidth: 2
      }]
    },
    options: {
      plugins: { legend: { labels: { color: "#eaf4ff" } } }
    }
  });
}

function renderPcbIssueChart(rows) {
  const issueMap = tallyBy(rows, "Issue Type");
  const points = Array.from(issueMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (pcbState.issueChart) pcbState.issueChart.destroy();
  pcbState.issueChart = new Chart(ui.pcbIssueChart, {
    type: "bar",
    data: {
      labels: points.map((point) => point.label),
      datasets: [{
        label: "Findings",
        data: points.map((point) => point.value),
        backgroundColor: "rgba(64, 196, 242, 0.35)",
        borderColor: "#40c4f2",
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: "y",
      scales: {
        x: { ticks: { color: "#9ab2c5" }, grid: { color: "rgba(130, 188, 214, 0.12)" } },
        y: { ticks: { color: "#9ab2c5" }, grid: { color: "rgba(130, 188, 214, 0.12)" } }
      },
      plugins: { legend: { labels: { color: "#eaf4ff" } } }
    }
  });
}

function topEntry(map) {
  const entries = Array.from(map.entries());
  if (!entries.length) return null;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best), entries[0]);
}

function renderPcbInsights(rows) {
  if (!rows.length) {
    ui.pcbInsightsList.innerHTML = "<li>No rows match the current PCB filters.</li>";
    return;
  }

  const statusMap = tallyBy(rows, "Status");
  const issueMap = tallyBy(rows, "Issue Type");
  const designMap = tallyBy(rows, "PCB Design");
  const reviewerMap = tallyBy(rows, "Reviewer");

  const topIssue = topEntry(issueMap);
  const topDesign = topEntry(designMap);
  const topReviewer = topEntry(reviewerMap);
  const openCount = statusMap.get("Open") || 0;
  const resolvedCount = statusMap.get("Resolved") || 0;
  const inProgressCount = statusMap.get("In Progress") || 0;

  const insights = [
    `Most common issue type is ${topIssue ? topIssue[0] : "N/A"} (${topIssue ? topIssue[1] : 0} findings).`,
    `Highest finding volume is on ${topDesign ? topDesign[0] : "N/A"} (${topDesign ? topDesign[1] : 0} findings).`,
    `Most assigned reviewer is ${topReviewer ? topReviewer[0] : "N/A"} (${topReviewer ? topReviewer[1] : 0} findings).`,
    `Status mix: Open ${openCount}, In Progress ${inProgressCount}, Resolved ${resolvedCount}.`,
    resolvedCount >= openCount
      ? "Resolution momentum is positive: resolved findings are at or above open findings."
      : "Backlog pressure is elevated: open findings exceed resolved findings."
  ];

  ui.pcbInsightsList.innerHTML = insights.map((text) => `<li>${escapeHtml(text)}</li>`).join("");
}

function renderPcbTable(rows) {
  const sample = rows.slice(0, 80);
  ui.pcbTableBody.innerHTML = sample.map((row) => `
    <tr>
      <td>${escapeHtml(row["Finding ID"] || "")}</td>
      <td>${escapeHtml(row["PCB Design"] || "")}</td>
      <td>${escapeHtml(row["Issue Type"] || "")}</td>
      <td>${escapeHtml(row["Status"] || "")}</td>
      <td>${escapeHtml(row["Designer"] || "")}</td>
      <td>${escapeHtml(row["Reviewer"] || "")}</td>
    </tr>
  `).join("");
}

function refreshPcbDashboard() {
  const rows = getFilteredPcbRows();
  renderPcbKpis(rows);
  renderPcbStatusChart(rows);
  renderPcbIssueChart(rows);
  renderPcbInsights(rows);
  renderPcbTable(rows);
}

function setupPcbFilters() {
  const designs = Array.from(new Set(pcbState.rows.map((row) => row["PCB Design"]).filter(Boolean))).sort();
  const statuses = Array.from(new Set(pcbState.rows.map((row) => row["Status"]).filter(Boolean))).sort();
  const designers = Array.from(new Set(pcbState.rows.map((row) => row["Designer"]).filter(Boolean))).sort();
  const reviewers = Array.from(new Set(pcbState.rows.map((row) => row["Reviewer"]).filter(Boolean))).sort();

  setSelectOptions(ui.pcbDesignFilter, designs, "", true);
  setSelectOptions(ui.pcbStatusFilter, statuses, "", true);
  setSelectOptions(ui.pcbDesignerFilter, designers, "", true);
  setSelectOptions(ui.pcbReviewerFilter, reviewers, "", true);

  ui.pcbDesignFilter.addEventListener("change", () => {
    pcbState.filters.design = ui.pcbDesignFilter.value;
    refreshPcbDashboard();
  });

  ui.pcbStatusFilter.addEventListener("change", () => {
    pcbState.filters.status = ui.pcbStatusFilter.value;
    refreshPcbDashboard();
  });

  ui.pcbDesignerFilter.addEventListener("change", () => {
    pcbState.filters.designer = ui.pcbDesignerFilter.value;
    refreshPcbDashboard();
  });

  ui.pcbReviewerFilter.addEventListener("change", () => {
    pcbState.filters.reviewer = ui.pcbReviewerFilter.value;
    refreshPcbDashboard();
  });
}

function parsePcbCsvText(csvText, sourceName) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message || "PCB CSV parse error");
  }

  pcbState.rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value || "").trim() !== ""));
  ui.pcbDashboard.classList.remove("hidden");
  ui.pcbMeta.textContent = `${sourceName}: ${pcbState.rows.length.toLocaleString()} findings`;

  setupPcbFilters();
  refreshPcbDashboard();
}

async function loadPcbCsv() {
  const response = await fetch("./pcb_review_findings.csv");
  if (!response.ok) {
    throw new Error("pcb_review_findings.csv not found in project root.");
  }
  const csvText = await response.text();
  parsePcbCsvText(csvText, "pcb_review_findings.csv");
}

function handleDropEvents() {
  const prevent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    ui.dropzone.addEventListener(eventName, prevent);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.dropzone.addEventListener(eventName, () => ui.dropzone.classList.add("is-dragover"));
  });

  ["dragleave", "drop"].forEach((eventName) => {
    ui.dropzone.addEventListener(eventName, () => ui.dropzone.classList.remove("is-dragover"));
  });

  ui.dropzone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      ui.fileMeta.textContent = "Please upload a .csv file.";
      return;
    }
    try {
      await parseCsvFile(file);
    } catch (error) {
      ui.fileMeta.textContent = `Could not load CSV: ${error.message}`;
    }
  });
}

function wireEvents() {
  ui.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await parseCsvFile(file);
    } catch (error) {
      ui.fileMeta.textContent = `Could not load CSV: ${error.message}`;
    }
  });

  ui.loadDemo.addEventListener("click", async () => {
    try {
      const response = await fetch("./electrical_npi_performance.csv");
      if (!response.ok) {
        throw new Error("Demo CSV not found in project root.");
      }
      const csvText = await response.text();
      parseCsvText(csvText, "electrical_npi_performance.csv");
    } catch (error) {
      ui.fileMeta.textContent = `Could not load demo CSV: ${error.message}`;
    }
  });

  ui.loadPcbDemo.addEventListener("click", async () => {
    try {
      await loadPcbCsv();
    } catch (error) {
      ui.fileMeta.textContent = `Could not load PCB CSV: ${error.message}`;
      ui.pcbMeta.textContent = "Open via local server or upload PCB CSV manually.";
    }
  });

  ui.pcbFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      parsePcbCsvText(text, file.name);
    } catch (error) {
      ui.fileMeta.textContent = `Could not parse PCB CSV: ${error.message}`;
    }
  });
}

setupControlListeners();
handleDropEvents();
wireEvents();
loadPcbCsv().catch(() => {
  ui.pcbMeta.textContent = "Auto-load blocked in file mode. Use local server or Upload PCB CSV.";
});


