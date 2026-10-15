/**
 * ============================================================================
 * SIM RACING LIVE WEB & DEEP RESEARCH RAG ENGINE // APEXWALL AI
 * ============================================================================
 * Provides multi-tier internet intelligence for motorsport engineering:
 * 1. Standard Live Mode: High-speed targeted search query & snippet RAG (<800ms)
 * 2. Deep Research Mode: Multi-query triangulation, authoritative domain weighting,
 *    and full-page deep body scraping of garage setup tables, wheel rates & pressures.
 * ============================================================================
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  authorityScore?: number;
}

export interface DeepPageExtract {
  url: string;
  domain: string;
  title: string;
  keyExcerpts: string[];
  extractedParameters?: Record<string, string>;
}

export interface SimResearchReport {
  enabled: boolean;
  deepMode: boolean;
  query: string;
  queries?: string[];
  sources: WebSearchResult[];
  deepExtracts?: DeepPageExtract[];
  synthesizedContext?: string;
}

interface CacheEntry {
  timestamp: number;
  results: WebSearchResult[];
}

interface PageCacheEntry {
  timestamp: number;
  extract: DeepPageExtract | null;
}

// In-memory cache to prevent redundant outbound calls
const searchCache = new Map<string, CacheEntry>();
const pageCache = new Map<string, PageCacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// High-authority motorsport & sim-racing domain whitelist
const HIGH_AUTHORITY_DOMAINS = [
  "coachdaveacademy.com",
  "simracingsetup.com",
  "thetenths.com",
  "traxion.gg",
  "overtake.gg",
  "racedepartment.com",
  "simracingwiki.org",
  "iracing.com",
  "assettocorsa.net",
  "lowfuelgrid.com",
  "tracktitan.io",
  "motorsport.com",
  "racecar-engineering.com",
];

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
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "web";
  }
}

function calculateAuthorityScore(domain: string): number {
  const d = domain.toLowerCase();
  for (const auth of HIGH_AUTHORITY_DOMAINS) {
    if (d.includes(auth)) return 10;
  }
  return 1;
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

  // 1. Tavily Search (If API key provided)
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
          const results: WebSearchResult[] = data.results.map((r: any) => {
            const domain = extractDomain(r.url || "");
            return {
              title: cleanHtmlEntities(r.title || ""),
              url: r.url || "",
              snippet: cleanHtmlEntities(r.content || ""),
              domain,
              authorityScore: calculateAuthorityScore(domain),
            };
          });
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

    while ((match = itemRegex.exec(html)) && results.length < maxResults * 2) {
      let rawUrl = match[1];
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
        const domain = extractDomain(rawUrl);
        results.push({
          title,
          url: rawUrl,
          snippet,
          domain,
          authorityScore: calculateAuthorityScore(domain),
        });
      }
    }

    // Sort by authority score descending
    results.sort((a, b) => (b.authorityScore || 0) - (a.authorityScore || 0));

    if (results.length > 0) {
      searchCache.set(normalizedQuery, { timestamp: Date.now(), results });
    }

    return results.slice(0, maxResults);
  } catch (err: any) {
    console.warn("[WebResearch] Search unavailable:", err?.message || err);
    return [];
  }
}

/**
 * Extracts concrete setup parameters (pressures, wing, ARB, ride heights) from page text
 */
function extractSetupParameters(text: string): Record<string, string> {
  const params: Record<string, string> = {};

  // Tyre pressures
  const pressureMatch = text.match(/(?:hot|cold)?\s*pressures?[:\s]+([0-9]{2}(?:\.[0-9]+)?(?:\s*-\s*[0-9]{2}(?:\.[0-9]+)?)?\s*psi)/i);
  if (pressureMatch) params["Tyre Pressures"] = pressureMatch[1].trim();

  // Rear wing
  const wingMatch = text.match(/(?:rear\s*)?wing[:\s]+([0-9]{1,2}(?:\s*\/\s*[0-9]{1,2})?)/i);
  if (wingMatch) params["Wing Angle"] = wingMatch[1].trim();

  // Ride heights
  const rideHeightMatch = text.match(/ride\s*heights?[:\s]+([0-9]{2,3}\s*mm(?:\s*[\/x-]\s*[0-9]{2,3}\s*mm)?)/i);
  if (rideHeightMatch) params["Ride Heights"] = rideHeightMatch[1].trim();

  // Brake bias
  const biasMatch = text.match(/brake\s*bias[:\s]+([0-9]{2}(?:\.[0-9]+)?%?)/i);
  if (biasMatch) params["Brake Bias"] = biasMatch[1].trim();

  // Anti-roll bar (ARB)
  const arbMatch = text.match(/arb[:\s]+([0-9]{1,2}(?:\s*[\/,-]\s*[0-9]{1,2})?)/i);
  if (arbMatch) params["Anti-Roll Bars"] = arbMatch[1].trim();

  return params;
}

