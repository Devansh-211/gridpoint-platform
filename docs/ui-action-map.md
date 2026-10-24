# GridPoint UI Action Map & Phase 0 Diagnosis

## 1. Phase 0 Root Cause & Architectural Diagnosis
- **CULPRIT COMMIT**: `db1026a` ("feat: revamp UI to match design blueprints for Demand Map and Network Configuration").
- **DIAGNOSIS**:
  1. The redesign in `db1026a` introduced static mockup markup into `static/index.html` and `static/app.js` using hardcoded values directly copied from the design screenshot ("10,240", "420 ord/day", "+6.4% baseline surge", "Cloud Engine v4.2 99.98%").
  2. The true React application in `src/` remained structured as a single-page vertical scroll (`src/App.tsx`), lacking the 256px sidebar app shell, the hash-based route architecture (`#/overview`, `#/map`, `#/config`, `#/solvers`, `#/scenarios`, `#/fleet`), and the segmented view hierarchy shown in the reference blueprints.
  3. Consequently, navigation controls led nowhere or were dead in the React application, controls were fragmented between the two frontends, and layout defects (wrapped badges, sidebar cutoff, lack of page header bands, hardcoded sample data) persisted.
- **REBUILD OBJECTIVE**:
  Rebuild the entire presentation and navigation layer in React (`src/App.tsx` + dedicated view modules) so it visually matches the reference screenshots with pixel precision, while binding 100% of controls to live store states, the live CFLP branch-and-bound Web Worker, CBC verifier, OSRM road matrix service, and dynamic currency conversions.

---

## 2. Comprehensive UI Action Map

