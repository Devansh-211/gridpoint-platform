# Backend Diagnosis & Root Cause Analysis

## Executive Summary
This document contains the diagnostic findings and empirical evidence for the observed failures of `/api/rank` (HTTP 500) and `/api/optimize` on the GridPoint backend, tested locally on Windows and against the live Vercel deployment (`https://gridpoint-platform.vercel.app`).

---

## Empirical Verification Summary (Phase 0)

1. **Environment Versions**:
   - Python: `3.13.7` (Windows AMD64)
   - PuLP: `2.9.0` (bundled CBC binary `PULP_CBC_CMD` verified operational, 2-variable test solve status: `Optimal`, $x=0.0, y=2.5$).
     - *Critical finding*: An unconstrained `pulp>=2.8.0` in `requirements.txt` installs `pulp==4.2.0`, which dropped `PULP_CBC_CMD`, altered `LpVariable` signature, and removed bundled CBC binaries (`listSolvers(onlyAvailable=True) == []`). Pinning `pulp>=2.8.0,<3.0.0` or `pulp==2.9.0` restores CBC binary support.
   - OR-Tools: `9.15.6755`
   - pandas: `3.1.0`
   - numpy: `2.5.4`
   - Test suite baseline: `pytest -v` passes 64/64 tests locally when CBC is present.

2. **Live Deployed API Probing (`https://gridpoint-platform.vercel.app`)**:
   - `GET /api/health` → `HTTP 200 OK`, `x-vercel-id: bom1::iad1::tfnlb-1792938749757-ac58bc3391b5`
     - Response: `{"status":"healthy","solver":"Heuristic Fallback Ready","solver_available":true,"platform":"GRIDPOINT B2B Logistics Optimization","version":"2.0.0"}`
     - Note: Deployed Vercel function did **not** have CBC binary available; it was operating in Heuristic Fallback mode.
   - `POST /api/optimize` with `{session_id: "default", p: 3, cost_per_km: 35, fixed_cost_per_warehouse: 15000, warehouse_capacity: 4000, distanceKm: {}}` → `HTTP 200 OK`, `solver_status: "Feasible (Heuristic Fallback)"`.
   - `POST /api/rank` with the identical payload → `HTTP 500 Internal Server Error`, `x-vercel-id: bom1::iad1::l4brn-1792938759762-baff5fd41b6b`.
     - Output: `Internal Server Error` (plain text 500).

---

## Hypothesis Evaluations (H1 – H9)

### H1. Server-side session dependency on a stateless platform
- **Status**: **CONFIRMED**
- **Evidence**:
  - `SESSION_STORE` is an in-memory dictionary in `api/routes.py` (`SESSION_STORE: Dict[str, Dict[str, Any]] = {}`).
  - In a serverless architecture (Vercel Lambda), each execution environment is ephemeral. Uploading a dataset in one request writes to that specific instance's memory. A subsequent `/api/rank` or `/api/optimize` request routed to a separate cold or concurrent container finds `session_id` missing from `SESSION_STORE`.
  - When `session_id` was missing, `_get_or_load_default_session()` silently fell back to loading `data/demo_neighborhoods.csv`. Any customized zones, live edits, or simulated demand shock (e.g. 12,348 orders/day from an order factor of 1.2 in the UI) were completely lost because `OptimizeRequest` and `RankRequest` did not accept zones or candidate sites directly.
  - Furthermore, if `session_id` was custom and the demo CSV path failed to resolve, it crashed with unhandled errors.

### H2. `distanceKm: {}` (Empty object where matrix expected)
- **Status**: **CONFIRMED (Partial Root Cause & Shape Mismatch)**
- **Evidence**:
  - In `routes.py`, `if req.distanceKm:` evaluates to `False` when `{}` is passed, defaulting to Haversine straight-line distance.
  - However, when the frontend **does** populate `distanceKm`, its shape is `hubs × zones` (`matrix.distancesKm[hId][zId]`), where `hId` is candidate plot IDs (`BLR-PL-01` or `central-depot`).
  - In `optimize_network`, candidate warehouses were initialized as `[WarehouseCandidate(id=n.id, ...) for n in neighborhoods]` (the 36 customer zones). When `optimize_network` queried `matrix.distances_km.get(w.id, {}).get(n.id, 0.0)`, `w.id` was not in the matrix, leading to `0.0 km` distances or misaligned lookups.
  - In `ranking.py`, `build_cand_dist_matrix` checks `c.id in base_matrix.distances_km`, but does not validate non-negative, finite numbers.