/**
 * Crawls and extracts deep garage setup data and technical paragraphs from a full web page
 */
export async function fetchPageDeepContent(
  url: string,
  title?: string,
  timeoutMs: number = 2800
): Promise<DeepPageExtract | null> {
  if (!url || !url.startsWith("http")) return null;

  // Check cache
  const cached = pageCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.extract;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const html = await res.text();

    // Strip scripts, styles, navigation, headers, footers, svg
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract high-signal motorsport setup sentences
    const technicalRegex =
      /(?:wing|downforce|pressure|psi|camber|toe|arb|anti-roll|spring|damper|bump|rebound|rake|ride height|brake bias|diff|differential|bop)[^.!?\n]{15,160}[.!?\n]/gi;
    
    const matches = stripped.match(technicalRegex) || [];
    const keyExcerpts = Array.from(new Set(matches.map((m) => m.trim()))).slice(0, 4);

    if (keyExcerpts.length === 0) {
      return null;
    }

    const domain = extractDomain(url);
    const extractedParameters = extractSetupParameters(stripped);

    const extract: DeepPageExtract = {
      url,
      domain,
      title: title || domain,
      keyExcerpts,
      extractedParameters: Object.keys(extractedParameters).length > 0 ? extractedParameters : undefined,
    };

    pageCache.set(url, { timestamp: Date.now(), extract });
    return extract;
  } catch (_err) {
    // Non-fatal, return null so calling agent continues gracefully
    return null;
  }
}

/**
 * Conducts structured sim-racing research (Standard or Deep Research Mode)
 */
