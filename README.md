# RRU French activities · results

Interactive French activities for Dr. Mohammad Khalid's RRU classes. Each time a student finishes a level and opens « See my results », the result is saved to his Google Sheet. Students don't sign in or press any extra button. A private master page shows every result.

## How it works

| Part | Where it lives | Changes how |
|---|---|---|
| `apps-script/Code.gs` | Pasted once into script.google.com | Rarely; re-paste only if Claude says so |
| `activities/*.html` + `activities/activities.json` | This repository | Claude pushes; live within ~5–10 min |
| `web/teacher.html`, `web/home.html`, `web/bridge.js` | This repository | Claude pushes; live within ~5–10 min |
| Results | Google Sheet « French activities — results » in your Drive | Filled automatically |

The web app loads the pages from this repository, so updates go live without redeploying. Student results never go to GitHub; they stay in your Sheet.

## One-time setup (≈10 minutes)

1. Open **script.google.com** → **New project**. Name it *French activities*.
2. **Code.gs**: delete what is there and paste the content of `apps-script/Code.gs`.
3. **appsscript.json**: ⚙️ Project Settings → tick « Show "appsscript.json" manifest file ». Back in the editor, open `appsscript.json` and replace it with `apps-script/appsscript.json`.
4. Save. Choose **setup** in the function menu → **▶ Run** → allow the permissions (Advanced → Go to *French activities* → Allow).
5. **Deploy → New deployment** → type **Web app** → Execute as **Me**, Who has access **Anyone** → **Deploy**.
6. Choose **showMyLinks** → **▶ Run**. The log shows:
   - the **student link** (list of all activities), and
   - **your master page link** (keep it private: it contains your key).

If « Anyone » is not offered (some university Google accounts block it), do the setup with your personal Gmail account instead.

## Daily use

- Share an activity: on the master page, **Copy** its link and post it in Classroom.
- See results: open your master page (it refreshes every 2 minutes, or press 🔄).
- Feedback: write it in the **💬 Feedback** box on the master page → *Send to GitHub* → *Submit new issue*. Then tell Claude « check my app feedback ».
- Need an update live immediately? In script.google.com run **refreshNow**.

## Adding an activity (Claude does this)

1. Put the page in `activities/<id>.html`. It must be built by the standard generator, which provides the `report` function.
2. Add `{ "id", "title", "emoji", "topic", "for", "file" }` to `activities/activities.json`. Add `"hidden": true` to keep it off the student list.
3. Push. The link is `<web app URL>?a=<id>`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
