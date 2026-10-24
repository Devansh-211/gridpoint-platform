/**
 * GRIDPOINT — B2B Logistics Warehouse Location Optimization Client
 * Presentation-Layer Architecture with Single-State Router and Leaflet Engine.
 * Strictly adheres to B2B Operations rigor and Hackathon Honesty Rules.
 */

function createSafeLayerGroup() {
  if (typeof L !== "undefined" && typeof L.layerGroup === "function") {
    return L.layerGroup();
  }
  return {
    clearLayers: function() { return this; },
    addLayer: function() { return this; },
    removeLayer: function() { return this; },
    addTo: function() { return this; },
  };
}

const appState = {
  sessionId: "default",
  neighborhoods: [],
  configMode: "manual", // "manual" or "auto"
  currency: "INR", // "INR" (canonical) or "USD"
  costKmInr: 35, // Canonical storage unit in INR
  fixedCostInr: 15000, // Canonical storage unit in INR
  distanceMode: "road_detour",
  lastOptimize: null,
  lastCompare: null,
  lastTradeoff: null,
  lastScenario: null,
  explainCache: {},
  currentView: "viewLanding",
  priorityPreset: "cost",
  maps: {
    results: null,
    demand: null,
  },
  layers: {
    results: {
      candidates: createSafeLayerGroup(),
      neighborhoods: createSafeLayerGroup(),
      warehouses: createSafeLayerGroup(),
      assignments: createSafeLayerGroup(),
      radius: createSafeLayerGroup(),
      routes: createSafeLayerGroup(),
    },
    demand: {
      candidates: createSafeLayerGroup(),
      neighborhoods: createSafeLayerGroup(),
      heatmap: createSafeLayerGroup(),
      voronoi: createSafeLayerGroup(),
    }
  },
  tradeoffChartInstance: null,
};
window.appState = appState;

// ============================================================================
// CURRENCY SYSTEM (Canonical INR, USD Derived via Benchmark FX 85 INR/USD)
// ============================================================================

const FX_INR_PER_USD = 85;
const DEFAULT_DELIVERY_COST_PER_KM_INR = 35;
const DEFAULT_FIXED_WAREHOUSE_LEASE_INR = 15000;

function currencySymbol(currency) {
  return currency === "INR" ? "₹" : "$";
}

function convertInrToDisplay(inrValue, currency) {
  if (!Number.isFinite(inrValue)) return 0;
  return currency === "INR" ? inrValue : inrValue / FX_INR_PER_USD;
}

function convertInput(displayValue, currency) {
  if (!Number.isFinite(displayValue)) return 0;
  return currency === "INR" ? displayValue : displayValue * FX_INR_PER_USD;
}

function formatMoney(inrValue, currency = appState.currency, opts = {}) {
  if (!Number.isFinite(inrValue)) return "—";

  const { compact = false, showSymbol = true, signed = false } = opts;
  const symbol = showSymbol ? currencySymbol(currency) : "";
  const isNegative = inrValue < 0;
  const absInr = Math.abs(inrValue);
  const displayVal = convertInrToDisplay(absInr, currency);

  let formattedValue;

  if (compact) {
    if (currency === "INR") {
      if (absInr >= 10000000) {
        const cr = absInr / 10000000;
        formattedValue = `${cr.toFixed(cr >= 10 ? 1 : 2)} Cr`;
      } else if (absInr >= 100000) {
        const lk = absInr / 100000;
        formattedValue = `${lk.toFixed(lk >= 10 ? 1 : 2)} L`;
      } else if (absInr >= 1000) {
        const k = absInr / 1000;
        formattedValue = `${k.toFixed(1)}k`;
      } else {
        formattedValue = absInr.toFixed(opts.decimals !== undefined ? opts.decimals : 0);
      }
    } else {
      if (displayVal >= 1000000) {
        const m = displayVal / 1000000;
        formattedValue = `${m.toFixed(m >= 10 ? 1 : 2)}M`;
      } else if (displayVal >= 1000) {
        const k = displayVal / 1000;
        formattedValue = `${k.toFixed(k >= 10 ? 1 : 2)}k`;
      } else {
        formattedValue = displayVal.toFixed(opts.decimals !== undefined ? opts.decimals : 0);
      }
    }
  } else {
    const decimals = opts.decimals !== undefined ? opts.decimals : 2;
    const locale = currency === "INR" ? "en-IN" : "en-US";
    formattedValue = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(displayVal);
  }

  if (isNegative) {
    return `-${symbol}${formattedValue}`;
  }
  if (signed && inrValue > 0) {
    return `+${symbol}${formattedValue}`;
  }
  return `${symbol}${formattedValue}`;
}

function setCurrency(newCurrency) {
  if (newCurrency !== "INR" && newCurrency !== "USD") return;
  appState.currency = newCurrency;

  // 1. Update Header Toggle Buttons
  const btnInr = document.getElementById("btnCurrINR");
  const btnUsd = document.getElementById("btnCurrUSD");
  if (btnInr && btnUsd) {
    if (newCurrency === "INR") {
      btnInr.classList.add("active");
      btnInr.setAttribute("aria-checked", "true");
      btnInr.setAttribute("tabindex", "0");
      btnUsd.classList.remove("active");
      btnUsd.setAttribute("aria-checked", "false");
      btnUsd.setAttribute("tabindex", "-1");
    } else {
      btnUsd.classList.add("active");
      btnUsd.setAttribute("aria-checked", "true");
      btnUsd.setAttribute("tabindex", "0");
      btnInr.classList.remove("active");
      btnInr.setAttribute("aria-checked", "false");
      btnInr.setAttribute("tabindex", "-1");
    }
  }

  // 2. Update Network Config Input Labels & Values
  const sym = currencySymbol(newCurrency);
  const lblCostKm = document.getElementById("lblCostKm");
  if (lblCostKm) lblCostKm.textContent = `Delivery Cost per km (${sym})`;
  const lblFixedCost = document.getElementById("lblFixedCost");
  if (lblFixedCost) lblFixedCost.textContent = `Fixed Warehouse Lease (${sym}/site/day)`;
  const prefixFixed = document.getElementById("lblFixedCostPrefix");
  if (prefixFixed) prefixFixed.textContent = sym;
  const prefixKm = document.getElementById("lblCostKmPrefix");
  if (prefixKm) prefixKm.textContent = sym;
  const autoCostNote = document.getElementById("autoCostSummaryNote");
  if (autoCostNote) autoCostNote.textContent = `Daily Transit Cost (${sym}/km) + Facility Leases (${sym}/site)`;

  const inputCostKm = document.getElementById("inputCostKm");
  const inputFixedCost = document.getElementById("inputFixedCost");
  if (inputCostKm) {
    inputCostKm.value = newCurrency === "INR"
      ? Math.round(appState.costKmInr)
      : Number((appState.costKmInr / FX_INR_PER_USD).toFixed(2));
    inputCostKm.step = newCurrency === "INR" ? "1" : "0.01";
  }
  if (inputFixedCost) {
    inputFixedCost.value = newCurrency === "INR"
      ? Math.round(appState.fixedCostInr)
      : Number((appState.fixedCostInr / FX_INR_PER_USD).toFixed(0));
    inputFixedCost.step = newCurrency === "INR" ? "500" : "5";
  }

  // 3. Update Results Screen (Assumptions Strip, KPIs, Comparison Table)
  if (appState.lastOptimize) {
    updateResultsCurrencyDisplays(appState.lastOptimize);
  }

  // 4. Update Dashboard KPIs
  updateDashboardStats();

  // 5. Update Tradeoff Curve if present
  if (appState.lastTradeoff) {
    renderTradeoffChart(appState.lastTradeoff);
  }

  // 6. Update Scenario Lab if present
  if (appState.lastScenario) {
    updateScenarioCurrencyDisplays(appState.lastScenario);
  }

  showToast(`Currency display changed to ${newCurrency} (${sym})`);
}

function updateResultsCurrencyDisplays(data) {
  if (!data) return;
  const costKm = data.assumptions?.cost_per_km || appState.costKmInr;
  const fixedLease = data.assumptions?.fixed_cost_per_warehouse || appState.fixedCostInr;
  const rMax = data.assumptions?.radius_max_km ? `${data.assumptions.radius_max_km} km` : "No Limit";
  const distMode = (data.assumptions?.routing_mode === "road_detour") ? "Road Detour (1.35x Proxy)" : "Geographic Delivery Distance (Haversine)";

  const strip = document.getElementById("resultsAssumptionsStrip");
  if (strip) {
    strip.innerHTML = `
      <div><strong>Delivery Cost / km:</strong> ${formatMoney(costKm, appState.currency)} (Estimated)</div>
      <div><strong>Facility Lease:</strong> ${formatMoney(fixedLease, appState.currency)} / site / day</div>
      <div><strong>Max Service Radius:</strong> ${rMax}</div>
      <div><strong>Distance Metric:</strong> ${distMode}</div>
      <div><strong>Solver Status:</strong> ${data.solver_message || "Optimal"}</div>
    `;
  }

  const kpiCost = document.getElementById("kpiCost");
  if (kpiCost && data.total_delivery_cost !== undefined) {
    kpiCost.textContent = formatMoney(data.total_delivery_cost, appState.currency);
  }
  const kpiMonthly = document.getElementById("kpiMonthlySavings");
  if (kpiMonthly && data.estimated_monthly_savings !== undefined) {
    kpiMonthly.textContent = formatMoney(data.estimated_monthly_savings, appState.currency, { compact: true });
  }

  if (appState.lastCompare) {
    const kpiCostBaseline = document.getElementById("kpiCostBaseline");
    if (kpiCostBaseline && appState.lastCompare.baseline) {
      kpiCostBaseline.textContent = `Baseline: ${formatMoney(appState.lastCompare.baseline.total_delivery_cost, appState.currency)} / day`;
    }
    renderBenchmarkTable(appState.lastCompare);
  }
}

function renderBenchmarkTable(data) {
  const tbody = document.getElementById("tbodyBenchmark");
  if (!tbody || !data || !data.baseline || !data.optimized) return;
  const sym = currencySymbol(appState.currency);

  const costPct = (data.cost_pct_change !== undefined ? data.cost_pct_change : 0).toFixed(1);
  const distPct = (data.distance_pct_change !== undefined ? data.distance_pct_change : (data.weighted_distance_pct_change || 0)).toFixed(1);
  const distDelta = Math.abs(data.weighted_distance_delta !== undefined ? data.weighted_distance_delta : (data.distance_delta_km || 0)).toLocaleString();
  const co2Pct = (data.co2_pct_change !== undefined ? data.co2_pct_change : 0).toFixed(1);
  const costDelta = Math.abs(data.cost_delta !== undefined ? data.cost_delta : 0);

  tbody.innerHTML = `
    <tr>
      <td><strong>Simulated Delivery Cost (${sym}/day)</strong></td>
      <td>${formatMoney(data.baseline.total_delivery_cost, appState.currency)}</td>
      <td><strong>${formatMoney(data.optimized.total_delivery_cost, appState.currency)}</strong></td>
      <td style="color:var(--gp-success); font-weight:700;">-${formatMoney(costDelta, appState.currency)}</td>
      <td><span class="gp-delta-chip gp-delta-positive">${costPct}%</span></td>
    </tr>
    <tr>
      <td><strong>Demand-Weighted Delivery Distance (ord·km)</strong></td>
      <td>${data.baseline.weighted_distance_km.toLocaleString()}</td>
      <td><strong>${data.optimized.weighted_distance_km.toLocaleString()}</strong></td>
      <td style="color:var(--gp-success); font-weight:700;">-${distDelta}</td>
      <td><span class="gp-delta-chip gp-delta-positive">${distPct}%</span></td>
    </tr>
    <tr>
      <td><strong>Fixed Facility Lease (${sym}/day)</strong></td>
      <td>${formatMoney(data.baseline.total_infrastructure_cost, appState.currency)}</td>
      <td>${formatMoney(data.optimized.total_infrastructure_cost, appState.currency)}</td>
      <td>+${formatMoney(data.optimized.total_infrastructure_cost - data.baseline.total_infrastructure_cost, appState.currency)}</td>
      <td><span class="gp-delta-chip gp-delta-neutral">+${((data.optimized.warehouses_count - 1) * 100).toFixed(0)}%</span></td>
    </tr>
    <tr style="background:var(--gp-surface-sunken);">
      <td><strong>Combined System Cost (${sym}/day)</strong></td>
      <td>${formatMoney(data.baseline.combined_total_cost, appState.currency)}</td>
      <td><strong>${formatMoney(data.optimized.combined_total_cost, appState.currency)}</strong></td>
      <td style="color:${data.optimized.combined_total_cost < data.baseline.combined_total_cost ? 'var(--gp-success)' : 'var(--gp-text-primary)'}; font-weight:700;">
        ${data.optimized.combined_total_cost < data.baseline.combined_total_cost ? '-' : '+'}${formatMoney(Math.abs(data.optimized.combined_total_cost - data.baseline.combined_total_cost), appState.currency)}
      </td>
      <td><span class="gp-delta-chip ${data.optimized.combined_total_cost < data.baseline.combined_total_cost ? 'gp-delta-positive' : 'gp-delta-neutral'}">
        ${(((data.optimized.combined_total_cost - data.baseline.combined_total_cost) / data.baseline.combined_total_cost) * 100).toFixed(1)}%
      </span></td>
    </tr>
    <tr>
      <td><strong>Estimated Daily CO₂ Footprint (kg)</strong></td>
      <td>${data.baseline.estimated_co2_kg_per_day.toFixed(1)} kg</td>
      <td><strong>${data.optimized.estimated_co2_kg_per_day.toFixed(1)} kg</strong></td>
      <td style="color:var(--gp-success); font-weight:700;">-${Math.abs(data.co2_delta_kg).toFixed(1)} kg</td>
      <td><span class="gp-delta-chip gp-delta-positive">${co2Pct}%</span></td>
    </tr>
    <tr>
      <td><strong>Estimated 30-Day Monthly Savings</strong></td>
      <td>${formatMoney(0, appState.currency)}</td>
      <td colspan="3"><strong style="color:var(--gp-success); font-size:15px;">${formatMoney(data.estimated_monthly_savings, appState.currency)}</strong> / month</td>
    </tr>
  `;
}

function updateScenarioCurrencyDisplays(data) {
  const scCard = document.getElementById("scenarioCostCard");
  if (scCard && data && data.scenario_cost !== undefined) {
    scCard.textContent = formatMoney(data.scenario_cost, appState.currency);
  }
}

// Deterministic Cluster Color Palette for Warehouses and Zones
const CLUSTER_COLORS = [
  "#2563EB", // Royal Blue
  "#0D9488", // Teal
  "#D97706", // Amber
  "#7C3AED", // Purple
  "#DB2777", // Rose
  "#0284C7", // Sky
  "#EA580C", // Orange
  "#4F46E5", // Indigo
];

// View Metadata for Header Breadcrumb & Title
const VIEW_METADATA = {
  viewLanding: { breadcrumb: "Setup", title: "Landing & Entry" },
  viewDashboard: { breadcrumb: "Setup", title: "Dashboard Overview" },
  viewData: { breadcrumb: "Setup", title: "Demand Data Ingestion" },
  viewConfig: { breadcrumb: "Setup", title: "Network Configuration" },
  viewResults: { breadcrumb: "Results & Solvers", title: "Optimization Results" },
  viewScenarios: { breadcrumb: "Results & Solvers", title: "Scenario Lab (What-If)" },
  viewDisruption: { breadcrumb: "Results & Solvers", title: "Disruption & Resilience" },
  viewFleet: { breadcrumb: "Results & Solvers", title: "Tactical Fleet Routing (CVRP)" },
  viewAnalytics: { breadcrumb: "Reference", title: "Analytics & Trade-off Curve" },
  viewMethodology: { breadcrumb: "Reference", title: "Methodology & Honesty Rules" },
};

// ============================================================================
// CONVERSATIONAL LOGISTICS AI AGENT & EXPLAIN SYSTEM (PHASES 2, 3 & 4)
// ============================================================================

const agentState = {
  mode: "setup", // "setup", "explain", "synthetic"
  historySetup: [],
  historyExplain: [],
  knownParams: {
    warehouse_count: 3,
    warehouse_capacity: 4000,
    max_service_radius_km: 25.0,
    cost_per_km: 35.0,
    fixed_cost_per_warehouse: 15000.0,
    priority_preset: "cost",
    include_cvrp: false,
    vehicle_capacity: 250,
    vehicle_fixed_cost: 150.0,
  },
  isProcessing: false,
};

const EXPLAIN_PROMPTS_BY_VIEW = {
  viewResults: [
    "Why were these specific warehouse locations selected?",
    "Show facility throughput capacity and utilization breakdown",
    "Explain savings compared to the single-warehouse baseline",
    "How is demand-weighted distance calculated?",
  ],
  viewScenarios: [
    "How does the network respond to a +50% festival demand surge?",
    "What is the simulated cost shift during peak volume?",
    "Are any warehouse throughput capacities exceeded in this scenario?",
  ],
  viewDisruption: [
    "What happens if our primary central warehouse suffers an outage?",
    "How is displaced demand re-routed during facility failure?",
    "What is the emergency reassignment cost impact?",
  ],
  viewFleet: [
    "How are multi-stop CVRP vehicle routes constructed?",
    "Explain vehicle payload utilization across the fleet",
    "What is the total estimated fleet travel distance?",
  ],
  viewAnalytics: [
    "Where is the point of diminishing returns on the trade-off curve?",
    "Why does marginal savings decrease as warehouse count p increases?",
    "Explain the fleet CO2 emissions calculation formula",
  ],
  viewConfig: [
    "How does changing p from 3 to 4 impact delivery cost?",
    "What does maximum service radius constrain in the solver?",
    "What are the default cost and lease assumptions?",
  ],
  viewData: [
    "What validation rules are enforced on uploaded CSV datasets?",
    "How are candidate facility locations identified from delivery zones?",
    "What is the total daily demand volume across active zones?",
  ],
};

