import {
  VehicleSimParameters,
  LapSimulationPoint,
  LapSimSectorBreakdown,
  SetupSensitivityDelta,
  LapSimulationResult,
} from "@/types/telemetry";
import { getAuthenticTrackGeometry } from "./circuit-geometries";

export interface SimulationOptions {
  trackName?: string;
  vehicleParams?: Partial<VehicleSimParameters>;
  airTempCelsius?: number;
  trackLengthMeters?: number;
}

const DEFAULT_GT3_PARAMS: VehicleSimParameters = {
  massKg: 1320,
  enginePowerBhp: 520,
  dragCdA: 1.54, // Cd * A = 0.72 * 2.14 m²
  downforceClA: 5.25, // Cl * A = 2.45 * 2.14 m²
  aeroBalanceFrontPct: 42.5,
  tireMuX: 1.72,
  tireMuY: 1.84,
  weightDistributionFrontPct: 48.0,
  drivetrainEfficiency: 0.88,
};

interface TrackSegment {
  dist: number;
  curvature: number; // 1 / Radius (1/m)
  sector: number;
}

/**
 * Discretizes circuit curvature into uniform track segments
 */
function buildTrackSegments(trackName: string, customLength?: number): TrackSegment[] {
  const geometry = getAuthenticTrackGeometry(trackName, customLength);
  const totalLength = geometry ? geometry.officialDistance : customLength || 5793; // default Monza length
  const step = 20; // 20m spatial resolution
  const segmentCount = Math.floor(totalLength / step);

  const corners = geometry?.corners || [
    { name: "Turn 1", dist: 600, radius: 45, angle: 95 },
    { name: "Turn 4", dist: 1800, radius: 85, angle: 65 },
    { name: "Turn 7", dist: 2800, radius: 120, angle: 50 },
    { name: "Turn 8", dist: 4200, radius: 90, angle: 80 },
    { name: "Turn 11", dist: 5200, radius: 110, angle: 70 },
  ];

  const segments: TrackSegment[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const dist = i * step;

    // Sector 1: 0 - 33%, Sector 2: 33% - 66%, Sector 3: 66% - 100%
    const progress = dist / totalLength;
    const sector = progress < 0.33 ? 1 : progress < 0.67 ? 2 : 3;

    // Determine curvature from nearest corner apex
    let maxCurvature = 0.0001; // small straightline curvature
    for (const c of corners) {
      const cornerRadius = (c as any).radius || 80;
      const cornerSpan = Math.max(70, cornerRadius * 1.5);
      const d = Math.abs(dist - c.dist);
      if (d <= cornerSpan) {
        // Smooth parabolic curvature envelope over corner apex
        const curveEnvelope = Math.cos((d / cornerSpan) * (Math.PI / 2));
        const curve = (1.0 / cornerRadius) * curveEnvelope;
        if (curve > maxCurvature) maxCurvature = curve;
      }
    }

    segments.push({
      dist,
      curvature: maxCurvature,
      sector,
    });
  }

  return segments;
}

/**
 * Runs Quasi-Static Point-Mass forward-backward velocity integration
 */
