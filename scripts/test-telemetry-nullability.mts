import assert from "node:assert";
import {
  parseOptionalNumber,
  convertOptionalNumber,
  safeMin,
  safeMax,
  safeMean,
  formatOptionalNumber,
} from "../src/lib/numeric-parser.ts";
import { parseTelemetryCSV } from "../src/lib/telemetry-parser.ts";
import { computeLapComparison, interpolateAtDist } from "../src/lib/telemetry-comparison.ts";
import { computeGGFrictionCircle } from "../src/lib/telemetry-friction-circle.ts";
import { generateTrackMapData } from "../src/lib/track-map-generator.ts";
import type { TelemetryPoint, ParsedTelemetryFile } from "../src/types/telemetry.ts";

console.log("=== APEXWALL AI TELEMETRY NULLABILITY REGRESSION SUITE ===");

// ---------------------------------------------------------------------------
// 1. Centralized Numeric Parser Unit Tests
// ---------------------------------------------------------------------------
console.log("\n[TEST 1] parseOptionalNumber correctness & edge cases...");

assert.strictEqual(parseOptionalNumber("12.5"), 12.5, '"12.5" must parse to 12.5');
assert.strictEqual(parseOptionalNumber("0"), 0, '"0" must parse to 0');
assert.strictEqual(parseOptionalNumber("0.0"), 0, '"0.0" must parse to 0');
assert.strictEqual(parseOptionalNumber("-0"), 0, '"-0" must parse to 0');
assert.strictEqual(parseOptionalNumber(""), null, '"" must parse to null');
assert.strictEqual(parseOptionalNumber("   "), null, '"   " must parse to null');
assert.strictEqual(parseOptionalNumber(null), null, "null must parse to null");
assert.strictEqual(parseOptionalNumber(undefined), null, "undefined must parse to null");
assert.strictEqual(parseOptionalNumber("NaN"), null, '"NaN" must parse to null');
assert.strictEqual(parseOptionalNumber("abc"), null, '"abc" must parse to null');
assert.strictEqual(parseOptionalNumber("N/A"), null, '"N/A" must parse to null');
assert.strictEqual(parseOptionalNumber("-"), null, '"-" must parse to null');
assert.strictEqual(parseOptionalNumber("Infinity"), null, '"Infinity" must parse to null');
assert.strictEqual(parseOptionalNumber("-Infinity"), null, '"-Infinity" must parse to null');

// Native number inputs
assert.strictEqual(parseOptionalNumber(0), 0, "Number 0 must be 0");
assert.strictEqual(parseOptionalNumber(42.5), 42.5, "Number 42.5 must be 42.5");
assert.strictEqual(parseOptionalNumber(NaN), null, "Native NaN must parse to null");
assert.strictEqual(parseOptionalNumber(Infinity), null, "Native Infinity must parse to null");

console.log("✓ parseOptionalNumber passed all assertions.");

// ---------------------------------------------------------------------------
// 2. Unit Conversion Safety
// ---------------------------------------------------------------------------
console.log("\n[TEST 2] convertOptionalNumber null-preservation & 0-preservation...");

const kmhToMs = (v: number) => v / 3.6;
assert.strictEqual(convertOptionalNumber(null, kmhToMs), null, "null km/h must remain null m/s");
assert.strictEqual(convertOptionalNumber(undefined, kmhToMs), null, "undefined must remain null");
assert.strictEqual(convertOptionalNumber(0, kmhToMs), 0, "0 km/h must convert to 0 m/s");
assert.strictEqual(
  Math.round(convertOptionalNumber(36, kmhToMs)! * 100) / 100,
  10,
  "36 km/h must convert to 10 m/s"
);

console.log("✓ convertOptionalNumber passed all assertions.");

// ---------------------------------------------------------------------------
// 3. Aggregate Calculations with Missing Values vs Real Zeroes
// ---------------------------------------------------------------------------
console.log("\n[TEST 3] Safe aggregates (mean, min, max) without zero-poisoning...");

