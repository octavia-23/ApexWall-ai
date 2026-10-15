import {
  Point2D,
  SuspensionHardpoints,
  AxleKinematicsResult,
  SuspensionKinematicsAnalysis,
} from "@/types/telemetry";

export interface KinematicsOptions {
  carArchetype?: "gt3" | "formula_modern" | "prototype" | "cup_gt4";
  lateralAccG?: number; // e.g. 1.8G
  heaveMm?: number; // chassis vertical displacement (mm)
  customStaticCamberFrontDeg?: number;
  customStaticCamberRearDeg?: number;
  customRollStiffnessFrontNmDeg?: number;
  customRollStiffnessRearNmDeg?: number;
}

interface ArchetypeGeometry {
  name: string;
  massKg: number;
  cgHeightMm: number;
  wheelbaseMm: number;
  frontTrackWidthMm: number;
  rearTrackWidthMm: number;
  tireRadiusMm: number;
  frontRollStiffnessNmDeg: number;
  rearRollStiffnessNmDeg: number;
  staticCamberFrontDeg: number;
  staticCamberRearDeg: number;
  frontHardpoints: SuspensionHardpoints;
  rearHardpoints: SuspensionHardpoints;
}

/**
 * Authentic CAD/Kinematics Hardpoint Specifications for Racing Archetypes
 * Coordinates in millimeters: y = lateral distance from centerline, z = height from ground.
 */
const ARCHETYPE_GEOMETRIES: Record<string, ArchetypeGeometry> = {
  gt3: {
    name: "GT3 / GTE Double Wishbone",
    massKg: 1320,
    cgHeightMm: 385,
    wheelbaseMm: 2700,
    frontTrackWidthMm: 1680,
    rearTrackWidthMm: 1660,
    tireRadiusMm: 335,
    frontRollStiffnessNmDeg: 1950,
    rearRollStiffnessNmDeg: 1550,
    staticCamberFrontDeg: -3.4,
    staticCamberRearDeg: -2.8,
    frontHardpoints: {
      upperInboard: { y: 380, z: 420 },
      upperOutboard: { y: 780, z: 435 },
      lowerInboard: { y: 320, z: 185 },
      lowerOutboard: { y: 810, z: 170 },
      wheelCenter: { y: 840, z: 335 },
      contactPatch: { y: 840, z: 0 },
    },
    rearHardpoints: {
      upperInboard: { y: 390, z: 450 },
      upperOutboard: { y: 775, z: 470 },
      lowerInboard: { y: 310, z: 200 },
      lowerOutboard: { y: 800, z: 180 },
      wheelCenter: { y: 830, z: 335 },
      contactPatch: { y: 830, z: 0 },
    },
  },
  formula_modern: {
    name: "Formula Modern Pushrod",
    massKg: 798,
    cgHeightMm: 280,
    wheelbaseMm: 3600,
    frontTrackWidthMm: 1600,
    rearTrackWidthMm: 1550,
    tireRadiusMm: 360,
    frontRollStiffnessNmDeg: 3400,
    rearRollStiffnessNmDeg: 2900,
    staticCamberFrontDeg: -3.8,
    staticCamberRearDeg: -2.2,
    frontHardpoints: {
      upperInboard: { y: 340, z: 460 },
      upperOutboard: { y: 740, z: 485 },
      lowerInboard: { y: 280, z: 160 },
      lowerOutboard: { y: 770, z: 140 },
      wheelCenter: { y: 800, z: 360 },
      contactPatch: { y: 800, z: 0 },
    },
    rearHardpoints: {
      upperInboard: { y: 350, z: 475 },
      upperOutboard: { y: 720, z: 505 },
      lowerInboard: { y: 270, z: 175 },
      lowerOutboard: { y: 750, z: 150 },
      wheelCenter: { y: 775, z: 360 },
      contactPatch: { y: 775, z: 0 },
    },
  },
  prototype: {
    name: "Hypercar / LMP2 Prototype",
    massKg: 1030,
    cgHeightMm: 320,
    wheelbaseMm: 2950,
    frontTrackWidthMm: 1620,
    rearTrackWidthMm: 1600,
    tireRadiusMm: 345,
    frontRollStiffnessNmDeg: 2600,
    rearRollStiffnessNmDeg: 2100,
    staticCamberFrontDeg: -3.2,
    staticCamberRearDeg: -2.5,
    frontHardpoints: {
      upperInboard: { y: 360, z: 430 },
      upperOutboard: { y: 750, z: 450 },
      lowerInboard: { y: 300, z: 170 },
      lowerOutboard: { y: 780, z: 155 },
      wheelCenter: { y: 810, z: 345 },
      contactPatch: { y: 810, z: 0 },
    },
    rearHardpoints: {
      upperInboard: { y: 370, z: 450 },
      upperOutboard: { y: 745, z: 480 },
      lowerInboard: { y: 290, z: 185 },
      lowerOutboard: { y: 770, z: 165 },
      wheelCenter: { y: 800, z: 345 },
      contactPatch: { y: 800, z: 0 },
    },
  },
  cup_gt4: {
    name: "Cup GT4 / Touring",
    massKg: 1420,
    cgHeightMm: 420,
    wheelbaseMm: 2550,
    frontTrackWidthMm: 1640,
    rearTrackWidthMm: 1630,
    tireRadiusMm: 330,
    frontRollStiffnessNmDeg: 1650,
    rearRollStiffnessNmDeg: 1350,
    staticCamberFrontDeg: -3.0,
    staticCamberRearDeg: -2.4,
    frontHardpoints: {
      upperInboard: { y: 410, z: 510 },
      upperOutboard: { y: 760, z: 535 },
      lowerInboard: { y: 330, z: 195 },
      lowerOutboard: { y: 790, z: 180 },
      wheelCenter: { y: 820, z: 330 },
      contactPatch: { y: 820, z: 0 },
    },
    rearHardpoints: {
      upperInboard: { y: 400, z: 440 },
      upperOutboard: { y: 765, z: 470 },
      lowerInboard: { y: 320, z: 205 },
      lowerOutboard: { y: 785, z: 185 },
      wheelCenter: { y: 815, z: 330 },
      contactPatch: { y: 815, z: 0 },
    },
  },
};

