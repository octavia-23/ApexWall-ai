import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchSimWeb, researchSimSetup, fetchPageDeepContent } from "@/lib/web-research";

describe("Sim Racing Live Web & Deep Research RAG Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles empty or whitespace-only queries gracefully", async () => {
    const res1 = await searchSimWeb("");
    const res2 = await searchSimWeb("   ");
    expect(res1).toEqual([]);
    expect(res2).toEqual([]);
  });

  it("respects enabled: false flag and skips web search", async () => {
    const report = await researchSimSetup({
      sim: "Assetto Corsa Competizione",
      car: "Ferrari 296 GT3",
      track: "Monza",
      enabled: false,
    });

    expect(report.enabled).toBe(false);
    expect(report.query).toBe("");
    expect(report.sources).toEqual([]);
    expect(report.synthesizedContext).toBeUndefined();
  });

  it("handles missing car or track parameters without crashing", async () => {
    const report1 = await researchSimSetup({
      sim: "iRacing",
      car: "",
      track: "Spa",
      enabled: true,
    });
    expect(report1.enabled).toBe(false);
    expect(report1.sources).toEqual([]);

    const report2 = await researchSimSetup({
      sim: "iRacing",
      car: "Porsche 992 GT3 R",
      track: "",
      enabled: true,
    });
    expect(report2.enabled).toBe(false);
    expect(report2.sources).toEqual([]);
  });

  it("synthesizes valid context structure when standard search succeeds", async () => {
    const mockHtml = `
      <div class="result">
        <a class="result__a" href="https://example.com/setups/acc-ferrari-296">ACC Ferrari 296 GT3 Monza Setup Guide</a>
        <a class="result__snippet">Run tyre pressures around 26.8 to 27.2 psi hot. Drop rear wing to 4 for Monza top speed.</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://simracingwiki.org/cars/ferrari-296">Ferrari 296 GT3 Technical Data</a>
        <a class="result__snippet">Camber limits are -3.5 deg front and -3.0 deg rear. Spring rates stiffen the front roll center.</a>
      </div>
    `;

    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      return new Response(mockHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });

    const report = await researchSimSetup({
      sim: "Assetto Corsa Competizione",
      car: "Ferrari 296 GT3",
      track: "Monza",
      enabled: true,
      deepMode: false,
    });

    expect(report.enabled).toBe(true);
    expect(report.deepMode).toBe(false);
    expect(report.query).toContain("Ferrari 296 GT3");
    expect(report.sources.length).toBe(2);

    const guideSource = report.sources.find((s) => s.domain === "example.com");
    expect(guideSource).toBeDefined();
    expect(guideSource?.title).toBe("ACC Ferrari 296 GT3 Monza Setup Guide");
    expect(guideSource?.snippet).toContain("26.8 to 27.2 psi hot");

    const wikiSource = report.sources.find((s) => s.domain === "simracingwiki.org");
    expect(wikiSource).toBeDefined();
    expect(wikiSource?.title).toBe("Ferrari 296 GT3 Technical Data");

    expect(report.synthesizedContext).toBeDefined();
    expect(report.synthesizedContext).toContain("COMMUNITY BENCHMARKS & LIVE WEB RESEARCH");
  });

  it("extracts garage setup tables, wheel rates, and parameters in deep crawl", async () => {
    const pageHtml = `
      <html>
        <body>
          <nav>Site Header & Links</nav>
          <h1>Ferrari 296 GT3 Monza Pro Setup Sheet</h1>
          <p>This car is extremely rapid through Ascari if you dial in the aerodynamic rake properly.</p>
          <div class="garage-sheet">
            <p>Hot Pressures: 26.8 - 27.2 psi</p>
            <p>Rear Wing: 4</p>
            <p>Ride Heights: 56 mm / 68 mm</p>
            <p>Brake Bias: 54.2%</p>
            <p>ARB: 7 / 2</p>
          </div>
          <p>The damper transition over the kerbs at Variante del Rettifilo requires softer fast bump to avoid upsetting the differential.</p>
        </body>
      </html>
    `;

    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      return new Response(pageHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });

    const extract = await fetchPageDeepContent("https://thetenths.com/setups/296-monza", "Ferrari 296 Monza Guide");
    expect(extract).not.toBeNull();
    expect(extract?.domain).toBe("thetenths.com");
    expect(extract?.keyExcerpts.length).toBeGreaterThan(0);
    expect(extract?.extractedParameters?.["Tyre Pressures"]).toBe("26.8 - 27.2 psi");
    expect(extract?.extractedParameters?.["Wing Angle"]).toBe("4");
    expect(extract?.extractedParameters?.["Brake Bias"]).toBe("54.2%");
    expect(extract?.extractedParameters?.["Anti-Roll Bars"]).toBe("7 / 2");
  });

  it("executes multi-query triangulation in Deep Research Mode", async () => {
    const searchMockHtml = `
      <div class="result">
        <a class="result__a" href="https://coachdaveacademy.com/acc/ferrari-296-monza">Coach Dave ACC 296 Setup</a>
        <a class="result__snippet">Optimized GT3 setup for Monza. Target 27.0 psi hot tyres.</a>
      </div>
    `;

    const pageMockHtml = `
      <html>
        <body>
          <h2>Detailed Setup Notes</h2>
          <p>Rear wing set to 3 for minimum drag down the Monza straights. Camber at maximum negative.</p>
          <p>Ride Heights: 54 mm / 66 mm</p>
        </body>
      </html>
    `;

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      if (typeof url === "string" && url.includes("duckduckgo")) {
        return new Response(searchMockHtml, { status: 200 });
      }
      return new Response(pageMockHtml, { status: 200 });
    });

    const report = await researchSimSetup({
      sim: "Assetto Corsa Competizione",
      car: "Ferrari 296 GT3",
      track: "Monza",
      handlingIssue: "High speed instability under braking into Turn 1",
      enabled: true,
      deepMode: true,
    });

    expect(report.enabled).toBe(true);
    expect(report.deepMode).toBe(true);
    expect(report.queries).toBeDefined();
    expect(report.queries?.length).toBeGreaterThanOrEqual(2);
    expect(report.sources.length).toBeGreaterThan(0);
    expect(report.deepExtracts).toBeDefined();
    expect(report.synthesizedContext).toContain("DEEP WEB RESEARCH & EXTENSIVE COMMUNITY BENCHMARKS");
    expect(report.synthesizedContext).toContain("coachdaveacademy.com");
  });

  it("survives network timeouts and server errors gracefully without throwing", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
      throw new Error("ETIMEDOUT: Connection timed out to search gateway");
    });

    const report = await researchSimSetup({
      sim: "Assetto Corsa Competizione",
      car: "BMW M4 GT3",
      track: "Silverstone",
      enabled: true,
    });

    expect(report.enabled).toBe(true);
    expect(report.sources).toEqual([]);
    expect(report.synthesizedContext).toBeUndefined();
  });
});