| # | Screen / Location | Control Name | Visual Spec Source | Intended Store Action / API / Worker Message | Pre-Fix Status | Rebuild Fix |
|---|---|---|---|---|---|---|
| 1 | **Sidebar** | Brand Home / Logo | Screenshot 1 & 2 | Navigates to `#/overview` (Hash Router) | Non-functional in React shell | Wrap in hash link `#/overview` with keyboard accessibility |
| 2 | **Sidebar** | "Overview" Nav Item | Screenshot 1 & 2 | Route: `#/overview`. Sets `activeRoute='overview'`. Renders Overview view | Missing in React shell | Hash router route rendering Overview hero, KPI cards, headroom, Why GridPoint |
| 3 | **Sidebar** | "Demand Map" Nav Item | Screenshot 1 | Route: `#/map`. Sets `activeRoute='map'`. Renders Demand Map view | Missing in React shell | Active styling via route (`aria-current="page"`), renders interactive Leaflet map & Zone Inspector |
| 4 | **Sidebar** | "Network Configuration" Nav Item | Screenshot 2 | Route: `#/config`. Sets `activeRoute='config'`. Renders Constraint Config | Missing in React shell | Renders Sizing Mode, Q_j, R_max, f_j, c_ij, Capacity Card, Candidate Matrix |
| 5 | **Sidebar** | "Optimization & Solvers" Nav Item | Screenshot 1 & 2 | Route: `#/solvers`. Sets `activeRoute='solvers'`. Renders Solver Transparency | Missing in React shell | Renders Alternatives Leaderboard, Verified badge, MIP gap/status, solve times |
| 6 | **Sidebar** | "Scenario Lab" Nav Item | Screenshot 1 & 2 | Route: `#/scenarios`. Sets `activeRoute='scenarios'`. Stress testing | Missing in React shell | Dedicated scenario stress testing sandbox (demand surge, cost shock, hub outage) |
| 7 | **Sidebar** | "Tactical Fleet" Nav Item | Screenshot 1 & 2 | Route: `#/fleet`. Sets `activeRoute='fleet'`. Fleet vehicle sizing | Missing in React shell | Dedicated fleet dispatch & vehicle allocation view derived from optimal assignments |
| 8 | **Sidebar Bottom** | "Settings" Button | Screenshot 1 & 2 | Opens Workspace Settings dialog (defaults, solver timeout, theme) | Dead | Radix Dialog with preferences and storage inspection |
| 9 | **Sidebar Bottom** | Engine Status Pill | Screenshot 1 & 2 | Live `/api/health` status + latency (no fake 99.98% uptime) | Fake text | Live status: `CBC Online • {solve_ms}ms` polling every 30s |
| 10 | **Header** | Dataset Selector Chip | Screenshot 1 & 2 | Dropdown menu: Bengaluru Demo, Upload CSV, Reset Dataset | Static text | Radix DropdownMenu with dataset switcher, upload trigger, and zone count |
| 11 | **Header** | Solver Telemetry Chip | Screenshot 1 & 2 | Real solver status from `/api/health` + solve latency | Static text | Live polling status pill with retry trigger if offline |
| 12 | **Header** | Currency Pill (`₹ INR \| $ USD`) | Screenshot 1 & 2 | `handleCurrencyChange(newCurr)`, updates `localStorage`, formats all money | Only in pre-redesign header | Top header toggle with keyboard navigation (arrows/enter) and instant format update |
| 13 | **Header** | "Load Preset" Button | Screenshot 1 & 2 | Opens Preset Menu: Cost-Focus, Quick-Commerce, Low-CO2, Surge | Static button | Popover/DropdownMenu with preset loader & localStorage saved presets |
| 14 | **Header** | "Run Optimizer" Button | Screenshot 1 & 2 | Dispatches `executeLiveSolve(zones, hubs, p)` with 5s watchdog | Partial | Connected with live progress spinner, disabled only while solve in-flight |
| 15 | **Header** | Notification Bell | Screenshot 1 & 2 | Popover event log: solve completion, verification result, OSRM fallback | Dead icon | Popover showing chronological operational telemetry events |
| 16 | **Header** | User Avatar Menu | Screenshot 1 & 2 | Menu: Reset Demo Data, Data Sources & Privacy, About GridPoint | Dead icon | Radix DropdownMenu with reset action and system details |
| 17 | **Demand Map** | KPI 1: Total Order Volume | Screenshot 1 | Computed: sum of `effectiveOrders(z)`. Trend vs baseline | Hardcoded "10,240" | Real store calculation from `zones`, trend computed dynamically |
| 18 | **Demand Map** | KPI 2: Peak Demand Zone | Screenshot 1 | Max demand zone name, orders, and dynamic "High Load" threshold chip | Hardcoded "Koramangala" | Calculated from `zones.reduce((max, z) => ...)` |
| 19 | **Demand Map** | KPI 3: Average Hub Radius | Screenshot 1 | Demand-weighted average road km to assigned hubs vs SLA | Hardcoded "4.8 km" | Dynamically computed from `solverOutput.assignments` and matrix distances |
| 20 | **Demand Map** | KPI 4: Active Layers Checkboxes | Screenshot 1 | Toggles Heatmap, Centroids, Voronoi, Candidates on map | Dead checkboxes | State hooks `showHeatmap`, `showCentroids`, `showVoronoi`, `showCandidates` |
| 21 | **Demand Map** | Map Zoom & Fullscreen | Screenshot 1 | Zoom In (+), Zoom Out (-), Toggle Fullscreen | Unbound | Connected to Leaflet map instance and fullscreen API |
| 22 | **Demand Map** | Coordinate / Scale Readout | Screenshot 1 | Real-time map center coordinates & zoom/scale | Hardcoded numbers | Leaflet `moveend` and `zoomend` event listeners updating readout |
| 23 | **Demand Map** | Demand Map Canvas | Screenshot 1 | Leaflet map with candidate pins, demand centroids, and voronoi partition | Static in mockup | `NetworkMap` integration with layer groups and invalidateSize on layout change |
| 24 | **Demand Map** | Zone Inspector ID & Name | Screenshot 1 | Displays selected zone ID (e.g. ZN-BLR-04) and name | Hardcoded | Connected to `selectedZone` state |
| 25 | **Demand Map** | Zone Inspector Orders Editor | Screenshot 1 | Inline input or stepper to adjust orders, re-solving live | Static text | Connected to `handleUpdateZoneDemand` with debounced solve trigger |
| 26 | **Demand Map** | Zone Inspector Hub & Dist | Screenshot 1 | Shows assigned hub, Haversine km, OSRM road km, and road factor | Hardcoded | Computed dynamically from active matrixResult and assignments |
| 27 | **Demand Map** | Intraday Demand Profile | Screenshot 1 | Modelled hourly profile scaled to zone orders with peak hour | Static bars | Recharts/SVG bar chart scaled via documented hourly distribution constant |
| 28 | **Demand Map** | "Reassign Zone Hub" Button | Screenshot 1 | Opens Reassign Hub Dialog with candidate picker and cost delta | Dead button | Radix Dialog with `evaluatePinned` worker delta and pin/unpin action |
| 29 | **Demand Map** | Zone Breakdown Search Filter | Screenshot 1 | Debounced text filter filtering table rows by neighborhood | Dead input | Bound to `filterText` state filtering `zones` |
| 30 | **Demand Map** | Zone Breakdown Pagination | Screenshot 1 | Page size select & Prev/Next buttons | Static text | Real pagination hook (`page`, `pageSize`, `totalPages`) |
| 31 | **Demand Map** | Export CSV Button | Screenshot 1 | Generates and downloads currency-aware CSV of delivery zones | Dead button | Calls `exportZonesCsv(zones, currency)` respecting current filter |
| 32 | **Network Config** | Page Header: Reset Defaults | Screenshot 2 | Resets $p$, capacity, radius, lease, transit cost to defaults | Dead button | Confirmation dialog + resets state to default constants |
| 33 | **Network Config** | Page Header: Save Preset | Screenshot 2 | Prompts for preset name and saves current parameters to localStorage | Dead button | Modal prompt saving to `gridpoint_user_presets` in localStorage |
| 34 | **Network Config** | Run Branch-and-Cut Button | Screenshot 2 | Triggers exact CFLP solve pipeline and switches to results view | Dead button | Executes `executeLiveSolve()` with progress indicator |
| 35 | **Network Config** | Optimization Sizing Mode | Screenshot 2 | Segmented toggle: Exact Count ($p$) vs Auto-Size ($p^*$) | Static UI | State toggle `autoSize`, enables/disables $p$ stepper |
| 36 | **Network Config** | Warehouse Count ($p$) Stepper | Screenshot 2 | Stepper `-` / `+` and slider bounded by candidate count | Static markup | Controlled inputs updating $p \in [1, N]$ with live solve |
| 37 | **Network Config** | Constraint: Capacity $Q_j$ | Screenshot 2 | Input for per-warehouse capacity cap (orders/day) | Hardcoded "4,000" | Bound to `warehouseCapacity`, validates $Q_j \ge \max(d_i)$ |
| 38 | **Network Config** | Constraint: Radius $R_{\max}$ | Screenshot 2 | Input + toggle for max service radius in km | Hardcoded "25 km" | Bound to `radiusMaxKm`, clamps distances and marks unserved |
| 39 | **Network Config** | Constraint: Fixed Lease $f_j$ | Screenshot 2 | Currency-aware input for warehouse fixed lease | Hardcoded "$300" | Uses `convertInput` / `currencySymbol` with canonical INR storage |
| 40 | **Network Config** | Constraint: Transit Rate $c_{ij}$ | Screenshot 2 | Currency-aware input for dispatch cost per km | Hardcoded "$1.25" | Uses `convertInput` / `currencySymbol` with canonical INR storage |
| 41 | **Network Config** | Priority Objective Cards | Screenshot 2 | 3 selectable cards: Cost Focus, Speed & Proximity, CO2 Abatement | Static cards | Mutual exclusion selection updating solver weights and constraints |
| 42 | **Network Config** | Distance Metric Radios | Screenshot 2 | Radio cards: OSRM Road Network, Road Detour Proxy, Haversine | Static radios | Toggles distance matrix source, updates matrixResult, and re-solves |
| 43 | **Network Config** | Capacity vs Demand Card | Screenshot 2 | Total capacity vs demand, Feasible/Infeasible badge, headroom bar | Hardcoded | Live calculation from `openHubs.length * Q_j` vs `totalDemand` |
| 44 | **Network Config** | Candidate Hub Topology List | Screenshot 2 | Scrollable list of evaluated candidate hubs with utilization | Empty in mockup | Real matrix of candidate hubs with status, regret, and inspect button |
| 45 | **Network Config** | CFLP Integer Program (MIP) | Screenshot 2 | Collapsible KaTeX formula matching exact MIP model | Static block | Accordion containing exact objective and constraints in KaTeX |
| 46 | **Overview** | Hero CTAs & Copy | App Spec | Explore Demand Map CTA, Configure Constraints CTA | Old layout | Hash links to `#/map` and `#/config` with hero metrics |
| 47 | **Optimization** | Verified Badge & Telemetry | App Spec | Live CBC verification status, gap, solve time, and logs | Fragmented | Single dedicated view with verified badge, diff banner, and rank table |
| 48 | **Scenario Lab** | Stress Test Sandbox | App Spec | Demand surge %, fuel cost shock, facility outage simulator | Fragmented | Isolated copy of state simulated through worker with before/after delta |
| 49 | **Tactical Fleet** | Fleet Vehicle Allocation | App Spec | Per-hub vehicle sizing: $\lceil \text{orders}/V_c \rceil$, total road km | Fragmented | Computed dispatch manifest with route counts, vehicle requirements, CSV |
| 50 | **Global** | Undo / Redo Shortcuts | App Spec | Ctrl+Z / Ctrl+Y (Cmd on Mac) undoes/redoes edits | Unbound | Global keyboard listener ignoring inputs, with visible toast feedback |

