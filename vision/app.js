const DATA_BASE = "../data/processed/views";

const charts = {};
const state = {
  selectedCity: null,
  selectedIndustry: null,
  selectedJob: null,
  topCityMetric: "job_count",
  topIndustryMetric: "job_count",
  topJobLineMetric: "avg_salary_k",
  minJobCount: 50,
  clusterCount: 5,
};
let dataStore = null;

const metricLabels = {
  activity_index: "活跃度",
  salary_index: "薪资水平",
  industry_diversity: "行业多样性",
  experience_level: "经验门槛",
};

const metricDisplay = {
  job_count: "岗位数",
  avg_salary_k: "平均月薪(K)",
  median_salary_k: "中位月薪(K)",
};

const topJobLineLabels = {
  avg_salary_k: "平均月薪(K)",
  median_salary_k: "中位月薪(K)",
};

const numberFormat = new Intl.NumberFormat("zh-CN");

const formatValue = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  if (typeof value === "number") {
    const rounded = digits === 0 ? Math.round(value) : Number(value.toFixed(digits));
    return numberFormat.format(rounded);
  }
  return String(value);
};

const byCountDesc = (a, b) => (b.count || b.job_count || 0) - (a.count || a.job_count || 0);
const getItemCount = (item) => item.job_count ?? item.count ?? 0;

const createChart = (id) => {
  const el = document.getElementById(id);
  if (!el) {
    return null;
  }
  const chart = echarts.init(el);
  charts[id] = chart;
  return chart;
};

const resizeCharts = () => {
  Object.values(charts).forEach((chart) => chart.resize());
};

const activateSection = (target) => {
  const tabs = document.querySelectorAll(".tab");
  const sections = document.querySelectorAll(".page-section");
  tabs.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.target === target));
  sections.forEach((section) => {
    section.classList.toggle("is-active", section.id === target);
  });
  setTimeout(resizeCharts, 100);
};

const updateFilterStatus = () => {
  const el = document.getElementById("filterStatus");
  if (!el) {
    return;
  }
  const parts = [];
  if (state.selectedCity) {
    parts.push(`城市 ${state.selectedCity}`);
  }
  if (state.selectedIndustry) {
    parts.push(`行业 ${state.selectedIndustry}`);
  }
  if (state.selectedJob) {
    parts.push(`职位 ${state.selectedJob}`);
  }
  el.textContent = parts.length ? `联动筛选：${parts.join(" / ")}` : "联动筛选：未选择";
};

const setSelection = (next) => {
  Object.assign(state, next);
  updateFilterStatus();
  if (dataStore) {
    renderAll();
  }
};

const clearSelection = () => {
  setSelection({ selectedCity: null, selectedIndustry: null, selectedJob: null });
};

const normalizeDistribution = (data) => {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data.map((item) => ({
      label: item.bin || item.name || item.category || item.group || "-",
      value: item.count ?? item.job_count ?? item.ratio ?? 0,
      ratio: item.ratio,
    }));
  }
  return Object.entries(data).map(([label, value]) => ({ label, value }));
};

const setKpiCards = (kpi) => {
  const grid = document.getElementById("kpiGrid");
  if (!grid || !kpi) {
    return;
  }
  grid.innerHTML = "";
  const items = [
    { label: "岗位总数", value: kpi.job_count, digits: 0 },
    { label: "覆盖城市", value: kpi.city_count, digits: 0 },
    { label: "覆盖行业", value: kpi.industry_count, digits: 0 },
    { label: "平均月薪(K)", value: kpi.avg_salary_k, digits: 2 },
    { label: "中位月薪(K)", value: kpi.median_salary_k, digits: 2 },
    { label: "数据保留率", value: kpi.retention_rate ? `${(kpi.retention_rate * 100).toFixed(2)}%` : "-" },
  ];
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `
      <div class="kpi-label">${item.label}</div>
      <div class="kpi-value">${typeof item.value === "string" ? item.value : formatValue(item.value, item.digits)}</div>
    `;
    grid.appendChild(card);
  });
};

