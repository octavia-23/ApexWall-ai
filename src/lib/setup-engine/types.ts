import { SetupSection } from "@/types/telemetry";

export type ParameterRuleSource = "HARD_FACT" | "VERIFIED_GAME_RULE" | "ENGINEERING_HEURISTIC" | "UNCERTAIN";

export type VehicleSubsystem = 
  | "tyres" 
  | "alignment" 
  | "mechanical_platform" 
  | "dampers" 
  | "aero" 
  | "drivetrain" 
  | "brakes" 
  | "electronics";

export interface ParameterDefinition {
  id: string;
  label: string;
  aliases: string[];
  menuTab: string;
  subsystem: VehicleSubsystem;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  source: ParameterRuleSource;
  formatDisplay?: (val: number) => string;
  parseValue?: (valStr: string) => number | null;
}

export type HandlingProblemPhase = 
  | "ENTRY" 
  | "MID_CORNER" 
  | "EXIT" 
  | "HIGH_SPEED" 
  | "KERBS" 
  | "STRAIGHT" 
  | "TYRES_THERMAL"
  | "GENERAL";

export interface SetupChange {
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
}

export interface SetupDiagnosticPlan {
  phase: HandlingProblemPhase;
  primaryLimiter: string;
  primaryTargetParams: string[];   // 1 to 3 primary parameters
  secondaryTargetParams: string[]; // 0 to 2 secondary parameters
  doNotTouchParams: string[];     // Protected parameters locked to baseline
  allowedDeltas: Record<string, { maxSteps: number; maxAbsDelta: number; preferredDirection?: "increase" | "decrease" }>;
  driverTechniqueFlag?: string;    // If driver input is the primary cause
  tradeoffsConsidered: { desired: string; secondaryRisk: string };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidenceFound: string[];
  hasTelemetryEvidence: boolean;
}

export interface SetupValidationReport {
  isValid: boolean;
  repairedCount: number;
  repairs: Array<{ param: string; original: string; repaired: string; reason: string }>;
  rejected: Array<{ param: string; reason: string }>;
  coherenceWarnings: string[];
}

export interface SetupEngineRequest {
  game: string;
  car: string;
  track: string;
  sessionType?: string;
  weather?: string;
  trackTemp?: string;
  airTemp?: string;
  fuelLoad?: string;
  tyreCompound?: string;
  driverStyle?: string;
  handlingIssue?: string;
  skillLevel?: string;
  customModProfile?: any;
  baselineSetup?: { summary?: string; sections: SetupSection[] };
  telemetryContext?: any;
  fullBaselineRequested?: boolean;
}

export interface SetupEngineResult {
  summary: string;
  setupPhilosophy: string;
  primaryLimiter: string;
  isBaseline: boolean;
  sections: SetupSection[];
  changes: SetupChange[];
  evidence: string[];
  rationale: string;
  tradeoff: string;
  expectedEffect: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  testOrder: string[];
  knownLimitations: string[];
  engineerNotes: string;
  validationStatus: SetupValidationReport;
}