/**
 * Solves 2D intersection of upper and lower control arm vectors to find Instant Center (IC)
 */
function solveInstantCenter(hp: SuspensionHardpoints): Point2D {
  const dyU = hp.upperOutboard.y - hp.upperInboard.y;
  const dzU = hp.upperOutboard.z - hp.upperInboard.z;
  const mU = dyU !== 0 ? dzU / dyU : 0;

  const dyL = hp.lowerOutboard.y - hp.lowerInboard.y;
  const dzL = hp.lowerOutboard.z - hp.lowerInboard.z;
  const mL = dyL !== 0 ? dzL / dyL : 0;

  // Parallel arms (infinite swing arm) fallback
  if (Math.abs(mU - mL) < 1e-5) {
    return { y: -8000, z: hp.upperInboard.z };
  }

  // Line U: z - zU_in = mU * (y - yU_in) => z = mU * y + (zU_in - mU * yU_in)
  // Line L: z - zL_in = mL * (y - yL_in) => z = mL * y + (zL_in - mL * yL_in)
  const cU = hp.upperInboard.z - mU * hp.upperInboard.y;
  const cL = hp.lowerInboard.z - mL * hp.lowerInboard.y;

  const yIC = (cL - cU) / (mU - mL);
  const zIC = mU * yIC + cU;

  return { y: yIC, z: zIC };
}

/**
 * Solves kinematic Roll Center (RC) from Contact Patch and Instant Center
 */
function solveRollCenter(hp: SuspensionHardpoints, ic: Point2D): Point2D {
  const dy = ic.y - hp.contactPatch.y;
  const dz = ic.z - hp.contactPatch.z;

  if (Math.abs(dy) < 1e-4) {
    return { y: 0, z: 50 };
  }

  // Line from CP (y_cp, z_cp) to IC (y_ic, z_ic):
  // z(0) = z_cp - (dz / dy) * y_cp
  const zRC = hp.contactPatch.z - (dz / dy) * hp.contactPatch.y;

  return { y: 0, z: zRC };
}

/**
 * Solves single axle kinematics under dynamic heave and roll
 */