function solveLapVelocityProfile(
  segments: TrackSegment[],
  params: VehicleSimParameters,
  airDensity: number = 1.225
): { speedsMs: number[]; timesSeconds: number[] } {
  const n = segments.length;
  const ds = segments[1].dist - segments[0].dist;
  const g = 9.80665;
  const mass = params.massKg;
  const powerWatts = params.enginePowerBhp * 745.7 * params.drivetrainEfficiency;

  // 1. Calculate Maximum Permissible Cornering Speed Envelope (Kamm Friction Circle)
  // m * v^2 * kappa = mu_y * (m * g + 0.5 * rho * ClA * v^2)
  // v^2 * (m * kappa - 0.5 * rho * ClA * mu_y) = mu_y * m * g
  const vCornerLimitMs: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = segments[i].curvature;
    if (k <= 0.0002) {
      // Long straight: limit only by terminal top speed (~340 km/h)
      vCornerLimitMs[i] = 340 / 3.6;
    } else {
      const denom = mass * k - 0.5 * airDensity * params.downforceClA * params.tireMuY;
      if (denom > 0) {
        const vSq = (params.tireMuY * mass * g) / denom;
        vCornerLimitMs[i] = Math.sqrt(Math.max(12, vSq));
      } else {
        // High downforce overcomes cornering inertia (flat-out through corner)
        vCornerLimitMs[i] = 320 / 3.6;
      }
    }
  }

  // 2. Forward Acceleration Pass
  const vForwardMs: number[] = new Array(n);
  vForwardMs[0] = Math.min(vCornerLimitMs[0], 65 / 3.6); // starting speed out of last corner

  for (let i = 0; i < n - 1; i++) {
    const v = Math.max(10.0, vForwardMs[i]);
    const fAeroDown = 0.5 * airDensity * params.downforceClA * v * v;
    const fAeroDrag = 0.5 * airDensity * params.dragCdA * v * v;
    const fRolling = 0.015 * mass * g;

    // Driving traction on rear axle
    const rearNormalN = mass * g * (1 - params.weightDistributionFrontPct / 100) + fAeroDown * (1 - params.aeroBalanceFrontPct / 100);
    const maxTractionN = params.tireMuX * rearNormalN;
    const powerDriveForceN = powerWatts / v;
    const fTractive = Math.min(powerDriveForceN, maxTractionN);

    // Lateral grip fraction currently utilized
    const latAcc = v * v * segments[i].curvature;
    const maxLatAcc = (params.tireMuY * (mass * g + fAeroDown)) / mass;
    const latGripRatio = Math.min(0.96, latAcc / Math.max(1.0, maxLatAcc));
    const longitudinalGripRetention = Math.sqrt(Math.max(0.05, 1.0 - Math.pow(latGripRatio, 2)));

    const netForceN = (fTractive * longitudinalGripRetention) - fAeroDrag - fRolling;
    const aAccel = Math.max(0, netForceN / mass);

    const vNextSq = v * v + 2 * aAccel * ds;
    const vNext = Math.sqrt(Math.max(10, vNextSq));
    vForwardMs[i + 1] = Math.min(vCornerLimitMs[i + 1], vNext);
  }

  // 3. Backward Braking Pass
  const vFinalMs: number[] = new Array(n);
  vFinalMs[n - 1] = vForwardMs[n - 1];

  for (let i = n - 1; i > 0; i--) {
    const v = Math.max(10.0, vFinalMs[i]);
    const fAeroDown = 0.5 * airDensity * params.downforceClA * v * v;
    const fAeroDrag = 0.5 * airDensity * params.dragCdA * v * v;

    const totalNormalN = mass * g + fAeroDown;
    const maxBrakeForceN = params.tireMuX * totalNormalN;

    const latAcc = v * v * segments[i].curvature;
    const maxLatAcc = (params.tireMuY * totalNormalN) / mass;
    const latGripRatio = Math.min(0.96, latAcc / Math.max(1.0, maxLatAcc));
    const longitudinalGripRetention = Math.sqrt(Math.max(0.05, 1.0 - Math.pow(latGripRatio, 2)));

    const netBrakingForceN = (maxBrakeForceN * longitudinalGripRetention) + fAeroDrag;
    const aDecel = netBrakingForceN / mass;

    const vPrevSq = v * v + 2 * aDecel * ds;
    const vPrevAllowed = Math.sqrt(vPrevSq);

    vFinalMs[i - 1] = Math.min(vForwardMs[i - 1], vPrevAllowed);
  }

  // 4. Time Integration
  const timesSeconds: number[] = new Array(n);
  timesSeconds[0] = 0;
  for (let i = 0; i < n - 1; i++) {
    const vAvg = (vFinalMs[i] + vFinalMs[i + 1]) / 2.0;
    const dt = ds / Math.max(5.0, vAvg);
    timesSeconds[i + 1] = timesSeconds[i] + dt;
  }

  return { speedsMs: vFinalMs, timesSeconds };
}