### H3. Infeasibility (demand > p × capacity, radius violations)
- **Status**: **CONFIRMED**
- **Evidence**:
  - When demand exceeds $p \times \text{capacity}$ (e.g., UI order factor 1.2 yields 12,348 orders/day, while $3 \times 4000 = 12,000$ capacity ceiling), `validate_presolve_feasibility` raises:
    `HTTPException(status_code=400, detail={"error": "Optimization Infeasible", ...})`.
  - In `rank_network` (`api/routes.py`), line 637 executes `base_optimize = optimize_network(req)`. When `optimize_network` raises `HTTPException(400)`, `rank_network` did not catch it.
  - Furthermore, if solver status is `LpStatusInfeasible` (-1), PuLP returns `None` for all variable values. Accessing `pulp.value(y[j]) > 0.5` without checking `prob.status` can throw `TypeError: '>' not supported between instances of 'NoneType' and 'float'`.
  - Hackathon Honesty Rules and system guidelines require returning HTTP 200 with a structured `{status: "infeasible", shortfall_orders: N, min_feasible_p: K, reason: "..."}` response rather than throwing exceptions or returning 500.

### H4. Validation / Alias Mismatches
- **Status**: **CONFIRMED**
- **Evidence**:
  - Frontend sends `max_alternatives: 4`, but `RankRequest` in `api/schemas.py` lacked the `max_alternatives` field.
  - In `OptimizeRequest`, `p` had no upper bound check against candidate count. If $p > \text{candidate count}$, PuLP model formulation enforces $\sum y_j = p$, which is structurally impossible when $p > M$, causing an immediate solver infeasibility crash.
  - Field casing: frontend sends `distanceKm` (camelCase). `OptimizeRequest` had `distanceKm: Optional[...]` but lacked Pydantic configuration (`populate_by_name = True`) for snake_case / camelCase interoperability.

### H5. Objective & Units Mismatch between Backend and Frontend
- **Status**: **CONFIRMED**
- **Evidence**:
  - Frontend worker (`src/solver/cflpEngine.ts`):
    - Delivery transit cost: $\sum_{i, j} \text{orders}_i \times \text{road\_km}_{ji} \times \text{cost\_per\_km} \times \text{fraction}_{ij}$
    - Facility lease cost: $\sum_{j \in \text{open}} \text{daily\_lease}_j$
    - Total cost: $\text{transit cost} + \text{lease cost}$ (INR/day)
    - Supports fractional flow assignment (split assignment).
  - Backend (`optimization/cflp.py`, `api/routes.py`, `optimization/ranking.py`):
    - Divided `cost_per_km` by `50.0` (`(cost_per_km / 50.0)`) assuming an arbitrary 50 orders/vehicle batch factor.
    - In manual mode (`auto_size=False`), `cflp.py` only minimized raw order-km without lease cost, but `routes.py` added lease cost post-hoc.
    - `cflp.py` enforced binary single assignment ($x_{ij} \in \{0, 1\}$).
    - Result: A 50x discrepancy between frontend worker objective and backend CBC objective, causing `CBC Verification Discrepancy` in `useOptimizationPipeline.ts` (worker objective vs CBC objective mismatch > 1e-4).

### H6. Ranking Module Internals (`optimization/ranking.py`)
- **Status**: **CONFIRMED (Primary Root Cause of Live 500)**
- **Evidence**:
  - On the deployed live site, `GET /api/health` showed `"solver": "Heuristic Fallback Ready"`, meaning CBC was **not** available.
  - In `api/routes.py`, `optimize_network` wraps solver invocation in a `try...except (SolverUnavailableError, Exception)` block and falls back to `solve_cflp_heuristic`.
  - In `optimization/ranking.py`, `solve_cflp_with_constraints` (line 161) calls:
    `solver = get_milp_solver(time_limit_sec=time_limit_sec, msg=0)`
    **without any `try/except` for `SolverUnavailableError`!**
  - When CBC is unavailable, `get_milp_solver()` raises `SolverUnavailableError("No CBC MILP solver detected...")`.
  - In `ranking.py`, line 282 and worker threads at line 365 call `solve_cflp_with_constraints`. When `f.result()` is accessed in `ThreadPoolExecutor` (line 399), `SolverUnavailableError` is re-raised uncaught in `rank_network`.
  - FastAPI has no custom handler for `SolverUnavailableError`, converting it directly into **HTTP 500 Internal Server Error**!
  - In addition, ranking shared PuLP model copies across threads without per-solve isolated temp directories, causing race conditions when CBC write files collided.

