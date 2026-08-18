// Netlify Function: searches real job openings via the Adzuna API
// (free tier, covers India + most major markets) so the app can show
// "where you'd likely get hired" ranked against the uploaded resume.
//
// Requires ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.
// Get free keys at https://developer.adzuna.com/
//
// No npm dependencies — uses fetch() built into Netlify's Node 18+ runtime.

const SUPPORTED_COUNTRIES = ["in", "us", "gb", "ca", "au", "de", "sg", "fr", "nl", "za"];

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "Job search isn't configured yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY in Netlify → " +
          "Site configuration → Environment variables (free keys at developer.adzuna.com), then redeploy.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const role = (payload.role || "").trim();
  const location = (payload.location || "").trim();
  let country = (payload.country || "in").trim().toLowerCase();
  if (!SUPPORTED_COUNTRIES.includes(country)) country = "in";

  if (!role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "A role/title to search for is required." }) };
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: role,
    "content-type": "application/json",
  });
  if (location) params.set("where", location);

  const apiUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;

  let response;
  try {
    response = await fetch(apiUrl);
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: `Could not reach the job search API: ${err.message}` }) };
  }

  if (!response.ok) {
    const text = await response.text();
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify({ error: `Job search API error ${response.status}: ${text.slice(0, 300)}` }),
    };
  }

  const data = await response.json();
  const jobs = (data.results || []).map((r) => ({
    title: r.title ? stripTags(r.title) : "Untitled role",
    company: r.company && r.company.display_name ? r.company.display_name : "Unknown company",
    location: r.location && r.location.display_name ? r.location.display_name : "",
    description: r.description ? stripTags(r.description) : "",
    url: r.redirect_url || "",
    created: r.created || null,
  }));

  return { statusCode: 200, headers, body: JSON.stringify({ jobs, count: data.count || jobs.length }) };
};

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}