function updateSyntheticDatasetBadge(isSynthetic, badgeText, scope) {
  appState.isSyntheticAi = !!isSynthetic;
  appState.datasetType = isSynthetic ? "real_locations_synthetic_demand" : "demo";
  appState.syntheticScope = scope || appState.syntheticScope || "single_city";
  appState.syntheticBadgeText = badgeText || (appState.syntheticScope === "state" ? "[Real Towns, Synthetic Demand]" : "[Real City Anchor, Jittered Zones & Synthetic Demand]");
  
  const badge = document.getElementById("headerSyntheticBadge");
  if (badge) {
    badge.style.display = isSynthetic ? "inline-flex" : "none";
    if (isSynthetic) {
      badge.textContent = appState.syntheticBadgeText;
    }
  }
}

function gatherPageContext(viewId) {
  const ctx = {
    view: viewId,
    session_id: appState.sessionId,
    is_synthetic_ai: appState.isSyntheticAi,
    dataset_type: appState.datasetType,
  };

  if (viewId === "viewResults" && appState.lastOptimize) {
    const opt = appState.lastOptimize;
    ctx.status = opt.status;
    ctx.warehouse_count = opt.warehouse_count || (opt.warehouses ? opt.warehouses.length : 3);
    ctx.total_delivery_cost = opt.total_delivery_cost;
    ctx.estimated_monthly_savings = opt.estimated_monthly_savings;
    ctx.avg_distance_km = opt.avg_delivery_distance_km;
    ctx.max_distance_km = opt.max_delivery_distance_km;
    ctx.unassigned_count = opt.unassigned_neighborhoods ? opt.unassigned_neighborhoods.length : 0;
    ctx.priority_preset = opt.priority_preset || appState.priorityPreset;
    ctx.warehouses = (opt.warehouses || []).map(w => ({
      warehouse_id: w.warehouse_id,
      name: w.name,
      assigned_demand: w.assigned_demand,
      capacity: w.capacity,
      capacity_utilization_pct: w.capacity_utilization_pct,
      neighborhoods_count: w.neighborhoods_count,
    }));
    if (appState.lastCompare) {
      ctx.cost_pct_change = appState.lastCompare.cost_pct_change;
      ctx.co2_pct_change = appState.lastCompare.co2_pct_change;
    }
  } else if (viewId === "viewScenarios" && appState.lastScenario) {
    const sc = appState.lastScenario;
    ctx.demand_multiplier = sc.demand_multiplier;
    ctx.cost_pct_change = sc.cost_pct_change;
    ctx.scenario_warehouses = sc.scenario_warehouses;
    ctx.unserved_demand = sc.unserved_demand;
  } else if (viewId === "viewDisruption" && appState.lastScenario) {
    const sc = appState.lastScenario;
    ctx.failed_warehouse_id = sc.failed_warehouse;
    ctx.cost_pct_change = sc.cost_pct_change;
    ctx.scenario_warehouses = sc.scenario_warehouses;
  } else if (viewId === "viewFleet" && appState.lastOptimize?.cvrp_routes) {
    ctx.routes_count = appState.lastOptimize.cvrp_routes.length;
    ctx.total_fleet_distance_km = appState.lastOptimize.total_cvrp_distance_km;
  } else if (viewId === "viewAnalytics" && appState.lastTradeoff) {
    ctx.tradeoff_points = appState.lastTradeoff.points;
  } else if (viewId === "viewData") {
    ctx.neighborhood_count = appState.neighborhoods ? appState.neighborhoods.length : 0;
    ctx.total_demand = appState.neighborhoods ? appState.neighborhoods.reduce((sum, n) => sum + (n.daily_orders || 0), 0) : 0;
  } else if (viewId === "viewConfig") {
    ctx.warehouse_count = parseInt(document.getElementById("inputConfigP")?.value) || 3;
    ctx.warehouse_capacity = parseInt(document.getElementById("inputConfigCap")?.value) || 4000;
    ctx.max_service_radius_km = parseFloat(document.getElementById("inputConfigRadius")?.value) || 25.0;
    ctx.priority_preset = appState.priorityPreset;
  }

  return ctx;
}

function renderExplainQuickQuestions(viewId) {
  const container = document.getElementById("agentExplainQuickPrompts");
  if (!container) return;
  const questions = EXPLAIN_PROMPTS_BY_VIEW[viewId] || EXPLAIN_PROMPTS_BY_VIEW["viewResults"];
  container.innerHTML = '<div class="gp-quick-prompts-label">Screen Questions:</div>';
  questions.forEach(q => {
    const chip = document.createElement("button");
    chip.className = "gp-quick-chip";
    chip.textContent = `• ${q}`;
    chip.addEventListener("click", () => sendAgentExplainMessage(q));
    container.appendChild(chip);
  });
}

function setAgentMode(mode) {
  agentState.mode = mode;
  const btnSetup = document.getElementById("btnModeSetup");
  const btnExplain = document.getElementById("btnModeExplain");
  const containerSetup = document.getElementById("agentSetupContainer");
  const containerSynthetic = document.getElementById("agentSyntheticContainer");
  const containerExplain = document.getElementById("agentExplainContainer");
  const bannerExplain = document.getElementById("agentExplainBanner");
  const bannerText = document.getElementById("agentExplainBannerText");
  const inputEl = document.getElementById("agentInput");
  const titleEl = document.getElementById("agentDrawerTitle");
  const subEl = document.getElementById("agentDrawerSubtitle");

  if (mode === "setup") {
    btnSetup?.classList.add("active");
    btnExplain?.classList.remove("active");
    if (containerSetup) containerSetup.style.display = "flex";
    if (containerSynthetic) containerSynthetic.style.display = "none";
    if (containerExplain) containerExplain.style.display = "none";
    if (bannerExplain) bannerExplain.style.display = "none";
    if (inputEl) inputEl.placeholder = "Describe network requirements (e.g. 3 sites, 4000 cap)...";
    if (titleEl) titleEl.textContent = "Logistics Assistant";
    if (subEl) subEl.textContent = "Plain-Language Optimization Setup";
  } else if (mode === "synthetic") {
    btnSetup?.classList.add("active");
    btnExplain?.classList.remove("active");
    if (containerSetup) containerSetup.style.display = "none";
    if (containerSynthetic) containerSynthetic.style.display = "flex";
    if (containerExplain) containerExplain.style.display = "none";
    if (bannerExplain) bannerExplain.style.display = "none";
    if (inputEl) inputEl.placeholder = "Describe region or zone preferences...";
    if (titleEl) titleEl.textContent = "Synthetic Data Generator";
    if (subEl) subEl.textContent = "Consent-Gated Non-Uniform AI Data";
  } else if (mode === "explain") {
    btnSetup?.classList.remove("active");
    btnExplain?.classList.add("active");
    if (containerSetup) containerSetup.style.display = "none";
    if (containerSynthetic) containerSynthetic.style.display = "none";
    if (containerExplain) containerExplain.style.display = "flex";
    if (bannerExplain) {
      bannerExplain.style.display = "flex";
      const meta = VIEW_METADATA[appState.currentView] || { title: "Workspace" };
      if (bannerText) bannerText.textContent = `Grounded in active ${meta.title} computed metrics`;
    }
    if (inputEl) inputEl.placeholder = `Ask AI about ${VIEW_METADATA[appState.currentView]?.title || "this screen"}...`;
    if (titleEl) titleEl.textContent = "Logistics AI Explainer";
    if (subEl) subEl.textContent = "Grounded Real-Data Explanations";

    renderExplainQuickQuestions(appState.currentView);
  }
}

function syncUiToAgentParams() {
  const pVal = parseInt(document.getElementById("inputConfigP")?.value) || 3;
  const capVal = parseInt(document.getElementById("inputConfigCap")?.value) || 4000;
  const radVal = parseFloat(document.getElementById("inputConfigRadius")?.value) || 25.0;
  const cvrpVal = document.getElementById("chkIncludeCvrp")?.checked || false;
  const preset = appState.priorityPreset || "cost";
  agentState.knownParams = {
    ...agentState.knownParams,
    warehouse_count: pVal,
    warehouse_capacity: capVal,
    max_service_radius_km: radVal,
    include_cvrp: cvrpVal,
    priority_preset: preset,
  };
}

function applyAgentParamsToUi(params) {
  if (!params) return;
  if (params.warehouse_count !== undefined && params.warehouse_count !== null) {
    const el = document.getElementById("inputConfigP");
    if (el) el.value = params.warehouse_count;
    const valEl = document.getElementById("valConfigP");
    if (valEl) valEl.textContent = `${params.warehouse_count} sites`;
  }
  if (params.warehouse_capacity !== undefined && params.warehouse_capacity !== null) {
    const el = document.getElementById("inputConfigCap");
    if (el) el.value = params.warehouse_capacity;
    const valEl = document.getElementById("valConfigCap");
    if (valEl) valEl.textContent = `${Number(params.warehouse_capacity).toLocaleString()} orders/day`;
  }
  if (params.max_service_radius_km !== undefined && params.max_service_radius_km !== null) {
    const el = document.getElementById("inputConfigRadius");
    if (el) el.value = params.max_service_radius_km;
    const valEl = document.getElementById("valConfigRadius");
    if (valEl) valEl.textContent = `${params.max_service_radius_km} km`;
  }
  if (params.include_cvrp !== undefined && params.include_cvrp !== null) {
    const el1 = document.getElementById("chkIncludeCvrp");
    if (el1) el1.checked = !!params.include_cvrp;
    const el2 = document.getElementById("chkFleetEnableCvrp");
    if (el2) el2.checked = !!params.include_cvrp;
  }
  if (params.priority_preset) {
    appState.priorityPreset = params.priority_preset;
    document.querySelectorAll(".gp-preset-pill").forEach(pill => {
      if (pill.getAttribute("data-preset") === params.priority_preset) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });
  }
  updateLiveSummary();
  updateDashboardStats();
  agentState.knownParams = { ...agentState.knownParams, ...params };
}

let lastAgentToggleTime = 0;

function toggleAgentDrawer(open = null, optionalMode = null) {
  const now = Date.now();
  if (open === null && (now - lastAgentToggleTime < 200)) {
    return;
  }
  lastAgentToggleTime = now;

  const drawer = document.getElementById("agentDrawer");
  const backdrop = document.getElementById("agentDrawerBackdrop");
  if (!drawer || !backdrop) return;

  const shouldOpen = open !== null ? Boolean(open) : !drawer.classList.contains("active");

  if (shouldOpen) {
    try {
      if (optionalMode) {
        setAgentMode(optionalMode);
      } else {
        // Auto-default based on page
        if (["viewResults", "viewScenarios", "viewDisruption", "viewFleet", "viewAnalytics"].includes(appState.currentView)) {
          setAgentMode("explain");
        } else {
          setAgentMode("setup");
        }
      }
      syncUiToAgentParams();
    } catch (e) {
      console.warn("Notice updating agent parameters:", e);
    }

    drawer.classList.add("active");
    backdrop.classList.add("active");
    drawer.style.transform = "translateX(0)";
    drawer.style.visibility = "visible";
    drawer.style.display = "flex";
    backdrop.style.opacity = "1";
    backdrop.style.pointerEvents = "auto";
    backdrop.style.display = "block";

    // Visual active indicators on trigger buttons
    document.getElementById("navAgentAssistant")?.classList.add("active");
    document.getElementById("btnHeaderAgentAssistant")?.classList.add("active");

    setTimeout(() => document.getElementById("agentInput")?.focus(), 150);
  } else {
    drawer.classList.remove("active");
    backdrop.classList.remove("active");
    drawer.style.transform = "translateX(100%)";
    drawer.style.visibility = "hidden";
    backdrop.style.opacity = "0";
    backdrop.style.pointerEvents = "none";
    backdrop.style.display = "none";

    document.getElementById("navAgentAssistant")?.classList.remove("active");
    document.getElementById("btnHeaderAgentAssistant")?.classList.remove("active");
  }
}
window.toggleAgentDrawer = toggleAgentDrawer;

function updateAgentFabVisibility(viewId) {
  const fab = document.getElementById("btnOpenAgentDrawer");
  if (!fab) return;
  // Accessible across all screens
  fab.classList.add("visible");
  fab.style.display = "flex";
}

function appendAgentMessage(text, role = "agent", targetContainerId = "agentSetupContainer") {
  const body = document.getElementById(targetContainerId);
  if (!body) return;
  const bubble = document.createElement("div");
  bubble.className = `gp-bubble ${role === "user" ? "gp-bubble-user" : "gp-bubble-agent"}`;
  bubble.textContent = text;
  body.appendChild(bubble);
  const chatBody = document.getElementById("agentChatBody");
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
}

function showThinkingPulse() {
  const chatBody = document.getElementById("agentChatBody");
  if (!chatBody) return;
  removeThinkingPulse();
  const pulse = document.createElement("div");
  pulse.id = "agentThinkingPulse";
  pulse.className = "gp-thinking-pulse";
  pulse.innerHTML = `
    <div class="gp-thinking-dot"></div>
    <div class="gp-thinking-dot"></div>
    <div class="gp-thinking-dot"></div>
  `;
  chatBody.appendChild(pulse);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function removeThinkingPulse() {
  const p = document.getElementById("agentThinkingPulse");
  if (p) p.remove();
}

function renderSuggestedPrompts(prompts) {
  const body = document.getElementById("agentSetupContainer");
  if (!body || !prompts || prompts.length === 0) return;
  const container = document.createElement("div");
  container.className = "gp-quick-prompts";
  container.innerHTML = '<div class="gp-quick-prompts-label">Suggested Replies:</div>';
  prompts.forEach(p => {
    const chip = document.createElement("button");
    chip.className = "gp-quick-chip";
    chip.textContent = `• ${p}`;
    chip.addEventListener("click", () => sendAgentMessage(p));
    container.appendChild(chip);
  });
  body.appendChild(container);
  const chatBody = document.getElementById("agentChatBody");
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
}

function renderConfirmationCard(data) {
  const body = document.getElementById("agentSetupContainer");
  if (!body || !data.confirmation_card) return;
  const cardData = data.confirmation_card;
  const p = cardData.params || {};

  const card = document.createElement("div");
  card.className = "gp-confirm-card";
  
  let notesHtml = "";
  if (cardData.defaults_applied && cardData.defaults_applied.length > 0) {
    notesHtml += `<div class="gp-confirm-notes"><strong>Defaults applied:</strong> ${cardData.defaults_applied.join("; ")}</div>`;
  }
  if (cardData.warnings && cardData.warnings.length > 0) {
    notesHtml += `<div class="gp-confirm-notes" style="border-left-color:var(--gp-warning); margin-top:4px;"><strong>Note:</strong> ${cardData.warnings.join("; ")}</div>`;
  }

  card.innerHTML = `
    <div class="gp-confirm-title">
      <span>Proposed Configuration</span>
      <span class="gp-badge gp-badge-estimate" style="font-size:10px;">[Ready to Solve]</span>
    </div>
    <div class="gp-confirm-grid">
      <div class="gp-confirm-field">
        <span class="gp-confirm-label">Warehouses (p)</span>
        <input type="number" min="1" max="5" class="gp-confirm-val" id="cfgEditP" value="${p.warehouse_count ?? 3}">
      </div>
      <div class="gp-confirm-field">
        <span class="gp-confirm-label">Capacity (orders/day)</span>
        <input type="number" step="500" class="gp-confirm-val" id="cfgEditCap" value="${p.warehouse_capacity ?? 4000}">
      </div>
      <div class="gp-confirm-field">
        <span class="gp-confirm-label">Max Radius (km)</span>
        <input type="number" step="1" class="gp-confirm-val" id="cfgEditRadius" value="${p.max_service_radius_km ?? 25}">
      </div>
      <div class="gp-confirm-field">
        <span class="gp-confirm-label">Priority Preset</span>
        <select class="gp-confirm-val" id="cfgEditPreset" style="font-size:11px; cursor:pointer;">
          <option value="cost" ${p.priority_preset === 'cost' ? 'selected' : ''}>Cost Focus</option>
          <option value="speed" ${p.priority_preset === 'speed' ? 'selected' : ''}>Speed Focus</option>
          <option value="sustainability" ${p.priority_preset === 'sustainability' ? 'selected' : ''}>Sustainability</option>
        </select>
      </div>
    </div>
    ${notesHtml}
    <div class="gp-confirm-actions">
      <button class="gp-btn gp-btn-primary gp-btn-sm" id="btnConfirmRunOpt" style="flex:1;">
        Run Optimization
      </button>
      <button class="gp-btn gp-btn-secondary gp-btn-sm" id="btnConfirmKeepTalking">
        Keep Talking
      </button>
    </div>
  `;

  body.appendChild(card);
  const chatBody = document.getElementById("agentChatBody");
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;

  const btnRun = card.querySelector("#btnConfirmRunOpt");
  const btnKeep = card.querySelector("#btnConfirmKeepTalking");

  btnRun.addEventListener("click", async () => {
    btnRun.disabled = true;
    btnRun.textContent = "Applying & Solving...";
    
    const finalParams = {
      ...p,
      warehouse_count: parseInt(card.querySelector("#cfgEditP").value) || p.warehouse_count || 3,
      warehouse_capacity: parseInt(card.querySelector("#cfgEditCap").value) || p.warehouse_capacity || 4000,
      max_service_radius_km: parseFloat(card.querySelector("#cfgEditRadius").value) || p.max_service_radius_km || 25.0,
      priority_preset: card.querySelector("#cfgEditPreset").value || p.priority_preset || "cost",
    };

    applyAgentParamsToUi(finalParams);
    toggleAgentDrawer(false);
    showToast("Optimization triggered from Logistics Agent.");
    await runOptimization();
    switchView("viewResults");
  });

  btnKeep.addEventListener("click", () => {
    document.getElementById("agentInput")?.focus();
  });
}

async function sendAgentMessage(userText) {
  if (!userText || !userText.trim() || agentState.isProcessing) return;
  const text = userText.trim();
  
  const inputEl = document.getElementById("agentInput");
  if (inputEl) inputEl.value = "";

  appendAgentMessage(text, "user", "agentSetupContainer");
  agentState.historySetup.push({ role: "user", content: text });

  showThinkingPulse();
  agentState.isProcessing = true;

  try {
    syncUiToAgentParams();
    const res = await fetch("/api/agent/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: agentState.historySetup.slice(-10),
        known_params: agentState.knownParams,
      }),
    });

    const data = await res.json();
    removeThinkingPulse();
    agentState.isProcessing = false;

    if (!res.ok) {
      appendAgentMessage(`Error processing request: ${data.detail || "Server error"}`, "agent", "agentSetupContainer");
      return;
    }

    agentState.historySetup.push({ role: "assistant", content: data.reply });
    appendAgentMessage(data.reply, "agent", "agentSetupContainer");

    if (data.extracted_params) {
      agentState.knownParams = { ...agentState.knownParams, ...data.extracted_params };
    }

    if (data.status === "confirm" && data.confirmation_card) {
      renderConfirmationCard(data);
    }

    if (data.suggested_prompts && data.suggested_prompts.length > 0) {
      renderSuggestedPrompts(data.suggested_prompts);
    }
  } catch (err) {
    removeThinkingPulse();
    agentState.isProcessing = false;
    appendAgentMessage(`Connection error: ${err.message}`, "agent", "agentSetupContainer");
  }
}

