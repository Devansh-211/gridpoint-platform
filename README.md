# GRIDPOINT — Intelligent Warehouse Location & Delivery Network Optimizer
### Operations-Research Logistics Decision Support Tool

**GRIDPOINT** is a B2B logistics decision-support tool designed for operations and supply chain managers at quick-commerce and e-commerce enterprises. Rather than relying on intuition or manual guesswork, GRIDPOINT applies mathematical optimization to determine **where warehouses should go, how many to open, which delivery zones each facility should serve, and quantifies the exact cost and distance improvements over a reference baseline**.

---

## 1. Executive Value Proposition

- **Make smarter delivery decisions:** Strategic Capacitated Facility Location Problem (CFLP) solved to mathematical optimality via Mixed-Integer Linear Programming (**PuLP + CBC**) with automated greedy + 2-opt local search fallback.
- **Save more:** Quantifies daily and monthly cost reductions over a rigorous **Single-Warehouse Reference Baseline** (1-median center).
- **Plan for disruption:** Interactive Scenario Lab simulating demand surges (+20% weekend, +50% festival peaks) and facility outage re-routing.
- **Explainable intelligence:** "Why this location?" mathematical intelligence breaking down key demand drivers and the exact score gap of rejected candidate facilities.
- **Tactical fleet execution:** Dedicated Capacitated Vehicle Routing Problem (CVRP) solving multi-stop vehicle tours via **Google OR-Tools Guided Local Search**.
- **Modern B2B Design System:** 10-screen persistent Left-Rail navigation architecture built with custom design tokens, responsive typography, and strict product honesty rules.

---

## 1.1. What's New in v2.0 (React + TypeScript Enterprise Edition)

1. **Enterprise Dual-Currency Engine (INR Canonical, USD Derived):**
   - Canonical storage and server-side computation standardized in Indian Rupees (`INR`, ₹).
   - Dynamic foreign exchange conversion to `USD` ($) via single calibrated constant `FX_INR_PER_USD = 85`.
   - Accessible header segmented pill (`role="radiogroup"`, keyboard arrow navigation, focus ring, persisted in `localStorage`).
   - Toggling currency executes **zero network re-solves** (pure client-side projection). User inputs auto-convert to canonical INR before API transmission.
   - Dual-mode formatting: compact notation (`₹1.2 Cr`, `₹12.4 L`, `$1.4M`, `$50k`) for executive KPI cards; full `Intl.NumberFormat` localized accounting in tables and charts.

2. **Zero Cold-Start Architecture & Resilient Fallback:**
   - Preloads the 36-zone Bengaluru logistics dataset on initial mount with automatic baseline vs. $p = 3$ optimization.
   - Animated skeleton loaders eliminate empty/placeholder states (never displays `$0.00` or `₹0` for uncomputed metrics).
   - Resilient 4-second timeout failover to bundled precomputed demo result (`src/data/demoResult.json`) with non-blocking inline notification and retry trigger.

3. **"Why GridPoint?" Comparison Matrix:**
   - Radix UI Collapsible 4-column comparison matrix evaluating Capability across Legacy Enterprise Tools, Basic Mapping Tools, and GridPoint Engine.
   - Semantic `<table>` with `<th scope>` on desktop/tablet; converts automatically to stacked responsive cards below 768px.

4. **KaTeX Mathematical Proof & Formulation Bar:**
   - Bundled local KaTeX engine rendering exact Mixed-Integer Linear Program (MILP) equations for both Manual and Auto-size modes.
   - Interactive variable legend and mathematical constraint breakdown ($x_{ij} \le y_j$, $\sum x_{ij} = 1$, capacity ceilings, and radius bounds).

5. **Solver Telemetry & Latency Badge:**
   - Header badge displaying real-time server-side solve duration (`solve_ms` measured via `time.perf_counter()`), solver status, and MIP gap diagnostics (`mip_gap`).

6. **Animated Capacity Headroom Progress Bar:**
   - Dynamic system throughput utilization progress bar (`role="progressbar"`) with calibrated color thresholds (Emerald <80%, Amber 80–95%, Red >95%, and striped Infeasible >100%).

