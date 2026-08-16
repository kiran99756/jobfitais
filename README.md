# JobFit AI — web version

Resume vs. job description match scanner. Originally a Python/CustomTkinter
desktop app; rebuilt here as a static site (single `index.html`, no build
step) plus one small serverless function, so it can run on Netlify.

## What runs where

- **Everything except the AI coach** runs entirely in the browser:
  PDF text extraction (pdf.js), ATS scoring, skill matching, resume
  suggestions, interview questions, and PDF report export (jsPDF).
  Nothing is uploaded to a server for these.
- **AI Career Coach** calls a Netlify Function (`netlify/functions/coach.js`)
  which forwards the request to Groq's API. This keeps your `GROQ_API_KEY`
  secret — it never reaches the browser.

## Deploy on Netlify

**Option A — drag and drop (fastest)**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole folder onto the page. Netlify deploys it as-is —
   no build command needed (`index.html` is served directly, and the
   `netlify/functions` folder is picked up automatically because of
   `netlify.toml`).

**Option B — connect a Git repo**
1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build command: leave blank. Publish directory: `.` (already set in
   `netlify.toml`, so Netlify should detect it automatically).
4. Deploy.

### Enable the AI Career Coach (optional)

1. Get a free API key at <https://console.groq.com/keys>.
2. In your Netlify site: **Site configuration → Environment variables →
   Add a variable**.
   - Key: `GROQ_API_KEY`
   - Value: your key
3. Redeploy the site (env var changes need a new deploy to take effect).

If `GROQ_API_KEY` isn't set, the rest of the app (score, skills,
suggestions, interview questions, PDF export) still works fully — only
the "Get coaching" button will show a message telling you the key is missing.

## Local preview

No build tools required — just open `index.html` directly in a browser,
or serve the folder with any static server. To test the AI coach locally
you'll need the [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```
netlify dev
```

This runs the function locally too (reads `GROQ_API_KEY` from a local
`.env` file — see `.env.example`).

## Structure

```
index.html                     - the whole app (UI, scoring logic, PDF export)
netlify/functions/coach.js     - serverless proxy to Groq (keeps API key secret)
netlify.toml                   - tells Netlify where to publish from / find functions
.env.example                   - local dev only, for `netlify dev`
```
