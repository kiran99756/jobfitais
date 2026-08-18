
// Netlify Function: proxies "AI Career Coach" requests to Groq's API.
// Keeps GROQ_API_KEY server-side (set it in Netlify → Site settings →
// Environment variables) so it's never exposed in the browser.
//
// No npm dependencies — uses the fetch() built into Netlify's Node 18+ runtime.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT =
  "You are a concise, practical career coach helping someone tailor their " +
  "resume and prep for a specific job. Be direct and specific to the resume " +
  "and job description given — avoid generic advice. Keep the response under " +
  "300 words, using short paragraphs or bullet points.";

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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "No GROQ_API_KEY set on the server. Add it in Netlify → Site " +
          "settings → Environment variables, then redeploy.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body." }),
    };
  }

  const {
    resumeText = "",
    jobDescription = "",
    score = 0,
    matched = [],
    missing = [],
  } = payload;

  if (!resumeText.trim() || !jobDescription.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Resume text and job description are required." }),
    };
  }

  const userPrompt = `
Resume:
${resumeText.slice(0, 4000)}

Job description:
${jobDescription.slice(0, 2000)}

ATS match score: ${score}%
Matched skills: ${matched.length ? matched.join(", ") : "none"}
Missing skills: ${missing.length ? missing.join(", ") : "none"}

Give this candidate specific, actionable coaching for landing this role:
what to emphasize, what to fix, and how to talk about the missing skills
if asked in an interview.
`.trim();

  const body = {
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 500,
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: `Could not reach Groq API: ${err.message}` }),
    };
  }

  if (response.status === 401) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Groq API rejected the key (401). Check GROQ_API_KEY." }),
    };
  }
  if (response.status === 429) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: "Groq API rate limit hit (429). Try again in a moment." }),
    };
  }
  if (!response.ok) {
    const text = await response.text();
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify({ error: `Groq API error ${response.status}: ${text.slice(0, 300)}` }),
    };
  }

  const data = await response.json();
  const advice = data?.choices?.[0]?.message?.content?.trim();

  if (!advice) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Unexpected response format from Groq API." }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ advice }),
  };
};