const renderTopBar = (
  chartId,
  list,
  valueKey = "job_count",
  maxItems = 15,
  selectedLabel,
  onClick,
  yAxisName = "岗位数",
  valueDigits = valueKey === "job_count" ? 0 : 2
) => {
  const chart = createChart(chartId);
  if (!chart || !list) {
    return;
  }
  const data = list.slice(0, maxItems);
  const labels = data.map((item) => item.name || item.group || "-");
  const values = data.map((item, idx) => ({
    value: item[valueKey] ?? item.count ?? 0,
    itemStyle: {
      color: selectedLabel && labels[idx] === selectedLabel ? "#1d6b6b" : "#c4512e",
    },
  }));
  chart.setOption({
    grid: { left: 60, right: 20, top: 30, bottom: 60 },
    xAxis: { type: "category", data: labels, axisLabel: { rotate: 30 } },
    yAxis: {
      type: "value",
      name: yAxisName,
      nameLocation: "start",
      nameGap: 32,
      nameTextStyle: { padding: [0, 0, 6, 0] },
      axisLabel: { margin: 12 },
    },
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const item = params[0];
        const value = item?.data?.value ?? item?.value ?? 0;
        return `${item.axisValue}<br/>${yAxisName}：${formatValue(value, valueDigits)}`;
      },
    },
    series: [
      {
        type: "bar",
        data: values,
      },
    ],
  });
  chart.off("click");
  if (onClick) {
    chart.on("click", onClick);
  }
};

const renderDistribution = (chartId, data) => {
  const chart = createChart(chartId);
  if (!chart) {
    return;
  }
  const dist = normalizeDistribution(data);
  chart.setOption({
    grid: { left: 60, right: 20, top: 30, bottom: 50 },
    xAxis: { type: "category", data: dist.map((d) => d.label) },
    yAxis: { type: "value", axisLabel: { margin: 10 } },
    tooltip: { trigger: "axis" },
    series: [
      {
        type: "bar",
        data: dist.map((d) => d.value),
        itemStyle: { color: "#efb11a" },
      },
    ],
  });
};

const renderSharePie = (chartId, data, centerX = "50%") => {
  const chart = createChart(chartId);
  if (!chart) {
    return;
  }
  const dist = normalizeDistribution(data);
  const seriesData = dist.map((item) => ({
    name: item.label,
    value: item.ratio ? item.ratio * 100 : item.value,
  }));
  chart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c}%" },
    series: [
      {
        type: "pie",
        center: [centerX, "50%"],
        radius: ["40%", "70%"],
        data: seriesData,
        label: {
          formatter: (params) => `${params.name}\n${Number(params.value).toFixed(2)}%`,
          overflow: "none",
        },
        labelLayout: { hideOverlap: false, moveOverlap: "shiftY" },
      },
    ],
  });
};

const renderBoxplot = (chartId, items, maxItems = 20, selectedLabel) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const data = items.slice(0, maxItems);
  const categories = data.map((item) => item.name || item.group || "-");
  const values = data.map((item, idx) => ({
    value: [
      item.salary_min_k,
      item.salary_q1_k,
      item.median_salary_k,
      item.salary_q3_k,
      item.salary_max_k,
    ],
    itemStyle: {
      color: selectedLabel && categories[idx] === selectedLabel ? "#c4512e" : "#1d6b6b",
    },
  }));
  chart.setOption({
    grid: { left: 40, right: 20, top: 30, bottom: 80 },
    xAxis: { type: "category", data: categories, axisLabel: { rotate: 40 } },
    yAxis: { type: "value", name: "K/月" },
    tooltip: { trigger: "item" },
    series: [
      {
        type: "boxplot",
        data: values,
      },
    ],
  });
};