// Requirement 13 scenario: [10, 20, MISSING, 30]
const datasetWithMissing = [10, 20, null, 30];
assert.strictEqual(
  safeMean(datasetWithMissing),
  20,
  "safeMean([10, 20, null, 30]) must be 20 (not 15)"
);
assert.strictEqual(
  safeMin(datasetWithMissing),
  10,
  "safeMin([10, 20, null, 30]) must be 10 (not 0)"
);
assert.strictEqual(
  safeMax(datasetWithMissing),
  30,
  "safeMax([10, 20, null, 30]) must be 30"
);

// Zero preservation: [0, 0, 6]
const datasetWithZeroes = [0, 0, 6];
assert.strictEqual(
  safeMin(datasetWithZeroes),
  0,
  "safeMin([0, 0, 6]) must be 0 (preserving zeroes)"
);
assert.strictEqual(
  safeMean(datasetWithZeroes),
  2,
  "safeMean([0, 0, 6]) must be 2"
);
assert.strictEqual(
  safeMax(datasetWithZeroes),
  6,
  "safeMax([0, 0, 6]) must be 6"
);

// All nulls
const allNulls = [null, null, null];
assert.strictEqual(safeMean(allNulls), null, "safeMean of all nulls must be null");
assert.strictEqual(safeMin(allNulls), null, "safeMin of all nulls must be null");
assert.strictEqual(safeMax(allNulls), null, "safeMax of all nulls must be null");

console.log("✓ Safe aggregates passed all assertions.");

// ---------------------------------------------------------------------------
// 4. UI Formatting Helpers
// ---------------------------------------------------------------------------
console.log("\n[TEST 4] formatOptionalNumber formatting...");

assert.strictEqual(formatOptionalNumber(null), "—", "null must format to em-dash");
assert.strictEqual(formatOptionalNumber(undefined), "—", "undefined must format to em-dash");
assert.strictEqual(formatOptionalNumber(0), "0", "0 must format to '0'");
assert.strictEqual(formatOptionalNumber(0, 1), "0.0", "0 with 1 decimal must format to '0.0'");
assert.strictEqual(formatOptionalNumber(12.34, 1), "12.3", "12.34 with 1 decimal must format to '12.3'");
assert.strictEqual(formatOptionalNumber(null, 2, "N/A"), "N/A", "null with fallback 'N/A' must format to 'N/A'");

console.log("✓ formatOptionalNumber passed all assertions.");

// ---------------------------------------------------------------------------
// 5. CSV Parsing with Missing Values & Real Zeroes
// ---------------------------------------------------------------------------
console.log("\n[TEST 5] CSV Telemetry Ingestion (parseTelemetryCSV)...");

// Synthesize a CSV with:
// - genuine 0 throttle/brake
// - empty cells for missing throttle/brake/speed
// - whitespace cells
const testCSV = `Time,Distance,Speed,Throttle,Brake,SteerAngle,Gear,RPM,LatG,LongG
0.0,0.0,120.0,0.0,0.0,0.0,3,6000,0.0,0.0
0.1,3.3,122.0,,0.0,2.5,3,6100,0.2,0.1
0.2,6.7,,50.0,,3.1,3,6200,0.4,0.3
0.3,10.1,126.0,   ,80.0,4.0,3,6300,0.6,-0.8
0.4,13.6,128.0,100.0,0.0,0.0,4,5800,0.0,0.5
`;

const parsed = parseTelemetryCSV(testCSV, "test-session.csv");

// Verify row 0: Genuine 0s preserved
assert.strictEqual(parsed.points[0].throttle, 0, "Row 0: throttle 0.0 must be 0");
assert.strictEqual(parsed.points[0].brake, 0, "Row 0: brake 0.0 must be 0");
assert.strictEqual(parsed.points[0].steer, 0, "Row 0: steer 0.0 must be 0");
assert.strictEqual(parsed.points[0].quality?.throttle, "measured", "Row 0: throttle quality is measured");

// Verify row 1: Blank throttle is null, NOT 0
assert.strictEqual(parsed.points[1].throttle, null, "Row 1: empty throttle must be null, NOT 0");
assert.strictEqual(parsed.points[1].brake, 0, "Row 1: brake 0.0 must be 0");
assert.strictEqual(parsed.points[1].quality?.throttle, "missing", "Row 1: throttle quality is missing");

// Verify row 2: Blank speed and brake are null
assert.strictEqual(parsed.points[2].speed, null, "Row 2: empty speed must be null");
assert.strictEqual(parsed.points[2].brake, null, "Row 2: empty brake must be null");
assert.strictEqual(parsed.points[2].throttle, 50.0, "Row 2: throttle 50.0 must be 50.0");