/**
 * Computes full Quasi-Static Closed-Loop Lap Simulation with Setup Sensitivities
 */
export function computeLapSimulation(
  options: SimulationOptions = {}
): LapSimulationResult {
  const trackName = options.trackName || "Autodromo Nazionale Monza";
  const params: VehicleSimParameters = {
    ...DEFAULT_GT3_PARAMS,
    ...options.vehicleParams,
  };

  const segments = buildTrackSegments(trackName, options.trackLengthMeters);
  const trackLengthMeters = segments[segments.length - 1].dist + (segments[1].dist - segments[0].dist);

  const { speedsMs, timesSeconds } = solveLapVelocityProfile(segments, params);
  const totalLapTimeSeconds = Number(timesSeconds[timesSeconds.length - 1].toFixed(3));

  // Format mm:ss.fff
  const m = Math.floor(totalLapTimeSeconds / 60);
  const s = (totalLapTimeSeconds % 60).toFixed(3);
  const lapTimeFormatted = `${m}:${s.padStart(6, "0")}`;

  const speedsKmh = speedsMs.map((v) => Math.round(v * 3.6));
  const topSpeedKmh = Math.max(...speedsKmh);
  const averageSpeedKmh = Math.round((trackLengthMeters / totalLapTimeSeconds) * 3.6);

  // Sector Breakdowns
  const sectors: LapSimSectorBreakdown[] = [1, 2, 3].map((sec) => {
    const secPoints = segments.map((seg, idx) => ({ seg, idx })).filter((item) => item.seg.sector === sec);
    const startIdx = secPoints[0].idx;
    const endIdx = secPoints[secPoints.length - 1].idx;
    const secTime = timesSeconds[endIdx] - (startIdx > 0 ? timesSeconds[startIdx - 1] : 0);
    const secSpeeds = secPoints.map((item) => speedsKmh[item.idx]);
    return {
      sector: sec,
      timeSeconds: Number(secTime.toFixed(3)),
      minSpeedKmh: Math.min(...secSpeeds),
      topSpeedKmh: Math.max(...secSpeeds),
    };
  });

  // Downsample simulation points for telemetry charting (target ~150 points)
  const stepInterval = Math.max(1, Math.floor(segments.length / 140));
  const points: LapSimulationPoint[] = [];

  for (let i = 0; i < segments.length; i += stepInterval) {
    const vMs = speedsMs[i];
    const vKmh = speedsKmh[i];
    const k = segments[i].curvature;
    const latG = Number(((vMs * vMs * k) / 9.80665).toFixed(2));

    const vPrev = i > 0 ? speedsMs[i - 1] : vMs;
    const dt = Math.max(0.05, timesSeconds[i] - (i > 0 ? timesSeconds[i - 1] : 0));
    const accelG = Number(((vMs - vPrev) / dt / 9.80665).toFixed(2));

    const fAeroDown = 0.5 * 1.225 * params.downforceClA * vMs * vMs;
    const fAeroDrag = 0.5 * 1.225 * params.dragCdA * vMs * vMs;

    let gear = 6;
    if (vKmh < 85) gear = 1;
    else if (vKmh < 125) gear = 2;
    else if (vKmh < 165) gear = 3;
    else if (vKmh < 205) gear = 4;
    else if (vKmh < 250) gear = 5;

    points.push({
      dist: segments[i].dist,
      speedKmh: vKmh,
      targetSpeedKmh: vKmh,
      accelG,
      latG,
      throttlePct: accelG > 0.05 ? 100 : accelG < -0.2 ? 0 : 65,
      brakePct: accelG < -0.3 ? Math.min(100, Math.round(Math.abs(accelG) * 45)) : 0,
      gear,
      downforceN: Math.round(fAeroDown),
      dragN: Math.round(fAeroDrag),
      timeSeconds: Number(timesSeconds[i].toFixed(2)),
    });
  }

  // 5. Evaluate Setup Sensitivities by Running Differential Perturbations
  const runSensitivity = (
    name: string,
    deltaDesc: string,
    perturbedParams: Partial<VehicleSimParameters>
  ): SetupSensitivityDelta => {
    const pert = { ...params, ...perturbedParams };
    const { speedsMs: pSpeeds, timesSeconds: pTimes } = solveLapVelocityProfile(segments, pert);
    const pLapTime = pTimes[pTimes.length - 1];
    const timeDelta = Number((pLapTime - totalLapTimeSeconds).toFixed(3));
    const pTopSpeed = Math.max(...pSpeeds.map((v) => Math.round(v * 3.6)));
    const pMinSpeed = Math.min(...pSpeeds.map((v) => Math.round(v * 3.6)));

    let verdict = "";
    if (timeDelta < -0.10) {
      verdict = `Significant pace improvement (${timeDelta}s). Setup perturbation yields net lap gain.`;
    } else if (timeDelta > 0.10) {
      verdict = `Lap time degradation (+${timeDelta}s). Drag or balance penalty exceeds benefits.`;
    } else {
      verdict = `Neutral lap tradeoff (${timeDelta > 0 ? `+${timeDelta}` : timeDelta}s). Fine-tune for driver confidence.`;
    }

    return {
      parameterName: name,
      deltaSetting: deltaDesc,
      lapTimeDeltaSeconds: timeDelta,
      topSpeedDeltaKmh: pTopSpeed - topSpeedKmh,
      minCornerSpeedDeltaKmh: pMinSpeed - Math.min(...speedsKmh),
      verdict,
    };
  };

  const sensitivities: SetupSensitivityDelta[] = [
    runSensitivity("Rear Wing Trim (+2°)", "+2° Wing Angle", {
      downforceClA: params.downforceClA + 0.32,
      dragCdA: params.dragCdA + 0.088,
      aeroBalanceFrontPct: params.aeroBalanceFrontPct - 1.4,
    }),
    runSensitivity("Low Drag Trim (-2° Wing)", "-2° Wing Angle", {
      downforceClA: Math.max(3.0, params.downforceClA - 0.32),
      dragCdA: Math.max(1.0, params.dragCdA - 0.088),
      aeroBalanceFrontPct: params.aeroBalanceFrontPct + 1.4,
    }),
    runSensitivity("Front Splitter Grounding (-4mm RH)", "-4mm Front Ride Height", {
      downforceClA: params.downforceClA + 0.22,
      aeroBalanceFrontPct: params.aeroBalanceFrontPct + 1.8,
    }),
    runSensitivity("Fuel Burn / Qualifying Lightening (-30 kg)", "-30 kg Fuel Load", {
      massKg: Math.max(1000, params.massKg - 30),
    }),
    runSensitivity("Peak Tire Friction (+5% Rubber)", "+0.09 Tire Mu", {
      tireMuX: params.tireMuX * 1.05,
      tireMuY: params.tireMuY * 1.05,
    }),
  ];

  const executiveSummary = `Quasi-Static Lap Solver: Projected optimal lap time is ${lapTimeFormatted} (${topSpeedKmh} km/h top speed, ${averageSpeedKmh} km/h average) over ${trackLengthMeters}m of ${trackName}. Best sensitivity candidate: ${sensitivities.sort((a, b) => a.lapTimeDeltaSeconds - b.lapTimeDeltaSeconds)[0]?.parameterName || "Baseline"} (${sensitivities.sort((a, b) => a.lapTimeDeltaSeconds - b.lapTimeDeltaSeconds)[0]?.lapTimeDeltaSeconds}s).`;

  return {
    trackName,
    trackLengthMeters,
    lapTimeSeconds: totalLapTimeSeconds,
    lapTimeFormatted,
    topSpeedKmh,
    averageSpeedKmh,
    sectors,
    points,
    baselineParameters: params,
    sensitivities,
    executiveSummary,
  };
}