const renderHeatmap = (chartId, items, selectedCity, selectedIndustry) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const filteredItems = items.filter((item) => {
    const industry = item.industry || item.company_type;
    return (!selectedCity || item.city === selectedCity) && (!selectedIndustry || industry === selectedIndustry);
  });
  const sourceItems = filteredItems.length ? filteredItems : items;
  const cityTotals = new Map();
  const industryTotals = new Map();
  sourceItems.forEach((item) => {
    const city = item.city;
    const industry = item.industry || item.company_type;
    const count = item.job_count || item.count || 0;
    if (!city || !industry) {
      return;
    }
    cityTotals.set(city, (cityTotals.get(city) || 0) + count);
    industryTotals.set(industry, (industryTotals.get(industry) || 0) + count);
  });
  const topCities = Array.from(cityTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name);
  const topIndustries = Array.from(industryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name);

  const cityIndex = new Map(topCities.map((name, idx) => [name, idx]));
  const industryIndex = new Map(topIndustries.map((name, idx) => [name, idx]));
  const data = sourceItems
    .filter((item) => cityIndex.has(item.city) && industryIndex.has(item.industry || item.company_type))
    .map((item) => [
      industryIndex.get(item.industry || item.company_type),
      cityIndex.get(item.city),
      item.avg_salary_k ?? item.value ?? 0,
    ]);
  const maxValue = data.length ? Math.max(...data.map((d) => d[2]), 1) : 1;

  chart.setOption({
    grid: { left: 90, right: 20, top: 40, bottom: 80 },
    xAxis: { type: "category", data: topIndustries, axisLabel: { rotate: 30 } },
    yAxis: { type: "category", data: topCities },
    tooltip: { trigger: "item" },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 10,
    },
    series: [
      {
        type: "heatmap",
        data,
        emphasis: { itemStyle: { borderColor: "#1a1712", borderWidth: 1 } },
      },
    ],
  });
};

const renderScatter = (chartId, items, selectedLabel) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const data = items.map((item) => ({
    name: item.name || item.group,
    value: [item.job_count || item.count, item.avg_salary_k],
    size: item.job_count || item.count || 0,
  }));
  chart.setOption({
    grid: { left: 50, right: 30, top: 30, bottom: 50 },
    xAxis: { type: "value", name: "岗位数" },
    yAxis: { type: "value", name: "平均月薪(K)" },
    tooltip: {
      formatter: (params) => `${params.data.name}<br/>岗位数：${formatValue(params.data.value[0], 0)}<br/>平均月薪：${formatValue(params.data.value[1], 2)}K`,
    },
    series: [
      {
        type: "scatter",
        data,
        symbolSize: (val, params) => {
          const base = Math.sqrt(params.data.size) * 0.5 + 6;
          return selectedLabel && params.data.name === selectedLabel ? base + 6 : base;
        },
        itemStyle: {
          color: (params) => (selectedLabel && params.data.name === selectedLabel ? "#1d6b6b" : "#c4512e"),
        },
      },
    ],
  });
};

const renderAvgMedianBars = (chartId, items) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const labels = items.map((item) => item.name || item.group || item.category || "-");
  const avg = items.map((item) => item.avg_salary_k ?? item.avg ?? 0);
  const median = items.map((item) => item.median_salary_k ?? item.median ?? 0);
  chart.setOption({
    grid: { left: 40, right: 20, top: 30, bottom: 60 },
    legend: { data: ["平均值", "中位数"] },
    xAxis: { type: "category", data: labels, axisLabel: { rotate: 30 } },
    yAxis: { type: "value" },
    tooltip: { trigger: "axis" },
    series: [
      { type: "bar", name: "平均值", data: avg, itemStyle: { color: "#1d6b6b" } },
      { type: "bar", name: "中位数", data: median, itemStyle: { color: "#efb11a" } },
    ],
  });
};