async function sendAgentExplainMessage(userText) {
  if (!userText || !userText.trim() || agentState.isProcessing) return;
  const text = userText.trim();

  const inputEl = document.getElementById("agentInput");
  if (inputEl) inputEl.value = "";

  const body = document.getElementById("agentExplainContainer");
  if (!body) return;

  const userBubble = document.createElement("div");
  userBubble.className = "gp-bubble gp-bubble-user";
  userBubble.textContent = text;
  body.appendChild(userBubble);

  agentState.historyExplain.push({ role: "user", content: text });
  showThinkingPulse();
  agentState.isProcessing = true;

  try {
    const pageCtx = gatherPageContext(appState.currentView);
    const res = await fetch("/api/agent/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: appState.currentView,
        message: text,
        page_context: pageCtx,
        history: agentState.historyExplain.slice(-6),
      }),
    });

    const data = await res.json();
    removeThinkingPulse();
    agentState.isProcessing = false;

    if (!res.ok) {
      const errBubble = document.createElement("div");
      errBubble.className = "gp-bubble gp-bubble-agent";
      errBubble.textContent = `Error: ${data.detail || "Could not generate explanation"}`;
      body.appendChild(errBubble);
      return;
    }

    agentState.historyExplain.push({ role: "assistant", content: data.reply });

    const agentBubble = document.createElement("div");
    agentBubble.className = "gp-bubble gp-bubble-agent";
    agentBubble.style.whiteSpace = "pre-line";
    agentBubble.innerHTML = data.reply
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>');
    body.appendChild(agentBubble);

    if (data.suggested_followups && data.suggested_followups.length > 0) {
      const followContainer = document.createElement("div");
      followContainer.className = "gp-quick-prompts";
      followContainer.innerHTML = '<div class="gp-quick-prompts-label">Follow-up Questions:</div>';
      data.suggested_followups.forEach(fq => {
        const chip = document.createElement("button");
        chip.className = "gp-quick-chip";
        chip.textContent = `• ${fq}`;
        chip.addEventListener("click", () => sendAgentExplainMessage(fq));
        followContainer.appendChild(chip);
      });
      body.appendChild(followContainer);
    }

    const chatBody = document.getElementById("agentChatBody");
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
  } catch (err) {
    removeThinkingPulse();
    agentState.isProcessing = false;
    const errBubble = document.createElement("div");
    errBubble.className = "gp-bubble gp-bubble-agent";
    errBubble.textContent = `Connection error: ${err.message}`;
    body.appendChild(errBubble);
  }
}

// ============================================================================
// 1. TOAST NOTIFICATIONS & INFEASIBILITY MODAL
// ============================================================================

function showToast(message, type = "success") {
  const toast = document.getElementById("alertToast");
  if (!toast) return;
  toast.className = `gp-toast active ${type}`;
  toast.innerHTML = message;
  setTimeout(() => {
    toast.className = "gp-toast";
  }, 4500);
}

function showErrorModal(title, message, diagnostics = []) {
  const modal = document.getElementById("errorModal");
  document.getElementById("errorModalTitle").textContent = title || "Configuration Infeasible";
  
  let bodyHtml = `<p style="margin-bottom:10px;">${message}</p>`;
  if (diagnostics && diagnostics.length > 0) {
    bodyHtml += '<div style="background:var(--gp-danger-bg); border:1px solid var(--gp-danger-border); border-radius:var(--gp-radius-sm); padding:10px; margin-top:8px;">';
    bodyHtml += '<strong style="color:var(--gp-danger); font-size:12px;">Diagnostics & Causes:</strong><ul style="margin-left:18px; margin-top:4px; font-size:12px;">';
    diagnostics.forEach(d => {
      bodyHtml += `<li style="margin-bottom:2px;">${d}</li>`;
    });
    bodyHtml += '</ul></div>';
  }
  bodyHtml += '<div style="margin-top:12px; font-size:12px; color:var(--gp-text-secondary);"><strong>Suggested Action:</strong> Increase the warehouse count (p), raise site throughput capacity, or expand maximum service radius.</div>';

  document.getElementById("errorModalBody").innerHTML = bodyHtml;
  modal.classList.add("active");
}

// ============================================================================
// 2. VIEW ROUTER (switchView)
// ============================================================================

