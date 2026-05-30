# Changelog

All notable changes to Trackquet are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-05-30

### Added

#### Match Tracker
- **Session Details modal** — clicking any session row (in Session History or the expanded String History list) opens a detail view showing the full session info. Match sessions expose editable fields directly in the modal; training sessions show a read-only view with an editable Notes field.
- **Match result** — when logging a Match session, a Win / Loss toggle is shown. Result is stored per session and displayed as a badge on session rows.
- **Match score** (optional) — free-text score field on Match sessions (e.g. `6-3, 7-5`). Displayed inline on session rows when set.
- **Opponent's racquet** (optional) — free-text field to record what racquet the opponent used. Enables future pattern analysis (e.g. losses vs spin racquets).
- **Win Ratio stat card** — new sixth stat card on the Racquet Detail page showing `W%` calculated across all match sessions for that racquet (all-time, all strings). Shows the breakdown on hover (e.g. `3W / 2L across 5 matches`).

#### API
- `GET /api/racquets/:id/sessions/:sessionID` — fetch a single session.
- `PUT /api/racquets/:id/sessions/:sessionID` — update notes, match result, score, and opponent racquet.
- `RacquetResponse` now includes `win_ratio`, `total_matches`, and `win_matches` fields.

#### Data model
- `Session` table: new columns `match_result`, `match_score`, `opponent_racquet` (auto-migrated, nullable/empty for existing rows and training sessions).

### Changed
- Session rows in **Session History** are now clickable (opens Session Details). The delete button stops event propagation so it still works independently.
- Session rows inside the **String History** expanded view are also clickable.
- **Log Session modal**: when session type is `match`, a "Match Details" section appears with the result toggle, score, and opponent racquet fields.
- Stats grid on Racquet Detail expanded from 5 to 6 columns to accommodate the Win Ratio card.

### Fixed
- `TestCreateSession_StringRecordAfterRetired` used the hardcoded date `2026-05-25` which became valid (past) after 5 days of real usage, flipping the expected status code. Changed to `2099-12-31` so the test is permanently future-safe.

---

## [0.0.1] — 2026-05-25 *(baseline)*

Initial stable release tagged from `main`. Covers:

- JWT authentication (register / login / me)
- Racquet CRUD with brand, year, head size, weight
- String tracking: single and hybrid (main + cross) setups
- Gauge-based restring threshold auto-calculation (weighted 55/45 for hybrid)
- Session logging: match and training types with duration and notes
- String records history with per-record session breakdown
- Usage bar and string condition status (Good / Declining / Restring!)
- Backdated session support
- Production deployment on Render (health check endpoint, CORS, JWT)
- 87.9% handler test coverage, 100% model test coverage