---

## 3. Phase 0 Safe-Mode Verification & Probe Results

### Safe-Mode Checks
1. **Clear `localStorage` & `IndexedDB`**:
   - `loadSavedNetwork()` cleanly initializes default 36 Bengaluru zones and 6 candidate plots (`createDefaultDemoZones()`, `createDefaultDemoHubs()`).
   - Currency defaults to canonical `'INR'` safely when `gridpoint_currency` is absent.
   - Result: **STABLE (Zero Crash)**.
2. **Web Worker Failure / Route to `/api/optimize`**:
   - When Web Worker is terminated or throws a timeout, `cflpSolver.solve()` catches the rejection and dispatches an HTTP POST request to `/api/optimize`.
   - Result: **VERIFIED PASS** (SolverOutput successfully produced via CBC backend fallback).
3. **Auto-Reoptimize OFF**:
   - When `autoReoptimize === false`, inline order edits update the `zones` state immediately, update arithmetic totals, mark `isStale = true`, and display a "Stale Results - Re-optimize Required" warning banner without firing solver requests.
   - Result: **VERIFIED PASS**.
4. **Map-Click Mode OFF**:
   - When click-to-add mode is toggled off, map clicks do not generate temporary placement markers and do not open the search drawer.
   - Result: **VERIFIED PASS**.