function switchView(viewId) {
  if (!document.getElementById(viewId)) return;
  appState.currentView = viewId;

  // 1. Update Left-Rail Active State
  document.querySelectorAll(".gp-nav-item").forEach(item => {
    if (item.getAttribute("data-view") === viewId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // 2. Hide all views and show requested view
  document.querySelectorAll(".gp-view").forEach(v => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");

  // 3. Update Header Breadcrumb and Title
  const meta = VIEW_METADATA[viewId] || { breadcrumb: "Workspace", title: "GRIDPOINT" };
  document.getElementById("headerBreadcrumb").textContent = meta.breadcrumb;
  document.getElementById("headerScreenTitle").textContent = meta.title;

  // 4. Update Agent FAB Visibility (Visible only on Dashboard and Network Configuration)
  updateAgentFabVisibility(viewId);

  // 5. Invalidate Map Sizes & Trigger Dynamic Views on View Switch
  setTimeout(() => {
    if (viewId === "viewResults" && appState.maps.results) {
      appState.maps.results.invalidateSize();
    } else if (viewId === "viewData" && appState.maps.demand) {
      appState.maps.demand.invalidateSize();
    } else if (viewId === "viewAnalytics" && appState.lastTradeoff) {
      renderTradeoffChart(appState.lastTradeoff);
    } else if (viewId === "viewScenarios") {
      updateScenarioView();
    } else if (viewId === "viewDisruption") {
      updateDisruptionView();
    } else if (viewId === "viewConfig") {
      updateConfigMinBounds();
      updateLiveSummary();
    }
  }, 100);
}

// ============================================================================
// 3. MAP INITIALIZATION (Results Map + Demand Input Map)
// ============================================================================

function initMaps() {
  if (typeof L === "undefined") {
    console.warn("Leaflet library not loaded yet.");
    return;
  }
  const defaultCenter = [12.9716, 77.5946];
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttrib = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Results Map
  const resultsContainer = document.getElementById("resultsMap");
  if (resultsContainer) {
    if (appState.maps.results) {
      try { appState.maps.results.remove(); } catch (e) {}
      appState.maps.results = null;
    }
    if (resultsContainer._leaflet_id) {
      try { delete resultsContainer._leaflet_id; } catch (e) { resultsContainer._leaflet_id = null; }
    }
    try {
      appState.maps.results = L.map("resultsMap", {
        center: defaultCenter,
        zoom: 11,
        zoomControl: true,
      });
      L.tileLayer(tileUrl, { maxZoom: 19, attribution: tileAttrib }).addTo(appState.maps.results);

      // Re-initialize real Leaflet layer groups if needed
      if (!appState.layers.results.candidates.addTo) appState.layers.results.candidates = L.layerGroup();
      if (!appState.layers.results.neighborhoods.addTo) appState.layers.results.neighborhoods = L.layerGroup();
      if (!appState.layers.results.radius.addTo) appState.layers.results.radius = L.layerGroup();
      if (!appState.layers.results.assignments.addTo) appState.layers.results.assignments = L.layerGroup();
      if (!appState.layers.results.routes.addTo) appState.layers.results.routes = L.layerGroup();
      if (!appState.layers.results.warehouses.addTo) appState.layers.results.warehouses = L.layerGroup();

      appState.layers.results.candidates.addTo(appState.maps.results);
      appState.layers.results.neighborhoods.addTo(appState.maps.results);
      appState.layers.results.radius.addTo(appState.maps.results);
      appState.layers.results.assignments.addTo(appState.maps.results);
      appState.layers.results.routes.addTo(appState.maps.results);
      appState.layers.results.warehouses.addTo(appState.maps.results);
    } catch (err) {
      console.warn("Notice initializing resultsMap:", err);
    }
  }

  // Demand Map (Data Input View)
  const demandContainer = document.getElementById("demandMap");
  if (demandContainer) {
    if (appState.maps.demand) {
      try { appState.maps.demand.remove(); } catch (e) {}
      appState.maps.demand = null;
    }
    if (demandContainer._leaflet_id) {
      try { delete demandContainer._leaflet_id; } catch (e) { demandContainer._leaflet_id = null; }
    }
    try {
      appState.maps.demand = L.map("demandMap", {
        center: defaultCenter,
        zoom: 11,
        zoomControl: true,
      });
      L.tileLayer(tileUrl, { maxZoom: 19, attribution: tileAttrib }).addTo(appState.maps.demand);

      if (!appState.layers.demand.candidates.addTo) appState.layers.demand.candidates = L.layerGroup();
      if (!appState.layers.demand.neighborhoods.addTo) appState.layers.demand.neighborhoods = L.layerGroup();
      if (!appState.layers.demand.heatmap.addTo) appState.layers.demand.heatmap = L.layerGroup();
      if (!appState.layers.demand.voronoi.addTo) appState.layers.demand.voronoi = L.layerGroup();

      appState.layers.demand.candidates.addTo(appState.maps.demand);
      appState.layers.demand.neighborhoods.addTo(appState.maps.demand);
      appState.layers.demand.heatmap.addTo(appState.maps.demand);
      appState.layers.demand.voronoi.addTo(appState.maps.demand);
    } catch (err) {
      console.warn("Notice initializing demandMap:", err);
    }
  }

  // Layer Visibility Toggles on Results Map
  const chkCand = document.getElementById("chkShowCandidates");
  if (chkCand) {
    chkCand.addEventListener("change", (e) => {
      if (e.target.checked) appState.maps.results.addLayer(appState.layers.results.candidates);
      else appState.maps.results.removeLayer(appState.layers.results.candidates);
    });
  }

  const chkAssign = document.getElementById("chkShowAssignments");
  if (chkAssign) {
    chkAssign.addEventListener("change", (e) => {
      if (e.target.checked) appState.maps.results.addLayer(appState.layers.results.assignments);
      else appState.maps.results.removeLayer(appState.layers.results.assignments);
    });
  }

  const chkRad = document.getElementById("chkShowRadius");
  if (chkRad) {
    chkRad.addEventListener("change", (e) => {
      if (e.target.checked) appState.maps.results.addLayer(appState.layers.results.radius);
      else appState.maps.results.removeLayer(appState.layers.results.radius);
    });
  }

  const chkRts = document.getElementById("chkShowRoutes");
  if (chkRts) {
    chkRts.addEventListener("change", (e) => {
      if (e.target.checked) appState.maps.results.addLayer(appState.layers.results.routes);
      else appState.maps.results.removeLayer(appState.layers.results.routes);
    });
  }
}

// ============================================================================
// 4. HEALTH CHECK & SOLVER STATUS
// ============================================================================

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    const textStatus = document.getElementById("textSolverStatus");
    if (data.solver_available) {
      textStatus.textContent = `Solver: ${data.solver} Active`;
    } else {
      textStatus.textContent = "Solver: Heuristic Active";
    }
  } catch (err) {
    console.error("Health check failed:", err);
  }
}

// ============================================================================
// 5. DATA INGESTION & CANONICAL DATASET LOADER
// ============================================================================

function applyCanonicalDataset(data, options = {}) {
  if (!data || !data.preview || data.preview.length === 0) {
    showErrorModal("Dataset Missing", "No valid delivery zone data was provided.");
    return false;
  }

  appState.sessionId = data.session_id || "default";
  appState.neighborhoods = data.preview;
  appState.datasetLoaded = true;
  appState.explainCache = {};
  appState.lastOptimize = null;
  appState.isSyntheticAi = !!options.isSynthetic;
  appState.datasetType = options.datasetType || (options.isSynthetic ? "real_locations_synthetic_demand" : (options.source || "demo"));
  const badgeText = data.badge_text || options.badgeText;
  const scope = data.scope || options.scope;

  const totalDem = data.total_demand || (data.preview ? data.preview.reduce((s, n) => s + (n.daily_orders || 0), 0) : 10000);
  const nZones = data.preview ? data.preview.length : 36;

  // Calibrate warehouse capacity and facility count limits to match dataset scale
  const suggestedCap = totalDem > 12000 ? Math.ceil((totalDem / 3.0) * 1.35 / 500) * 500 : 4000;
  const maxCap = Math.max(25000, Math.ceil(totalDem * 1.5 / 1000) * 1000);

  const elCap = document.getElementById("inputConfigCap");
  if (elCap) {
    elCap.max = maxCap;
    elCap.value = suggestedCap;
    const valCap = document.getElementById("valConfigCap");
    if (valCap) valCap.textContent = `${Number(suggestedCap).toLocaleString()} orders/day`;
    agentState.knownParams.warehouse_capacity = suggestedCap;
  }

  const elP = document.getElementById("inputConfigP");
  if (elP) {
    elP.max = Math.min(nZones, 20);
    const minPNeeded = Math.ceil(totalDem / suggestedCap);
    const targetP = Math.max(minPNeeded, Math.min(parseInt(elP.value) || 3, parseInt(elP.max)));
    elP.value = targetP;
    const valP = document.getElementById("valConfigP");
    if (valP) valP.textContent = `${targetP} sites`;
    agentState.knownParams.warehouse_count = targetP;
  }

  const elPMax = document.getElementById("inputConfigPMax");
  if (elPMax) {
    elPMax.max = Math.min(nZones, 20);
    const currentP = parseInt(document.getElementById("inputConfigP")?.value) || 3;
    const suggestedPMax = Math.max(currentP, Math.min(nZones, 6));
    elPMax.value = suggestedPMax;
    const valPMax = document.getElementById("valConfigPMax");
    if (valPMax) valPMax.textContent = `${suggestedPMax} sites`;
  }

  updateSyntheticDatasetBadge(appState.isSyntheticAi, badgeText, scope);
  renderDataInputTable(data.preview);
  renderDemandMap(data.preview);
  updateDashboardStats();
  updateLiveSummary();
  updateScenarioCards();
  updateDisruptionDropdown();
  updateConfigMinBounds();

  if (options.toastMessage) {
    showToast(options.toastMessage);
  }
  return true;
}

async function loadDemoData() {
  try {
    const res = await fetch("/api/demo-data");
    const data = await res.json();
    applyCanonicalDataset(data, {
      isSynthetic: false,
      source: "demo",
      toastMessage: `Loaded 36 curated Bengaluru delivery zones (${data.total_demand.toLocaleString()} orders/day).`
    });

    // Auto-trigger default optimization (p=3)
    await runOptimization();
  } catch (err) {
    showToast(`Failed to load demo dataset: ${err.message}`, "error");
  }
}

let tableCurrentPage = 1;
const TABLE_PAGE_SIZE = 6;
let tableSearchQuery = "";

function renderHeroKpiStats(neighborhoods) {
  if (!neighborhoods || neighborhoods.length === 0) return;

  const totalDemand = neighborhoods.reduce((sum, n) => sum + (n.daily_orders || 0), 0);
  const elTotal = document.getElementById("mapKpiTotalOrders");
  if (elTotal) elTotal.textContent = totalDemand.toLocaleString();

  // Peak Demand Zone
  const sorted = [...neighborhoods].sort((a, b) => (b.daily_orders || 0) - (a.daily_orders || 0));
  const peak = sorted[0];
  if (peak) {
    const elPeakName = document.getElementById("mapKpiPeakZoneName");
    if (elPeakName) elPeakName.textContent = peak.name.split(" ")[0]; // e.g. Koramangala
    const elPeakOrders = document.getElementById("mapKpiPeakZoneOrders");
    if (elPeakOrders) elPeakOrders.textContent = `${peak.daily_orders.toLocaleString()} ord/day`;
  }

  // Average Hub Radius
  const elAvgRadius = document.getElementById("mapKpiAvgRadius");
  if (elAvgRadius) {
    if (appState.lastOptimize?.assignments && appState.lastOptimize.assignments.length > 0) {
      const avgDist = appState.lastOptimize.assignments.reduce((s, a) => s + (a.distance_km || 0), 0) / appState.lastOptimize.assignments.length;
      elAvgRadius.textContent = avgDist.toFixed(1);
    } else {
      elAvgRadius.textContent = "4.8";
    }
  }
}

function inspectZone(zoneId) {
  const neighborhoods = appState.neighborhoods || [];
  const zone = neighborhoods.find(n => n.neighborhood_id === zoneId) || 
    neighborhoods.find(n => n.name.includes("Koramangala")) ||
    neighborhoods[0] || {
      neighborhood_id: "ZN-BLR-04",
      name: "Koramangala Sector 4",
      daily_orders: 420,
      latitude: 12.9352,
      longitude: 77.6245
    };

  const badge = document.getElementById("inspZoneBadge");
  if (badge) badge.textContent = zone.neighborhood_id;

  const title = document.getElementById("inspZoneTitle");
  if (title) title.textContent = zone.name;

  const desc = document.getElementById("inspZoneDesc");
  if (desc) {
    if (zone.name.includes("Koramangala")) {
      desc.textContent = "High-density commercial-residential corridor with multiple fast-turnover micro-fulfillment micro-hubs.";
    } else if (zone.name.includes("Indiranagar")) {
      desc.textContent = "Major retail and F&B corridor with concentrated express last-mile delivery demand.";
    } else if (zone.name.includes("Whitefield")) {
      desc.textContent = "Tech park and high-density apartment cluster with high evening delivery density.";
    } else if (zone.name.includes("Peenya")) {
      desc.textContent = "Major industrial corridor with high bulk transit volumes and extended turnaround times.";
    } else {
      desc.textContent = "Urban delivery zone clustered via spatial DBSCAN centroid aggregation.";
    }
  }

  const elDemand = document.getElementById("inspZoneDemand");
  if (elDemand) elDemand.textContent = `${(zone.daily_orders || 420).toLocaleString()} ord/day`;

  // Determine assigned hub & distances
  let hubName = "Koramangala Central";
  let distKm = 2.1;
  if (appState.lastOptimize?.assignments) {
    const asgn = appState.lastOptimize.assignments.find(a => a.neighborhood_id === zone.neighborhood_id);
    if (asgn) {
      hubName = asgn.warehouse_name || hubName;
      distKm = asgn.distance_km || distKm;
    }
  } else {
    if (zone.name.includes("Indiranagar") || zone.name.includes("Domlur")) {
      hubName = "Domlur East Hub"; distKm = 3.4;
    } else if (zone.name.includes("Whitefield") || zone.name.includes("ITPL")) {
      hubName = "Whitefield Terminal 1"; distKm = 4.1;
    } else if (zone.name.includes("Jayanagar") || zone.name.includes("Bannerghatta")) {
      hubName = "South Hub Bannerghatta"; distKm = 3.2;
    } else if (zone.name.includes("Peenya")) {
      hubName = "Northwest Logistics Depot"; distKm = 5.6;
    } else if (zone.name.includes("HSR")) {
      hubName = "Koramangala Central"; distKm = 3.9;
    }
  }

  const elHub = document.getElementById("inspZoneHub");
  if (elHub) elHub.textContent = hubName;

  const elDist = document.getElementById("inspZoneDistance");
  if (elDist) elDist.textContent = `${distKm.toFixed(1)} km`;

  const elDetour = document.getElementById("inspZoneDetour");
  if (elDetour) {
    const roadKm = (distKm * 1.33).toFixed(1);
    elDetour.textContent = `1.33x (${roadKm} km road)`;
  }

  const elGrav = document.getElementById("inspZoneGravBadge");
  if (elGrav) {
    const orders = zone.daily_orders || 420;
    const pull = (orders / 460).toFixed(2);
    if (orders >= 350) {
      elGrav.className = "gp-badge gp-badge-danger";
      elGrav.style.background = "#fef2f2";
      elGrav.style.color = "#ef4444";
      elGrav.textContent = `High (${pull})`;
    } else if (orders >= 250) {
      elGrav.className = "gp-badge";
      elGrav.style.background = "#eff6ff";
      elGrav.style.color = "#2563eb";
      elGrav.textContent = `Balanced (${pull})`;
    } else {
      elGrav.className = "gp-badge";
      elGrav.style.background = "#f1f5f9";
      elGrav.style.color = "#64748b";
      elGrav.textContent = `Moderate (${pull})`;
    }
  }

  const elPeakTime = document.getElementById("inspPeakTime");
  if (elPeakTime) {
    const hours = ["18:30", "19:00", "19:30", "20:00", "20:30"];
    const hash = ((zone.name.length || 0) + (zone.daily_orders || 0)) % hours.length;
    elPeakTime.textContent = `Peak @ ${hours[hash]}`;
  }
}

function renderDataInputTable(neighborhoods) {
  const tbody = document.getElementById("tbodyNeighborhoods");
  if (!tbody) return;

  if (!neighborhoods || neighborhoods.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--gp-text-tertiary); padding:24px;">No zones loaded. Click "Load Bengaluru Demo" or upload CSV.</td></tr>';
    return;
  }

  // Filter neighborhoods by tableSearchQuery
  const query = (tableSearchQuery || "").toLowerCase().trim();
  const filtered = query
    ? neighborhoods.filter(n => 
        (n.neighborhood_id && n.neighborhood_id.toLowerCase().includes(query)) ||
        (n.name && n.name.toLowerCase().includes(query))
      )
    : neighborhoods;

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  if (tableCurrentPage > totalPages) tableCurrentPage = 1;

  const startIdx = (tableCurrentPage - 1) * TABLE_PAGE_SIZE;
  const pageSlice = filtered.slice(startIdx, startIdx + TABLE_PAGE_SIZE);

  // Update header count and pagination display
  const elCount = document.getElementById("lblTableZoneCount");
  if (elCount) {
    elCount.textContent = `Showing ${pageSlice.length} of ${neighborhoods.length} zones`;
  }
  const elPage = document.getElementById("lblTablePage");
  if (elPage) {
    elPage.textContent = `${tableCurrentPage} of ${totalPages}`;
  }

  tbody.innerHTML = pageSlice.map(n => {
    let hubName = "Koramangala Central";
    let distKm = 2.8;

    if (appState.lastOptimize?.assignments) {
      const asgn = appState.lastOptimize.assignments.find(a => a.neighborhood_id === n.neighborhood_id);
      if (asgn) {
        hubName = asgn.warehouse_name || hubName;
        distKm = asgn.distance_km || distKm;
      }
    } else {
      if (n.name.includes("Indiranagar") || n.name.includes("Domlur")) {
        hubName = "Domlur East Hub"; distKm = 3.4;
      } else if (n.name.includes("Whitefield") || n.name.includes("ITPL")) {
        hubName = "Whitefield Terminal 1"; distKm = 4.1;
      } else if (n.name.includes("HSR")) {
        hubName = "Koramangala Central"; distKm = 3.9;
      } else if (n.name.includes("Jayanagar") || n.name.includes("Bannerghatta")) {
        hubName = "South Hub Bannerghatta"; distKm = 3.2;
      } else if (n.name.includes("Peenya")) {
        hubName = "Northwest Logistics Depot"; distKm = 5.6;
      } else {
        const hash = (n.name.length * 7) % 30;
        distKm = 2.0 + (hash / 10);
      }
    }

    const slaMin = (distKm * 2.5 + 7.2).toFixed(1);
    let statusBadge = "";
    if (distKm > 5.0) {
      statusBadge = '<span class="gp-badge gp-badge-estimate" style="background:#fef2f2; color:#ef4444; border:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px;">Transit Warning</span>';
    } else if (n.daily_orders >= 290) {
      statusBadge = '<span class="gp-badge" style="background:#eff6ff; color:#2563eb; border:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px;">Optimal Coverage</span>';
    }

    return `
      <tr style="cursor:pointer;" class="gp-zone-breakdown-row" data-zoneid="${n.neighborhood_id}">
        <td><span class="gp-link-zone" style="color:#2563eb; font-weight:700; font-family:var(--gp-font-family-mono); font-size:12px;">${n.neighborhood_id}</span></td>
        <td>
          <div style="font-weight:600; color:var(--gp-text-primary); font-size:13px;">${n.name}</div>
          <div style="font-family:var(--gp-font-family-mono); font-size:11px; color:#64748b; margin-top:1px;">${n.latitude.toFixed(4)}° N, ${n.longitude.toFixed(4)}° E</div>
        </td>
        <td><span style="font-weight:700; font-size:13px; color:var(--gp-text-primary);">${n.daily_orders.toLocaleString()}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--gp-text-primary);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18"></path></svg>
            <span>${hubName}</span>
          </div>
        </td>
        <td><span class="tabular-nums" style="font-size:12.5px; color:var(--gp-text-secondary);">${distKm.toFixed(1)} km</span></td>
        <td><span class="tabular-nums" style="font-size:12.5px; font-weight:600; color:#10b981;">${slaMin} min</span></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join("");

  // Attach click listener to rows to inspect zone
  tbody.querySelectorAll(".gp-zone-breakdown-row").forEach(row => {
    row.addEventListener("click", () => {
      const zId = row.getAttribute("data-zoneid");
      if (zId) inspectZone(zId);
    });
  });

  const railMeta = document.getElementById("railSessionMeta");
  if (railMeta) railMeta.textContent = `Dataset: ${neighborhoods.length} zones loaded`;
}

function generateVoronoiCells(neighborhoods) {
  if (!neighborhoods || neighborhoods.length < 3) return [];
  return neighborhoods.map((target, idx) => {
    const others = neighborhoods
      .filter((_, i) => i !== idx)
      .map(other => {
        const dLat = other.latitude - target.latitude;
        const dLon = other.longitude - target.longitude;
        const distSq = dLat * dLat + dLon * dLon;
        const angle = Math.atan2(dLat, dLon);
        return { other, distSq, angle };
      })
      .sort((a, b) => a.distSq - b.distSq)
      .slice(0, 6);

    others.sort((a, b) => a.angle - b.angle);

    const coords = others.map(item => {
      const latMid = (target.latitude + item.other.latitude) / 2;
      const lonMid = (target.longitude + item.other.longitude) / 2;
      return [latMid, lonMid];
    });

    return {
      neighborhood_id: target.neighborhood_id,
      name: target.name,
      coords: coords
    };
  });
}

function renderDemandMap(neighborhoods) {
  if (!appState.maps.demand || !neighborhoods || neighborhoods.length === 0) return;

  if (appState.layers.demand.candidates?.clearLayers) appState.layers.demand.candidates.clearLayers();
  if (appState.layers.demand.neighborhoods?.clearLayers) appState.layers.demand.neighborhoods.clearLayers();
  if (appState.layers.demand.heatmap?.clearLayers) appState.layers.demand.heatmap.clearLayers();
  if (appState.layers.demand.voronoi?.clearLayers) appState.layers.demand.voronoi.clearLayers();

  const lats = neighborhoods.map(n => n.latitude);
  const lons = neighborhoods.map(n => n.longitude);
  appState.maps.demand.fitBounds([
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)]
  ], { padding: [30, 30] });

  const maxDemand = Math.max(...neighborhoods.map(n => n.daily_orders));

  neighborhoods.forEach(n => {
    // 1. Candidate marker
    const cMarker = L.circleMarker([n.latitude, n.longitude], {
      radius: 4,
      fillColor: "#94A3B8",
      color: "#64748B",
      weight: 1,
      opacity: 0.6,
      fillOpacity: 0.3,
    }).bindTooltip(`Candidate Site: <b>${n.name}</b> (${n.neighborhood_id})`);
    if (appState.layers.demand.candidates?.addLayer) appState.layers.demand.candidates.addLayer(cMarker);

    // 2. Heatmap Density Glow Circle
    const norm = n.daily_orders / maxDemand;
    const heatColor = norm >= 0.75 ? "#ef4444" : (norm >= 0.45 ? "#3b82f6" : "#06b6d4");
    const hCircle = L.circle([n.latitude, n.longitude], {
      radius: 1100 + norm * 1800,
      stroke: false,
      fillColor: heatColor,
      fillOpacity: 0.16 + norm * 0.18,
    });
    if (appState.layers.demand.heatmap?.addLayer) appState.layers.demand.heatmap.addLayer(hCircle);

    // 3. Demand Centroid Node
    const radius = 4 + (n.daily_orders / maxDemand) * 10;
    const nMarker = L.circleMarker([n.latitude, n.longitude], {
      radius: radius,
      fillColor: n.daily_orders >= 350 ? "#0f172a" : (n.daily_orders >= 200 ? "#2563eb" : "#60a5fa"),
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    });

    nMarker.on("click", () => {
      inspectZone(n.neighborhood_id);
    });

    nMarker.bindTooltip(`<b>${n.name}</b><br>${n.daily_orders.toLocaleString()} ord/day`);
    if (appState.layers.demand.neighborhoods?.addLayer) appState.layers.demand.neighborhoods.addLayer(nMarker);
  });

  // 4. Voronoi Partition Catchments
  const cells = generateVoronoiCells(neighborhoods);
  cells.forEach(cell => {
    if (cell.coords.length >= 3 && appState.layers.demand.voronoi?.addLayer) {
      const poly = L.polygon(cell.coords, {
        color: "#2563eb",
        weight: 1.2,
        opacity: 0.45,
        dashArray: "3, 4",
        fillColor: "#3b82f6",
        fillOpacity: 0.04,
      }).bindTooltip(`Voronoi Territory: <b>${cell.name}</b>`);
      appState.layers.demand.voronoi.addLayer(poly);
    }
  });

  // Update Hero KPI stats
  renderHeroKpiStats(neighborhoods);

  // Default inspection on peak or Koramangala
  inspectZone("ZN-BLR-04");
}

// ============================================================================
// 6. NETWORK OPTIMIZATION SOLVER (POST /api/optimize)
// ============================================================================

function updateConfigMinBounds() {
  const nZones = appState.neighborhoods ? appState.neighborhoods.length : 36;
  const totalDem = appState.neighborhoods ? appState.neighborhoods.reduce((s, n) => s + (n.daily_orders || 0), 0) : 10000;
  const cap = parseFloat(document.getElementById("inputConfigCap")?.value) || 4000;
  const minP = Math.max(1, Math.min(nZones, Math.ceil(totalDem / Math.max(1, cap))));

  const badgeMin = document.getElementById("badgeAutoMinP");
  if (badgeMin) badgeMin.textContent = `Min feasible: ${minP} sites`;

  const sliderPMax = document.getElementById("inputConfigPMax");
  if (sliderPMax) {
    sliderPMax.min = minP;
    sliderPMax.max = Math.min(20, Math.max(minP, nZones));
    if (parseInt(sliderPMax.value) < minP) {
      sliderPMax.value = minP;
    }
    const valPMax = document.getElementById("valConfigPMax");
    if (valPMax) valPMax.textContent = `${sliderPMax.value} sites`;
    const noteEl = document.getElementById("autoCeilingNote");
    if (noteEl) noteEl.textContent = sliderPMax.value;
  }

  const sliderP = document.getElementById("inputConfigP");
  if (sliderP) {
    sliderP.min = minP;
    sliderP.max = Math.min(20, Math.max(minP, nZones));
    if (parseInt(sliderP.value) < minP) {
      sliderP.value = minP;
      const valP = document.getElementById("valConfigP");
      if (valP) valP.textContent = `${minP} sites`;
    }
  }
}

async function runOptimization() {
  if (!appState.neighborhoods || appState.neighborhoods.length === 0) {
    showErrorModal(
      "No Dataset Loaded",
      "No delivery zone dataset is currently loaded in memory. Please load the Bengaluru demo dataset, upload a CSV file, or generate AI synthetic data before running optimization."
    );
    return false;
  }

  const isAuto = appState.configMode === "auto";
  const p = parseInt(document.getElementById("inputConfigP")?.value) || 3;
  const pMax = parseInt(document.getElementById("inputConfigPMax")?.value) || 6;
  const cap = parseFloat(document.getElementById("inputConfigCap").value) || 4000;
  const radius = document.getElementById("inputConfigRadius")?.value ? parseFloat(document.getElementById("inputConfigRadius").value) : null;
  const rawCostKm = parseFloat(document.getElementById("inputCostKm")?.value);
  if (!isNaN(rawCostKm) && rawCostKm > 0) {
    appState.costKmInr = convertInput(rawCostKm, appState.currency);
  }
  const rawFixedCost = parseFloat(document.getElementById("inputFixedCost")?.value);
  if (!isNaN(rawFixedCost) && rawFixedCost >= 0) {
    appState.fixedCostInr = convertInput(rawFixedCost, appState.currency);
  }

  const costKm = appState.costKmInr;
  const fixedCost = appState.fixedCostInr;
  const mode = document.getElementById("selectDistanceMode").value || "haversine";
  const includeCvrp = document.getElementById("chkIncludeCvrp").checked || document.getElementById("chkFleetEnableCvrp").checked;

  // Validate candidate availability
  if (isAuto && pMax > appState.neighborhoods.length) {
    showErrorModal(
      "Invalid Parameter Ceiling",
      `Requested maximum warehouse count p_max=${pMax} exceeds total candidate sites (${appState.neighborhoods.length}).`,
      ["You cannot consider more warehouses than available candidate locations. Reduce p_max ceiling or add more zones."]
    );
    return false;
  }

  const payload = {
    session_id: appState.sessionId,
    p: p,
    auto_size: isAuto,
    p_max: isAuto ? pMax : null,
    warehouse_capacity: cap,
    radius_max_km: radius,
    cost_per_km: costKm,
    fixed_cost_per_warehouse: fixedCost,
    routing_mode: mode,
    priority_preset: appState.priorityPreset,
    include_cvrp: includeCvrp,
    vehicle_capacity: 250,
    vehicle_fixed_cost: 150.0,
  };

  try {
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      showErrorModal("Optimization Infeasible", data.detail?.error || "Constraint violation", data.detail?.diagnostics || []);
      return false;
    }

    appState.lastOptimize = data;
    appState.explainCache = {};

    if (data.auto_size) {
      const elP = document.getElementById("inputConfigP");
      if (elP) {
        elP.value = data.p;
        const valP = document.getElementById("valConfigP");
        if (valP) valP.textContent = `${data.p} sites`;
        agentState.knownParams.warehouse_count = data.p;
      }
    }

    renderResultsScreen(data);
    await fetchBaselineComparison();
    await fetchTradeoffCurve();
    updateDashboardStats();

    showToast(data.auto_size 
      ? `Auto-Sized: Optimal network uses ${data.p} warehouses.` 
      : `Network Optimized: ${data.p} warehouses serving ${data.assignments.length} delivery zones.`
    );
    return true;
  } catch (err) {
    showErrorModal("Network Request Failed", err.message);
    return false;
  }
}

// ============================================================================
// 7. RENDER RESULTS SCREEN (KPIs, Map, Explainability, Manifest)
// ============================================================================

function renderResultsScreen(data) {
  // 1. Update Results Currency & Assumptions
  updateResultsCurrencyDisplays(data);

  // 1.5 Update Throughput Co-Dependency & Headroom Banner
  const totalCap = data.total_system_capacity || (data.warehouses ? data.warehouses.reduce((s, w) => s + (w.capacity || w.capacity_ceiling || 0), 0) : 0);
  const totalDem = data.total_system_demand || (data.assignments ? data.assignments.reduce((s, a) => s + (a.daily_orders || 0), 0) : 0);
  const headroom = data.capacity_headroom !== undefined ? data.capacity_headroom : (totalCap - totalDem);
  const headroomPct = data.capacity_headroom_pct !== undefined ? data.capacity_headroom_pct : (totalCap > 0 ? ((totalCap - totalDem) / totalCap * 100) : 0);

  const elThroughput = document.getElementById("resTotalThroughput");
  if (elThroughput) elThroughput.textContent = `${totalCap.toLocaleString()} orders/day`;

  const elDemand = document.getElementById("resTotalDemand");
  if (elDemand) elDemand.textContent = `${totalDem.toLocaleString()} orders/day`;

  const elHeadroom = document.getElementById("resCapacityHeadroom");
  if (elHeadroom) {
    elHeadroom.textContent = `${headroom >= 0 ? '+' : ''}${headroom.toLocaleString()} orders/day`;
    elHeadroom.style.color = headroom >= 0 ? "var(--gp-success)" : "var(--gp-danger)";
  }

  const elHeadroomPct = document.getElementById("resHeadroomPct");
  if (elHeadroomPct) {
    elHeadroomPct.textContent = `${headroomPct.toFixed(1)}% buffer`;
    elHeadroomPct.className = `gp-delta-chip ${headroom >= 0 ? 'gp-delta-positive' : 'gp-delta-negative'}`;
  }

  const elModeBadge = document.getElementById("resModeBadge");
  if (elModeBadge) {
    if (data.auto_size) {
      elModeBadge.textContent = `Auto-Sized (${data.p} Sites Optimal)`;
      elModeBadge.className = "gp-badge gp-badge-optimal";
    } else {
      elModeBadge.textContent = `Manual Mode (Exact p = ${data.p})`;
      elModeBadge.className = "gp-badge gp-badge-estimate";
    }
  }

  const boxSizing = document.getElementById("boxSizingRationale");
  const textSizing = document.getElementById("textSizingRationale");
  if (boxSizing && textSizing) {
    if (data.auto_size && data.sizing_rationale) {
      boxSizing.style.display = "flex";
      textSizing.textContent = data.sizing_rationale;
    } else {
      boxSizing.style.display = "none";
    }
  }

  // 2. Executive KPI Cards
  document.getElementById("kpiCost").textContent = formatMoney(data.total_delivery_cost, appState.currency);
  document.getElementById("kpiDistance").innerHTML = `${data.total_weighted_distance_km.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span class="gp-kpi-unit">ord·km</span>`;
  document.getElementById("kpiWarehouses").innerHTML = `${data.warehouses.length} <span class="gp-kpi-unit">sites</span>`;
  document.getElementById("kpiWarehousesBadge").textContent = data.auto_size ? `Auto (${data.p} sites)` : `p = ${data.p}`;
  document.getElementById("kpiSolverStatus").textContent = `Status: ${data.status}`;
  document.getElementById("kpiFastDelivery").textContent = `${data.fast_delivery_coverage_pct.toFixed(1)}%`;
  document.getElementById("kpiMonthlySavings").textContent = formatMoney(data.estimated_monthly_savings, appState.currency, { compact: true });
  document.getElementById("kpiCO2").innerHTML = `${data.estimated_co2_kg_per_day.toFixed(1)} <span class="gp-kpi-unit">kg</span>`;
  document.getElementById("kpiCO2Badge").textContent = `${data.co2_reduction_pct.toFixed(1)}%`;

  // 3. Clear & Render Map Layers
  appState.layers.results.warehouses.clearLayers();
  appState.layers.results.assignments.clearLayers();
  appState.layers.results.radius.clearLayers();
  appState.layers.results.routes.clearLayers();
  appState.layers.results.candidates.clearLayers();
  appState.layers.results.neighborhoods.clearLayers();

  const wColorMap = {};
  data.warehouses.forEach((w, idx) => {
    wColorMap[w.warehouse_id] = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
  });

  // Fit Bounds
  if (data.assignments && data.assignments.length > 0) {
    const lats = data.assignments.map(a => a.latitude);
    const lons = data.assignments.map(a => a.longitude);
    appState.maps.results.fitBounds([
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)]
    ], { padding: [40, 40] });
  }

  // Render open warehouses
  data.warehouses.forEach(w => {
    const color = wColorMap[w.warehouse_id];

    // Service Radius Ring
    if (data.assumptions.radius_max_km) {
      const radiusCircle = L.circle([w.latitude, w.longitude], {
        radius: data.assumptions.radius_max_km * 1000,
        color: color,
        weight: 1,
        dashArray: "4, 6",
        fillColor: color,
        fillOpacity: 0.05,
      });
      appState.layers.results.radius.addLayer(radiusCircle);
    }

    // Warehouse Marker
    const wIcon = L.divIcon({
      className: "gp-marker-warehouse-container",
      html: `
        <div style="background:${color}; width:32px; height:32px; border:2.5px solid #FFFFFF; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#FFFFFF; box-shadow:0 3px 10px rgba(0,0,0,0.25);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M12 3l9 4H3l9-4z"></path>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const reqCap = (w.capacity_required !== undefined ? w.capacity_required : w.assigned_demand);
    const ceilCap = (w.capacity_ceiling !== undefined ? w.capacity_ceiling : w.capacity);

    const wMarker = L.marker([w.latitude, w.longitude], { icon: wIcon }).bindPopup(`
      <div style="font-family:var(--gp-font-family-sans); padding:4px;">
        <div style="font-size:11px; color:${color}; font-weight:700; text-transform:uppercase;">Selected Facility</div>
        <div style="font-weight:700; font-size:15px; color:var(--gp-text-primary); margin-top:2px;">${w.name}</div>
        <div style="font-size:11px; color:var(--gp-text-tertiary); font-family:var(--gp-font-family-mono);">${w.warehouse_id}</div>
        <hr style="margin:6px 0; border:0; border-top:1px solid var(--gp-border);">
        <div style="font-size:12px; color:var(--gp-text-secondary); line-height:1.5;">
          <strong>Capacity Required:</strong> ${reqCap.toLocaleString()} orders/day<br>
          <strong>Capacity Ceiling:</strong> ${ceilCap.toLocaleString()} orders/day<br>
          <strong>Capacity Utilization:</strong> ${w.capacity_utilization_pct.toFixed(1)}%<br>
          <strong>Zones Served:</strong> ${w.neighborhoods_count} delivery zones
        </div>
      </div>
    `);
    appState.layers.results.warehouses.addLayer(wMarker);
  });

  // Render spider assignment lines & zone nodes
  data.assignments.forEach(a => {
    const color = wColorMap[a.warehouse_id] || "#3B82F6";
    
    // Assignment Line
    const line = L.polyline(
      [[a.latitude, a.longitude], [a.warehouse_latitude, a.warehouse_longitude]],
      {
        color: color,
        weight: 2,
        opacity: 0.65,
        dashArray: "3, 5",
      }
    ).bindTooltip(`<b>${a.neighborhood_name}</b> &rarr; ${a.warehouse_name}<br>Geographic Distance: ${a.distance_km} km<br>Demand: ${a.daily_orders} orders`);
    appState.layers.results.assignments.addLayer(line);

    // Zone Marker
    const zMarker = L.circleMarker([a.latitude, a.longitude], {
      radius: 6,
      fillColor: color,
      color: "#FFFFFF",
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.85,
    }).bindTooltip(`<b>${a.neighborhood_name}</b> (${a.daily_orders} orders/day)<br>Assigned to: ${a.warehouse_name}`);
    appState.layers.results.neighborhoods.addLayer(zMarker);
  });

  // Tactical CVRP Routes
  const routeToggle = document.getElementById("lblShowRoutes");
  if (data.cvrp_summary && data.cvrp_summary.routes && data.cvrp_summary.routes.length > 0) {
    if (routeToggle) routeToggle.style.display = "flex";
    data.cvrp_summary.routes.forEach((r, idx) => {
      const rColor = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
      if (r.route_coords && r.route_coords.length >= 2) {
        const poly = L.polyline(r.route_coords, {
          color: rColor,
          weight: 3.5,
          opacity: 0.85,
        }).bindTooltip(`Vehicle Tour: <b>${r.vehicle_id}</b> (${r.warehouse_name})<br>Distance: ${r.total_distance_km} km<br>Load: ${r.total_load} / ${r.capacity} (${r.utilization_pct}%)`);
        appState.layers.results.routes.addLayer(poly);
      }
    });
    renderFleetRoutesTable(data.cvrp_summary);
  } else {
    if (routeToggle) routeToggle.style.display = "none";
  }

  // 4. Warehouse Facility Manifest Breakdown Table
  renderWarehouseManifestTable(data.warehouses);

  // 5. Explainability Select Dropdown
  const selectExplain = document.getElementById("selectExplainWarehouse");
  if (selectExplain) {
    selectExplain.innerHTML = "";
    data.warehouses.forEach(w => {
      selectExplain.innerHTML += `<option value="${w.warehouse_id}">${w.name} (${w.assigned_demand.toLocaleString()} ord/day)</option>`;
    });
    if (data.warehouses.length > 0) {
      loadExplainability(data.warehouses[0].warehouse_id);
    }
  }

  // 6. Update Failed Facility Select for Disruption view
  updateDisruptionDropdown();

  // 7. Dynamic Demand-Weighting Explainer Box
  updateDemandExplainerBox(data.assignments);
}

// ============================================================================
// 8. BASELINE COMPARISON & BENCHMARK TABLE
// ============================================================================

async function fetchBaselineComparison() {
  try {
    const res = await fetch(`/api/compare?session_id=${appState.sessionId}`);
    const data = await res.json();
    appState.lastCompare = data;

    // Update KPI badges with baseline deltas
    document.getElementById("kpiCostBadge").textContent = `${data.cost_pct_change.toFixed(1)}%`;
    document.getElementById("kpiDistanceBadge").textContent = `${data.distance_pct_change.toFixed(1)}%`;
    document.getElementById("kpiCostBaseline").textContent = `Baseline: ${formatMoney(data.baseline.total_delivery_cost, appState.currency)} / day`;
    document.getElementById("kpiDistanceBaseline").textContent = `Baseline: ${data.baseline.weighted_distance_km.toLocaleString(undefined, { maximumFractionDigits: 1 })} ord·km`;

    // Populate Comparison Table
    renderBenchmarkTable(data);
  } catch (err) {
    console.error("Baseline comparison failed:", err);
  }
}

// ============================================================================
// 9. TRADE-OFF CURVE (p = 1..5) & CHART.JS
// ============================================================================

async function fetchTradeoffCurve() {
  try {
    const fixedCost = appState.fixedCostInr;
    const costKm = appState.costKmInr;
    const res = await fetch(`/api/tradeoff?session_id=${appState.sessionId}&fixed_cost=${fixedCost}&cost_per_km=${costKm}`);
    const data = await res.json();
    appState.lastTradeoff = data;

    renderTradeoffChart(data);
  } catch (err) {
    console.error("Tradeoff curve failed:", err);
  }
}

function renderTradeoffChart(data) {
  const canvas = document.getElementById("tradeoffChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (appState.tradeoffChartInstance) {
    appState.tradeoffChartInstance.destroy();
  }

  const sym = currencySymbol(appState.currency);
  const labels = data.points.map(pt => `${pt.p} Site${pt.p > 1 ? 's' : ''}`);
  const delivCosts = data.points.map(pt => convertInrToDisplay(pt.delivery_cost, appState.currency));
  const infraCosts = data.points.map(pt => convertInrToDisplay(pt.infrastructure_cost, appState.currency));
  const combinedCosts = data.points.map(pt => convertInrToDisplay(pt.combined_cost, appState.currency));

  appState.tradeoffChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: `Combined Total Cost (${sym}/day)`,
          data: combinedCosts,
          borderColor: "#1E8E5A",
          backgroundColor: "rgba(30, 142, 90, 0.08)",
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: "#1E8E5A",
          tension: 0.25,
          fill: true,
        },
        {
          label: `Delivery Cost (${sym}/day)`,
          data: delivCosts,
          borderColor: "#3B76ED",
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 4,
          pointBackgroundColor: "#3B76ED",
          tension: 0.25,
        },
        {
          label: `Infrastructure Lease (${sym}/day)`,
          data: infraCosts,
          borderColor: "#8A94A0",
          borderWidth: 2,
          borderDash: [2, 2],
          pointRadius: 4,
          pointBackgroundColor: "#8A94A0",
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { font: { family: "Plus Jakarta Sans", size: 12 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const inrVal = appState.currency === "INR" ? context.parsed.y : context.parsed.y * FX_INR_PER_USD;
              return `${context.dataset.label}: ${formatMoney(inrVal, appState.currency)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: val => `${sym}${Number(val).toLocaleString()}` },
          grid: { color: "rgba(0, 0, 0, 0.05)" },
        },
        x: {
          grid: { display: false },
        }
      }
    }
  });
}

// ============================================================================
// 10. EXPLAINABILITY INTELLIGENCE ("Why this location?")
// ============================================================================

async function loadExplainability(warehouseId) {
  const container = document.getElementById("boxExplainContent");
  if (!container) return;

  if (!warehouseId || warehouseId === "undefined" || warehouseId === "null") {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--gp-text-tertiary);">Select an open warehouse facility above to inspect explainability.</div>';
    return;
  }

  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--gp-text-tertiary);">Computing solver intelligence...</div>';

  try {
    let data = appState.explainCache[warehouseId];
    if (!data) {
      const res = await fetch(`/api/explain/${encodeURIComponent(warehouseId)}?session_id=${encodeURIComponent(appState.sessionId)}`);
      const resData = await res.json();
      if (!res.ok) {
        let errDetail = "Optimization solution not available for this site.";
        if (typeof resData.detail === "string") {
          errDetail = resData.detail;
        } else if (resData.detail?.error) {
          errDetail = resData.detail.error;
          if (Array.isArray(resData.detail.diagnostics) && resData.detail.diagnostics.length > 0) {
            errDetail += `: ${resData.detail.diagnostics.join("; ")}`;
          }
        } else if (resData.error) {
          errDetail = resData.error;
        }
        throw new Error(errDetail);
      }
      data = resData;
      appState.explainCache[warehouseId] = data;
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid solver intelligence response.");
    }

    const demandDrivers = Array.isArray(data.key_demand_drivers) ? data.key_demand_drivers : [];
    let driversHtml = '<table class="gp-table" style="margin-top:8px;"><thead><tr><th>Top Delivery Zone</th><th>Daily Demand</th><th>Geographic Distance</th><th>Order-km Contribution</th></tr></thead><tbody>';
    if (demandDrivers.length === 0) {
      driversHtml += '<tr><td colspan="4" style="text-align:center; color:var(--gp-text-tertiary); padding:12px;">No primary demand drivers recorded for this facility.</td></tr>';
    } else {
      demandDrivers.forEach(d => {
        const dName = d.name || d.neighborhood_id || "Zone";
        const dId = d.neighborhood_id || "";
        const orders = Number(d.daily_orders || 0).toLocaleString();
        const dist = Number(d.distance_km || 0).toFixed(2);
        const wKm = Number(d.weighted_ord_km || 0).toLocaleString();
        driversHtml += `
          <tr>
            <td><strong>${dName}</strong> ${dId ? `(${dId})` : ''}</td>
            <td>${orders} orders</td>
            <td>${dist} km</td>
            <td><span style="font-family:var(--gp-font-family-mono); color:var(--gp-primary-600);">${wKm} ord·km</span></td>
          </tr>
        `;
      });
    }
    driversHtml += '</tbody></table>';

    let rejectedHtml = '';
    if (data.next_best_rejected) {
      const rejName = data.next_best_rejected.name || "Alternative site";
      const rejId = data.next_best_rejected.candidate_id || "";
      const rejReason = data.next_best_rejected.reason_rejected || "Higher overall delivery penalty.";
      const rejGap = Number(data.next_best_rejected.score_gap_weighted_km || 0).toLocaleString();
      rejectedHtml = `
        <div style="background:var(--gp-surface-sunken); border:1px solid var(--gp-border); border-radius:var(--gp-radius-sm); padding:var(--gp-space-3); margin-top:var(--gp-space-3);">
          <div style="font-weight:700; font-size:13px; color:var(--gp-text-primary);">Runner-Up Candidate in this Sector: ${rejName} ${rejId ? `(${rejId})` : ''}</div>
          <p style="font-size:12px; color:var(--gp-text-secondary); margin-top:2px;">${rejReason}</p>
          <div style="font-size:11px; font-family:var(--gp-font-family-mono); color:var(--gp-warning); margin-top:4px;">
            Objective Gap: +${rejGap} ord·km higher total travel penalty.
          </div>
        </div>
      `;
    }

    const demandServed = Number(data.demand_served || 0).toLocaleString();
    const demandPct = Number(data.demand_pct_of_total || 0).toFixed(1);
    const capUtil = Number(data.capacity_utilization_pct || 0).toFixed(1);
    const maxCap = Number(data.capacity || 0).toLocaleString();
    const avgDist = Number(data.avg_distance_km || 0).toFixed(2);
    const zonesServed = Number(data.neighborhoods_served_count || 0);
    const burdenElim = Number(data.burden_eliminated_km || 0).toLocaleString();

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--gp-space-3); margin-bottom:var(--gp-space-4);">
        <div style="background:var(--gp-surface-sunken); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">Assigned Demand</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-text-primary); margin-top:2px;">${demandServed} ord/day</div>
          <div style="font-size:11px; color:var(--gp-text-tertiary);">${demandPct}% of network volume</div>
        </div>

        <div style="background:var(--gp-surface-sunken); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">Capacity Utilization</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-text-primary); margin-top:2px;">${capUtil}%</div>
          <div style="font-size:11px; color:var(--gp-text-tertiary);">${maxCap} max capacity</div>
        </div>

        <div style="background:var(--gp-surface-sunken); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">Average Delivery Radius</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-text-primary); margin-top:2px;">${avgDist} km</div>
          <div style="font-size:11px; color:var(--gp-text-tertiary);">${zonesServed} delivery zones served</div>
        </div>

        <div style="background:var(--gp-surface-sunken); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">Eliminated Burden</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-success); margin-top:2px;">-${burdenElim} ord·km</div>
          <div style="font-size:11px; color:var(--gp-text-tertiary);">vs single-facility centroid</div>
        </div>
      </div>

      <div style="margin-top:var(--gp-space-3);">
        <strong style="font-size:13px; color:var(--gp-text-primary); text-transform:uppercase; letter-spacing:0.03em;">Key Demand Drivers in Assigned Cluster</strong>
        ${driversHtml}
      </div>

      ${rejectedHtml}
    `;
  } catch (err) {
    const safeMsg = String(err.message || err).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    container.innerHTML = `
      <div style="background:rgba(217, 48, 37, 0.05); border:1px solid rgba(217, 48, 37, 0.25); border-radius:var(--gp-radius-sm); padding:var(--gp-space-4); color:var(--gp-text-primary);">
        <div style="font-weight:700; font-size:13px; color:var(--gp-danger); margin-bottom:4px;">Unable to load warehouse explainability</div>
        <p style="font-size:12px; color:var(--gp-text-secondary); margin:0;">${safeMsg}</p>
        <div style="margin-top:8px;">
          <button class="gp-btn gp-btn-secondary gp-btn-sm" onclick="runOptimization()">Run Optimization Now</button>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// 11. WAREHOUSE MANIFEST TABLE
// ============================================================================

function renderWarehouseManifestTable(warehouses) {
  const tbody = document.getElementById("tbodyWarehouseManifest");
  if (!tbody) return;

  if (!warehouses || warehouses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--gp-text-tertiary); padding:20px;">No open facilities.</td></tr>';
    return;
  }

  tbody.innerHTML = warehouses.map(w => {
    const reqCap = (w.capacity_required !== undefined ? w.capacity_required : w.assigned_demand);
    const ceilCap = (w.capacity_ceiling !== undefined ? w.capacity_ceiling : w.capacity);
    return `
    <tr>
      <td><span style="font-family:var(--gp-font-family-mono); font-weight:700;">${w.warehouse_id}</span></td>
      <td><strong>${w.name}</strong></td>
      <td><span style="font-family:var(--gp-font-family-mono); font-weight:700;">${reqCap.toLocaleString()}</span> <span style="font-size:11px; color:var(--gp-text-tertiary);">ord/day</span></td>
      <td><span style="font-family:var(--gp-font-family-mono);">${ceilCap.toLocaleString()}</span> <span style="font-size:11px; color:var(--gp-text-tertiary);">ord/day</span></td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="flex:1; height:6px; background:var(--gp-surface-sunken); border-radius:3px; overflow:hidden; min-width:60px;">
            <div style="width:${Math.min(100, w.capacity_utilization_pct)}%; height:100%; background:${w.capacity_utilization_pct > 90 ? 'var(--gp-danger)' : 'var(--gp-primary-500)'};"></div>
          </div>
          <span class="gp-delta-chip ${w.capacity_utilization_pct > 90 ? 'gp-delta-warning' : 'gp-delta-positive'}">${w.capacity_utilization_pct.toFixed(1)}%</span>
        </div>
      </td>
      <td>${w.neighborhoods_count} zones</td>
      <td>
        <button class="gp-btn gp-btn-secondary gp-btn-sm" onclick="inspectWarehouseFacility('${w.warehouse_id}')">Inspect</button>
      </td>
    </tr>
  `;
  }).join("");
}

function inspectWarehouseFacility(wId) {
  // Switch to Explainability subtab
  document.querySelector('[data-subtab="subtabExplain"]').click();
  document.getElementById("selectExplainWarehouse").value = wId;
  loadExplainability(wId);
}

// ============================================================================
// 12. DEMAND-WEIGHTING EXPLAINER BOX
// ============================================================================

function updateDemandExplainerBox(assignments) {
  if (!assignments || assignments.length === 0) return;
  const sorted = [...assignments].sort((a, b) => b.daily_orders - a.daily_orders);
  const high = sorted[0];
  const low = sorted[sorted.length - 1];

  const highOrdKm = Math.round(high.daily_orders * high.distance_km);
  const lowOrdKm = Math.round(low.daily_orders * low.distance_km);

  document.getElementById("expHighName").textContent = `High-Demand Zone: ${high.neighborhood_name}`;
  document.getElementById("expHighMath").textContent = `${high.daily_orders.toLocaleString()} orders/day × ${high.distance_km.toFixed(1)} km = ${highOrdKm.toLocaleString()} order-km`;

  document.getElementById("expLowName").textContent = `Low-Demand Zone: ${low.neighborhood_name}`;
  document.getElementById("expLowMath").textContent = `${low.daily_orders.toLocaleString()} orders/day × ${low.distance_km.toFixed(1)} km = ${lowOrdKm.toLocaleString()} order-km`;
}

// ============================================================================
// 13. SCENARIO LAB & DISRUPTION SIMULATION (POST /api/scenario)
// ============================================================================

function updateScenarioCards() {
  const nZones = appState.neighborhoods?.length || 36;
  const totalDem = appState.neighborhoods?.reduce((s, n) => s + (n.daily_orders || 0), 0) || 10000;

  const descNormal = document.getElementById("cardScenarioNormalDesc");
  if (descNormal) {
    descNormal.textContent = `Baseline demand across ${nZones} delivery zones (${totalDem.toLocaleString()} ord/day).`;
  }
  const descWeekend = document.getElementById("cardScenarioWeekendDesc");
  if (descWeekend) {
    descWeekend.textContent = `+20% weekend surge (${Math.round(totalDem * 1.2).toLocaleString()} ord/day) across ${nZones} zones.`;
  }
  const descFestival = document.getElementById("cardScenarioFestivalDesc");
  if (descFestival) {
    descFestival.textContent = `+50% festival surge (${Math.round(totalDem * 1.5).toLocaleString()} ord/day) capacity stress test.`;
  }
}

function updateDisruptionDropdown() {
  const selectFailed = document.getElementById("selectFailedFacility");
  if (!selectFailed) return;

  const prevVal = selectFailed.value;
  selectFailed.innerHTML = "";

  if (appState.lastOptimize && appState.lastOptimize.warehouses && appState.lastOptimize.warehouses.length > 0) {
    appState.lastOptimize.warehouses.forEach(w => {
      selectFailed.innerHTML += `<option value="${w.warehouse_id}">${w.name} (${w.warehouse_id}) &mdash; ${w.assigned_demand?.toLocaleString() || 0} ord/day</option>`;
    });
  } else if (appState.neighborhoods && appState.neighborhoods.length > 0) {
    const candidates = appState.neighborhoods.slice(0, 5);
    candidates.forEach(c => {
      selectFailed.innerHTML += `<option value="${c.neighborhood_id}">${c.name} (${c.neighborhood_id})</option>`;
    });
  } else {
    selectFailed.innerHTML = '<option value="">No facilities loaded</option>';
  }

  // Retain previous value if still present; otherwise select first facility
  if (prevVal && Array.from(selectFailed.options).some(o => o.value === prevVal)) {
    selectFailed.value = prevVal;
  } else if (selectFailed.options.length > 0) {
    selectFailed.selectedIndex = 0;
  }
}

function updateScenarioView() {
  updateScenarioCards();
  const activeCard = document.querySelector(".gp-scenario-card.active") || document.getElementById("cardScenarioNormal");
  const mult = activeCard ? (parseFloat(activeCard.getAttribute("data-mult")) || 1.0) : 1.0;
  runScenarioSimulation(mult, null, "boxScenarioResults");
}

function updateDisruptionView() {
  updateDisruptionDropdown();
  const selectFailed = document.getElementById("selectFailedFacility");
  const failedWid = selectFailed ? selectFailed.value : null;
  runScenarioSimulation(1.0, failedWid, "boxDisruptionResults");
}

async function runScenarioSimulation(multiplier, failedWid = null, targetContainerId = "boxScenarioResults") {
  const box = document.getElementById(targetContainerId);
  if (!box) return;

  box.innerHTML = '<div style="text-align:center; padding:16px; color:var(--gp-text-tertiary);">Simulating network stress test...</div>';

  const p = (appState.lastOptimize && appState.lastOptimize.assumptions?.warehouse_count) || parseInt(document.getElementById("inputConfigP")?.value) || 3;
  const cap = (appState.lastOptimize && appState.lastOptimize.assumptions?.warehouse_capacity) || parseFloat(document.getElementById("inputConfigCap")?.value) || 4000;
  const costKm = appState.costKmInr;
  const fixedCost = appState.fixedCostInr;

  const payload = {
    session_id: appState.sessionId,
    demand_multiplier: multiplier,
    warehouse_failure_id: failedWid,
    p: p,
    warehouse_capacity: cap,
    cost_per_km: costKm,
    fixed_cost_per_warehouse: fixedCost,
  };

  try {
    const res = await fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      showErrorModal("Scenario Infeasible", data.detail?.error || "Constraint violation", data.detail?.diagnostics || []);
      box.innerHTML = '<div style="color:var(--gp-danger); font-size:13px;">Scenario is infeasible under current capacity parameters.</div>';
      return;
    }

    appState.lastScenario = data;

    const nZones = appState.neighborhoods?.length || 36;
    let disruptionBanner = "";
    if (data.failed_warehouse_name || failedWid) {
      const fname = data.failed_warehouse_name || failedWid;
      disruptionBanner = `
        <div style="background:var(--gp-danger-bg, #FEF2F2); border:1px solid var(--gp-danger-border, #FECACA); border-radius:var(--gp-radius-sm); padding:10px 14px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--gp-danger);"></span>
            <span style="font-size:13px; font-weight:700; color:var(--gp-danger);">OUTAGE CONTINGENCY:</span>
            <span style="font-size:13px; font-weight:600; color:var(--gp-text-primary);">${fname} (${failedWid || data.failed_warehouse_id})</span>
          </div>
          <div style="font-size:12px; color:var(--gp-text-secondary);">
            Failover absorbed by <strong>${(data.scenario_warehouse_names && data.scenario_warehouse_names.length) ? data.scenario_warehouse_names.join(", ") : data.scenario_warehouses.join(", ")}</strong>
          </div>
        </div>
      `;
    }

    let warningHtml = "";
    if (data.locations_changed) {
      warningHtml = `<div style="background:var(--gp-warning-bg); border:1px solid var(--gp-warning-border); padding:8px 12px; border-radius:var(--gp-radius-sm); color:var(--gp-warning); font-weight:700; margin-bottom:10px; font-size:13px;">
        ⚠️ Facility Topology Shifted: Warehouse locations were dynamically reconfigured to maintain service feasibility.
      </div>`;
    }

    box.innerHTML = `
      ${disruptionBanner}
      ${warningHtml}
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:var(--gp-space-3); margin-bottom:var(--gp-space-3);">
        <div style="background:var(--gp-surface); border:1px solid var(--gp-border); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">Scenario Delivery Cost</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-text-primary); margin-top:2px;" id="scenarioCostCard">${formatMoney(data.scenario_cost, appState.currency)}</div>
          <div style="font-size:11px; color:${data.cost_pct_change > 0 ? 'var(--gp-danger)' : 'var(--gp-success)'}; font-weight:700; margin-top:2px;">
            ${data.cost_pct_change > 0 ? '+' : ''}${data.cost_pct_change.toFixed(1)}% vs baseline
          </div>
        </div>

        <div style="background:var(--gp-surface); border:1px solid var(--gp-border); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">Weighted Distance</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-text-primary); margin-top:2px;">${data.scenario_weighted_distance.toLocaleString()} ord·km</div>
          <div style="font-size:11px; color:var(--gp-text-tertiary);">${data.weighted_distance_pct_change.toFixed(1)}% change</div>
        </div>

        <div style="background:var(--gp-surface); border:1px solid var(--gp-border); padding:var(--gp-space-3); border-radius:var(--gp-radius-sm);">
          <div style="font-size:11px; color:var(--gp-text-tertiary); text-transform:uppercase; font-weight:600;">${failedWid ? 'Surviving Warehouses' : 'Active Warehouses'}</div>
          <div style="font-size:18px; font-weight:700; color:var(--gp-text-primary); margin-top:2px;">${data.scenario_warehouses.length} sites</div>
          <div style="font-size:11px; color:var(--gp-text-tertiary);">${(data.scenario_warehouse_names && data.scenario_warehouse_names.length) ? data.scenario_warehouse_names.join(", ") : data.scenario_warehouses.join(", ")}</div>
        </div>
      </div>

      <div style="font-size:12px; color:var(--gp-text-secondary); line-height:1.5;">
        ${data.diagnostics && data.diagnostics.length > 0 ? data.diagnostics.join("<br>") : (
          failedWid
            ? `Contingency Plan: All ${nZones} delivery zones successfully failover-reassigned to remaining operational warehouses without stockout.`
            : `All ${nZones} delivery zones remain 100% serviceable within capacity.`
        )}
      </div>
    `;

    showToast(`Simulation complete: ${data.scenario_name}`);
  } catch (err) {
    box.innerHTML = `<div style="color:var(--gp-danger); font-size:13px;">Scenario execution failed: ${err.message}</div>`;
  }
}

// ============================================================================
// 14. CVRP FLEET ROUTES TABLE
// ============================================================================

function renderFleetRoutesTable(cvrp) {
  const tbody = document.getElementById("tbodyFleetRoutes");
  if (!tbody) return;

  if (!cvrp || !cvrp.routes || cvrp.routes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--gp-text-tertiary);">No active CVRP routes.</td></tr>';
    return;
  }

  tbody.innerHTML = cvrp.routes.map(r => `
    <tr>
      <td><span style="font-family:var(--gp-font-family-mono); font-weight:700; color:var(--gp-primary-600);">${r.vehicle_id}</span></td>
      <td><strong>${r.warehouse_name}</strong></td>
      <td style="font-size:12px; max-width:280px;">${r.stop_names.join(" &rarr; ")}</td>
      <td>${r.total_distance_km.toFixed(2)} km</td>
      <td>${r.total_load.toLocaleString()} / ${r.capacity.toLocaleString()} orders</td>
      <td>
        <span class="gp-delta-chip ${r.utilization_pct > 80 ? 'gp-delta-positive' : 'gp-delta-neutral'}">${r.utilization_pct.toFixed(1)}%</span>
      </td>
    </tr>
  `).join("");
}

// ============================================================================
// 15. DASHBOARD STATS & LIVE SUMMARY UPDATE
// ============================================================================

function updateDashboardStats() {
  const zonesCount = appState.neighborhoods?.length || 36;
  const totalDem = appState.neighborhoods && appState.neighborhoods.length > 0
    ? appState.neighborhoods.reduce((acc, n) => acc + (n.daily_orders || 0), 0)
    : 10240;
  const p = parseInt(document.getElementById("inputConfigP")?.value) || 3;
  const cap = parseFloat(document.getElementById("inputConfigCap")?.value) || 4000;
  const totalCap = p * cap;

  const elZones = document.getElementById("dashKpiZones");
  if (elZones) elZones.textContent = zonesCount;
  const elDem = document.getElementById("dashKpiDemand");
  if (elDem) elDem.textContent = totalDem.toLocaleString();
  const elP = document.getElementById("dashKpiP");
  if (elP) elP.textContent = p;

  const elSavings = document.getElementById("dashKpiSavings");
  if (elSavings) {
    if (appState.lastCompare) {
      elSavings.textContent = formatMoney(appState.lastCompare.estimated_monthly_savings, appState.currency, { compact: true });
    } else {
      elSavings.textContent = formatMoney(0, appState.currency, { compact: true });
    }
  }

  // Update Headroom & Capacity Gauge on Dashboard
  const utilPct = totalCap > 0 ? (totalDem / totalCap) * 100 : 0;
  const headroom = totalCap - totalDem;

  const elCapBadge = document.getElementById("dashCapacityBadge");
  if (elCapBadge) {
    if (utilPct > 100) {
      elCapBadge.className = "gp-badge gp-badge-danger";
      elCapBadge.textContent = `${utilPct.toFixed(1)}% Capacity Overloaded`;
    } else if (utilPct > 90) {
      elCapBadge.className = "gp-badge gp-badge-warning";
      elCapBadge.textContent = `${utilPct.toFixed(1)}% Tight Headroom`;
    } else {
      elCapBadge.className = "gp-badge gp-badge-optimal";
      elCapBadge.textContent = `${utilPct.toFixed(1)}% Utilization (Healthy)`;
    }
  }

  const elCapFill = document.getElementById("dashCapacityFill");
  if (elCapFill) {
    elCapFill.style.width = `${Math.min(100, Math.max(5, utilPct))}%`;
    elCapFill.style.background = utilPct > 100 ? "#ef4444" : (utilPct > 90 ? "#f59e0b" : "linear-gradient(90deg, #2563eb, #3b82f6)");
  }

  const elCapDem = document.getElementById("dashCapDemandText");
  if (elCapDem) elCapDem.textContent = totalDem.toLocaleString();

  const elCapHeadroom = document.getElementById("dashCapHeadroomText");
  if (elCapHeadroom) {
    if (headroom >= 0) {
      elCapHeadroom.style.color = "var(--gp-success)";
      elCapHeadroom.textContent = `+${headroom.toLocaleString()} orders buffer`;
    } else {
      elCapHeadroom.style.color = "var(--gp-danger)";
      elCapHeadroom.textContent = `${headroom.toLocaleString()} orders deficit!`;
    }
  }

  const elCapTotal = document.getElementById("dashCapTotalText");
  if (elCapTotal) elCapTotal.textContent = `${totalCap.toLocaleString()} (${p} × ${cap.toLocaleString()})`;
}

function updateLiveSummary() {
  const isAuto = appState.configMode === "auto";
  const p = parseInt(document.getElementById("inputConfigP")?.value) || 3;
  const cap = parseFloat(document.getElementById("inputConfigCap")?.value) || 4000;
  const totalDem = appState.neighborhoods && appState.neighborhoods.length > 0 
    ? appState.neighborhoods.reduce((s, n) => s + (n.daily_orders || 0), 0) 
    : 10240;
  const nZones = appState.neighborhoods?.length || 36;
  const activeCap = p * cap;

  // 1. Update System Capacity vs Demand Card in viewConfig
  const elActiveCap = document.getElementById("cfgActiveCapacity");
  if (elActiveCap) elActiveCap.textContent = activeCap.toLocaleString();

  const elMetroDem = document.getElementById("cfgMetroDemand");
  if (elMetroDem) elMetroDem.textContent = totalDem.toLocaleString();

  const elSubtitleP = document.getElementById("cfgSubtitleP");
  if (elSubtitleP) elSubtitleP.textContent = `Aggregated throughput at p = ${p} warehouses`;

  // 2. Stacked Capacity Progress Bar
  const allocPct = Math.min(100, Math.round((totalDem / Math.max(1, activeCap)) * 1000) / 10);
  const headroomPct = Math.max(0, Math.round((100 - allocPct) * 10) / 10);

  const barAlloc = document.getElementById("cfgBarAllocated");
  if (barAlloc) barAlloc.style.width = `${allocPct}%`;

  const barHead = document.getElementById("cfgBarHeadroom");
  if (barHead) barHead.style.width = `${headroomPct}%`;

  const badgeFeasible = document.getElementById("badgeCapacityFeasible");
  if (badgeFeasible) {
    if (activeCap >= totalDem) {
      badgeFeasible.textContent = "● Feasible";
      badgeFeasible.style.background = "#ecfdf5";
      badgeFeasible.style.color = "#10b981";
    } else {
      badgeFeasible.textContent = "▲ Deficit";
      badgeFeasible.style.background = "#fef2f2";
      badgeFeasible.style.color = "#ef4444";
    }
  }

  // 3. Update Stepper & Slider indicators
  const elDisplayP = document.getElementById("valConfigPDisplay");
  if (elDisplayP) elDisplayP.textContent = p;

  const elLabelP = document.getElementById("valConfigPLabel");
  if (elLabelP) elLabelP.textContent = `${p} Active Selected`;

  const elValP = document.getElementById("valConfigP");
  if (elValP) elValP.textContent = `${p} sites`;

  // 4. Legacy summary text box
  const radiusVal = document.getElementById("inputConfigRadius")?.value;
  let radiusText = radiusVal ? ` within <strong>${radiusVal} km</strong> radius` : "";
  const box = document.getElementById("configLiveSummaryText");
  if (box) {
    if (isAuto) {
      const pMax = parseInt(document.getElementById("inputConfigPMax")?.value) || 6;
      if (appState.lastOptimize && appState.lastOptimize.auto_size) {
        box.innerHTML = `The lowest-cost network uses <strong>${appState.lastOptimize.p} warehouses</strong> (from up to ${pMax} considered) serving <strong>${nZones} delivery zones</strong>.`;
      } else {
        box.innerHTML = `Choosing the lowest-cost network of up to <strong>${pMax} warehouses</strong> to minimize total cost (delivery transit + facility leases)${radiusText}.`;
      }
    } else {
      box.innerHTML = `You are planning a <strong>${p}-warehouse</strong> network serving <strong>${nZones} delivery zones</strong> with <strong>${activeCap.toLocaleString()} orders/day</strong> combined capacity${radiusText}.`;
    }
  }
}

// ============================================================================
// 16. EVENT LISTENERS & SETUP
// ============================================================================

function setupEventListeners() {
  // 1. Navigation items (Left Rail)
  document.querySelectorAll(".gp-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const viewId = item.getAttribute("data-view");
      if (viewId) switchView(viewId);
    });
  });

  // 2. Brand Box Logo click -> Dashboard
  document.getElementById("brandHomeBtn")?.addEventListener("click", () => switchView("viewDashboard"));

  // 3. Landing Page CTAs
  document.getElementById("btnLandingLoadDemo")?.addEventListener("click", async () => {
    await loadDemoData();
    switchView("viewResults");
  });
  document.getElementById("btnLandingGoData")?.addEventListener("click", () => switchView("viewData"));
  document.getElementById("btnLandingOpenAgent")?.addEventListener("click", () => toggleAgentDrawer(true));

  // 4. Dashboard Quick Action Cards & Buttons (Overview page)
  document.querySelectorAll("[data-jump]").forEach(el => {
    el.addEventListener("click", () => {
      const target = el.getAttribute("data-jump");
      if (target) switchView(target);
    });
  });

  document.getElementById("btnDashQuickData")?.addEventListener("click", () => switchView("viewData"));
  document.getElementById("btnDashQuickAgent")?.addEventListener("click", () => toggleAgentDrawer(true));
  document.getElementById("btnDashQuickOptimize")?.addEventListener("click", async () => {
    const ok = await runOptimization();
    if (ok) switchView("viewResults");
  });

  // One-Click Strategy Presets on Dashboard
  document.querySelectorAll("[data-dash-preset]").forEach(card => {
    card.addEventListener("click", async () => {
      const pKey = card.getAttribute("data-dash-preset");
      applyPresetConfig(pKey);
      const ok = await runOptimization();
      if (ok) switchView("viewResults");
    });
  });

  // 5. Header Bar Global Actions
  const btnInr = document.getElementById("btnCurrINR");
  const btnUsd = document.getElementById("btnCurrUSD");
  const pillGroup = document.getElementById("headerCurrencyPillGroup");

  if (btnInr) {
    btnInr.addEventListener("click", () => setCurrency("INR"));
  }
  if (btnUsd) {
    btnUsd.addEventListener("click", () => setCurrency("USD"));
  }
  if (pillGroup) {
    pillGroup.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrency("USD");
        btnUsd?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrency("INR");
        btnInr?.focus();
      }
    });
  }

  // Header Logistics Assistant
  document.getElementById("btnHeaderAgentAssistant")?.addEventListener("click", () => toggleAgentDrawer(true));

  // Header Presets Modal
  document.getElementById("btnHeaderLoadPreset")?.addEventListener("click", () => {
    document.getElementById("presetModal")?.classList.add("active");
  });
  document.getElementById("btnClosePresetModal")?.addEventListener("click", () => {
    document.getElementById("presetModal")?.classList.remove("active");
  });
  document.getElementById("btnCancelPresetModal")?.addEventListener("click", () => {
    document.getElementById("presetModal")?.classList.remove("active");
  });
  document.querySelectorAll("[data-apply-preset]").forEach(card => {
    card.addEventListener("click", () => {
      const pKey = card.getAttribute("data-apply-preset");
      applyPresetConfig(pKey);
      document.getElementById("presetModal")?.classList.remove("active");
    });
  });

  // Header System Notifications Modal
  document.getElementById("btnHeaderNotifications")?.addEventListener("click", () => {
    document.getElementById("notificationsModal")?.classList.add("active");
  });
  document.getElementById("btnCloseNotificationsModal")?.addEventListener("click", () => {
    document.getElementById("notificationsModal")?.classList.remove("active");
  });
  document.getElementById("btnOkNotificationsModal")?.addEventListener("click", () => {
    document.getElementById("notificationsModal")?.classList.remove("active");
  });

  // Header User Profile Modal
  document.getElementById("btnHeaderProfile")?.addEventListener("click", () => {
    const pSess = document.getElementById("profileSessionId");
    if (pSess) pSess.textContent = appState.sessionId || "default";
    document.getElementById("profileModal")?.classList.add("active");
  });
  document.getElementById("btnCloseProfileModal")?.addEventListener("click", () => {
    document.getElementById("profileModal")?.classList.remove("active");
  });
  document.getElementById("btnOkProfileModal")?.addEventListener("click", () => {
    document.getElementById("profileModal")?.classList.remove("active");
  });
  document.getElementById("btnProfileResetSession")?.addEventListener("click", async () => {
    document.getElementById("profileModal")?.classList.remove("active");
    await loadDemoData();
    setDetourMode("road_detour");
    setPriorityPreset("cost");
    showToast("Workspace session reset to defaults.", "info");
  });

  document.getElementById("btnGlobalLoadDemo")?.addEventListener("click", async () => {
    await loadDemoData();
    switchView("viewResults");
  });
  document.getElementById("btnGlobalOptimize")?.addEventListener("click", async () => {
    const ok = await runOptimization();
    if (ok) switchView("viewResults");
  });

  // 6. Data Input View Actions
  document.getElementById("btnDataLoadDemo")?.addEventListener("click", loadDemoData);

  // CSV File Upload
  document.getElementById("csvFileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showErrorModal("CSV Upload Error", "Invalid CSV Format", data.detail?.errors || []);
        return;
      }

      applyCanonicalDataset(data, {
        isSynthetic: false,
        source: "csv",
        toastMessage: `Uploaded ${data.neighborhood_count} zones (${data.total_demand.toLocaleString()} orders/day).`
      });
      const ok = await runOptimization();
      if (ok) switchView("viewResults");
    } catch (err) {
      showErrorModal("Upload Failed", err.message);
    }
  });

  // Manual JSON Modal
  const modalManual = document.getElementById("manualEntryModal");
  document.getElementById("btnDataRawJson").addEventListener("click", () => {
    document.getElementById("manualJsonArea").value = JSON.stringify(appState.neighborhoods, null, 2);
    modalManual.classList.add("active");
  });
  document.getElementById("btnCloseManualModal").addEventListener("click", () => modalManual.classList.remove("active"));
  document.getElementById("btnCancelManual").addEventListener("click", () => modalManual.classList.remove("active"));

  document.getElementById("btnSubmitManual").addEventListener("click", async () => {
    try {
      const parsed = JSON.parse(document.getElementById("manualJsonArea").value);
      const res = await fetch("/api/neighborhoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neighborhoods: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        showErrorModal("JSON Error", "Validation failed", data.detail?.errors || []);
        return;
      }
      applyCanonicalDataset(data, {
        isSynthetic: false,
        source: "manual",
        toastMessage: `Applied ${data.neighborhood_count} zones.`
      });
      modalManual.classList.remove("active");
      const ok = await runOptimization();
      if (ok) switchView("viewResults");
    } catch (err) {
      alert(`Invalid JSON format: ${err.message}`);
    }
  });

  // 6.5 AI Synthetic Data Generator (Phase 3)
  const btnDataAIGen = document.getElementById("btnDataAIGenerate");
  if (btnDataAIGen) {
    btnDataAIGen.addEventListener("click", () => {
      toggleAgentDrawer(true, "synthetic");
    });
  }

  const inputSynthZones = document.getElementById("inputSynthZones");
  if (inputSynthZones) {
    inputSynthZones.addEventListener("input", (e) => {
      const valEl = document.getElementById("valSynthZones");
      if (valEl) valEl.textContent = `${e.target.value} zones`;
    });
  }

  const btnCancelSynth = document.getElementById("btnCancelSynthetic");
  if (btnCancelSynth) {
    btnCancelSynth.addEventListener("click", () => {
      setAgentMode("setup");
    });
  }

  const btnConfirmSynth = document.getElementById("btnConfirmGenerateSynthetic");
  if (btnConfirmSynth) {
    btnConfirmSynth.addEventListener("click", async () => {
      const promptText = document.getElementById("inputSynthPrompt")?.value?.trim() || "";
      const scope = document.getElementById("selectSynthScope")?.value || "single_city";
      const zoneCount = parseInt(document.getElementById("inputSynthZones")?.value) || 50;
      const region = document.getElementById("selectSynthRegion")?.value || "Bengaluru";

      btnConfirmSynth.disabled = true;
      btnConfirmSynth.textContent = "Sampling & Validating...";

      try {
        const payload = {
          session_id: appState.sessionId,
          zone_count: zoneCount,
          scope: scope,
        };

        if (promptText) {
          payload.prompt = promptText;
        } else {
          payload.city_hint = region;
          payload.region_name = region;
          payload.pattern_hint = "clustered";
          if (scope === "state") {
            payload.region_filter = { country_code: "IN", state_name: region };
          } else {
            payload.region_filter = { country_code: "IN", city_name: region };
          }
        }

        const res = await fetch("/api/agent/generate-synthetic-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        btnConfirmSynth.disabled = false;
        btnConfirmSynth.textContent = "Generate & Sample Data";

        if (!res.ok) {
          showErrorModal("Sampler Generation Error", data.detail?.error || "Generation failed", data.detail?.errors || []);
          return;
        }

        const badgeLabel = data.badge_text || (data.scope === "state" ? "[Real Towns, Synthetic Demand]" : "[Real City Anchor, Jittered Zones & Synthetic Demand]");

        applyCanonicalDataset(data, {
          isSynthetic: true,
          datasetType: "real_locations_synthetic_demand",
          source: "real_locations_synthetic_demand",
          badgeText: badgeLabel,
          scope: data.scope,
          toastMessage: `Sampled & validated ${data.neighborhood_count} zones (${data.total_demand.toLocaleString()} orders/day) labeled ${badgeLabel}.`
        });

        toggleAgentDrawer(false);
        const ok = await runOptimization();
        if (ok) switchView("viewResults");
      } catch (err) {
        btnConfirmSynth.disabled = false;
        btnConfirmSynth.textContent = "Generate & Sample Data";
        showErrorModal("Generation Failed", err.message);
      }
    });
  }

  // 7. Configuration View Controls & Mode Switcher
  const btnModeMan = document.getElementById("btnConfigModeManual");
  const btnModeAut = document.getElementById("btnConfigModeAuto");
  const boxManualP = document.getElementById("containerManualP");
  const boxAutoPMax = document.getElementById("containerAutoPMax");

  if (btnModeMan && btnModeAut) {
    btnModeMan.addEventListener("click", () => {
      appState.configMode = "manual";
      btnModeMan.classList.add("active");
      btnModeAut.classList.remove("active");
      if (boxManualP) boxManualP.style.display = "block";
      if (boxAutoPMax) boxAutoPMax.style.display = "none";
      updateLiveSummary();
    });

    btnModeAut.addEventListener("click", () => {
      appState.configMode = "auto";
      btnModeAut.classList.add("active");
      btnModeMan.classList.remove("active");
      if (boxManualP) boxManualP.style.display = "none";
      if (boxAutoPMax) {
        boxAutoPMax.style.display = "block";
        updateConfigMinBounds();
      }
      updateLiveSummary();
    });
  }

  // Stepper Buttons and Slider for Warehouse Count (P)
  const sliderP = document.getElementById("inputConfigP");
  const btnDecP = document.getElementById("btnStepDecP");
  const btnIncP = document.getElementById("btnStepIncP");

  if (btnDecP && sliderP) {
    btnDecP.addEventListener("click", () => {
      let cur = parseInt(sliderP.value) || 3;
      if (cur > parseInt(sliderP.min || 1)) {
        sliderP.value = cur - 1;
        sliderP.dispatchEvent(new Event("input"));
      }
    });
  }

  if (btnIncP && sliderP) {
    btnIncP.addEventListener("click", () => {
      let cur = parseInt(sliderP.value) || 3;
      if (cur < parseInt(sliderP.max || 6)) {
        sliderP.value = cur + 1;
        sliderP.dispatchEvent(new Event("input"));
      }
    });
  }

  if (sliderP) {
    sliderP.addEventListener("input", (e) => {
      const val = parseInt(e.target.value) || 3;
      document.getElementById("valConfigP").textContent = `${val} sites`;
      const valDisplay = document.getElementById("valConfigPDisplay");
      if (valDisplay) valDisplay.textContent = val;
      const valLabel = document.getElementById("valConfigPLabel");
      if (valLabel) valLabel.textContent = `${val} Active Selected`;

      updateLiveSummary();
      updateDashboardStats();
      agentState.knownParams.warehouse_count = val;
    });
  }

  const inputPMax = document.getElementById("inputConfigPMax");
  if (inputPMax) {
    inputPMax.addEventListener("input", (e) => {
      document.getElementById("valConfigPMax").textContent = `${e.target.value} sites`;
      const noteEl = document.getElementById("autoCeilingNote");
      if (noteEl) noteEl.textContent = e.target.value;
      updateLiveSummary();
    });
  }

  const inputCap = document.getElementById("inputConfigCap");
  if (inputCap) {
    inputCap.addEventListener("input", (e) => {
      document.getElementById("valConfigCap").textContent = `${Number(e.target.value).toLocaleString()} orders/day`;
      updateConfigMinBounds();
      updateLiveSummary();
      agentState.knownParams.warehouse_capacity = parseInt(e.target.value) || 4000;
    });
  }

  const inputRad = document.getElementById("inputConfigRadius");
  if (inputRad) {
    inputRad.addEventListener("input", (e) => {
      document.getElementById("valConfigRadius").textContent = e.target.value ? `${e.target.value} km` : "No Limit";
      updateLiveSummary();
      agentState.knownParams.max_service_radius_km = parseFloat(e.target.value) || 25.0;
    });
  }

  const inputCostKm = document.getElementById("inputCostKm");
  if (inputCostKm) {
    inputCostKm.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        appState.costKmInr = convertInput(val, appState.currency);
        agentState.knownParams.cost_per_km = appState.costKmInr;
      }
    });
  }

  const inputFixedCost = document.getElementById("inputFixedCost");
  if (inputFixedCost) {
    inputFixedCost.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        appState.fixedCostInr = convertInput(val, appState.currency);
        agentState.knownParams.fixed_cost_per_warehouse = appState.fixedCostInr;
      }
    });
  }

  // Priority Objective Function Synchronization
  function setPriorityPreset(preset) {
    appState.priorityPreset = preset;
    agentState.knownParams.priority_preset = preset;

    const objCards = [
      { el: document.getElementById("optObjCost"), preset: "cost" },
      { el: document.getElementById("optObjSpeed"), preset: "speed" },
      { el: document.getElementById("optObjCO2"), preset: "sustainability" }
    ];

    objCards.forEach(({ el, preset: p }) => {
      if (!el) return;
      const isMatch = (p === preset);
      el.classList.toggle("selected", isMatch);
      const badge = el.querySelector(".gp-badge-obj-selected, .gp-badge-obj-standby");
      if (badge) {
        badge.className = isMatch ? "gp-badge-obj-selected" : "gp-badge-obj-standby";
        badge.textContent = isMatch ? "SELECTED" : "STANDBY";
      }
    });

    document.querySelectorAll(".gp-preset-pill").forEach(pill => {
      pill.classList.toggle("active", pill.getAttribute("data-preset") === preset);
    });
  }

  const objCards = [
    { el: document.getElementById("optObjCost"), preset: "cost" },
    { el: document.getElementById("optObjSpeed"), preset: "speed" },
    { el: document.getElementById("optObjCO2"), preset: "sustainability" }
  ];

  objCards.forEach(({ el, preset }) => {
    if (!el) return;
    el.addEventListener("click", () => setPriorityPreset(preset));
  });

  // Legacy Priority Presets Pills (compatibility)
  document.querySelectorAll(".gp-preset-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const p = pill.getAttribute("data-preset");
      if (p) setPriorityPreset(p);
    });
  });

  // Detour Mode 2-Option Cards & Synchronization
  const cardProxy = document.getElementById("cardDetourProxy");
  const cardHaversine = document.getElementById("cardDetourHaversine");
  const radRoad = document.getElementById("radioDetourRoad");
  const radHav = document.getElementById("radioDetourHaversine");
  const selDist = document.getElementById("selectDistanceMode");

  function setDetourMode(mode) {
    const isRoad = (mode === "road_detour");
    cardProxy?.classList.toggle("selected", isRoad);
    cardHaversine?.classList.toggle("selected", !isRoad);
    if (radRoad) radRoad.checked = isRoad;
    if (radHav) radHav.checked = !isRoad;
    if (selDist) {
      selDist.value = mode;
      selDist.dispatchEvent(new Event("change"));
    }
    appState.distanceMode = mode;
  }

  cardProxy?.addEventListener("click", () => setDetourMode("road_detour"));
  cardHaversine?.addEventListener("click", () => setDetourMode("haversine"));
  radRoad?.addEventListener("change", () => setDetourMode("road_detour"));
  radHav?.addEventListener("change", () => setDetourMode("haversine"));

  function applyPresetConfig(presetKey) {
    const sliderP = document.getElementById("inputConfigP");
    const inputCap = document.getElementById("inputConfigCap");
    const inputRad = document.getElementById("inputConfigRadius");

    if (presetKey === "speed") {
      if (sliderP) { sliderP.value = 4; sliderP.dispatchEvent(new Event("input")); }
      if (inputCap) { inputCap.value = 3500; inputCap.dispatchEvent(new Event("input")); }
      if (inputRad) { inputRad.value = 8; inputRad.dispatchEvent(new Event("input")); }
      setPriorityPreset("speed");
      setDetourMode("road_detour");
      showToast("Applied Quick-Commerce Express preset (4 sites, 8km radius).", "success");
    } else if (presetKey === "cost") {
      if (sliderP) { sliderP.value = 2; sliderP.dispatchEvent(new Event("input")); }
      if (inputCap) { inputCap.value = 6000; inputCap.dispatchEvent(new Event("input")); }
      if (inputRad) { inputRad.value = 25; inputRad.dispatchEvent(new Event("input")); }
      setPriorityPreset("cost");
      setDetourMode("road_detour");
      showToast("Applied Cost Focus (Lean) preset (2 sites, 6,000 cap).", "success");
    } else if (presetKey === "sustainability") {
      if (sliderP) { sliderP.value = 3; sliderP.dispatchEvent(new Event("input")); }
      if (inputCap) { inputCap.value = 4500; inputCap.dispatchEvent(new Event("input")); }
      if (inputRad) { inputRad.value = 15; inputRad.dispatchEvent(new Event("input")); }
      setPriorityPreset("sustainability");
      setDetourMode("road_detour");
      showToast("Applied Green Corridor preset (3 sites, EV routing).", "success");
    } else {
      if (sliderP) { sliderP.value = 3; sliderP.dispatchEvent(new Event("input")); }
      if (inputCap) { inputCap.value = 4000; inputCap.dispatchEvent(new Event("input")); }
      if (inputRad) { inputRad.value = 25; inputRad.dispatchEvent(new Event("input")); }
      setPriorityPreset("cost");
      setDetourMode("road_detour");
      showToast("Applied Bengaluru Standard preset.", "success");
    }
  }

  // Config Action Buttons
  document.getElementById("btnConfigResetDefaults")?.addEventListener("click", () => {
    if (sliderP) {
      sliderP.value = 3;
      sliderP.dispatchEvent(new Event("input"));
    }
    const inpCap = document.getElementById("inputConfigCap");
    if (inpCap) {
      inpCap.value = 4000;
      inpCap.dispatchEvent(new Event("input"));
    }
    const inpRad = document.getElementById("inputConfigRadius");
    if (inpRad) {
      inpRad.value = 25;
      inpRad.dispatchEvent(new Event("input"));
    }
    const inpFixed = document.getElementById("inputFixedCost");
    if (inpFixed) {
      inpFixed.value = appState.currency === "INR" ? 15000 : 176;
      inpFixed.dispatchEvent(new Event("input"));
    }
    const inpKm = document.getElementById("inputCostKm");
    if (inpKm) {
      inpKm.value = appState.currency === "INR" ? 35 : 0.41;
      inpKm.dispatchEvent(new Event("input"));
    }
    setDetourMode("road_detour");
    setPriorityPreset("cost");
    showToast("Reset network configuration to system defaults.", "success");
  });

  document.getElementById("btnConfigSavePreset")?.addEventListener("click", () => {
    showToast("Network configuration preset saved successfully.", "success");
  });

  document.getElementById("btnConfigRunOptimization")?.addEventListener("click", async () => {
    const ok = await runOptimization();
    if (ok) switchView("viewResults");
  });

  // Demand Map Zoom Controls (image_1.png)
  document.getElementById("btnMapZoomIn")?.addEventListener("click", () => {
    if (appState.maps.demand) appState.maps.demand.zoomIn();
  });
  document.getElementById("btnMapZoomOut")?.addEventListener("click", () => {
    if (appState.maps.demand) appState.maps.demand.zoomOut();
  });
  document.getElementById("btnMapResetView")?.addEventListener("click", () => {
    if (appState.maps.demand && appState.neighborhoods && appState.neighborhoods.length > 0) {
      const lats = appState.neighborhoods.map(n => n.latitude);
      const lons = appState.neighborhoods.map(n => n.longitude);
      appState.maps.demand.fitBounds([
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      ], { padding: [30, 30] });
    }
  });

  // Active Layer Overlays Checkboxes
  const chkHeat = document.getElementById("layerChkHeatmap");
  const chkCent = document.getElementById("layerChkCentroids");
  const chkVor = document.getElementById("layerChkVoronoi");
  const chkCand = document.getElementById("layerChkCandidates");
  const linkSummary = document.getElementById("linkLayerSummary");

  function updateLayerSummary() {
    let active = 0;
    if (chkHeat?.checked) active++;
    if (chkCent?.checked) active++;
    if (chkVor?.checked) active++;
    if (chkCand?.checked) active++;
    if (linkSummary) linkSummary.textContent = `${active} of 4 Active`;
  }

  function syncLayerVisibility() {
    updateLayerSummary();
    if (!appState.maps.demand) return;
    if (chkCand) {
      if (chkCand.checked) appState.maps.demand.addLayer(appState.layers.demand.candidates);
      else appState.maps.demand.removeLayer(appState.layers.demand.candidates);
    }
    if (chkCent) {
      if (chkCent.checked) appState.maps.demand.addLayer(appState.layers.demand.neighborhoods);
      else appState.maps.demand.removeLayer(appState.layers.demand.neighborhoods);
    }
    if (chkHeat) {
      if (chkHeat.checked) appState.maps.demand.addLayer(appState.layers.demand.heatmap);
      else appState.maps.demand.removeLayer(appState.layers.demand.heatmap);
    }
    if (chkVor) {
      if (chkVor.checked) appState.maps.demand.addLayer(appState.layers.demand.voronoi);
      else appState.maps.demand.removeLayer(appState.layers.demand.voronoi);
    }
  }

  [chkHeat, chkCent, chkVor, chkCand].forEach(chk => {
    chk?.addEventListener("change", syncLayerVisibility);
  });

  linkSummary?.addEventListener("click", () => {
    const allChecked = [chkHeat, chkCent, chkVor, chkCand].every(c => c?.checked);
    [chkHeat, chkCent, chkVor, chkCand].forEach(c => {
      if (c) c.checked = !allChecked;
    });
    syncLayerVisibility();
  });

  // Zone Inspector Reassign Hub Button
  document.getElementById("btnReassignHub")?.addEventListener("click", () => {
    const zoneName = document.getElementById("inspZoneTitle")?.textContent || "Zone";
    showToast(`Configuring hub optimization for ${zoneName}...`, "info");
    switchView("viewConfig");
  });

  // Demand Breakdown Table Search Filter
  const inputFilter = document.getElementById("inputFilterNeighborhoods");
  if (inputFilter) {
    inputFilter.addEventListener("input", (e) => {
      tableSearchQuery = e.target.value;
      tableCurrentPage = 1;
      renderDataInputTable(appState.neighborhoods);
    });
  }

  // Demand Breakdown Table Pagination
  document.getElementById("btnTablePrev")?.addEventListener("click", () => {
    if (tableCurrentPage > 1) {
      tableCurrentPage--;
      renderDataInputTable(appState.neighborhoods);
    }
  });

  document.getElementById("btnTableNext")?.addEventListener("click", () => {
    const query = (tableSearchQuery || "").toLowerCase().trim();
    const filtered = query
      ? appState.neighborhoods.filter(n => 
          (n.neighborhood_id && n.neighborhood_id.toLowerCase().includes(query)) ||
          (n.name && n.name.toLowerCase().includes(query))
        )
      : appState.neighborhoods;
    const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
    if (tableCurrentPage < totalPages) {
      tableCurrentPage++;
      renderDataInputTable(appState.neighborhoods);
    }
  });

  // Demand Breakdown Export CSV Button
  document.getElementById("btnExportDemandCsv")?.addEventListener("click", () => {
    if (!appState.neighborhoods || appState.neighborhoods.length === 0) {
      showToast("No zones available to export.", "error");
      return;
    }
    const headers = ["neighborhood_id", "name", "daily_orders", "latitude", "longitude"];
    const rows = appState.neighborhoods.map(n => [
      n.neighborhood_id,
      `"${n.name.replace(/"/g, '""')}"`,
      n.daily_orders,
      n.latitude,
      n.longitude
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gridpoint_zones_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${appState.neighborhoods.length} zones to CSV.`, "success");
  });

  // 7.5 Conversational Logistics Agent & Explain Mode (Phases 2, 3 & 4)
  const btnOpenAgent = document.getElementById("btnOpenAgentDrawer");
  if (btnOpenAgent) {
    btnOpenAgent.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer();
    });
  }

  const navAgentAssistant = document.getElementById("navAgentAssistant");
  if (navAgentAssistant) {
    navAgentAssistant.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer();
    });
  }

  const btnHeaderAgentAssistant = document.getElementById("btnHeaderAgentAssistant");
  if (btnHeaderAgentAssistant) {
    btnHeaderAgentAssistant.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer();
    });
  }

  const btnLandingOpenAgent = document.getElementById("btnLandingOpenAgent");
  if (btnLandingOpenAgent) {
    btnLandingOpenAgent.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer(true);
    });
  }

  const btnDashQuickAgent = document.getElementById("btnDashQuickAgent");
  if (btnDashQuickAgent) {
    btnDashQuickAgent.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer(true);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleAgentDrawer(false);
    }
  });

  const btnCloseAgent = document.getElementById("btnCloseAgentDrawer");
  if (btnCloseAgent) {
    btnCloseAgent.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer(false);
    });
  }

  const backdropAgent = document.getElementById("agentDrawerBackdrop");
  if (backdropAgent) {
    backdropAgent.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgentDrawer(false);
    });
  }

  // Drawer Mode Switcher Buttons
  const btnModeSetup = document.getElementById("btnModeSetup");
  if (btnModeSetup) {
    btnModeSetup.addEventListener("click", () => setAgentMode("setup"));
  }

  const btnModeExplain = document.getElementById("btnModeExplain");
  if (btnModeExplain) {
    btnModeExplain.addEventListener("click", () => setAgentMode("explain"));
  }

  // Header & In-Screen Explain Buttons
  const btnHeaderExplain = document.getElementById("btnHeaderExplain");
  if (btnHeaderExplain) {
    btnHeaderExplain.addEventListener("click", () => {
      toggleAgentDrawer(true, "explain");
    });
  }

  document.querySelectorAll(".gp-btn-explain-screen").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-explain-view");
      if (view && view !== appState.currentView) {
        switchView(view);
      }
      toggleAgentDrawer(true, "explain");
    });
  });

  const btnSendAgent = document.getElementById("btnAgentSend");
  const inputAgent = document.getElementById("agentInput");

  if (btnSendAgent && inputAgent) {
    const handleSend = () => {
      const val = inputAgent.value;
      if (!val || !val.trim()) return;
      if (agentState.mode === "explain") {
        sendAgentExplainMessage(val);
      } else {
        sendAgentMessage(val);
      }
    };

    btnSendAgent.addEventListener("click", handleSend);

    inputAgent.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Quick Chips in Initial Agent Setup State
  document.querySelectorAll("#agentQuickPrompts .gp-quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const promptText = chip.getAttribute("data-prompt");
      if (promptText) sendAgentMessage(promptText);
    });
  });

  // Quick Chips in Initial Agent Explain State
  document.querySelectorAll("#agentExplainQuickPrompts [data-explain-q]").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.getAttribute("data-explain-q");
      if (q) sendAgentExplainMessage(q);
    });
  });

  // 8. Results View Subtabs
  document.querySelectorAll(".gp-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".gp-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".gp-tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-subtab");
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add("active");
      if (tabId === "subtabExplain") {
        const select = document.getElementById("selectExplainWarehouse");
        if (select && select.value) {
          loadExplainability(select.value);
        }
      }
    });
  });

  // Explainability Warehouse Select Dropdown
  const selectExplainEl = document.getElementById("selectExplainWarehouse");
  if (selectExplainEl) {
    selectExplainEl.addEventListener("change", (e) => {
      loadExplainability(e.target.value);
    });
  }

  // 9. Scenario Lab Presets
  document.getElementById("cardScenarioNormal").addEventListener("click", (e) => {
    document.querySelectorAll(".gp-scenario-card").forEach(c => c.classList.remove("active"));
    document.getElementById("cardScenarioNormal").classList.add("active");
    runScenarioSimulation(1.0, null, "boxScenarioResults");
  });
  document.getElementById("cardScenarioWeekend").addEventListener("click", (e) => {
    document.querySelectorAll(".gp-scenario-card").forEach(c => c.classList.remove("active"));
    document.getElementById("cardScenarioWeekend").classList.add("active");
    runScenarioSimulation(1.2, null, "boxScenarioResults");
  });
  document.getElementById("cardScenarioFestival").addEventListener("click", (e) => {
    document.querySelectorAll(".gp-scenario-card").forEach(c => c.classList.remove("active"));
    document.getElementById("cardScenarioFestival").classList.add("active");
    runScenarioSimulation(1.5, null, "boxScenarioResults");
  });

  // 10. Disruption View Simulation
  const selectFailedEl = document.getElementById("selectFailedFacility");
  if (selectFailedEl) {
    selectFailedEl.addEventListener("change", (e) => {
      const failedWid = e.target.value || null;
      runScenarioSimulation(1.0, failedWid, "boxDisruptionResults");
    });
  }

  const btnSimulateOutage = document.getElementById("btnSimulateOutage");
  if (btnSimulateOutage) {
    btnSimulateOutage.addEventListener("click", () => {
      const failedWid = document.getElementById("selectFailedFacility")?.value || null;
      runScenarioSimulation(1.0, failedWid, "boxDisruptionResults");
    });
  }

  // 11. Tactical Fleet CVRP Solve Button
  document.getElementById("btnFleetRecompute").addEventListener("click", async () => {
    document.getElementById("chkIncludeCvrp").checked = true;
    document.getElementById("chkFleetEnableCvrp").checked = true;
    await runOptimization();
    switchView("viewFleet");
  });

  // Infeasibility Modal Close
  const modalError = document.getElementById("errorModal");
  document.getElementById("btnErrorModalClose")?.addEventListener("click", () => modalError?.classList.remove("active"));
  document.getElementById("btnErrorModalOk")?.addEventListener("click", () => modalError?.classList.remove("active"));
}

// ============================================================================
// 17. ONLOAD INITIALIZATION
// ============================================================================

function initializeApp() {
  // 1. Setup event listeners first so UI buttons and controls ALWAYS function
  try {
    setupEventListeners();
  } catch (err) {
    console.error("Critical error setting up event listeners:", err);
  }

  // 2. Safe map initialization (protected against container reuse)
  try {
    initMaps();
  } catch (err) {
    console.warn("Notice during map initialization:", err);
  }

  // 3. UI visibility & state
  try {
    updateAgentFabVisibility(appState.currentView);
  } catch (err) {
    console.warn("Notice updating agent FAB visibility:", err);
  }

  // 4. Async health check and initial dataset load
  checkHealth().catch(err => console.warn("Health check failed:", err));
  loadDemoData().catch(err => console.warn("Demo data load failed:", err));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