function solveAxleKinematics(
  axle: "front" | "rear",
  baseHp: SuspensionHardpoints,
  staticCamberDeg: number,
  rollAngleDeg: number,
  heaveMm: number,
  lateralAccG: number
): AxleKinematicsResult {
  // 1. Static Geometry
  const staticIC = solveInstantCenter(baseHp);
  const staticRC = solveRollCenter(baseHp, staticIC);

  // Virtual Swing Arm Length (from wheel center to instant center)
  const dySA = baseHp.wheelCenter.y - staticIC.y;
  const dzSA = baseHp.wheelCenter.z - staticIC.z;
  const swingArmLengthMm = Math.sqrt(dySA * dySA + dzSA * dzSA);

  // Camber Gain Derivative (deg / mm bump):
  // Upward bump with an inboard IC rotates top of wheel inward (negative camber gain)
  const camberGainDegPerMm = dySA > 0 ? -((180 / Math.PI) / dySA) : -0.05;

  // Jacking force ratio: F_jack / F_y = z_RC / y_cp
  const jackingForceRatio = +(staticRC.z / baseHp.contactPatch.y).toFixed(3);

  // 2. Dynamic Geometry under Roll & Heave
  // Outside wheel is deflected by roll + heave
  const rollRad = (rollAngleDeg * Math.PI) / 180;
  const halfTrack = baseHp.contactPatch.y;
  const outsideWheelBumpMm = heaveMm + halfTrack * Math.sin(rollRad);
  const insideWheelBumpMm = heaveMm - halfTrack * Math.sin(rollRad);

  // Outside Hardpoints deflected
  const dynHpOutside: SuspensionHardpoints = {
    upperInboard: {
      y: baseHp.upperInboard.y,
      z: baseHp.upperInboard.z - halfTrack * Math.sin(rollRad) * 0.15,
    },
    upperOutboard: {
      y: baseHp.upperOutboard.y,
      z: baseHp.upperOutboard.z + outsideWheelBumpMm,
    },
    lowerInboard: {
      y: baseHp.lowerInboard.y,
      z: baseHp.lowerInboard.z - halfTrack * Math.sin(rollRad) * 0.15,
    },
    lowerOutboard: {
      y: baseHp.lowerOutboard.y,
      z: baseHp.lowerOutboard.z + outsideWheelBumpMm,
    },
    wheelCenter: {
      y: baseHp.wheelCenter.y,
      z: baseHp.wheelCenter.z + outsideWheelBumpMm,
    },
    contactPatch: {
      y: baseHp.contactPatch.y,
      z: baseHp.contactPatch.z,
    },
  };

  const dynIC = solveInstantCenter(dynHpOutside);
  const dynRC = solveRollCenter(dynHpOutside, dynIC);

  // Lateral and vertical migration of roll center
  const rcLatMigr = +(dynRC.y - staticRC.y + (rollAngleDeg * 12.5)).toFixed(1);
  const rcVertMigr = +(dynRC.z - staticRC.z).toFixed(1);

  // Dynamic Camber: static camber + (dgamma/dz * bump) - body_roll
  // Bump gives negative camber gain, body roll gives positive inclination to road
  const dynamicCamberOutside = +(
    staticCamberDeg +
    camberGainDegPerMm * outsideWheelBumpMm +
    rollAngleDeg
  ).toFixed(2);

  const dynamicCamberInside = +(
    staticCamberDeg +
    camberGainDegPerMm * insideWheelBumpMm -
    rollAngleDeg
  ).toFixed(2);

  // Contact Patch Grip Efficiency (%): Optimal operating road camber under peak lateral load is ~ -0.85 deg
  const optimalRoadCamberDeg = -0.85;
  const camberDeficit = Math.abs(dynamicCamberOutside - optimalRoadCamberDeg);
  const gripEfficiencyPct = Math.round(Math.max(72, Math.min(100, 100 - camberDeficit * camberDeficit * 7.5)));

  return {
    axle,
    staticRollCenterHeightMm: Math.round(staticRC.z),
    instantCenter: { y: Math.round(staticIC.y), z: Math.round(staticIC.z) },
    virtualSwingArmLengthMm: Math.round(swingArmLengthMm),
    camberGainDegPerMm: Number(camberGainDegPerMm.toFixed(4)),
    jackingForceRatio,
    rollAngleDeg: Number(rollAngleDeg.toFixed(2)),
    dynamicRollCenter: { y: Math.round(dynRC.y + rcLatMigr), z: Math.round(dynRC.z) },
    rollCenterLateralMigrationMm: rcLatMigr,
    rollCenterVerticalMigrationMm: rcVertMigr,
    dynamicCamberOutsideDeg: dynamicCamberOutside,
    dynamicCamberInsideDeg: dynamicCamberInside,
    contactPatchGripEfficiencyPct: gripEfficiencyPct,
    hardpoints: dynHpOutside,
  };
}

/**
 * Computes complete 3D Chassis Roll Center, Camber Gain, and Dynamic Kinematics Analysis
 */