const renderTopJobs = (chartId, items, selectedJob, lineMetric, onClick) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const data = items.slice(0, 20);
  const labels = data.map((item) => item.name || item.group || "-");
  const counts = data.map((item, idx) => ({
    value: item.job_count || item.count || 0,
    itemStyle: {
      color: selectedJob && labels[idx] === selectedJob ? "#1d6b6b" : "#c4512e",
    },
  }));
  const lineData = data.map((item) => item[lineMetric] ?? 0);
  const lineLabel = topJobLineLabels[lineMetric] || "平均月薪(K)";
  chart.setOption({
    grid: { left: 50, right: 40, top: 30, bottom: 80 },
    xAxis: [{ type: "category", data: labels, axisLabel: { rotate: 40 } }],
    yAxis: [
      { type: "value", name: "岗位数" },
      { type: "value", name: lineLabel },
    ],
    tooltip: { trigger: "axis" },
    series: [
      { type: "bar", name: "岗位数", data: counts },
      { type: "line", name: lineLabel, data: lineData, yAxisIndex: 1, itemStyle: { color: "#1d6b6b" } },
    ],
  });
  chart.off("click");
  if (onClick) {
    chart.on("click", onClick);
  }
};

const renderRequirementStacked = (chartId, items, selectedJob) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const byJob = new Map();
  items.forEach((item) => {
    const job = item.job_title || item.job || item.group || "-";
    const category = item.category || item.name || item.experience || "-";
    const count = item.count || item.job_count || 0;
    if (!byJob.has(job)) {
      byJob.set(job, new Map());
    }
    const map = byJob.get(job);
    map.set(category, (map.get(category) || 0) + count);
  });
  const allJobs = Array.from(byJob.entries())
    .map(([job, map]) => ({ job, count: Array.from(map.values()).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.count - a.count);
  const jobs = selectedJob && byJob.has(selectedJob)
    ? [selectedJob]
    : allJobs.slice(0, 10).map((item) => item.job);
  const categories = new Set();
  jobs.forEach((job) => {
    const map = byJob.get(job);
    map.forEach((_, cat) => categories.add(cat));
  });
  const series = Array.from(categories).map((cat) => ({
    name: cat,
    type: "bar",
    stack: "total",
    data: jobs.map((job) => (byJob.get(job).get(cat) || 0)),
  }));

  chart.setOption({
    grid: { left: 40, right: 20, top: 40, bottom: 80 },
    legend: { type: "scroll" },
    xAxis: { type: "category", data: jobs, axisLabel: { rotate: 40 } },
    yAxis: { type: "value" },
    tooltip: { trigger: "axis" },
    series,
  });
};

const renderProfileCards = (items) => {
  const container = document.getElementById("profileCards");
  if (!container || !items) {
    return;
  }
  container.innerHTML = "";
  const filtered = items.filter((item) => {
    if (state.selectedJob) {
      return item.job_title === state.selectedJob;
    }
    if (state.selectedCity) {
      return (item.top_cities || []).some((city) => city.name === state.selectedCity);
    }
    if (state.selectedIndustry) {
      return (item.top_industries || []).some((industry) => industry.name === state.selectedIndustry);
    }
    return true;
  });
  (filtered.length ? filtered : items).slice(0, 6).forEach((item) => {
    const card = document.createElement("div");
    card.className = "profile-card";
    const topCities = (item.top_cities || []).slice(0, 3).map((c) => c.name).join(", ");
    const topIndustries = (item.top_industries || []).slice(0, 3).map((c) => c.name).join(", ");
    const title = item.job_title || item.name || "-";
    card.innerHTML = `
      <h3 title="${title}">${title}</h3>
      <div class="profile-meta">
        <div>岗位数：${formatValue(item.job_count || item.count, 0)}</div>
        <div>平均月薪：${formatValue(item.avg_salary_k, 2)}K</div>
        <div>中位月薪：${formatValue(item.median_salary_k, 2)}K</div>
      </div>
      <div class="profile-meta">热门城市：${topCities || "-"}</div>
      <div class="profile-meta">热门行业：${topIndustries || "-"}</div>
    `;
    container.appendChild(card);
  });
};

const renderCityRadar = (chartId, radarData, city) => {
  const chart = createChart(chartId);
  if (!chart || !radarData) {
    return;
  }
  const metrics = radarData.filter((item) => item.city === city);
  const indicator = metrics.map((item) => ({
    name: metricLabels[item.metric_name] || item.metric_name,
    max: 1,
  }));
  const values = metrics.map((item) => item.value ?? 0);
  chart.setOption({
    radar: { indicator, radius: "65%" },
    tooltip: { trigger: "item" },
    series: [
      {
        type: "radar",
        data: [
          {
            value: values,
            name: city,
            areaStyle: { color: "rgba(29, 107, 107, 0.2)" },
            lineStyle: { color: "#1d6b6b" },
          },
        ],
      },
    ],
  });
};

const renderCitySimilarity = (chartId, items, selectedCity, clusterCount) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const palette = ["#efb11a", "#c4512e", "#1d6b6b", "#6b5f56", "#f29a2e", "#8e6c88"];
  const getDisplayCluster = (clusterId) => {
    if (!clusterCount) {
      return clusterId;
    }
    return ((clusterId - 1 + clusterCount) % clusterCount) + 1;
  };
  const data = items.map((item) => {
    const displayCluster = getDisplayCluster(item.cluster_id);
    return {
      name: item.city,
      displayCluster,
      value: [item.x, item.y, item.job_count || item.count, displayCluster],
    };
  });
  const highlight = selectedCity
    ? data.filter((item) => item.name === selectedCity)
    : [];
  chart.setOption({
    grid: { left: 40, right: 20, top: 30, bottom: 50 },
    xAxis: { type: "value" },
    yAxis: { type: "value" },
    tooltip: {
      formatter: (params) => `${params.data.name}<br/>聚类：${params.data.value[3]}<br/>岗位数：${formatValue(params.data.value[2], 0)}`,
    },
    series: [
      {
        type: "scatter",
        data,
        symbolSize: (val, params) => {
          const base = Math.sqrt(val[2]) * 0.5 + 6;
          return selectedCity && params.data.name === selectedCity ? base + 6 : base;
        },
        itemStyle: {
          color: (params) => {
            if (selectedCity && params.data.name === selectedCity) {
              return "#1d6b6b";
            }
            const index = (params.data.displayCluster - 1) % palette.length;
            return palette[index];
          },
        },
      },
      {
        type: "scatter",
        data: highlight,
        symbolSize: 12,
        z: 20,
        itemStyle: {
          color: "#f29a2e",
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      },
    ],
  });
};

const renderCityStats = (chartId, items) => {
  const chart = createChart(chartId);
  if (!chart || !items) {
    return;
  }
  const data = items.slice(0, 25).sort(byCountDesc);
  const labels = data.map((item) => item.name || item.group || "-");
  const counts = data.map((item) => item.job_count || item.count || 0);
  const avg = data.map((item) => item.avg_salary_k ?? 0);
  chart.setOption({
    grid: { left: 50, right: 40, top: 30, bottom: 80 },
    xAxis: [{ type: "category", data: labels, axisLabel: { rotate: 40 } }],
    yAxis: [
      { type: "value", name: "岗位数" },
      { type: "value", name: "平均月薪(K)" },
    ],
    tooltip: { trigger: "axis" },
    series: [
      { type: "bar", name: "岗位数", data: counts, itemStyle: { color: "#c4512e" } },
      { type: "line", name: "平均月薪", data: avg, yAxisIndex: 1, itemStyle: { color: "#1d6b6b" } },
    ],
  });
};

const renderSimilarityList = (items, city) => {
  const container = document.getElementById("similarityList");
  if (!container || !items) {
    return;
  }
  const match = items.find((item) => item.city === city);
  const list = match ? match.top_similar_cities || [] : [];
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = "<div class=\"similarity-item\">暂无相似城市。</div>";
    return;
  }
  list.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "similarity-item";
    div.innerHTML = `<strong>${entry.city}</strong><br/>相似度：${(entry.similarity * 100).toFixed(2)}%`;
    container.appendChild(div);
  });
};

