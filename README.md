# JobFit AI — web version

Resume vs. job description match scanner. Originally a Python/CustomTkinter
desktop app; rebuilt here as a static site (single `index.html`, no build
step) plus one small serverless function, so it can run on Netlify.

## What runs where

- **Scoring, matching, suggestions, PDF export** run entirely in the
  browser: PDF text extraction (pdf.js), ATS scoring, skill matching,
  resume suggestions, interview questions, and PDF report export (jsPDF).
  Nothing is uploaded to a server for these.
- **AI Career Coach** calls `netlify/functions/coach.js`, which forwards
  the request to Groq's API. Keeps `GROQ_API_KEY` server-side.
- **"Fetch from URL"** (paste a job posting link) calls
  `netlify/functions/fetch-jd.js`, which fetches the page server-side
  (avoids browser CORS) and extracts plain text. Best-effort — works well
  on plain job pages and most company career sites; sites that block bots
  or require login (LinkedIn, some Indeed pages) will fail with a message
  telling you to paste the description manually.
- **"Find jobs to apply to"** calls `netlify/functions/job-search.js`,
  which queries the Adzuna job search API by role/location and returns
  real openings. Each listing is scored client-side against your uploaded
  resume using the same matching logic as the main analyzer, then sorted
  highest-fit first — this is the "where would I get hired" view.

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

### Enable job search (optional)

1. Get free API credentials at <https://developer.adzuna.com/> (sign up,
   create an app — takes a couple of minutes).
2. In Netlify: **Site configuration → Environment variables**, add:
   - `ADZUNA_APP_ID` — your app ID
   - `ADZUNA_APP_KEY` — your app key
3. Redeploy.

Without these set, everything else still works — the "Search jobs" button
will just show a message explaining the keys are missing. The "Fetch from
URL" field for pasting a single job link doesn't need these; it only needs
the site itself to be deployed (no extra keys).

## Local preview

No build tools required — just open `index.html` directly in a browser,
or serve the folder with any static server. To test the AI coach locally
you'll need the [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```
netlify dev
```

This runs the functions locally too (reads keys from a local `.env`
file — see `.env.example`).

## Structure

```
index.html                        - the whole app (UI, scoring logic, PDF export, job ranking)
netlify/functions/coach.js        - serverless proxy to Groq (keeps API key secret)
netlify/functions/fetch-jd.js     - fetches a job posting URL server-side, extracts text
netlify/functions/job-search.js   - queries Adzuna for real job openings by role/location
netlify.toml                      - tells Netlify where to publish from / find functions
.env.example                      - local dev only, for `netlify dev`
```