7. **Honest Routing Accuracy:**
   - Clear distinction between exact Mixed-Integer Linear Programming for warehouse location (PuLP/CBC) and heuristic vehicle routing (OR-Tools Guided Local Search metaheuristics).

---

## 1.2. What's New in v2.1 (Ranking Engine, Regret Quantification & Cadastral Verification)

1. **Iterative No-Good Cuts Ranking Engine (`/api/rank`):**
   - Ranks top 5 configurations (#1 optimal, #2–#5 runner-up configurations) by iteratively enforcing integer exclusion cuts:
     $$\sum_{j \in S} y_j \le p - 1$$
   - Each rank returns total daily cost (INR), delta vs. optimal (₹/day and %), per-site capacity utilization, and which sites were added/removed.
   - Preserves all core solver bindings and CFLP mathematical formulation in a clean additive module (`optimization/ranking.py`).

2. **Per-Candidate Regret Quantification:**
   - Regret measures the exact daily penalty of forcing candidate site $j$ to be included in the open set ($y_j = 1$):
     $$\text{Regret}(j) = \text{Cost}(y_j = 1) - \text{Cost}(\text{Optimal})$$
   - Parallel multi-threaded execution with a 3-second timeout and linear programming (LP) relaxation fallback if the solver timeout is reached.

3. **Exhaustive LP Verification Benchmark:**
   - For combinatorial instances $\binom{M}{p} \le 5000$ (e.g. $\binom{20}{3} = 1140$), an exhaustive brute force transportation LP verifies that the MILP branch-and-cut solution matches the true global mathematical minimum with 100% precision.

4. **Interactive Network Map with Footprint Polygons:**
   - Deterministically sized candidate footprints from `area_sq_ft` with status color coding (Emerald = Optimal, Amber = Runner-up, Slate = Screened/Rejected).
   - Interactive popups triggering land registry inspection.
   - Optional live Overpass OpenStreetMap (OSM) zoning context toggle (`landuse=industrial|commercial|retail`) with debouncing and graceful offline fallback.
   - Visible disclaimer: *"Illustrative footprint, not a surveyed boundary."*

5. **Demo-Only Land Registry Inspector Drawer:**
   - Radix UI Dialog drawer with copy-to-clipboard helpers for GPS coordinates and locality names.
   - Curated direct link-outs to official Karnataka portals: **Bhoomi RTC Portal**, **Karnataka GIS (KGIS)**, and **BBMP Property Tax Portal**.
   - Strict data honesty: zero simulated survey numbers or fake ownership records. Official title fields start blank with in-browser `localStorage` note retention. Completely hidden if user uploads custom zone data.

---

## 1.3. What's New in v2.2 (Real OSRM Road Matrix, Live Exact CFLP In-Browser Engine & Photon Search)

1. **OSRM Street-Network Routing Matrix (`osrmMatrixService`):**
   - Replaces synthetic Haversine straight-line distances with real road distances (km) and free-flow driving durations (min) via OSRM (`https://router.project-osrm.org/table/v1/driving/...`).
   - Coordinate-pair caching in memory and persistent storage with sub-millisecond lookups on slider edits.
   - Intelligent batch chunking adhering to coordinate limits with concurrency control and automatic retry.
   - Deterministic 1.34× detour factor fallback if coordinates are unroutable, with a real-time status badge (`OSRM Live Street Network` vs. `Mixed` vs. `Haversine Geodesic`).
   - Seamless transmission to backend `/api/optimize` and `/api/rank` via the additive `distanceKm` field.

2. **Live Exact CFLP Engine in Web Worker (`cflpWorker.ts`):**
   - Live browser-based exact Capacitated Facility Location solver eliminating server round-trips on demand tweaks.
   - Branch-and-bound over candidate hub combinations with include/exclude tree exploration, symmetry breaking, and node ordering by marginal gain.
   - Leaf nodes solve the exact capacitated assignment problem via Min-Cost Flow (Successive Shortest Path) supporting fractional demand splitting across hubs hitting capacity ceilings.
   - Sub-millisecond performance (measured p50: **0.03 ms**, p95: **0.06 ms** across 200 random order edits) with a 400 ms anytime best-incumbent safeguard.
   - Background cross-check verification against PuLP/CBC displaying `✓ Verified exact (matches CBC)` when solutions agree within $10^{-4}$ relative gap.
   - Collapsible Solver Transparency Panel displaying nodes explored, nodes pruned, incumbent updates, and facility sets evaluated vs $\binom{M}{p}$.

3. **Live Inline Order Editing & Topology Diff Banner:**
   - Universal `OrderQuantityEditor` embedded directly in the Delivery Zone Ingestion table and Zone Demand Breakdown table with integer numeric input, `−50` / `+50` steppers, and `1x` / `1.5x` / `2x` surge pills.
   - Real-time reactive state: editing Koramangala from 420 to 2,800 orders immediately updates Total Daily Demand, utilization bars, and re-optimizes the network in under 1 ms.
   - Topology Diff Banner (`TopologyDiffBanner`) highlighting opened/closed hubs, reassigned zones, spillover flows, and cost delta.
   - Versioned `localStorage` persistence with one-click `Reset Demo Data` restoration.

4. **Keyless Live Search & Map-Click Location Ingestion (Photon):**
   - Prominent search bar querying Photon Komoot geocoding (`https://photon.komoot.io/api/?q=...&lat=12.9716&lon=77.5946&limit=5`) with 250 ms debounce, LRU caching, and keyboard combobox navigation.
   - "📍 Click Map to Add Zone" toolbar mode with crosshair cursor, Esc cancellation, and automatic reverse geocoding (`/reverse?lat=...&lon=...`).
   - Modular "Add to Network" form for creating either Delivery Demand Zones or Candidate Warehouse Hubs with automatic ID assignment (`ZN-BLR-37`, `HUB-BLR-19`).

---

## 2. How the Engine Works & Mathematical Formulation

### 2.1. Dual-Engine Optimization Architecture
GRIDPOINT employs a dual-engine architecture designed for instantaneous feedback paired with formal operations research verification:

1. **Client-Side Live Worker Solver (Live CFLP Engine):**
   - **Branch-and-Bound over Facility Sets:** Explores candidate warehouse combinations $\binom{M}{p}$.
   - **Lower Bound at Node:** $\text{LB} = \sum_{j \in S_{\text{fixed}}} f_j + \sum_{i \in I} \min_{j \in J_{\text{allowed}}} \{ c_{\text{transit}} \cdot d_{ij} \cdot D_i \} + \text{cheapest remaining hub leases}$.
   - **Capacity Pruning:** If $\sum_{j \in S_{\text{fixed}} \cup J_{\text{allowed}}} Q_j < \sum_{i \in I} D_i$, the branch is immediately pruned.
   - **Leaf Node Assignment:** At complete sets of $p$ facilities, an exact Min-Cost Flow (Successive Shortest Path) routine determines optimal zone-to-hub assignments and fractional spillovers when capacity ceilings are saturated.
   - **SLA Radius & Penalty:** Arcs exceeding $R_{\max}$ are disallowed. Uncovered zones carry a heavy documented penalty in the objective and are flagged in the UI.

2. **Server-Side Verifier & Ranking Engine (FastAPI + PuLP/CBC):**
   - Solves the full Mixed-Integer Linear Program (MILP) with Coin-OR CBC.
   - Powers the Iterative No-Good Cuts ranking engine (`/api/rank`) to produce runner-up configurations #2–#5 and candidate regret scores.
   - Asynchronously verifies the live worker's objective within $10^{-4}$ relative precision.

### 2.2. Distance Data & Routing Engine
- **Road Network Distance:** Real road network kilometers and free-flow durations are fetched from OSRM (`router.project-osrm.org`) using the `/table/v1/driving` API.
- **Detour Factor Fallback:** If OSRM is unreachable or pairs are disconnected, GridPoint computes Haversine geodesic distance multiplied by a calibrated urban road detour factor of **1.34×**.
- **Free-Flow ETAs:** Durations represent baseline free-flow driving times computed at an urban reference speed of 24 km/h.

### 2.3. Data Sources & Privacy
- **Photon Geocoding API:** Location search and reverse-geocoding queries are sent to Komoot's public Photon service (`photon.komoot.io`), powered by OpenStreetMap.
- **OSRM Routing API:** Distance matrix queries are sent to Project-OSRM's public routing service (`router.project-osrm.org`).
- **Privacy Assurance:** Only geographical coordinates (`lat, lon`) are transmitted to external geocoding and routing services. No personal identifying information (PII), proprietary customer names, or title ownership records are ever transmitted.

---

## 2.4. Mathematical Formulation (CFLP)

Let:
- $I = \{1, \dots, n\}$ be the set of delivery zones (neighborhoods) with daily order demand $d_i \ge 0$.
- $J = \{1, \dots, m\}$ be the set of candidate warehouse facility locations with throughput capacity $C_j > 0$.
- $D_{i,j}$ be the geographic delivery distance (Haversine straight-line distance, $R \approx 6371\text{ km}$) between delivery zone $i$ and candidate warehouse $j$.
- $p \in [1, 5]$ be the exact number of warehouse facilities to open.
- $R_{\max}$ be the maximum permissible service radius in kilometers.

#### Decision Variables:
$$y_j \in \{0, 1\} \quad \forall j \in J \quad (1 \text{ if warehouse } j \text{ is opened, } 0 \text{ otherwise})$$
$$x_{i,j} \in \{0, 1\} \quad \forall i \in I, j \in J \quad (1 \text{ if delivery zone } i \text{ is assigned to warehouse } j, 0 \text{ otherwise})$$

#### Objective Function:
Minimize **Total Demand-Weighted Geographic Delivery Distance**:
$$\min \sum_{i \in I} \sum_{j \in J} d_i \cdot D_{i,j} \cdot x_{i,j}$$

#### Constraints:
1. **Single Assignment:** Each delivery zone is assigned to exactly one distribution warehouse:
   $$\sum_{j \in J} x_{i,j} = 1 \quad \forall i \in I$$
2. **Facility Linkage:** Zones can only be assigned to opened warehouse facilities:
   $$x_{i,j} \le y_j \quad \forall i \in I, j \in J$$
3. **Capacity Limit:** Total demand allocated to warehouse $j$ cannot exceed its throughput capacity:
   $$\sum_{i \in I} d_i \cdot x_{i,j} \le C_j \cdot y_j \quad \forall j \in J$$
4. **Exact Warehouse Count:** Exactly $p$ distribution centers are opened:
   $$\sum_{j \in J} y_j = p$$
5. **Maximum Service Radius:**
   $$x_{i,j} = 0 \quad \forall (i, j) \text{ where } D_{i,j} > R_{\max}$$

---

### Tactical Routing: Capacitated Vehicle Routing Problem (CVRP)

For opened warehouses with assigned delivery zone clusters, GRIDPOINT executes a secondary tactical vehicle tour optimization using Google OR-Tools Guided Local Search with virtual demand splitting to construct legal vehicle tours:
- Vehicle capacity $Q$ (e.g. 250 orders/van).
- Fixed vehicle dispatch penalty $F_{\text{veh}}$ (e.g. $150/van) to discourage fleet proliferation and maximize payload consolidation.

---

## 3. Tech Stack

- **Backend:** Python 3.11+ / 3.14, FastAPI, Uvicorn (`uvicorn app:app --reload`).
- **Optimization:** PuLP + CBC (Coin-or branch and cut), Google OR-Tools (CVRP Guided Local Search).
- **Data & Math:** Pandas, NumPy, Haversine Geospatial Matrix Engine.
- **Frontend:** Semantic HTML5, CSS3 Tokens Design System (`tokens.css`, `style.css`), Vanilla JavaScript (`app.js` Single State Architecture).
- **Geospatial & Charts:** Leaflet.js (interactive maps & cluster rendering), Chart.js (trade-off curves & analytics).

---

## 4. Information Architecture & Navigation

The platform is structured into a persistent **Left-Rail application shell** across 10 distinct, fully-grounded screens:

| Category | Screen | ID | Key Capabilities |
|---|---|---|---|
| **Setup** | **Landing & Entry** | `viewLanding` | Overview of system capabilities, quickstart buttons to load demo data or upload CSV. |
| **Setup** | **Dashboard Overview** | `viewDashboard` | High-level operations workspace summary with session metrics and 4-step workflow cards. |
| **Setup** | **Demand Data Ingestion** | `viewData` | CSV drag-and-drop, validation feedback banner, raw JSON editor, and interactive Demand Map. |
| **Setup** | **Network Configuration** | `viewConfig` | Facility count $p$, capacity, radius $R_{\max}$, priority presets (Cost, Speed, Green), and live plain-language summary line. |
| **Results** | **Optimization Results** | `viewResults` | Centerpiece Leaflet map with layer toggles, 6 executive KPI cards with `[Estimate]` badges & delta chips, baseline comparison benchmark table, facility manifest, "Why here?" decision intelligence, and demand-weighting explainer. |
| **Results** | **Scenario Lab (What-If)** | `viewScenarios` | Demand shock simulation (Normal 1.0x, Weekend +20%, Festival +50%) with before/after comparisons and topology shift detection. |
| **Results** | **Disruption & Resilience** | `viewDisruption` | Single-point-of-failure facility outage simulator with emergency zone reassignment and cost impact analysis. |
| **Results** | **Tactical Fleet Routing** | `viewFleet` | Dedicated Google OR-Tools CVRP routing screen: turn-by-turn vehicle stop sequences, payload utilization bars, and fleet distance manifests. |
| **Reference** | **Analytics & Trade-off** | `viewAnalytics` | Facility count vs. delivery cost trade-off curve ($p=1..5$) with Chart.js, diminishing returns curve, and visible on-screen CO₂ emissions formula footnote ($0.21 \text{ kg CO}_2/\text{km}$). |
| **Reference** | **Methodology & About** | `viewMethodology` | CFLP Integer Program formulation, CVRP formulation, the 8 Product Honesty Rules, tech stack summary, and Hackathon AI Usage Disclosure. |

---

## 5. Project Directory Structure

```
gridpoint/
├── api/
│   ├── routes.py            # FastAPI REST endpoints & optimization handlers
│   └── schemas.py           # Pydantic request/response schemas
├── core/
│   ├── models.py            # Domain data classes (Neighborhood, WarehouseCandidate, CFLPResult)
│   ├── validation.py        # Presolve feasibility checks & CSV schema validation
│   ├── metrics.py           # Financial cost formulas & safe percentage deltas
│   └── geodata.py           # Deterministic Real-Geodata Sampler & demand synthesizer
├── data/
│   ├── cities_geodata.csv       # 4,198 real cities/towns from dr5hn/ODbL database
│   ├── demo_neighborhoods.csv   # Curated 36 Bengaluru delivery zones
│   └── sample_neighborhoods.csv # Demonstration dataset
├── scripts/
│   └── download_geodata.py  # One-time script to fetch & filter public cities geodata
├── optimization/
│   ├── cflp.py              # PuLP/CBC MILP formulation with Greedy + 2-Opt Heuristic fallback
│   ├── assignment.py        # Neighborhood cluster assignment & utilization aggregator
│   └── cvrp.py              # Google OR-Tools CVRP solver for multi-stop vehicle tours
├── routing/
│   ├── distance.py          # Haversine distance engine & empirical road proxy
│   ├── matrix.py            # Pairwise distance matrix computation
│   └── osrm.py              # Routing abstraction layer
├── simulation/
│   ├── baseline.py          # 1-median Single-Warehouse Reference Baseline calculation
│   └── scenario.py          # Demand shock (+20%, +50%) & warehouse outage simulator
├── static/
│   ├── tokens.css           # Design tokens (colors, typography, 8px spacing, elevation)
│   ├── style.css            # Component library (buttons, cards, KPIs, tables, skeletons, error banners)
│   ├── index.html           # 10-screen Left-Rail application shell
│   └── app.js               # Reactive client router, Leaflet geospatial engine & Chart.js
├── tests/
│   ├── test_api.py          # REST endpoint integration tests (12 test suites)
│   ├── test_cflp.py         # CFLP solver unit tests
│   ├── test_cvrp.py         # CVRP routing unit tests
│   ├── test_metrics.py      # Financial & delta metrics tests
│   └── test_validation.py   # Presolve validation tests
├── app.py                   # Application entrypoint & CBC solver startup verification
├── config.py                # Configuration constants & defaults
├── requirements.txt         # Python dependencies
└── README.md                # System documentation & Hackathon AI Usage Disclosure
```

---

## 6. Quickstart & Installation

### Prerequisites
- Python 3.11+
- Virtual environment tool (`venv`)

### 1. Set Up Environment
```bash
# Clone the repository
git clone https://github.com/Devansh-211/gridpoint.git
cd gridpoint

# Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure AI Features (Optional / Recommended)
The core mathematical optimization engines (PuLP/CBC CFLP solver, Google OR-Tools CVRP router, geospatial matrix, baseline comparisons, and CSV upload) have **zero external API dependencies** and run 100% locally.

To enable the **Conversational Logistics Assistant** (natural language parameter extraction), **AI Synthetic Data Generator**, and **Grounded Per-Page Explainer**, configure your Anthropic API key in `.env`:
```bash
# Copy template
cp .env.example .env

# Edit .env and insert your real Anthropic API key
# ANTHROPIC_API_KEY=sk-ant-api03-...
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```
*Note: If no `ANTHROPIC_API_KEY` is configured, the core optimizer, maps, and CSV uploads continue to operate with zero degradation; only the AI drawer will display an honest "AI features unavailable — no API key configured" notice.*

### 3. Run Automated Test Suite
```bash
python -m pytest -v
```

### 4. Launch Application
```bash
uvicorn app:app --reload --port 8000
```
Open your browser to: **`http://127.0.0.1:8000/`** (Interactive API Swagger Docs: `http://127.0.0.1:8000/docs`).

---

## 7. End-to-End Demo Script (Under 2 Minutes)

1. **One-Click Demo Ingestion:** Click **"Load Bengaluru Demo"** in the top navigation bar or landing screen. 36 delivery zones instantly load with proportional circle markers.
2. **Configure Facilities:** In **Network Configuration**, set warehouse count $p = 3$, site capacity $= 4,000$ orders/day, and select **"Cost Focus"** priority preset. Observe the live summary update: *"Planning a 3-warehouse network serving 36 delivery zones with 12,000 orders/day capacity."*
3. **Run Optimization:** Click **"Run Network Optimization"**. Within 1–2 seconds, the MILP solver returns the proven optimal 3-facility network.
4. **Inspect Centerpiece Map:** In **Optimization Results**, view selected warehouses (custom building pins), cluster assignment spider lines, and translucent service radius rings.
5. **Review Demand-Weighting Explainer:** Inspect the live dynamic panel showing why high-demand zones (e.g. Koramangala, 420 orders) exert greater mathematical pull than low-demand zones (e.g. Kengeri, 150 orders).
6. **Inspect "Why this location?":** Select a warehouse in the intelligence tab to review its assigned volume, capacity utilization %, top 3 demand drivers, and the **score gap of the runner-up rejected candidate**.
7. **Evaluate Trade-off Curve:** Switch to **Analytics & Trade-off** to review the diminishing returns curve ($p = 1 \dots 5$) balancing delivery distance reduction against fixed facility leases.
8. **Run Disruption Test:** Switch to **Disruption & Resilience** or **Scenario Lab** and click **"Festival Surge (+50%)"** or simulate a warehouse outage to test network resilience and automatic load reassignment.
9. **Tactical CVRP Routes:** Switch to **Tactical Fleet (CVRP)** to review turn-by-turn vehicle tours and vehicle payload utilization.

---

## 8. Transparency, Terminology & Honesty Rules

- **Distance Metric:** All straight-line distances are explicitly labeled **"Geographic delivery distance"** ($R \approx 6371\text{ km}$, Haversine formula) — never implied to be exact road distance.
- **Baseline Benchmark:** Comparisons are explicitly labeled **"Single-Warehouse Reference Baseline vs Optimized Network"** (computed dynamically from the 1-median facility center).
- **Cost & Emissions Estimates:** All financial figures and carbon metrics carry visible **`[Estimate]`** tags and show their calculation assumptions nearby.
- **Fast Delivery Proxy:** Fast delivery coverage is explicitly labeled **"Distance-based service proxy"** (% of demand within 5 km) — never guaranteeing delivery time SLAs.
- **No Fake AI:** The "Why here?" explainability panel is generated strictly from real solver metrics, objective gradients, and candidate score gaps.
- **Real-Geodata Sampler & Synthetic Demand:** Demonstration networks never hallucinate random coordinates or non-existent places with an LLM. State networks sample distinct real towns from `dr5hn/countries-states-cities-database` (`[Real Towns, Synthetic Demand]`); single-city networks jitter derived demo zones around a real city anchor (`[Real City Anchor, Jittered Zones & Synthetic Demand]`). Demand is clustered deterministically with NumPy, while LLM involvement is strictly constrained to parsing plain-language user requests into structured parameters.

---

## 9. Mandatory Hackathon AI Usage Disclosure

*In compliance with Hackathon Rule §17 on AI Transparency and Integrity:*

### Team-Authored Independent Engineering & Creative Contribution:
- **Problem Formulation & Strategy:** Formulation of the Capacitated Facility Location Problem (CFLP) and coupling with tactical CVRP vehicle routing for quick-commerce operations.
- **Mathematical Modeling:** Formulation of decision variables ($y_j, x_{i,j}$), objective functions, capacity constraints, service radius limits, and demand-weighting terms ($\sum d_i D_{i,j} x_{i,j}$).
- **Operations Research Architecture & Live Solver:** Design of the in-browser exact branch-and-bound CFLP engine (`cflpEngine.ts`) with Min-Cost Flow (Successive Shortest Path) leaf assignment, lower bound bounding, symmetry breaking, and anytime fallback guarantees.
- **Optimization Architecture & Solver Bindings:** Designing the PuLP/CBC solver interface, presolve feasibility validation rules, iterative no-good cuts ranking engine, and the greedy + 2-opt local search heuristic fallback.
- **Explainability & Metrics Design:** Defining the "Why here?" candidate score gap algorithm, demand-driver breakdown, Single-Warehouse Reference Baseline comparison methodology, and real-time topology diff detection.
- **Geospatial & Road Routing Architecture:** Architecting the OSRM table matrix integration with chunked coordinate queries, coordinate-pair caching, 1.34× detour factor fallbacks, and keyless Photon geocoding search.
- **Integration, Ground Truth & Testing:** Authoring test suites (66 Vitest frontend tests including 500-instance exactness proof and 200-edit sub-millisecond benchmarks; 64 backend pytest tests), validating backend routes against live OR-Tools and CBC binaries, and establishing verification benchmarks.

### AI Coding Assistant Utilization (UI Polish & Modernization):
- **B2B SaaS UI Polish & Modernization:** Implementation of the React 18 + TypeScript + Tailwind CSS application shell, Radix UI collapsibles, and responsive layouts across 375px mobile, 768px tablet, and 1280px desktop.
- **Currency Conversion Architecture:** Implementation of `src/lib/currency.ts` (`FX_INR_PER_USD = 85`, `formatMoney` with compact Crore/Lakh and Million/Thousand notation, `convertInput` round-trip sanitization, and accessible header toggle).
- **Zero Cold-Start & Micro-Interactions:** Automated initial mount execution, skeleton state design, KaTeX math formula rendering bar, and animated Capacity Headroom progress bar.
- **Resilience Engineering:** 4-second timeout failover to bundled precomputed JSON fixtures, OSRM cache invalidation, and non-blocking toast/inline notification handling.

---

## 10. Credits & Open Source Acknowledgements

GRIDPOINT is built upon open data, open-source mathematical solvers, and community-driven geospatial tools. We gratefully acknowledge the following projects and resources:

### Open Data & Geographic Sources
- **[dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database)** (mirrored as `liewyousheng/geolocation` on Kaggle): Comprehensive open-source global geodata repository (licensed under the [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/)). Filtered and utilized in `data/cities_geodata.csv` for GRIDPOINT's deterministic real-geodata sampler (4,198 real cities/towns across Indian states and territories).
- **[OpenStreetMap (OSM)](https://www.openstreetmap.org/)**: Geographic coordinate reference data and locality centroids for Bengaluru metropolitan wards and urban hubs (licensed under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/)).
- **[CARTO Base Maps (Positron & Dark Matter)](https://carto.com/basemaps/)**: Open-access map tile services used for rendering the interactive Leaflet centerpiece map and cluster assignment spider lines (Map tiles © CARTO, Data © OpenStreetMap contributors).
- **[Bruhat Bengaluru Mahanagara Palike (BBMP) Open Data & Census of India](https://bbmp.gov.in/)**: Urban ward boundaries, commercial density patterns, and population distributions that informed the realistic demand volumes and clustering parameters in `demo_neighborhoods.csv`.
- **[Project-OSRM (Open Source Routing Machine)](http://project-osrm.org/)**: Road network routing abstractions and distance matrix protocols informing the geospatial matrix routing layer.

### Open-Source Solvers & Computational Libraries
- **[COIN-OR CBC (Coin-or branch and cut)](https://github.com/coin-or/Cbc)**: High-performance open-source Mixed Integer Linear Programming (MILP) solver used to compute optimal facility locations for the Capacitated Facility Location Problem (CFLP).
- **[PuLP](https://github.com/coin-or/pulp)**: Python linear programming modeler (BSD License) used to formulate the CFLP objective and constraints.
- **[Google OR-Tools](https://developers.google.com/optimization)**: Combinatorial optimization library (Apache 2.0 License) used for multi-stop vehicle tour optimization in the Capacitated Vehicle Routing Problem (CVRP).
- **[Pandas](https://pandas.pydata.org/) & [NumPy](https://numpy.org/)**: Open-source data manipulation, validation, and vectorized geospatial distance matrix computing (BSD License).

### Frontend Geospatial & UI Libraries
- **[Leaflet.js](https://leafletjs.com/)**: Leading open-source JavaScript library for mobile-friendly interactive maps (BSD 2-Clause License).
- **[Chart.js](https://www.chartjs.org/)**: Simple yet flexible JavaScript charting library for designers and developers (MIT License).
- **[Lucide Icons](https://lucide.dev/)**: Clean, consistent icon set for user interface actions and status indicators (ISC License).
- **[Google Fonts (Inter & JetBrains Mono)](https://fonts.google.com/)**: High-legibility typography designed for user interfaces and data-dense operational displays (SIL Open Font License).

### Backend & Testing Frameworks
- **[FastAPI](https://fastapi.tiangolo.com/) & [Starlette](https://www.starlette.io/)**: Modern, fast web framework for building APIs with Python (MIT License).
- **[Uvicorn](https://www.uvicorn.org/)**: Lightning-fast ASGI server implementation (BSD-3-Clause License).
- **[Pydantic](https://docs.pydantic.dev/)**: Data validation and settings management using Python type annotations (MIT License).
- **[Pytest](https://pytest.org/) & [HTTPX](https://www.python-httpx.org/)**: Robust testing frameworks for Python (MIT & BSD Licenses).

