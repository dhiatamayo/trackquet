# Changelog

All notable changes to Trackquet are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.3.1] — 2026-07-01

### Fixed

- **Mobile court selector** — replaced number input with large tap-friendly +/− buttons; increment/decrement spinners were invisible on Android Chrome

---

## [0.3.0] — 2026-07-01

### Added

#### Match Tracker
- **Full match session management** — create, view, update, and delete organized match sessions with multiple matchmaking formats
- **6 matchmaking formats** — Americano, Mexicano, Super Mexicano, Team Americano, Mixed Americano, Team Mexicano
- **Court-aware scheduling** — specify number of courts; matchups are distributed so players rotate with sit-outs and play counts stay balanced (±1 match)
- **Odd player support** — Americano and Mixed Americano work with odd player counts; team formats still require even
- **Per-matchup timing** — start/finish buttons on each individual matchup with a live running timer
- **Live leaderboard** — cumulative points, point differential, and tiebreaker ranking (point diff → head-to-head)
- **Score validation** — enforces win conditions (points-based or set-based) on score entry
- **Add player mid-session** — add a new player to an active session; new matchups are generated and shuffled with unplayed ones
- **Auto-assigned court numbers** — courts cycle 1..N across matchups in each round
- **Delete match session** — with confirmation dialog and full cascade delete
- **Home page navigation** — new landing page with "My Racquets" and "My Matches" cards
- **Context-aware breadcrumbs** — Layout shows correct page title based on route

#### Backend
- **4 new GORM models** — MatchSession, MatchPlayer, Matchup, MatchupPlayer with auto-migration
- **11 REST API endpoints** — full CRUD for sessions, matchups, leaderboard, timing, and player management
- **Property-based tests** — 11 PBTs covering schedule completeness, tiebreaker ordering, score validation, gender constraints, and more
- **Integration tests** — CRUD flow, cascade delete, user isolation, score recalculation, round generation

#### Frontend
- **7 new components** — CreateMatchModal, PlayerInput, ScoreInput, Leaderboard, DrawSchedule, MatchupDetailModal, Home
- **3 new pages** — Home, MatchList, MatchSessionDetail
- **Match API client** — typed functions for all match endpoints

---

## [0.2.7] — 2026-06-21

### Fixed

#### Session Logging
- **PostgreSQL duplicate key on session insert** — the `sessions` table's `id` sequence had drifted behind the actual max ID (likely from a prior data migration), causing `duplicate key value violates unique constraint "sessions_pkey"` (500 error) when creating new sessions.
- **Added startup sequence sync** — new `fixPostgresSequences()` runs on every PostgreSQL startup, resetting primary key sequences for all tables (`users`, `racquets`, `string_records`, `sessions`, `string_presets`) to `MAX(id) + 1`. Prevents this class of bug from recurring after any future data import or migration.

---

## [0.2.6] — 2026-06-19

### Fixed

#### String Record Usage Tracking
- **Delete session not decrementing `total_minutes` on PostgreSQL** — the `DeleteSession` handler used `MAX(0, total_minutes - ?)` which is valid SQLite scalar syntax but not valid PostgreSQL (where `MAX` is aggregate-only). The expression silently failed on Postgres, leaving `total_minutes` stale after session deletion. Replaced with Go-side computation that works on both databases.

---

## [0.2.5] — 2026-06-19

### Changed

#### Infrastructure
- **Database migration: Render Postgres → Neon** — removed the Render-managed `databases` section from `render.yaml`. `DATABASE_URL` is now set manually (pointing to Neon free-tier Postgres with no 90-day expiry).

#### Backend
- **Added `godotenv`** — `.env` file is now auto-loaded on startup via `github.com/joho/godotenv`. Previously, environment variables in `.env` were silently ignored by the Go runtime, causing local runs to fall back to SQLite even when `DATABASE_URL` was set in the file.

### Fixed

#### Monthly Report
- **Clay theme milestone overflow** — tightened spacing (header, stat rows, divider, racquet usage, milestone rows) so all 4 milestones fit within the 640px card height without overlapping the footer. Plus Jakarta Sans has slightly larger metrics than the previous Georgia serif.
- **Clay theme label inconsistency** — renamed "Racquets in Play" → "Racquet Usage" and "Season Highlights" → "Milestones" to match Aurora, Neon, and Frost themes.

---

## [0.2.4] — 2026-06-19

### Changed

