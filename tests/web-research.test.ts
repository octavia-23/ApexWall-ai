import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchSimWeb, researchSimSetup } from "@/lib/web-research";

describe("Sim Racing Live Web Research RAG Engine", () => {
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

  it("synthesizes valid context structure when search succeeds", async () => {
    // Mock global fetch to return deterministic HTML search response
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
    });

    expect(report.enabled).toBe(true);
    expect(report.query).toContain("Ferrari 296 GT3");
    expect(report.sources.length).toBe(2);

    expect(report.sources[0].title).toBe("ACC Ferrari 296 GT3 Monza Setup Guide");
    expect(report.sources[0].domain).toBe("example.com");
    expect(report.sources[0].snippet).toContain("26.8 to 27.2 psi hot");

    expect(report.synthesizedContext).toBeDefined();
    expect(report.synthesizedContext).toContain("COMMUNITY BENCHMARKS & LIVE WEB RESEARCH");
    expect(report.synthesizedContext).toContain("example.com");
    expect(report.synthesizedContext).toContain("simracingwiki.org");
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