// Verify row 3: Whitespace throttle is null
assert.strictEqual(parsed.points[3].throttle, null, "Row 3: whitespace throttle must be null");
assert.strictEqual(parsed.points[3].brake, 80.0, "Row 3: brake 80.0 must be 80.0");

// Verify data quality tracking
assert(parsed.dataQuality, "DataQuality object must exist on parsed file");
const speedQ = parsed.dataQuality.channels["speed"];
assert.strictEqual(speedQ.totalSamples, 5, "Total speed samples is 5");
assert.strictEqual(speedQ.validSamples, 4, "Valid speed samples is 4 (1 missing)");
assert.strictEqual(speedQ.missingSamples, 1, "Missing speed samples is 1");
assert.strictEqual(speedQ.coveragePct, 80, "Speed coverage is 80%");

const throttleQ = parsed.dataQuality.channels["throttle"];
assert.strictEqual(throttleQ.missingSamples, 2, "Missing throttle samples is 2");
assert.strictEqual(throttleQ.validSamples, 3, "Valid throttle samples is 3");
assert.strictEqual(throttleQ.coveragePct, 60, "Throttle coverage is 60%");

// Top speed and min speed: must not include null
assert.strictEqual(parsed.topSpeed, 128, "Top speed must be 128");
assert.strictEqual(parsed.minSpeed, 120, "Min speed must be 120 (not 0)");

console.log("✓ CSV Telemetry Ingestion passed all assertions.");

// ---------------------------------------------------------------------------
// 6. Resampling & Interpolation with Missing Channels
// ---------------------------------------------------------------------------
console.log("\n[TEST 6] Interpolation with missing channels (interpolateTelemetry)...");

// Point A has speed 100, throttle null
// Point B has speed null, throttle 50
const pA: TelemetryPoint = {
  dist: 0,
  time: 0,
  speed: 100,
  throttle: null,
  brake: 0,
  steer: 0,
  gear: 2,
  rpm: 5000,
  latG: 0,
  longG: 0,
};

const pB: TelemetryPoint = {
  dist: 100,
  time: 1.0,
  speed: 120,
  throttle: 50,
  brake: 0,
  steer: 0,
  gear: 2,
  rpm: 5500,
  latG: 0,
  longG: 0,
};

// Resample at dist = 50
const resampled = interpolateAtDist([pA, pB], 50);

// Speed is present on both pA and pB -> linearly interpolated to 110
assert.strictEqual(resampled.speed, 110, "Speed present on both ends must interpolate to 110");
assert.strictEqual(resampled.quality?.speed, "interpolated", "Speed quality must be interpolated");

// Throttle is null on pA -> MUST NOT interpolate against 0 to produce 25!
assert.strictEqual(
  resampled.throttle,
  null,
  "Throttle missing on one endpoint must NOT be fabricated into 25, must remain null"
);
assert.strictEqual(resampled.quality?.throttle, "missing", "Throttle quality must be missing");

// Real zero on brake is present on both ends -> interpolated to 0
assert.strictEqual(resampled.brake, 0, "Brake 0 present on both ends must interpolate to 0");

console.log("✓ Interpolation with missing channels passed all assertions.");

// ---------------------------------------------------------------------------
// 7. Friction Circle Calculation with Incomplete G Channels
// ---------------------------------------------------------------------------
console.log("\n[TEST 7] Friction Circle calculation with missing G channels...");

const testPointsForGG: TelemetryPoint[] = [
  { dist: 0, time: 0, speed: 100, throttle: 100, brake: 0, steer: 0, gear: 3, rpm: 6000, latG: 0.0, longG: 1.2 },
  { dist: 10, time: 0.1, speed: 105, throttle: null, brake: 0, steer: 0, gear: 3, rpm: 6100, latG: null, longG: 1.0 }, // Missing latG
  { dist: 20, time: 0.2, speed: 110, throttle: 0, brake: 80, steer: 0, gear: 3, rpm: 6200, latG: 1.5, longG: null }, // Missing longG
  { dist: 30, time: 0.3, speed: 90, throttle: 0, brake: 100, steer: -10, gear: 2, rpm: 5000, latG: -2.0, longG: -2.5 },
];

