# Migration plan: Apps Script → Next.js + Supabase

Status (25 Nov 2026): **step 3 done** — the Next.js app is built in `next/` and tested locally. Waiting for steps 1–2 (Khalid's accounts). Nothing in the live app has changed. Students keep using the current Apps Script links until the new version is tested and Dr. Khalid says "switch".

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
| `doGet` → `homePage_` | `app/route.ts` (serves `web/home.html`) |
| `doGet` → `activityPage_(id)` | `app/a/[id]/route.ts`: returns the activity HTML with `bridge.js` and `RRU_ACTIVITY` injected (same as today) |
| `doGet` → `teacherPage_(key)` | `app/teacher/route.ts` (serves `web/teacher.html`), behind login; `app/login` = email code sign-in |
| `saveResult(r)` | `POST /api/results` (public; same clipping rules: name 40, level 120, errors 3000, device 20; unknown activity id rejected; rate limit per device) |
| `getResults(key)` | `GET /api/teacher/results` (teacher only) |
| `getActivities(key)` | `GET /api/teacher/activities` |
| `addActivity(key, meta, html)` | `POST /api/teacher/activities` (file to Storage, row to `activities`) |
| `updateActivity(key, id, patch)` | `PATCH /api/teacher/activities/[id]` |
| `getActivitySource(key, id)` | `GET /api/teacher/activities/[id]/source` (Upgrade checker) |
| `activities_()` merge of `activities.json` + Sheet rows | Same rule: GitHub list + database rows; newest `updated` wins |
| `gh_()` + 5-min cache | Not needed: files are part of the deployment, so a push goes live in ~1 min |
| `refreshNow()` | Not needed |
| « 📊 Open the Sheet » | « 📊 Export results (CSV) » → `GET /api/teacher/export` (same columns as the Sheet) |
| `setup()`, `showMyLinks()` | Not needed |

`bridge.js`, `home.html`: **not changed at all** (decided while building). `teacher.html`: only the 📧 additions below, shown only when the new app sets `DATA.features`, so the Apps Script master page looks and works as before. The new app adds a small adapter (`RUN_SHIM` in `next/lib/html.ts`) that provides `google.script.run` and turns each call into a `fetch()` to the matching `/api` route. So the same files serve both apps during testing, and every future change to them reaches both. The few Apps Script words on the master page (« Open the Sheet », « Drive », « keep this link private ») are swapped when the new app serves it (`TEACHER_WORDING`); a test fails if one of them is no longer found. Old links keep working: `/?a=<id>` → `/a/<id>`, `/?page=teacher` → `/teacher`.

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
  errors text, device text,
  ip_hash text                 -- rate limit only (300 results / 10 min per network); the address itself is never stored
);
```

Final version: `next/supabase/schema.sql` (also adds `activities.created`, indexes, the private Storage bucket). Tested on a real Postgres in `next/tests/schema.test.ts`.

Row-level security on: the public can only insert into `results` (through the API route); only the teacher can read anything.

## 5. Steps

| # | Step | Who | Needs laptop? |
|---|---|---|---|
| 1 | Create free accounts: Vercel and Supabase (sign in with GitHub) | Khalid | Yes, once |
| 2 | Create the Supabase project; copy the project URL and keys into Vercel's settings | Khalid, Claude guiding | Yes, once |
| 3 | ✅ Build the Next.js app in a `next/` folder of this repo; tests (25 Nov) | Claude | No |
| 4 | Deploy to Vercel; Khalid tests every page on phone and laptop | Both | No |
| 5 | Switch: post the new student link in Classroom; old Apps Script home page shows "We've moved" with the new link | Khalid decides | No |
| 6 | After a term with no problems: retire Apps Script; keep the Sheet as an archive | Khalid decides | No |

Existing results: 0 attempts so far, so nothing to import. If results exist at switch time, Claude imports the Sheet rows once.

Activities Khalid uploaded from the Apps Script master page (Drive folder « French activities — files », « Activities » tab of the Sheet) are **not** read by the new app. At switch time Claude copies them (file + title/emoji/topic/for/hidden/video settings) into the new app, keeping their ids so the links stay the same.

## 6. Limits to know

- **Supabase free plan pauses a project after about 1 week with no activity** (e.g. holidays). Data is kept and it can be resumed from the dashboard. Fix: a small GitHub Action pings the database every 3 days.
- **No automatic backups on the free plan.** Fix: an « Export results (CSV) » button on the master page, plus Supabase's own export. Pro plan ($25/month) adds daily backups; not needed now.
- **This repository is public.** Student names, results and keys must never be committed. Keys live only in Vercel's settings.
- **University Google/Microsoft accounts** may block sign-in emails; use the personal Gmail for the teacher login, as for Apps Script today.
- **Upgrade, Add-from-link and Feedback** still open GitHub issues; Claude processes them as now ("check my app feedback").

## 6b. Added on 25 Nov: « 📧 Ask for email » (new app only)

- Each activity card on the master page has a **📧 Ask for email** switch (badge « 📧 email required » when on). Claude can also set `"askEmail": true` in `activities/activities.json`.
- When on, the activity opens with a box asking for the student's email; it won't close until the email looks valid. It is pre-filled with the last email used on that device but **always asks**, so on a shared lab computer a result never goes to the previous student.
- The email is saved with the result (`results.email`), shown under the name on the master page, searchable in the name box, and in the CSV (« Email » column). Activities without the switch never send an email.
- A typed email is not verified: a student can type someone else's. Verified sign-in for students is possible later but is a bigger change.
- Database: `activities.ask_email`, `results.email` (in `schema.sql`; it adds them to an existing database too).

## 7. Setup for steps 1–2 (Khalid, on the laptop, ≈20 minutes)

1. **supabase.com** → Sign in with GitHub → **New project**. Name: `rru-french`. Region: **Mumbai (ap-south-1)**. Choose a database password and keep it in your password manager.
2. In the project: **SQL Editor → New query** → paste all of `next/supabase/schema.sql` → **Run**. It should say "Success".
3. **Authentication → Emails → Magic Link** template: add the line `Your code: {{ .Token }}` to the message → Save. (Then you can type the code on your phone instead of tapping the link.)
4. **Project Settings → API keys**: keep this tab open (you need the URL, the *publishable* key and the *secret* key).
5. **vercel.com** → Sign in with GitHub → **Add New → Project** → import *Interactive-French-learning-activities*.
   - **Root Directory**: `next`
   - **Environment Variables** (names in `next/.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `TEACHER_EMAIL` (your personal Gmail).
   - **Deploy**.
