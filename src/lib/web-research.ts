/**
 * ============================================================================
 * SIM RACING LIVE WEB RESEARCH & BENCHMARK RAG ENGINE // APEXWALL AI
 * ============================================================================
 * Provides real-time internet search capabilities for:
 * 1. Sim-specific setup benchmarks (ACC, iRacing, AC, AMS2, rF2, LMU)
 * 2. Community tyre pressure, camber, and aero targets
 * 3. Recent sim patch notes & BOP (Balance of Performance) updates
 * 4. Circuit characteristics & real-world GT3/F1 setup telemetry notes
 * ============================================================================
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface SimResearchReport {
  enabled: boolean;
  query: string;
  sources: WebSearchResult[];
  synthesizedContext?: string;
}

interface CacheEntry {
  timestamp: number;
  results: WebSearchResult[];
}

// In-memory cache with 15-minute TTL to reduce redundant outbound requests
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

/**
 * Executes a live web search using DuckDuckGo HTML / Tavily with fallback
 */
export async function searchSimWeb(
  query: string,
  maxResults: number = 4
): Promise<WebSearchResult[]> {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  // Check cache first
  const cached = searchCache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results.slice(0, maxResults);
  }

  // 1. If TAVILY_API_KEY is available, use it
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "basic",
          max_results: maxResults,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          const results: WebSearchResult[] = data.results.map((r: any) => ({
            title: cleanHtmlEntities(r.title || ""),
            url: r.url || "",
            snippet: cleanHtmlEntities(r.content || ""),
            domain: extractDomain(r.url || ""),
          }));
          searchCache.set(normalizedQuery, { timestamp: Date.now(), results });
          return results.slice(0, maxResults);
        }
      }
    } catch (_tavilyErr) {
      // Fallback to DuckDuckGo HTML below
    }
  }

  // 2. DuckDuckGo HTML Search (Zero-config, free, high-speed)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const html = await res.text();
    const results: WebSearchResult[] = [];

    // Parse each result using regex
    const itemRegex =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = itemRegex.exec(html)) && results.length < maxResults) {
      let rawUrl = match[1];
      // Decode DuckDuckGo redirect wrapper (/l/?kh=-1&uddg=...)
      if (rawUrl.includes("uddg=")) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          try {
            rawUrl = decodeURIComponent(uddgMatch[1]);
          } catch {
            // Keep original if decode fails
          }
        }
      }

      const title = cleanHtmlEntities(match[2]);
      const snippet = cleanHtmlEntities(match[3]);

      if (title && snippet && rawUrl.startsWith("http")) {
        results.push({
          title,
          url: rawUrl,
          snippet,
          domain: extractDomain(rawUrl),
        });
      }
    }

    if (results.length > 0) {
      searchCache.set(normalizedQuery, { timestamp: Date.now(), results });
    }

    return results;
  } catch (err: any) {
    console.warn("[WebResearch] Search unavailable:", err?.message || err);
    return [];
  }
}

/**
 * Conducts structured sim-racing research for a vehicle, circuit, and setup problem
 */
export async function researchSimSetup(params: {
  sim: string;
  car: string;
  track: string;
  handlingIssue?: string;
  weather?: string;
  enabled?: boolean;
}): Promise<SimResearchReport> {
  const { sim, car, track, handlingIssue, enabled = true } = params;

  if (!enabled || !car || !track) {
    return {
      enabled: false,
      query: "",
      sources: [],
    };
  }

  // Construct search query targeting sim setup guides, benchmarks, and baseline specs
  const cleanSim = sim || "Assetto Corsa Competizione";
  const query = `${cleanSim} ${car} ${track} setup guide tyre pressure aero`;

  try {
    const sources = await searchSimWeb(query, 4);

    if (sources.length === 0) {
      return {
        enabled: true,
        query,
        sources: [],
      };
    }

    // Synthesize context for LLM prompt injection
    const bullets = sources
      .map(
        (s) =>
          `• [${s.domain}] "${s.title}": ${s.snippet} (${s.url})`
      )
      .join("\n");

    const synthesizedContext = `
COMMUNITY BENCHMARKS & LIVE WEB RESEARCH (RETRIEVED FOR ${cleanSim.toUpperCase()} ${car.toUpperCase()} @ ${track.toUpperCase()}):
${bullets}

GUIDANCE: Reference these real-world and community setup benchmarks (e.g. typical aero levels, target tyre pressures, known handling quirks) to corroborate and enrich your mechanical diagnosis and driver communication. Always respect the legal adjustment ranges.
`.trim();

    return {
      enabled: true,
      query,
      sources,
      synthesizedContext,
    };
  } catch (err: any) {
    console.warn("[WebResearch] Failed to research sim setup:", err?.message || err);
    return {
      enabled: true,
      query,
      sources: [],
    };
  }
}