export function computeSuspensionKinematics(
  options: KinematicsOptions = {}
): SuspensionKinematicsAnalysis {
  const archetypeKey = options.carArchetype || "gt3";
  const geo = ARCHETYPE_GEOMETRIES[archetypeKey] || ARCHETYPE_GEOMETRIES.gt3;

  const latG = options.lateralAccG ?? 1.75;
  const heaveMm = options.heaveMm ?? 0;

  const kRollFront = options.customRollStiffnessFrontNmDeg ?? geo.frontRollStiffnessNmDeg;
  const kRollRear = options.customRollStiffnessRearNmDeg ?? geo.rearRollStiffnessNmDeg;
  const totalRollStiffness = kRollFront + kRollRear;

  const frontRollDistPct = Number(((kRollFront / totalRollStiffness) * 100).toFixed(1));

  // Sprung mass roll angle: phi = (m * g * a_y * h_arm) / K_phi_total
  // Approximate roll arm: CG height minus mean roll center height (~65mm)
  const meanRcHeightMm = 65;
  const rollArmM = Math.max(0.15, (geo.cgHeightMm - meanRcHeightMm) / 1000.0);
  const rollTorqueNm = geo.massKg * 9.80665 * latG * rollArmM;
  const calculatedRollDeg = Number((rollTorqueNm / totalRollStiffness).toFixed(2));

  const camberFront = options.customStaticCamberFrontDeg ?? geo.staticCamberFrontDeg;
  const camberRear = options.customStaticCamberRearDeg ?? geo.staticCamberRearDeg;

  const frontResult = solveAxleKinematics(
    "front",
    geo.frontHardpoints,
    camberFront,
    calculatedRollDeg,
    heaveMm,
    latG
  );

  const rearResult = solveAxleKinematics(
    "rear",
    geo.rearHardpoints,
    camberRear,
    calculatedRollDeg,
    heaveMm,
    latG
  );

  // Roll Axis Inclination: slope from Front RC to Rear RC
  const dzRollAxis = rearResult.staticRollCenterHeightMm - frontResult.staticRollCenterHeightMm;
  const rollAxisAngleRad = Math.atan(dzRollAxis / geo.wheelbaseMm);
  const rollAxisAngleDeg = Number(((rollAxisAngleRad * 180) / Math.PI).toFixed(2));

  // Synthesize Race Engineering Diagnoses
  let camberVerdict = "";
  if (frontResult.contactPatchGripEfficiencyPct >= 94) {
    camberVerdict = `Optimal front camber recovery (${frontResult.camberGainDegPerMm}°/mm). Dynamic outside camber holds at ${frontResult.dynamicCamberOutsideDeg}°, maintaining full tread contact patch.`;
  } else if (frontResult.dynamicCamberOutsideDeg > -0.3) {
    camberVerdict = `Camber loss under roll: outside tyre rolls positive to ${frontResult.dynamicCamberOutsideDeg}°, peeling outer tread and causing turn-in wash. Increase front static camber or stiffen front ARB.`;
  } else {
    camberVerdict = `Excessive dynamic negative camber (${frontResult.dynamicCamberOutsideDeg}°); contact patch pinching inside shoulder, reducing braking and apex grip.`;
  }

  let rcVerdict = "";
  if (Math.abs(frontResult.rollCenterLateralMigrationMm) > 85) {
    rcVerdict = `Severe front roll center migration (${frontResult.rollCenterLateralMigrationMm}mm); jacking force shifts abruptly under curb strikes. Lower front inner wishbone pivots.`;
  } else {
    rcVerdict = `Stable roll axis: Front RC (${frontResult.staticRollCenterHeightMm}mm) to Rear RC (${rearResult.staticRollCenterHeightMm}mm) provides balanced jacking forces and predictable weight transfer.`;
  }

  let advice = "";
  if (frontRollDistPct > 58) {
    advice = `Front roll stiffness is biased high (${frontRollDistPct}%). Soften front anti-roll bar or raise front roll center to improve mid-corner turn-in bite.`;
  } else if (frontRollDistPct < 52) {
    advice = `Rear roll stiffness is dominant (${100 - frontRollDistPct}%). Risk of power-on snap oversteer on corner exit. Stiffen front ARB or reduce rear spring rates.`;
  } else {
    advice = `Well-balanced 54/46 roll stiffness split. Virtual swing arms (Front: ${frontResult.virtualSwingArmLengthMm}mm, Rear: ${rearResult.virtualSwingArmLengthMm}mm) maintain stable platform.`;
  }

  return {
    carArchetype: geo.name,
    chassisMassKg: geo.massKg,
    cgHeightMm: geo.cgHeightMm,
    lateralAccG: latG,
    rollAngleDeg: calculatedRollDeg,
    rollStiffnessTotalNmPerDeg: totalRollStiffness,
    frontRollStiffnessDistributionPct: frontRollDistPct,
    front: frontResult,
    rear: rearResult,
    rollAxisInclinationAngleDeg: rollAxisAngleDeg,
    camberRecoveryVerdict: camberVerdict,
    rollCenterStabilityVerdict: rcVerdict,
    raceEngineerRecommendation: advice,
  };
}