const initTabs = () => {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateSection(tab.dataset.target);
    });
  });
};

const renderAll = () => {
  if (!dataStore) {
    return;
  }
  const { overview, salary, profile, region } = dataStore;
  const minCount = state.minJobCount;
  const filterByMinCount = (items) => (items || []).filter((item) => getItemCount(item) >= minCount);
  const metricCityLabel = metricDisplay[state.topCityMetric] || "岗位数";
  const metricIndustryLabel = metricDisplay[state.topIndustryMetric] || "岗位数";
  setKpiCards(overview.kpi);
  renderTopBar(
    "chartTopCities",
    overview.top_cities,
    state.topCityMetric,
    15,
    state.selectedCity,
    (params) => {
      setSelection({ selectedCity: params.name, selectedJob: null });
    },
    metricCityLabel,
    state.topCityMetric === "job_count" ? 0 : 2
  );
  renderTopBar(
    "chartTopIndustries",
    overview.top_industries,
    state.topIndustryMetric,
    15,
    state.selectedIndustry,
    (params) => {
      setSelection({ selectedIndustry: params.name, selectedJob: null });
    },
    metricIndustryLabel,
    state.topIndustryMetric === "job_count" ? 0 : 2
  );
  renderDistribution("chartSalaryDistribution", overview.salary_distribution || overview.kpi?.salary_bin_distribution);
  renderSharePie("chartExperienceShare", overview.experience_distribution, "58%");
  renderSharePie("chartEducationShare", overview.education_distribution, "50%");

  renderBoxplot("chartCityBoxplot", filterByMinCount(salary.city_boxplot), 20, state.selectedCity);
  renderBoxplot("chartIndustryBoxplot", filterByMinCount(salary.industry_boxplot), 20, state.selectedIndustry);
  renderHeatmap(
    "chartCityIndustryHeatmap",
    filterByMinCount(salary.city_industry_heatmap),
    state.selectedCity,
    state.selectedIndustry
  );
  renderScatter("chartCityScatter", filterByMinCount(salary.city_scatter), state.selectedCity);
  renderScatter("chartIndustryScatter", filterByMinCount(salary.industry_scatter), state.selectedIndustry);
  renderAvgMedianBars("chartExperienceSalary", salary.experience_salary);
  renderAvgMedianBars("chartEducationSalary", salary.education_salary);

  renderTopJobs("chartTopJobs", profile.top_jobs, state.selectedJob, state.topJobLineMetric, (params) => {
    const selectedJob = params.name;
    const cardMatch = (profile.profile_cards || []).find((item) => item.job_title === selectedJob);
    const nextCity = cardMatch?.top_cities?.[0]?.name || null;
    const nextIndustry = cardMatch?.top_industries?.[0]?.name || null;
    setSelection({ selectedJob, selectedCity: nextCity, selectedIndustry: nextIndustry });
  });
  renderRequirementStacked("chartRequirement", profile.requirement_distribution?.experience || [], state.selectedJob);
  renderProfileCards(profile.profile_cards || []);

  const citySelect = document.getElementById("citySelect");
  const cities = Array.from(new Set((region.city_radar || []).map((item) => item.city)));
  cities.sort();
  if (citySelect && !citySelect.dataset.ready) {
    citySelect.innerHTML = cities.map((city) => `<option value="${city}">${city}</option>`).join("");
    citySelect.dataset.ready = "true";
    citySelect.addEventListener("change", (event) => {
      const city = event.target.value;
      setSelection({ selectedCity: city });
    });
  }
  const activeCity = state.selectedCity && cities.includes(state.selectedCity)
    ? state.selectedCity
    : citySelect?.value || cities[0];
  if (citySelect && activeCity) {
    citySelect.value = activeCity;
  }
  if (activeCity) {
    renderCityRadar("chartCityRadar", region.city_radar, activeCity);
    renderSimilarityList(region.city_similarity || [], activeCity);
  }
  renderCitySimilarity("chartCitySimilarity", region.city_similarity, activeCity, state.clusterCount);
  renderCityStats("chartCityStats", region.city_stats);
  resizeCharts();
};

