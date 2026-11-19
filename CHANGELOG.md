# Changelog

## v1.1 — 19 Nov 2026
- Added activity « L'imparfait » (OD1 Unité 6), from issue #1. Results bridge now also reads older-format pages (tries/type).
- ➕ Add activity: « 🔗 Add from a claude.ai link » sends the link to Claude as a GitHub issue (label add-activity).
- Master page: ➕ Add activity (upload or paste an .html file; stored in Drive folder « French activities — files », listed in the « Activities » tab of the Sheet). Warns if a page won't save results.
- Each activity card: ✏️ Edit details, 🙈 Hide/👁 Show on the student page, 🗑️ Remove (with ♻️ Restore), ⬆️ Upgrade, 🎬 Videos.
- ⬆️ Upgrade: checks the page against web/standard.json (the current standard), lists every feature as present / missing / check; choose Keep · Add · Change · Remove per feature; sends an « upgrade » request to Claude as a GitHub issue.
- 🎬 Videos: step-by-step NotebookLM guide built from the activity (lesson notes source + Explainer prompt + Short prompt); paste the video links and students see a « 🎬 Watch first » box at the top of the activity (YouTube / Drive play inside the page).

## v1.0 — 19 Nov 2026
- Apps Script web app: results of each finished level are saved silently to a Google Sheet (name, date and time, activity, level, score, first/second try, errors, device).
- Student page listing the activities.
- Private master page: activity links with Copy/Open, results table with filters (activity, date, name), « By student » view, totals, link to the Sheet.
- 💬 Feedback box that opens a GitHub issue for Claude.
- First activity: « Je te présente… » (OD1 Dossier 1 Unité 1).
- Results that fail to send (no network) are kept on the device and sent at the next visit.