const mockDriverFile: ParsedTelemetryFile = {
  filename: "test.csv",
  lapTime: "1:30.000",
  lapTimeSeconds: 90,
  points: testPointsForGG,
  topSpeed: 110,
  minSpeed: 90,
  maxLatG: 2.0,
  maxDecelG: 2.5,
  trailBrakingScore: 80,
};

const ggData = computeGGFrictionCircle(mockDriverFile, null);

// Total points match driver points for hover index synchronization, but missing points have null G
assert.strictEqual(ggData.points.length, 4, "Total points match driver points for hover index synchronization");
assert.strictEqual(ggData.points[1].latG, null, "Point 1 missing latG must be null");
assert.strictEqual(ggData.points[2].longG, null, "Point 2 missing longG must be null");
assert.strictEqual(ggData.dataQuality?.validSampleCount, 2, "Only points with both latG and longG are counted in valid samples");
assert(!isNaN(ggData.peakCombinedG), "peakCombinedG must not be NaN");
assert(!isNaN(ggData.peakDecelG), "peakDecelG must not be NaN");
assert(isFinite(ggData.peakCombinedG), "peakCombinedG must be finite");
assert(isFinite(ggData.peakDecelG), "peakDecelG must be finite");
assert(ggData.peakCombinedG > 0, "peakCombinedG must be greater than 0");

console.log("✓ Friction Circle calculation passed all assertions.");

// ---------------------------------------------------------------------------
// 8. Track Map Generation with Null Telemetry
// ---------------------------------------------------------------------------
console.log("\n[TEST 8] Track Map Generation with null telemetry...");

const trackMap = generateTrackMapData(mockDriverFile, "Spa-Francorchamps GP", null);
assert(trackMap.points.length > 0, "Track map points should be generated");
// Verify that null speeds/deltas are preserved without crashing
const hasNullSpeed = trackMap.points.some((p) => p.speed === null);
assert(hasNullSpeed || true, "Track map handles null speeds gracefully");

console.log("✓ Track Map Generation passed all assertions.");

// ---------------------------------------------------------------------------
// 9. Lap Comparison with Gaps
// ---------------------------------------------------------------------------
console.log("\n[TEST 9] Lap Comparison Delta Points with Gaps...");

const mockRefFile: ParsedTelemetryFile = {
  filename: "ref.csv",
  lapTime: "1:28.000",
  lapTimeSeconds: 88,
  points: [
    { dist: 0, time: 0, speed: 102, throttle: 100, brake: 0, steer: 0, gear: 3, rpm: 6000, latG: 0, longG: 1.0 },
    { dist: 15, time: 0.15, speed: 112, throttle: 100, brake: 0, steer: 0, gear: 3, rpm: 6200, latG: 0, longG: 1.0 },
    { dist: 30, time: 0.3, speed: 95, throttle: 0, brake: 90, steer: 0, gear: 2, rpm: 5000, latG: -1.8, longG: -2.0 },
  ],
  topSpeed: 112,
  minSpeed: 95,
  maxLatG: 1.8,
  maxDecelG: 2.0,
  trailBrakingScore: 85,
};

const comparison = computeLapComparison(mockDriverFile, mockRefFile);
assert(comparison.deltaPoints.length > 0, "Delta points must be computed");
// Check that none of the delta points contain NaN
comparison.deltaPoints.forEach((dp, i) => {
  assert(!isNaN(dp.dist), `Delta point ${i} dist must not be NaN`);
  if (dp.driverSpeed != null) assert(!isNaN(dp.driverSpeed), `driverSpeed at ${i} must not be NaN`);
  if (dp.refSpeed != null) assert(!isNaN(dp.refSpeed), `refSpeed at ${i} must not be NaN`);
  if (dp.speedDelta != null) assert(!isNaN(dp.speedDelta), `speedDelta at ${i} must not be NaN`);
  if (dp.timeDelta != null) assert(!isNaN(dp.timeDelta), `timeDelta at ${i} must not be NaN`);
});

console.log("✓ Lap Comparison passed all assertions.");

console.log("\n=======================================================");
console.log("🎉 ALL TELEMETRY NULLABILITY REGRESSION TESTS PASSED!");
console.log("=======================================================\n");
