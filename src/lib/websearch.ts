export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** Search the web via DuckDuckGo's no-JS HTML endpoint (no API key required). */
export async function webSearch(query: string, max = 6): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) throw new Error(`búsqueda falló: HTTP ${resp.status}`);
  const html = await resp.text();

  const results: SearchResult[] = [];
  const blockRe = /<div class="result results_links[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && results.length < max) {
    const block = m[1];
    const linkM = linkRe.exec(block);
    if (!linkM) continue;
    let href = linkM[1];
    // DuckDuckGo wraps result URLs in a redirect with `uddg=<encoded target>`.
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    const snippetM = snippetRe.exec(block);
    results.push({
      title: stripTags(linkM[2]),
      url: href,
      snippet: snippetM ? stripTags(snippetM[1]) : "",
    });
  }
  return results;
}

/** Fetch a URL and return its readable text content, truncated. */
export async function webFetch(url: string, maxChars = 6000): Promise<string> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("URL inválida");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("solo se permiten URLs http/https");
  }

  const resp = await fetchWithTimeout(target.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const contentType = resp.headers.get("content-type") || "";
  const raw = await resp.text();

  if (!contentType.includes("html")) {
    return raw.slice(0, maxChars);
  }

  const withoutScripts = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = stripTags(withoutScripts);
  return text.slice(0, maxChars);
}
