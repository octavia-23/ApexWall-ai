export type SampleQuality = "measured" | "interpolated" | "missing";

export interface TelemetryChannelQuality {
  channel: string;
  totalSamples: number;
  validSamples: number;
  missingSamples: number;
  coveragePct: number;
  status: "available" | "partial" | "missing";
}

export interface TelemetryDataQuality {
  totalRows: number;
  channels: Record<string, TelemetryChannelQuality>;
  overallQuality: "good" | "degraded" | "insufficient";
  warnings: string[];
}

export interface TelemetryPoint {
  time: number;
  dist: number;
  speed: number | null;
  throttle: number | null;
  brake: number | null;
  steer: number | null;
  gear: number | null;
  rpm: number | null;
  latG: number | null;
  longG: number | null;
  tempFL: number | null;
  tempFR: number | null;
  tempRL: number | null;
  tempRR: number | null;
  pressFL: number | null;
  pressFR: number | null;
  pressRL: number | null;
  pressRR: number | null;
  understeerAngle?: number | null; // Steering angle minus Ackermann angle (positive = understeer, negative = oversteer)
  quality?: Partial<Record<string, SampleQuality>>;
}

export interface CornerPhaseBalance {
  entry: "Oversteer" | "Neutral" | "Understeer" | "Unavailable";
  mid: "Oversteer" | "Neutral" | "Understeer" | "Unavailable";
  exit: "Oversteer" | "Neutral" | "Understeer" | "Unavailable";
  entryDeltaDeg: number | null;
  midDeltaDeg: number | null;
  exitDeltaDeg: number | null;
  verdict: string;
  availability?: "available" | "partial" | "unavailable";
}

export interface TyreOptimizationReport {
  recommendedCold: {
    FL: number | null;
    FR: number | null;
    RL: number | null;
    RR: number | null;
  };
  observedHot: {
    FL: number | null;
    FR: number | null;
    RL: number | null;
    RR: number | null;
  };
  targetHot: number;
  pressureDelta: {
    FL: number | null;
    FR: number | null;
    RL: number | null;
    RR: number | null;
  };
  status: string;
  availability?: "available" | "partial" | "unavailable";
}

export interface DriverVsCarDiagnostics {
  driverTechniquePoints: string[];
  mechanicalSetupPoints: string[];
}

export interface TyreCornerData {
  temp: string;
  pressure: string;
}

export interface MinCornerSpeed {
  dist: number;
  speed: number;
  steer: number;
}

export interface TelemetryStats {
  lapTime: string;
  topSpeed: number | null;
  minSpeed: number | null;
  maxLatG: number | null;
  maxDecelG: number | null;
  minCornerSpeeds: MinCornerSpeed[];
  trailBrakingScore: number | null;
  throttleSmoothness: number | null;
  steeringScrub: number | null;
  tyres: {
    FL: TyreCornerData;
    FR: TyreCornerData;
    RL: TyreCornerData;
    RR: TyreCornerData;
  };
  dataQuality?: TelemetryDataQuality;
}

export interface TelemetryAnomaly {
  location: string;
  description: string;
  channel: string;
}

export interface ParsedTelemetryFile {
  filename: string;
  rawCount: number;
  lapTime: string;
  topSpeed: number | null;
  minSpeed: number | null;
  maxLatG: number | null;
  maxDecelG: number | null;
  minCornerSpeeds: MinCornerSpeed[];
  trailBrakingScore: number | null;
  throttleSmoothness: number | null;
  steeringScrub: number | null;
  tyreStats: {
    FL: TyreCornerData;
    FR: TyreCornerData;
    RL: TyreCornerData;
    RR: TyreCornerData;
  };
  detectedAnomalies: TelemetryAnomaly[];
  points: TelemetryPoint[];
  channels: string[];
  dataQuality?: TelemetryDataQuality;
  phaseBalance?: CornerPhaseBalance;
  tyreOptimization?: TyreOptimizationReport;
  driverVsCar?: DriverVsCarDiagnostics;
}

export interface KpiRating {
  name: string;
  score: number;
  status: string;
  feedback: string;
}

export interface CornerBreakdown {
  corner: string;
  timeDelta: string;
  driverInput: string;
  chassisResponse: string;
  actionableFix: string;
}

export interface DriverCoaching {
  phase: string;
  icon: string;
  tip: string;
}

export interface SetupAdjustment {
  category: string;
  component: string;
  adjustment: string;
  rationale: string;
}

export interface SetupItem {
  label: string;
  value: string;
  styleNote?: string;
}

export interface SetupSection {
  title: string;
  items: SetupItem[];
}

export interface AdaptiveSetup {
  philosophy: string;
  sections: SetupSection[];
}