const init = async () => {
  if (window.location.protocol === "file:") {
    const footer = document.querySelector(".app-footer");
    if (footer) {
      footer.insertAdjacentHTML(
        "afterbegin",
        "<div><strong>数据加载受限：</strong>请使用本地服务器打开页面。</div>"
      );
    }
  }
  initTabs();
  const clearButton = document.getElementById("clearFilters");
  if (clearButton) {
    clearButton.addEventListener("click", clearSelection);
  }
  const topCityMetric = document.getElementById("topCityMetric");
  const topIndustryMetric = document.getElementById("topIndustryMetric");
  const topJobLineMetric = document.getElementById("topJobLineMetric");
  const clusterCount = document.getElementById("clusterCount");
  const minJobCountRange = document.getElementById("minJobCountRange");
  const minJobCountInput = document.getElementById("minJobCountInput");
  const [overview, salary, profile, region] = await Promise.all([
    fetch(`${DATA_BASE}/overview_page.json`).then((res) => res.json()),
    fetch(`${DATA_BASE}/salary_patterns_page.json`).then((res) => res.json()),
    fetch(`${DATA_BASE}/job_profile_page.json`).then((res) => res.json()),
    fetch(`${DATA_BASE}/region_portrait_page.json`).then((res) => res.json()),
  ]);
  const maxCount = Math.max(
    ...[...(salary.city_scatter || []), ...(salary.industry_scatter || [])].map(getItemCount),
    state.minJobCount
  );
  if (minJobCountRange && minJobCountInput) {
    const maxValue = Math.max(200, maxCount);
    minJobCountRange.max = String(maxValue);
    minJobCountInput.max = String(maxValue);
    minJobCountRange.value = String(state.minJobCount);
    minJobCountInput.value = String(state.minJobCount);
    const updateMinCount = (value) => {
      const parsed = Math.min(maxValue, Math.max(0, Number(value) || 0));
      state.minJobCount = parsed;
      minJobCountRange.value = String(parsed);
      minJobCountInput.value = String(parsed);
      renderAll();
    };
    minJobCountRange.addEventListener("input", (event) => updateMinCount(event.target.value));
    minJobCountInput.addEventListener("change", (event) => updateMinCount(event.target.value));
  }
  if (topCityMetric) {
    topCityMetric.value = state.topCityMetric;
    topCityMetric.addEventListener("change", (event) => {
      state.topCityMetric = event.target.value;
      renderAll();
    });
  }
  if (topIndustryMetric) {
    topIndustryMetric.value = state.topIndustryMetric;
    topIndustryMetric.addEventListener("change", (event) => {
      state.topIndustryMetric = event.target.value;
      renderAll();
    });
  }
  if (topJobLineMetric) {
    topJobLineMetric.value = state.topJobLineMetric;
    topJobLineMetric.addEventListener("change", (event) => {
      state.topJobLineMetric = event.target.value;
      renderAll();
    });
  }
  if (clusterCount) {
    clusterCount.value = String(state.clusterCount);
    clusterCount.addEventListener("change", (event) => {
      state.clusterCount = Number(event.target.value);
      renderAll();
    });
  }
  dataStore = { overview, salary, profile, region };
  updateFilterStatus();
  renderAll();
};

init().catch((error) => {
  console.error("Failed to initialize dashboard", error);
  const footer = document.querySelector(".app-footer");
  if (footer) {
    footer.insertAdjacentHTML(
      "afterbegin",
      "<div><strong>数据加载失败：</strong>请确认已启动本地服务器且 JSON 文件存在。</div>"
    );
  }
});

window.addEventListener("resize", resizeCharts);
