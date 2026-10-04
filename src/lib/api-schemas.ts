import { z } from "zod";

/**
 * ============================================================================
 * In-Memory Token Bucket Rate Limiter (Module-level, per-instance)
 * ============================================================================
 * Enforces a fixed rate limit per IP per route within a serverless instance.
 * Note: Because Next.js serverless route handlers can be instantiated across
 * multiple instances, this rate limiting is per-serverless-instance, which is
 * acceptable for a demo deployment.
 * ============================================================================
 */
interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

export class MemoryRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;
  private readonly windowMs: number;

  constructor(limit: number = 10, windowMs: number = 60 * 1000) {
    this.maxTokens = limit;
    this.windowMs = windowMs;
    this.refillRatePerMs = limit / windowMs;
  }

  public check(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(ip);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefillTime: now };
      this.buckets.set(ip, bucket);
    } else {
      // Calculate token refill based on elapsed time
      const elapsed = Math.max(0, now - bucket.lastRefillTime);
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRatePerMs);
      bucket.lastRefillTime = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: 0 };
  }

  /**
   * Reset bucket for a given IP (useful for test suites)
   */
  public reset(ip?: string) {
    if (ip) {
      this.buckets.delete(ip);
    } else {
      this.buckets.clear();
    }
  }
}

/**
 * 32KB payload size limit in bytes (belt-and-braces cap)
 */
export const MAX_PAYLOAD_BYTES = 32 * 1024; // 32,768 bytes

/**
 * Helper to get client IP from request headers or default to loopback
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return "127.0.0.1";
}

/**
 * ============================================================================
 * Schema 1: /api/race-engineer
 * ============================================================================
 * - messages: array of max 20 objects { role: enum("user","assistant"), content: string max 4000 chars }
 * - telemetryContext and setupContext: optional objects with known field shapes
 *   loosely typed to match client-side RaceEngineerChat.tsx usage
 * - activeSim: optional string
 * ============================================================================
 */
export const RaceEngineerMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000, "Message content must not exceed 4000 characters"),
});

export const RaceEngineerTelemetryContextSchema = z.object({
  car: z.string().optional(),
  track: z.string().optional(),
  lapTime: z.string().optional(),
  topSpeed: z.number().nullable().optional(),
  minSpeed: z.number().nullable().optional(),
  trailBrakingScore: z.number().nullable().optional(),
  gripUtilization: z.number().nullable().optional(),
  tyres: z.record(z.string(), z.any()).nullable().optional(),
  keyCorners: z.array(z.record(z.string(), z.any())).nullable().optional(),
}).passthrough();

export const RaceEngineerSetupContextSchema = z.object({
  game: z.string().optional(),
  car: z.string().optional(),
  track: z.string().optional(),
  summary: z.string().optional(),
  sections: z.array(z.record(z.string(), z.any())).optional(),
  engineerNotes: z.string().optional(),
}).passthrough();

export const RaceEngineerRequestSchema = z.object({
  messages: z.array(RaceEngineerMessageSchema).max(20, "Cannot submit more than 20 messages").default([]),
  telemetryContext: RaceEngineerTelemetryContextSchema.optional(),
  setupContext: RaceEngineerSetupContextSchema.optional(),
  activeSim: z.string().optional(),
});

export type RaceEngineerRequest = z.infer<typeof RaceEngineerRequestSchema>;

/**
 * ============================================================================
 * Schema 2: /api/generate-setup
 * ============================================================================
 * - game, car, track: required trimmed strings (max 200 chars each)
 * - all other fields optional, typed loosely enough to match SetupGenerator.tsx
 * ============================================================================
 */
export const GenerateSetupRequestSchema = z.object({
  game: z.string().trim().min(1, "Game is required").max(200, "Game name must not exceed 200 characters"),
  car: z.string().trim().min(1, "Car is required").max(200, "Car name must not exceed 200 characters"),
  track: z.string().trim().min(1, "Track is required").max(200, "Track name must not exceed 200 characters"),
  sessionType: z.string().max(200).optional(),
  weather: z.string().max(200).optional(),
  trackTemp: z.string().max(200).optional(),
  airTemp: z.string().max(200).optional(),
  fuelLoad: z.string().max(200).optional(),
  tyreCompound: z.string().max(200).optional(),
  driverStyle: z.string().max(1000).optional(),
  handlingIssue: z.string().max(2000).optional(),
  skillLevel: z.string().max(200).optional(),
  customModProfile: z.record(z.string(), z.any()).nullable().optional(),
  baselineSetup: z.object({
    summary: z.string().optional(),
    sections: z.array(
      z.object({
        title: z.string(),
        items: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
            styleNote: z.string().optional(),
          }).passthrough()
        ),
      }).passthrough()
    ),
  }).nullable().optional(),
  telemetryContext: z.record(z.string(), z.any()).nullable().optional(),
  fullBaselineRequested: z.boolean().optional(),
});

export type GenerateSetupRequest = z.infer<typeof GenerateSetupRequestSchema>;