export async function researchSimSetup(params: {
  sim: string;
  car: string;
  track: string;
  handlingIssue?: string;
  weather?: string;
  enabled?: boolean;
  deepMode?: boolean;
}): Promise<SimResearchReport> {
  const { sim, car, track, handlingIssue, enabled = true, deepMode = false } = params;

  if (!enabled || !car || !track) {
    return {
      enabled: false,
      deepMode: false,
      query: "",
      sources: [],
    };
  }

  const cleanSim = sim || "Assetto Corsa Competizione";

  // --------------------------------------------------------------------------
  // MODE 1: DEEP RESEARCH MODE (Multi-Query Triangulation + Deep Page Crawling)
  // --------------------------------------------------------------------------
  if (deepMode) {
    const queries = [
      `${cleanSim} ${car} ${track} setup tyre pressure aero wing`,
      `${cleanSim} ${car} ${track} telemetry guide camber dampers`,
    ];

    if (handlingIssue && handlingIssue.trim().length > 3) {
      queries.push(`${cleanSim} ${car} ${handlingIssue.slice(0, 80)} setup fix`);
    } else {
      queries.push(`${cleanSim} ${car} balance of performance tyre model patch`);
    }

    try {
      // 1. Run all 3 queries in parallel
      const searchPromises = queries.map((q) => searchSimWeb(q, 3));
      const searchResultsSets = await Promise.allSettled(searchPromises);

      // 2. Flatten and deduplicate by URL
      const urlSeen = new Set<string>();
      const combinedSources: WebSearchResult[] = [];

      for (const res of searchResultsSets) {
        if (res.status === "fulfilled") {
          for (const item of res.value) {
            if (!urlSeen.has(item.url)) {
              urlSeen.add(item.url);
              combinedSources.push(item);
            }
          }
        }
      }

      // Sort by domain authority
      combinedSources.sort((a, b) => (b.authorityScore || 0) - (a.authorityScore || 0));
      const topSources = combinedSources.slice(0, 6);

      // 3. Deep-crawl top 3 pages concurrently
      const deepCrawlTargets = topSources.slice(0, 3);
      const deepCrawlPromises = deepCrawlTargets.map((s) =>
        fetchPageDeepContent(s.url, s.title, 2800)
      );

      const deepExtractResults = await Promise.allSettled(deepCrawlPromises);
      const deepExtracts: DeepPageExtract[] = [];

      for (const crawlRes of deepExtractResults) {
        if (crawlRes.status === "fulfilled" && crawlRes.value) {
          deepExtracts.push(crawlRes.value);
        }
      }

      // 4. Synthesize context for LLM prompt injection
      let synthesizedContext = `
================================================================================
DEEP WEB RESEARCH & EXTENSIVE COMMUNITY BENCHMARKS [ACTIVE DEEP MODE]
Simulation: ${cleanSim.toUpperCase()} | Chassis: ${car.toUpperCase()} | Circuit: ${track.toUpperCase()}
================================================================================
`;

      if (deepExtracts.length > 0) {
        synthesizedContext += `\nDEEP-CRAWLED SETUP EXCERPTS & GARAGE TABLES FROM HIGH-AUTHORITY SOURCES:\n`;
        deepExtracts.forEach((ext) => {
          synthesizedContext += `\n[Source: ${ext.domain}] "${ext.title}" (${ext.url})\n`;
          if (ext.extractedParameters) {
            const paramList = Object.entries(ext.extractedParameters)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" | ");
            synthesizedContext += `  • Extracted Parameters: ${paramList}\n`;
          }
          ext.keyExcerpts.forEach((exc) => {
            synthesizedContext += `  • Quote: "${exc}"\n`;
          });
        });
      }

      synthesizedContext += `\nADDITIONAL SEARCH BENCHMARKS & FORUM GUIDES:\n`;
      topSources.slice(0, 4).forEach((s) => {
        synthesizedContext += `• [${s.domain}] "${s.title}": ${s.snippet} (${s.url})\n`;
      });

      synthesizedContext += `
INSTRUCTION FOR RACE ENGINEER:
Ground your setup decisions and delta values against the deep-crawled setup sheets and telemetry excerpts above.
Explicitly cite relevant community benchmarks in your diagnosis and radio communication.
`.trim();

      return {
        enabled: true,
        deepMode: true,
        query: queries[0],
        queries,
        sources: topSources,
        deepExtracts: deepExtracts.length > 0 ? deepExtracts : undefined,
        synthesizedContext,
      };
    } catch (err: any) {
      console.warn("[WebResearch:Deep] Deep research error, falling back to standard:", err?.message || err);
      // Fall through to standard search below
    }
  }

  // --------------------------------------------------------------------------
  // MODE 2: STANDARD LIVE RESEARCH MODE (Fast Targeted Search Snippets)
  // --------------------------------------------------------------------------
  const query = `${cleanSim} ${car} ${track} setup guide tyre pressure aero`;

  try {
    const sources = await searchSimWeb(query, 4);

    if (sources.length === 0) {
      return {
        enabled: true,
        deepMode: false,
        query,
        sources: [],
      };
    }

    const bullets = sources
      .map((s) => `• [${s.domain}] "${s.title}": ${s.snippet} (${s.url})`)
      .join("\n");

    const synthesizedContext = `
COMMUNITY BENCHMARKS & LIVE WEB RESEARCH (RETRIEVED FOR ${cleanSim.toUpperCase()} ${car.toUpperCase()} @ ${track.toUpperCase()}):
${bullets}

GUIDANCE: Reference these real-world and community setup benchmarks (e.g. typical aero levels, target tyre pressures, known handling quirks) to corroborate and enrich your mechanical diagnosis and driver communication. Always respect the legal adjustment ranges.
`.trim();

    return {
      enabled: true,
      deepMode: false,
      query,
      sources,
      synthesizedContext,
    };
  } catch (err: any) {
    console.warn("[WebResearch] Failed to research sim setup:", err?.message || err);
    return {
      enabled: true,
      deepMode: false,
      query,
      sources: [],
    };
  }
}
