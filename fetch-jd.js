// Netlify Function: fetches a job posting page server-side and extracts
// best-effort plain text, so the browser can paste in a job description
// from a URL without hitting CORS restrictions.
//
// No npm dependencies — uses fetch() built into Netlify's Node 18+ runtime
// and a hand-rolled tag stripper (good enough for job description bodies,
// not a general-purpose readability engine).

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

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const rawUrl = (payload.url || "").trim();
  let url;
  try {
    url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "That doesn't look like a valid URL." }) };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    const msg = err.name === "AbortError" ? "The site took too long to respond." : err.message;
    return { statusCode: 502, headers, body: JSON.stringify({ error: `Could not reach that page: ${msg}` }) };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: `The site returned an error (${response.status}). Some job boards (like LinkedIn) block automated fetching — paste the description manually instead.`,
      }),
    };
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return { statusCode: 415, headers, body: JSON.stringify({ error: "That URL isn't an HTML page." }) };
  }

  const html = await response.text();
  const title = extractTitle(html);
  const text = htmlToText(html);

  if (!text || text.length < 40) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({
        error: "Couldn't find readable text on that page — it may render its content with JavaScript. Paste the description manually instead.",
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ title, text: text.slice(0, 8000) }),
  };
};

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim().slice(0, 200) : null;
}

function htmlToText(html) {
  let out = html
    // drop non-content blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // turn block-level boundaries into newlines so paragraphs don't run together
    .replace(/<\/(p|div|li|h[1-6]|section|article|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // strip all remaining tags
    .replace(/<[^>]+>/g, " ");

  out = decodeEntities(out);

  // collapse whitespace: multiple spaces -> one, multiple blank lines -> one
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