### H7. Serverless Runtime Constraints (Vercel)
- **Status**: **CONFIRMED**
- **Evidence**:
  - On Vercel, the default filesystem is read-only except `/tmp`. PuLP's `PULP_CBC_CMD` writes temporary MPS/LP problem files to current directory or system temp by default unless directed to `/tmp`.
  - Vercel's Python serverless bundle limit is 250 MB uncompressed (or 50 MB zipped). Bundling heavy unpinned libraries or compilation artifacts risks exceeding bundle limits.
  - Python versions: Vercel standard Python runtime is Python 3.9/3.10/3.12. Python dependencies must be strictly pinned.

### H8. Data Loading & Relative Path Resolution
- **Status**: **CONFIRMED**
- **Evidence**:
  - In `api/routes.py` line 80:
    `csv_path = "data/demo_neighborhoods.csv" if os.path.exists("data/demo_neighborhoods.csv") else "data/sample_neighborhoods.csv"`
  - This relies on `os.getcwd()`. When executed from any directory other than repository root (e.g., inside `/api` on Vercel), `os.path.exists()` returns `False`, causing `pd.read_csv("data/sample_neighborhoods.csv")` to raise an unhandled `FileNotFoundError`, surfacing as HTTP 500.
  - Paths must be anchored to `Path(__file__).resolve().parent.parent / "data" / "demo_neighborhoods.csv"`.

### H9. CORS & Base URL Routing
- **Status**: **REFUTED as Cause of 500**
- **Evidence**:
  - The live frontend uses same-origin relative `/api/rank` and `/api/optimize` URLs rewritten via `vercel.json` (`/api/(.*)` → `/api/index.py`).
  - Responses carry `Vary: Origin` and CORS middleware is configured in `app.py`. Network inspection confirms requests reach the FastAPI router and return 200 or 500 status codes directly from the application.

---

## Action Plan for Phase 2 Fixes
1. **Stateless Request Model**: Allow optional `zones` and `candidates` in `OptimizeRequest` and `RankRequest`. Precedence: request body → session store → bundled demo dataset.
2. **Robust Distance Matrix Parsing**: Gracefully treat `null`, `{}`, `[]` as absent; compute Haversine × detour matrix. Validate provided matrices for non-negative, finite numbers and support `[hubId][zoneId]` orientation.
3. **Structured Outcomes (No 500s or Infeasible Exceptions)**:
   - Return HTTP 200 with `status: "infeasible"`, `shortfall_orders`, `min_feasible_p`, `reason` when capacity or radius is violated.
   - Return HTTP 200 with `status: "time_limit"` or `"not_optimal"` on solver timeout.
4. **Resilient Ranking & Heuristic Fallback**:
   - Wrap `get_milp_solver()` in `ranking.py` with heuristic fallback when CBC is unavailable or fails.
   - Support `time_budget_s` and graceful `partial: true` alternative sets.
5. **Objective Function Parity**:
   - Align backend transit cost with frontend: $\sum \text{orders}_i \times \text{dist}_{ji} \times \text{cost\_per\_km} \times x_{ij}$.
   - Support optional `assignment_mode: "split" | "single"` (default single, matching existing).
6. **Robust File Paths & Serverless Temp Config**:
   - Anchor all data file lookups to `Path(__file__).resolve().parents[...]`.
   - Set PuLP/CBC temp directories to `tempfile.gettempdir()` / `/tmp`.
7. **Enhanced Health Endpoint**:
   - Return comprehensive JSON with python, pulp, cbc_available, ortools_available, data_available, and status `healthy` or `degraded`.