5. **React StrictMode**:
   - Components survive double-mount cycles without duplicate Leaflet container instantiation or dangling Web Worker event listeners.
   - Result: **VERIFIED PASS**.

### Dead-Control Probe Findings
- **Stuck `inert` or `aria-hidden`**:
  - Found: In the previous static mockup shell, when modals or drawers opened, `#root` or container divs had leftover `aria-hidden="true"` or `pointer-events: none` on backdrop unmount if an animation was interrupted.
  - Fix: In the React rebuild, all modals and sheets use controlled `@radix-ui/react-dialog` with explicit `open` / `onOpenChange` handlers that cleanly restore body pointer events on dismiss.
- **Stuck Busy Flags**:
  - Found: If `/api/optimize` or worker solve encountered an unhandled exception, `isSolving` could remain `true`, permanently disabling action buttons.
  - Fix: Single wiring pipeline with `try ... finally { setIsSolving(false) }` and a 5-second timeout watchdog that unconditionally clears the busy flag.
- **Title/Button Collisions**:
  - Found: Page header actions overlapped with titles at viewport widths between 900px and 1100px.
  - Fix: Flex header row with `flex-wrap`, `min-w-0`, and responsive stacking below 1100px.

---

## 4. Comprehensive Verification Results across All 50 Controls

| Category | Total Controls | Current Status | Verification Test Evidence |
|---|---|---|---|
| **App Shell & Global Nav** (#1–#9) | 9 | **OK - Verified** | `src/test/clickEverything.test.tsx` (Route switching, deep links, settings/status) |
| **Top Header Controls** (#10–#16) | 7 | **OK - Verified** | `src/test/clickEverything.test.tsx` (Currency pill, telemetry popover, avatar menu, preset trigger) & `src/test/pipelineResilience.test.ts` (Watchdog reset) |
| **Demand Map KPIs & Overlays** (#17–#23) | 7 | **OK - Verified** | `src/test/DemandMapView.test.tsx`, `src/test/clickEverything.test.tsx` (Esc key, layer toggles) |
| **Zone Inspector & Edit Controls** (#24–#28) | 5 | **OK - Verified** | `src/test/ReassignHubModal.test.tsx`, `src/test/pipelineResilience.test.ts` (Edit totals & loop prevention) |
| **Zone Demand Table Controls** (#29–#31) | 3 | **OK - Verified** | `src/test/ZoneDemandTable.test.tsx` (Filtering, pagination, CSV export, inline orders) |
| **Network Configuration Controls** (#32–#45) | 14 | **OK - Verified** | `src/test/NetworkConfigView.test.tsx`, `src/test/clickEverything.test.tsx` (Sizing mode, steppers, constraints, priority cards, distance radios) |
| **Overview, Solvers, Scenarios, Fleet** (#46–#49) | 4 | **OK - Verified** | `src/test/clickEverything.test.tsx` (Route rendering, scenario controls, fleet calculations) |
| **Global Keyboard & AST Controls** (#50 + Scanner) | 1 + 25 files | **OK - Verified** | `src/test/deadControlScanner.test.ts` (AST verification: 0 dead controls found), `src/test/useOptimizationPipeline.test.ts` |

**All 50 controls from the reference blueprints and functional specifications are verified functional, responsive, and backed by live application logic.**