export interface CornerDeltaComparison {
  corner: string;
  shortName?: string;
  dist: number;
  driverMinSpeed: number | null;
  refMinSpeed: number | null;
  speedDelta: number | null;
  timeDelta: number;
  brakingPointDeltaMeters: number;
  throttleCommitDeltaMeters: number;
  verdict: string;
}

export interface DeltaPoint {
  dist: number;
  timeDelta: number;
  speedDelta: number | null;
  driverSpeed: number | null;
  refSpeed: number | null;
  driverThrottle: number | null;
  refThrottle: number | null;
  driverBrake: number | null;
  refBrake: number | null;
}

export interface GGPoint {
  latG: number | null;
  longG: number | null;
  speed: number | null;
  dist: number;
  throttle: number | null;
  brake: number | null;
  gTotal: number | null;
}

export interface GGFrictionQuadrantStats {
  trailBrakingLeftGripPct: number;
  trailBrakingRightGripPct: number;
  powerDownLeftGripPct: number;
  powerDownRightGripPct: number;
}

export interface GGFrictionCircleData {
  scaleMaxG: number;
  peakCombinedG: number | null;
  peakLatG: number | null;
  peakDecelG: number | null;
  gripUtilizationPct: number | null;
  trailBrakingTransitionEfficiency: number | null;
  quadrantStats: GGFrictionQuadrantStats;
  points: GGPoint[];
  envelopeHull: { latG: number; longG: number }[];
  refEnvelopeHull?: { latG: number; longG: number }[];
  refGripUtilizationPct?: number | null;
  gripDeficitVerdict: string;
  dataQuality?: {
    validSampleCount: number;
    totalSampleCount: number;
    coveragePct: number;
    status: "available" | "partial" | "insufficient";
  };
}

export interface LapComparisonSummary {
  driverLapTime: string;
  refLapTime: string;
  totalTimeDeltaSeconds: number;
  topSpeedDeltaKmh: number;
  cornerComparisons: CornerDeltaComparison[];
  deltaPoints: DeltaPoint[];
  frictionCircle?: GGFrictionCircleData;
}

export interface TelemetryAnalysisResult {
  overallScore: number;
  verdictTitle: string;
  lapTimeObserved?: string;
  estimatedTimeLost?: string;
  primaryLimiter?: string;
  executiveSummary?: string;
  kpiRatings?: KpiRating[];
  cornerBreakdowns?: CornerBreakdown[];
  driverCoaching?: DriverCoaching[];
  setupAdjustments?: SetupAdjustment[];
  adaptiveSetup?: AdaptiveSetup;
  pitRadioMessage?: string;
  lapComparison?: LapComparisonSummary;
  frictionCircle?: GGFrictionCircleData;
  phaseBalance?: CornerPhaseBalance;
  tyreOptimization?: TyreOptimizationReport;
  driverVsCar?: DriverVsCarDiagnostics;
  dataQuality?: TelemetryDataQuality;
}

export interface GeneratedSetupResult {
  summary: string;
  sections: SetupSection[];
  engineerNotes: string;
  setupPhilosophy?: string;
  primaryLimiter?: string;
  isBaseline?: boolean;
  changes?: Array<{
    parameter: string;
    oldValue: string | number;
    newValue: string | number;
    delta: string | number;
    evidence: string[];
    diagnosis: string;
    rationale: string;
    tradeoff: string;
    expectedEffect: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    validationTest: string;
  }>;
  evidence?: string[];
  rationale?: string;
  tradeoff?: string;
  expectedEffect?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  testOrder?: string[];
  knownLimitations?: string[];
  validationStatus?: {
    isValid: boolean;
    repairedCount: number;
    repairs: Array<{ param: string; original: string; repaired: string; reason: string }>;
    rejected: Array<{ param: string; reason: string }>;
    coherenceWarnings: string[];
  };
}

export interface TrackCorner {
  id: string;
  name: string;
  shortName: string;
  dist: number;
  x: number;
  y: number;
  driverSpeed?: number | null;
  refSpeed?: number | null;
  speedDelta?: number | null;
  timeDelta?: number;
  brakingPointDeltaMeters?: number;
  throttleCommitDeltaMeters?: number;
  verdict?: string;
}

export interface TrackMapPoint {
  dist: number;
  x: number;
  y: number;
  speed: number | null;
  throttle: number | null;
  brake: number | null;
  latG: number | null;
  timeDelta?: number;
  refSpeed?: number | null;
  cornerName?: string;
}

export interface TrackDrsZone {
  name: string;
  start: number;
  end: number;
}

export interface TrackSector {
  sector: number;
  dist: number;
}

export interface TrackMapData {
  circuitKey?: string;
  circuitName: string;
  country?: string;
  fiaGrade?: string;
  totalDistance: number;
  points: TrackMapPoint[];
  fullCircuitPoints?: { dist: number; x: number; y: number }[];
  corners: TrackCorner[];
  drsZones?: TrackDrsZone[];
  sectors?: TrackSector[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}
