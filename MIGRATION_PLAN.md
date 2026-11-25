# Migration plan: Apps Script → Next.js + Supabase

Status: plan only (25 Nov 2026). Nothing in the live app has changed. Students keep using the current Apps Script links until the new version is tested and Dr. Khalid says "switch".

## 1. Why move

The current app (v1.1) works. The move is for:

- **Speed.** Every page now waits for Apps Script, which reads GitHub (cached 5 min) and the Sheet on each load. The master page shows "Loading…" for several seconds.
- **A real teacher login.** Today the master page is protected only by `?key=` in the link. Anyone who gets the link sees every result and can add/edit/remove activities.
- **No Google banner** ("This application was created by a Google Apps Script user").
- **An installable app** on phone and laptop (PWA: "Add to home screen"), one codebase for both.
- **Growth.** A Sheet slows down as results pile up; Postgres doesn't.

What does **not** change for students: same activity pages, no sign-in, no extra button, results still saved silently, offline results still sent later.

## 2. Target stack

| Part | Now | After |
|---|---|---|
| Frontend | `web/home.html`, `web/teacher.html`, served by `doGet` | Next.js (App Router, TypeScript), same look and colours |
| Activity pages | `activities/*.html` from GitHub, or Drive file | Same HTML files, served by a Next.js route that injects `bridge.js` |
| Backend | `Code.gs` (`saveResult`, `getResults`, `addActivity`, …) | Next.js API routes (`app/api/...`) |
| Database | Sheet « French activities — results » (tabs Results, Activities) | Supabase Postgres (tables `results`, `activities`) |
| Uploaded activities | Drive folder « French activities — files » | Supabase Storage bucket `activities` |
| Teacher access | `TEACHER_KEY` in the link | Supabase Auth: email sign-in, only Dr. Khalid's email allowed |
| Hosting | Google | Vercel (free Hobby plan), deploys on every push to `main` |
| Version control | GitHub (this repo) | Same repo |

## 3. Function-by-function mapping

| Code.gs today | New |
|---|---|
| `doGet` → `homePage_` | `app/page.tsx` (student list) |
| `doGet` → `activityPage_(id)` | `app/a/[id]/route.ts`: returns the activity HTML with `bridge.js` and `RRU_ACTIVITY` injected (same as today) |
| `doGet` → `teacherPage_(key)` | `app/teacher/page.tsx`, behind login |
| `saveResult(r)` | `POST /api/results` (public; same clipping rules: name 40, level 120, errors 3000, device 20; unknown activity id rejected; rate limit per device) |
| `getResults(key)` | `GET /api/teacher/results` (teacher only) |
| `getActivities(key)` | `GET /api/teacher/activities` |
| `addActivity(key, meta, html)` | `POST /api/teacher/activities` (file to Storage, row to `activities`) |
| `updateActivity(key, id, patch)` | `PATCH /api/teacher/activities/[id]` |
| `getActivitySource(key, id)` | `GET /api/teacher/activities/[id]/source` (Upgrade checker) |
| `activities_()` merge of `activities.json` + Sheet rows | Same rule: GitHub list + database rows; newest `updated` wins |
| `gh_()` + 5-min cache | Not needed: files are part of the deployment, so a push goes live in ~1 min |
| `refreshNow()` | Not needed |
| `setup()`, `showMyLinks()` | Not needed |

`bridge.js`: only `send()` changes, from `google.script.run.saveResult(r)` to `fetch('/api/results', {method:'POST', ...})`. The `report()` hook, offline queue (`rru_pending_results`), toast and 🎬 video box stay as they are.

`teacher.html` features that move unchanged: stats, activity cards (Copy, Open, Edit, Hide, Videos, Upgrade, Remove/Restore), results with filters and « By student », 2-minute auto-refresh, Feedback / Upgrade / Add-from-link as GitHub issues, NotebookLM video guide, `standard.json` checks.

## 4. Database

```sql
create table activities (
  id text primary key,
  title text, emoji text, topic text, "for" text,
  source text not null check (source in ('github','upload')),
  file_path text,              -- Storage path for uploaded activities
  hidden boolean, removed boolean not null default false,
  video text, short text,
  updated timestamptz not null default now()
);

create table results (
  id bigint generated always as identity primary key,
  created timestamptz not null default now(),
  name text, activity_id text not null, activity_title text,
  level text, score numeric, total int, pct int,
  first int, second int, review int,
  errors text, device text
);
```

Row-level security on: the public can only insert into `results` (through the API route); only the teacher can read anything.

## 5. Steps

| # | Step | Who | Needs laptop? |
|---|---|---|---|
| 1 | Create free accounts: Vercel and Supabase (sign in with GitHub) | Khalid | Yes, once |
| 2 | Create the Supabase project; copy the project URL and keys into Vercel's settings | Khalid, Claude guiding | Yes, once |
| 3 | Build the Next.js app in a `next/` folder of this repo; run the database script; tests | Claude | No |
| 4 | Deploy to Vercel; Khalid tests every page on phone and laptop | Both | No |
| 5 | Switch: post the new student link in Classroom; old Apps Script home page shows "We've moved" with the new link | Khalid decides | No |
| 6 | After a term with no problems: retire Apps Script; keep the Sheet as an archive | Khalid decides | No |

Existing results: 0 attempts so far, so nothing to import. If results exist at switch time, Claude imports the Sheet rows once.

## 6. Limits to know

- **Supabase free plan pauses a project after about 1 week with no activity** (e.g. holidays). Data is kept and it can be resumed from the dashboard. Fix: a small GitHub Action pings the database every 3 days.
- **No automatic backups on the free plan.** Fix: an « Export results (CSV) » button on the master page, plus Supabase's own export. Pro plan ($25/month) adds daily backups; not needed now.
- **This repository is public.** Student names, results and keys must never be committed. Keys live only in Vercel's settings.
- **University Google/Microsoft accounts** may block sign-in emails; use the personal Gmail for the teacher login, as for Apps Script today.
- **Upgrade, Add-from-link and Feedback** still open GitHub issues; Claude processes them as now ("check my app feedback").