#### Typography
- **Custom font: Plus Jakarta Sans** — replaced the default Tailwind system font stack with [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (variable, weights 200–800) loaded from Google Fonts. Applied globally via Tailwind's `fontFamily.sans` override.
- **Monthly Report story cards** — all four themes (Aurora, Neon, Clay, Frost) now render in Plus Jakarta Sans instead of the previous Inter/Georgia fallbacks. The Clay theme no longer uses a serif font.
- **PNG export font embedding** — changed `html-to-image` config from `skipFonts: true` to `skipFonts: false` so the custom font is inlined into exported story card PNGs.

---

## [0.2.2] — 2026-06-17

### Added

#### Match Tracking
- **Match type support** — added `match_type` (`singles` / `doubles`) on sessions across backend models, handlers, and frontend types/forms.
- **Separate win metrics on racquet detail** — Racquet Detail now shows dedicated Singles and Doubles win-rate cards.

### Changed

#### Monthly Report
- **Separate win rates per match type** — story cards now display Singles and Doubles win rates instead of one combined win-rate value.
- **Neon/Frost card density tuning** — tightened spacing and panel sizing in upper sections so milestones and footer fit in PNG export without using scrollable containers.

#### API
- `MonthlyReportResponse` now includes per-type fields: `win_rate_singles`, `win_rate_doubles`, `total_wins_singles`, `total_wins_doubles`, `total_matches_singles`, `total_matches_doubles`.
- `RacquetResponse` now includes per-type fields: `win_ratio_singles`, `win_ratio_doubles`, `total_matches_singles`, `total_matches_doubles`, `win_matches_singles`, `win_matches_doubles`.

### Fixed

#### Win-Rate Accuracy
- **Forced-stop exclusion** — matches with empty `match_result` are excluded from all win-rate calculations (racquet-level and monthly report), preventing inflated or distorted percentages.

---

## [0.2.1] — 2026-06-02

### Fixed

#### Monthly Report
- **Score-margin milestone sorting** — Biggest Win and Hardest Loss now rank by total set-game margin (e.g. `6-0` outranks `7-5`). Scored matches always rank above unscored ones; unscored matches fall back to duration ordering.
- **Milestone cap reduced to 4** — report now returns exactly 4 milestones (Biggest Win, Hardest Loss, Longest Match, Longest Training), down from 6. Removed the "Notable Win" and "Notable Loss" secondary entries.
- **Longest Match always reflects true longest** — the Longest Match milestone now always shows the overall longest match session, even when that session also holds the Biggest Win or Hardest Loss tag (it will appear twice with different tags).
- **Aurora card milestone overflow** — added `.slice(0, 4)` on the Aurora theme's milestone list, matching the other three themes and preventing overlap with the footer.
- **Neon theme title** — corrected "Monthly Performance" to "Monthly Wrap-Up" for consistency across all four themes.
- **Modal scroll on mobile** — both the Monthly Report modal and the Log Session modal now use the `overflow-y-auto` + `min-h-full` pattern, preventing the dialog from clipping behind the browser URL bar on mobile.

#### Story Card PNG Export
- **Switched to `html-to-image`** — replaced `html2canvas` with `html-to-image` (SVG `foreignObject` renderer). Eliminates text-shift and clipping artefacts caused by `html2canvas` miscomputing paint coordinates inside flex containers, affecting milestone rows, racquet usage bar, and the footer on all four themes.

#### Testing
- Updated `report_test.go` to reflect new 4-milestone logic: score-based assertions, no "Notable Win"/"Notable Loss" tags, and updated duplicate check to allow the same session to appear with two different tags.

---

## [0.2.0] — 2026-06-01

### Added

#### Monthly Report
- **Monthly Report panel** on the Dashboard — year/month selects and a Generate button fetch an aggregated stats summary for the selected month.
- **Shareable Story Card** — 9:16 vertical card rendered at 360×640 on-screen and exported at 1080×1920 (html2canvas scale:3) as `trackquet-{month}-story.png`.
- **4 visual themes** — Aurora (dark indigo/purple gradient), Neon (cyberpunk black/magenta/cyan), Clay (warm amber/dark brown serif), Frost (clean white minimal). Switched via a row of emoji+label buttons in the modal header.
- **Export to PNG** — downloads the story card as a full-resolution PNG.
- **Share Story** — Web Share API with title, text, and PNG file; guarded by `navigator.canShare({ files })` and degrades gracefully when unsupported.
- **Stats displayed** — total sessions, total hours, avg min/session, win rate (matches only), top 3 racquets by session count with usage bars, up to 6 session milestones (Best Win, Worst Loss, Longest Match, Longest Training, Most Recent Win, Most Recent Loss).

#### API
- `GET /api/reports/monthly?year=YYYY&month=MM` — returns `MonthlyReportResponse` with total sessions, hours, win rate, `RacquetUsageStat` array (ranked by session count), and `NotableSession` array (up to 6 milestones) for the authenticated user.

#### Testing
- `backend/handlers/report_test.go` — 12 unit tests covering: no racquets, no sessions in month, totals/avg/win-rate aggregation, milestone win/loss ordering, longest match vs. longest training split, no-duplicate milestone check, invalid query params (4 sub-cases), racquet usage ranking.

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