6. Supabase → **Authentication → URL Configuration** → Site URL = your Vercel address (e.g. `https://rru-french.vercel.app`) → Save.
7. GitHub repo → **Settings → Secrets and variables → Actions → Variables** → New: `APP_URL` = the same Vercel address (keeps the database awake).
8. Tell Claude « Vercel is set up ». Then step 4: open `/teacher` on phone and laptop, sign in, play an activity as a student, check the result appears.

The secret key must never be pasted in chat, in GitHub or anywhere else than Vercel's settings.

## 8. What was tested (25 Nov) and what can only be tested after setup

Tested here: 43 automated tests (merge rules, result clipping, rate limit, CSV, every teacher route refused without login, schema on Postgres); production build; a real Chrome run on a phone-sized screen: an activity played to the end → « ✅ Result saved »; the same offline → queued, then sent at the next visit; master page shows both results, 🙈 Hide removes it from the student page, ⬆️ Upgrade reads the page; 📧 switch on → email box on the activity → email shown on the master page and in the CSV, not on other activities; the Apps Script version of the master page shows no 📧 button and no errors.

Only after setup (step 4): the real Supabase connection, the email sign-in, uploads to Storage. These use the in-memory stand-in in the tests.

Try it on a laptop without Supabase: `cd next && npm install && LOCAL_MODE=1 npm run dev` → http://localhost:3000 (data is lost when it stops; never works on Vercel).
