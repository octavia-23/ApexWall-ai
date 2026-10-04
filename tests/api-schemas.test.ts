import { describe, it, expect, beforeEach } from "vitest";
import {
  RaceEngineerRequestSchema,
  GenerateSetupRequestSchema,
  MemoryRateLimiter,
  MAX_PAYLOAD_BYTES,
  getClientIp,
} from "@/lib/api-schemas";

describe("Phase 5 - API Schemas & Abuse Guard Characterization Tests", () => {
  describe("RaceEngineerRequestSchema", () => {
    it("accepts valid race-engineer payload with standard messages and context", () => {
      const validPayload = {
        messages: [
          { role: "user", content: "I'm getting understeer on entry" },
          { role: "assistant", content: "Copy driver. Looking at front roll stiffness." },
          { role: "user", content: "Should I adjust the front ARB?" },
        ],
        activeSim: "Assetto Corsa Competizione",
        setupContext: {
          car: "Porsche 992 GT3 R",
          track: "Monza",
          summary: "Aggressive qualifying setup",
          sections: [
            {
              title: "Suspension",
              items: [{ label: "Front ARB", value: "4" }],
            },
          ],
        },
        telemetryContext: {
          lapTime: "1:47.350",
          topSpeed: 280,
          minSpeed: 75,
          trailBrakingScore: 88,
          gripUtilization: 45,
          tyres: {
            FL: { pressure: "27.2 psi", temp: "85°C" },
          },
          keyCorners: [
            { corner: "T1", driverSpeed: 75, speedDelta: -2, timeDelta: 0.12, verdict: "Braking deep" },
          ],
        },
      };

      const result = RaceEngineerRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages.length).toBe(3);
        expect(result.data.activeSim).toBe("Assetto Corsa Competizione");
      }
    });

    it("accepts minimal empty payload with default messages array", () => {
      const result = RaceEngineerRequestSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toEqual([]);
      }
    });

    it("rejects messages with invalid roles", () => {
      const payload = {
        messages: [{ role: "system", content: "System prompt injection attempt" }],
      };
      const result = RaceEngineerRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it("rejects messages exceeding 4000 characters", () => {
      const payload = {
        messages: [{ role: "user", content: "A".repeat(4001) }],
      };
      const result = RaceEngineerRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/4000/);
      }
    });

    it("rejects more than 20 messages", () => {
      const payload = {
        messages: Array.from({ length: 21 }, (_, i) => ({
          role: "user" as const,
          content: `Message ${i}`,
        })),
      };
      const result = RaceEngineerRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/20/);
      }
    });
  });

  describe("GenerateSetupRequestSchema", () => {
    it("accepts valid generate-setup payload with all fields", () => {
      const validPayload = {
        game: "Assetto Corsa Competizione",
        car: "Porsche 992 GT3 R",
        track: "Monza GP",
        sessionType: "Qualifying",
        weather: "Dry",
        trackTemp: "32°C",
        airTemp: "24°C",
        fuelLoad: "45 L",
        tyreCompound: "Medium Slick",
        driverStyle: "Aggressive trail-braker",
        handlingIssue: "Understeer on entry into T1",
        skillLevel: "Advanced",
        baselineSetup: {
          summary: "Monza Baseline",
          sections: [
            {
              title: "Tyres",
              items: [{ label: "FL Pressure", value: "26.8" }],
            },
          ],
        },
        fullBaselineRequested: false,
      };

      const result = GenerateSetupRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.game).toBe("Assetto Corsa Competizione");
        expect(result.data.car).toBe("Porsche 992 GT3 R");
        expect(result.data.track).toBe("Monza GP");
      }
    });

    it("rejects missing game, car, or track", () => {
      expect(GenerateSetupRequestSchema.safeParse({ car: "992", track: "Monza" }).success).toBe(false);
      expect(GenerateSetupRequestSchema.safeParse({ game: "ACC", track: "Monza" }).success).toBe(false);
      expect(GenerateSetupRequestSchema.safeParse({ game: "ACC", car: "992" }).success).toBe(false);
    });

    it("rejects blank/whitespace-only game, car, or track", () => {
      expect(GenerateSetupRequestSchema.safeParse({ game: "   ", car: "992", track: "Monza" }).success).toBe(false);
      expect(GenerateSetupRequestSchema.safeParse({ game: "ACC", car: "  \t ", track: "Monza" }).success).toBe(false);
      expect(GenerateSetupRequestSchema.safeParse({ game: "ACC", car: "992", track: "" }).success).toBe(false);
    });

    it("trims game, car, and track", () => {
      const result = GenerateSetupRequestSchema.safeParse({
        game: "  Assetto Corsa Competizione  ",
        car: "  Porsche 992 GT3 R  ",
        track: "  Monza  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.game).toBe("Assetto Corsa Competizione");
        expect(result.data.car).toBe("Porsche 992 GT3 R");
        expect(result.data.track).toBe("Monza");
      }
    });

    it("rejects oversized strings (> 200 chars for car/game/track)", () => {
      const result = GenerateSetupRequestSchema.safeParse({
        game: "ACC",
        car: "P".repeat(201),
        track: "Monza",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("MemoryRateLimiter", () => {
    let limiter: MemoryRateLimiter;

    beforeEach(() => {
      limiter = new MemoryRateLimiter(10, 60 * 1000);
    });

    it("allows up to 10 requests immediately and blocks the 11th", () => {
      const ip = "192.168.1.100";
      for (let i = 0; i < 10; i++) {
        const res = limiter.check(ip);
        expect(res.allowed).toBe(true);
      }

      // 11th request must be denied
      const eleventh = limiter.check(ip);
      expect(eleventh.allowed).toBe(false);
      expect(eleventh.remaining).toBe(0);
    });

    it("tracks different IPs separately", () => {
      const ipA = "10.0.0.1";
      const ipB = "10.0.0.2";

      for (let i = 0; i < 10; i++) {
        expect(limiter.check(ipA).allowed).toBe(true);
      }
      expect(limiter.check(ipA).allowed).toBe(false);

      // ipB should still have 10 tokens
      expect(limiter.check(ipB).allowed).toBe(true);
    });
  });

  describe("getClientIp and MAX_PAYLOAD_BYTES", () => {
    it("extracts IP correctly from x-forwarded-for first entry", () => {
      const headers = new Headers({ "x-forwarded-for": "203.0.113.195, 70.41.3.18" });
      expect(getClientIp(headers)).toBe("203.0.113.195");
    });

    it("falls back to 127.0.0.1 when no ip headers present", () => {
      const headers = new Headers();
      expect(getClientIp(headers)).toBe("127.0.0.1");
    });

    it("defines MAX_PAYLOAD_BYTES as 32KB", () => {
      expect(MAX_PAYLOAD_BYTES).toBe(32768);
    });
  });
});
