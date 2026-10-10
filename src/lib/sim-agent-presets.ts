import { Machine, SessionSeed, PlannerContext, StateContext } from "@/components/ui/agent-console-template";

export const SPA_MACHINE: Machine = {
  name: "StabilizeBlanchimontApex",
  maxVisits: 3,
  store: [
    { key: "telemetryLapTime", kind: "observed", value: "2:16.842" },
    { key: "apexSpeed", kind: "observed", value: "238.4 km/h" },
    { key: "rearSlipAngle", kind: "observed", value: "4.8 deg" },
    { key: "curbImpactG", kind: "observed", value: "1.92 g" },
    { key: "carModel", kind: "set", value: "Ferrari 296 GT3" },
    { key: "circuitName", kind: "set", value: "Circuit de Spa-Francorchamps" },
    { key: "trackTemp", kind: "set", value: "28°C" },
    { key: "fuelLoad", kind: "set", value: "48 L" },
    { key: "rearRideHeight", kind: "agent" },
    { key: "rearWingAngle", kind: "agent" },
    { key: "rearReboundClicks", kind: "agent" },
    { key: "diffPreload", kind: "agent" },
    { key: "targetTyrePressureRL", kind: "agent" },
    { key: "aerodynamicBalanceDelta", kind: "agent" },
    { key: "setupVerificationPassed", kind: "observed" },
  ],
  states: [
    {
      id: "IngestMoTeCTelemetry",
      prompt:
        "Parse 50Hz MoTeC telemetry channels for Lap 4. Extract lateral G, steer angle, throttle trace, and rear suspension travel through Blanchimont entry and apex.",
      writes: ["apexSpeed", "rearSlipAngle", "curbImpactG"],
      next: "AnalyzeHighSpeedAero",
      steps: [
        "loading motec csv log: spa_stint1_ferrari296.ld",
        "extracting channels: Car_Speed, Lat_G, Steer_Angle, Susp_Travel_RL, Susp_Travel_RR",
        "detected abrupt 4.8° yaw spike at Turn 17 apex under full throttle compression",
      ],
      values: { apexSpeed: "238.4 km/h", rearSlipAngle: "4.8 deg", curbImpactG: "1.92 g" },
    },
    {
      id: "AnalyzeHighSpeedAero",
      prompt:
        "Compute aerodynamic Center of Pressure (CoP) migration under high-speed compression. Evaluate rear diffuser stalling risk and wing pitch sensitivity.",
      writes: ["rearRideHeight", "rearWingAngle", "aerodynamicBalanceDelta"],
      next: "TuneDamperKinetics",
      steps: [
        "evaluating ride height delta: rear bottoming out on curb transition (-14mm deflection)",
        "raising rear static ride height by +2mm to avoid diffuser stall under aero load",
        "trimming rear wing to Wing P7 (+1 click) to lock the rear axle at >220 km/h",
      ],
      values: { rearRideHeight: "52 mm (+2mm)", rearWingAngle: "P7 (+1)", aerodynamicBalanceDelta: "+1.2% rearward" },
    },
    {
      id: "TuneDamperKinetics",
      prompt:
        "Calculate low-speed and high-speed damper clicks. Stiffen rear rebound to control chassis heave pitch without compromising curb compliance.",
      writes: ["rearReboundClicks"],
      next: "CalibrateDifferentialPreload",
      steps: [
        "analyzing damper histogram: 72% of travel in low-speed transient velocity range",
        "increasing rear slow rebound damping from 6 to 8 clicks to dampen snap oscillation",
        "softening rear fast bump by 1 click for kerb compliance",
      ],
      values: { rearReboundClicks: "8 clicks (+2 clicks stiff)" },
    },
    {
      id: "CalibrateDifferentialPreload",
      prompt:
        "Adjust differential preload and power lock ramp to stabilize transition between trail-braking and throttle application.",
      writes: ["diffPreload"],
      next: "VerifyHomologationCompliance",
      steps: [
        "evaluating off-throttle yaw rotation into Blanchimont",
        "raising differential preload from 55 Nm to 70 Nm to prevent snap yaw breakaway on curb touch",
      ],
      values: { diffPreload: "70 Nm (+15 Nm)" },
    },
    {
      id: "VerifyHomologationCompliance",
      prompt:
        "Cross-check ride height limits against SRO/FIA GT3 technical regulations and compute tyre pressure delta.",
      writes: ["setupVerificationPassed", "targetTyrePressureRL"],
      when: [{ key: "setupVerificationPassed", to: "DeploySetupToGarage" }],
      next: "DeploySetupToGarage",
      steps: [
        "checking FIA minimum ride height: front 50mm, rear 52mm (complies with 50mm min)",
        "adjusting cold tyre pressure RL to 26.5 psi to hit 27.8 psi hot operating window",
        "simulation passes: predicted apex stability +18%, lap time delta -0.240s",
      ],
      values: { setupVerificationPassed: true, targetTyrePressureRL: "26.5 psi cold" },
    },
    {
      id: "DeploySetupToGarage",
      prompt: "Commit calibrated parameters to Setup Vault and Dense Garage Setup Table.",
      next: "Completed",
      steps: [
        "generating setup profile: 'Spa_Q_Ferrari296_V2_AeroBalanced'",
        "export ready: ACC JSON, MoTeC telemetry overlay, and Setup Vault",
      ],
    },
    { id: "Completed", final: true },
    { id: "Aborted", final: true, outcome: "failure" },
  ],
};

export const MONZA_MACHINE: Machine = {
  name: "CalibrateMonzaBraking",
  maxVisits: 3,
  store: [
    { key: "telemetryLapTime", kind: "observed", value: "1:46.312" },
    { key: "trailBrakingScore", kind: "observed", value: "68%" },
    { key: "decelMaxG", kind: "observed", value: "2.14 g" },
    { key: "carModel", kind: "set", value: "Porsche 992 GT3 R" },
    { key: "circuitName", kind: "set", value: "Autodromo Nazionale Monza" },
    { key: "frontBrakeBias", kind: "agent" },
    { key: "brakePressureTarget", kind: "agent" },
    { key: "tyrePressureFL", kind: "agent" },
    { key: "antiRollBarFront", kind: "agent" },
    { key: "brakingStabilityScore", kind: "observed" },
  ],
  states: [
    {
      id: "AnalyzePrimaVarianteBraking",
      prompt: "Ingest deceleration telemetry at 300m board into T1 Prima Variante. Calculate longitudinal decel peak and trail-off curvature.",
      writes: ["decelMaxG", "trailBrakingScore"],
      next: "TuneBrakeBiasBalance",
      steps: [
        "sampling brake pressure trace: 100% initial bite decaying into 45% trail-brake",
        "front axle lockup detected on right-front wheel 38m before turn-in",
      ],
      values: { decelMaxG: "2.14 g", trailBrakingScore: "68%" },
    },
    {
      id: "TuneBrakeBiasBalance",
      prompt: "Calibrate front-to-rear brake pressure distribution to eliminate premature front lockup while maintaining stability.",
      writes: ["frontBrakeBias", "brakePressureTarget"],
      next: "CalibrateFrontAxleKinetics",
      steps: [
        "shifting brake bias rearward from 56.4% to 54.8% (-1.6%)",
        "calibrating master cylinder target to 98% peak threshold",
      ],
      values: { frontBrakeBias: "54.8% (-1.6% rearward)", brakePressureTarget: "98% peak" },
    },
    {
      id: "CalibrateFrontAxleKinetics",
      prompt: "Adjust front anti-roll bar and tyre pressures to prevent weight transfer saturation during aggressive deceleration.",
      writes: ["antiRollBarFront", "tyrePressureFL"],
      next: "VerifyBrakingSimulation",
      steps: [
        "softening front ARB by 1 blade click to maximize contact patch under pitch",
        "reducing cold pressure FL by -0.3 psi to achieve 27.2 psi hot pressure at apex",
      ],
      values: { antiRollBarFront: "Blade 3 (-1 click)", tyrePressureFL: "26.3 psi cold" },
    },
    {
      id: "VerifyBrakingSimulation",
      prompt: "Execute Monte Carlo brake distance model across 5 consecutive laps.",
      writes: ["brakingStabilityScore"],
      next: "DeploymentReady",
      steps: [
        "simulated braking distance reduced by 4.2 meters into Prima Variante",
        "braking stability score increased from 68% to 92%",
      ],
      values: { brakingStabilityScore: "92% (+24%)" },
    },
    { id: "DeploymentReady", final: true },
    { id: "Aborted", final: true, outcome: "failure" },
  ],
};

export const NURBURGRING_MACHINE: Machine = {
  name: "BalanceNordschleifeDampers",
  maxVisits: 3,
  store: [
    { key: "telemetryLapTime", kind: "observed", value: "8:04.190" },
    { key: "curbImpactMaxG", kind: "observed", value: "2.85 g" },
    { key: "carModel", kind: "set", value: "BMW M4 GT3" },
    { key: "circuitName", kind: "set", value: "Nürburgring Nordschleife" },
    { key: "frontFastBumpClicks", kind: "agent" },
    { key: "rearFastReboundClicks", kind: "agent" },
    { key: "bumpstopClearanceFront", kind: "agent" },
    { key: "kerbComplianceIndex", kind: "observed" },
  ],
  states: [
    {
      id: "IngestFlugplatzTelemetry",
      prompt: "Assess chassis heave velocity through Flugplatz crest and Schwedenkreuz curb strikes.",
      writes: ["curbImpactMaxG"],
      next: "TuneHighSpeedDamping",
      steps: [
        "detecting high velocity piston spike > 120 mm/s over curb strips",
        "excessive chassis deflection causing momentary tire unweighting",
      ],
      values: { curbImpactMaxG: "2.85 g" },
    },
    {
      id: "TuneHighSpeedDamping",
      prompt: "Open high-speed blow-off valves and adjust fast bump/rebound dampers to absorb harsh vertical energy.",
      writes: ["frontFastBumpClicks", "rearFastReboundClicks", "bumpstopClearanceFront"],
      next: "SimulateFullLapCompliance",
      steps: [
        "softening front fast bump by 2 clicks (blow-off relief)",
        "increasing rear fast rebound by 1 click to control post-crest oscillation",
        "adding 4mm bumpstop packer clearance to prevent hydraulic bottoming",
      ],
      values: {
        frontFastBumpClicks: "4 clicks (-2 soft)",
        rearFastReboundClicks: "6 clicks (+1 control)",
        bumpstopClearanceFront: "18 mm (+4mm)",
      },
    },
    {
      id: "SimulateFullLapCompliance",
      prompt: "Run 20.8 km compliance simulation across 73 corners.",
      writes: ["kerbComplianceIndex"],
      next: "OptimalSetupValidated",
      steps: [
        "curb impact G reduced from 2.85g to 1.88g",
        "driver confidence score index improved by +34%",
      ],
      values: { kerbComplianceIndex: "96% compliant" },
    },
    { id: "OptimalSetupValidated", final: true },
    { id: "Failed", final: true, outcome: "failure" },
  ],
};

export const SIM_RACING_SESSIONS: SessionSeed[] = [
  {
    id: "spa-blanchimont-oversteer",
    title: "Spa 24h — Blanchimont Snap Oversteer",
    prompt:
      "Ingest Spa-Francorchamps Stint (Ferrari 296 GT3) — Diagnose high-speed snap oversteer through Blanchimont apex (Turn 17), balance rear diffuser ride height against rear wing angle, and calibrate differential preload.",
    machine: SPA_MACHINE,
    status: "running",
  },
  {
    id: "monza-prima-variante-braking",
    title: "Monza Quali — T1 Trail Braking & Brake Bias",
    prompt:
      "Monza Quali Lap (Porsche 992 GT3 R) — Analyze trail-braking efficiency into Prima Variante chicane (Turn 1), optimize front brake bias from 56.4% to 54.8%, and calibrate cold tyre pressures.",
    machine: MONZA_MACHINE,
    status: "awaiting",
  },
  {
    id: "nurburgring-nordschleife-damping",
    title: "Nürburgring 24h — Wet Baseline & Damper Compliance",
    prompt:
      "Nürburgring Nordschleife 24h Setup Synthesis — Balance bumpstop packings and high-speed compression damping for curb stability through Flugplatz and Tiergarten.",
    machine: NURBURGRING_MACHINE,
    status: "done",
  },
  {
    id: "silverstone-endurance-strategy",
    title: "Silverstone 1h — 2-Stop Pit Window & Tyre Wear",
    prompt:
      "Silverstone Endurance Strategy — Calculate 1-stop vs 2-stop pit window for 60-minute race, fuel burn rate 2.84 L/lap, and tyre degradation delta between Soft and Medium compounds.",
    status: "done",
  },
];

export const SIM_RACING_SUGGESTIONS = [
  "Ingest Spa Lap 2:16.842 and eliminate snap oversteer on Blanchimont apex",
  "Calibrate front brake bias and cold tyre pressures for Monza qualifying",
  "Balance damper bump/rebound clicks for curb stability at Nürburgring",
  "Calculate 1-stop vs 2-stop pit strategy with 2.84 L/lap fuel consumption",
];

/**
 * Intelligent motorsport engineering planner that generates a tailored
 * multi-state machine for any sim racing tuning, telemetry, or strategy ask.
 */
export function simRacingPlanner(prompt: string, _ctx: PlannerContext): Machine {
  const p = prompt.toLowerCase();

  // Oversteer / Understeer / Handling Balance
  if (p.includes("oversteer") || p.includes("understeer") || p.includes("balance") || p.includes("handling")) {
    const isOversteer = p.includes("oversteer");
    const name = isOversteer ? "MitigateOversteerBalance" : "MitigateUndersteerBalance";
    return {
      name,
      maxVisits: 3,
      store: [
        { key: "telemetryAnalyzed", kind: "observed" },
        { key: "cornerPhase", kind: "observed", value: p.includes("entry") ? "Entry" : p.includes("exit") ? "Exit" : "Apex" },
        { key: "antiRollBarAdjustment", kind: "agent" },
        { key: "differentialAdjustment", kind: "agent" },
        { key: "aerodynamicBalanceDelta", kind: "agent" },
        { key: "verificationPassed", kind: "observed" },
      ],
      states: [
        {
          id: "IngestCornerTelemetry",
          prompt: `Analyze lateral acceleration and steering angle gradient through the affected corner section. Identify weight transfer distribution.`,
          writes: ["telemetryAnalyzed"],
          next: "TuneMechanicalRollCouple",
          steps: [
            "analyzing telemetry channels: Steer_Angle, Lat_G, Yaw_Rate",
            `confirmed ${isOversteer ? "rear slip angle excess" : "front tire scrub saturation"} during transient phase`,
          ],
          values: { telemetryAnalyzed: true },
        },
        {
          id: "TuneMechanicalRollCouple",
          prompt: `Calibrate front/rear anti-roll bar blade settings and spring rates to shift mechanical grip balance.`,
          writes: ["antiRollBarAdjustment"],
          next: "CalibrateDifferentialTraction",
          steps: [
            isOversteer
              ? "softening rear anti-roll bar by 1 click and stiffening front ARB"
              : "softening front anti-roll bar by 1 click to increase front mechanical compliance",
          ],
          values: {
            antiRollBarAdjustment: isOversteer ? "Rear ARB -1, Front ARB +1" : "Front ARB -1, Rear ARB +1",
          },
        },
        {
          id: "CalibrateDifferentialTraction",
          prompt: `Adjust differential preload, coast ramp, and power lock to stabilize yaw rotation.`,
          writes: ["differentialAdjustment"],
          next: "AdjustAeroCenterOfPressure",
          steps: [
            isOversteer
              ? "increasing diff preload +15 Nm to lock differential on deceleration"
              : "decreasing diff preload -10 Nm to allow sharper turn-in rotation",
          ],
          values: {
            differentialAdjustment: isOversteer ? "+15 Nm preload (stabilize rear)" : "-10 Nm preload (sharpen rotation)",
          },
        },
        {
          id: "AdjustAeroCenterOfPressure",
          prompt: `Trim rear wing angle and front ride height rake for optimal high-speed aero balance.`,
          writes: ["aerodynamicBalanceDelta"],
          next: "ValidateSetupSimulation",
          steps: [
            isOversteer
              ? "increasing rear wing angle +1 click (+0.8% rear aero balance)"
              : "lowering front ride height -1mm (-0.7% forward aero rake)",
          ],
          values: {
            aerodynamicBalanceDelta: isOversteer ? "+0.8% rearward" : "+0.7% forward",
          },
        },
        {
          id: "ValidateSetupSimulation",
          prompt: `Run vehicle dynamics model check against track elevation and telemetry baseline.`,
          writes: ["verificationPassed"],
          next: "SetupReadyForGarage",
          steps: [
            "simulated yaw damping index: +22% improvement",
            "corner exit traction efficiency: 98.4%",
          ],
          values: { verificationPassed: true },
        },
        { id: "SetupReadyForGarage", final: true },
      ],
    };
  }

  // Brake / Tyre Pressures
  if (p.includes("brake") || p.includes("pressure") || p.includes("tyre") || p.includes("tire")) {
    return {
      name: "CalibrateBrakesAndTyres",
      maxVisits: 3,
      store: [
        { key: "telemetryBrakeDecelG", kind: "observed", value: "2.18 g" },
        { key: "targetColdPressures", kind: "agent" },
        { key: "calibratedBrakeBias", kind: "agent" },
        { key: "brakeDuctLevel", kind: "agent" },
        { key: "compliancePassed", kind: "observed" },
      ],
      states: [
        {
          id: "AnalyzeBrakeAndTyreThermals",
          prompt: "Evaluate 4-corner disc core temps and tire pressure hot stabilization windows.",
          writes: ["telemetryBrakeDecelG"],
          next: "CalibrateColdPressures",
          steps: [
            "sampling brake disc temps: Front 620°C, Rear 510°C (optimal range 450-650°C)",
            "analyzing cold-to-hot pressure rise across 5 laps",
          ],
          values: { telemetryBrakeDecelG: "2.18 g peak" },
        },
        {
          id: "CalibrateColdPressures",
          prompt: "Determine exact cold target pressures so tyres stabilize within 27.5 - 28.0 psi hot window.",
          writes: ["targetColdPressures"],
          next: "TuneBrakeBiasAndDucts",
          steps: [
            "calibrating for ambient temp: FL 26.4, FR 26.6, RL 26.3, RR 26.5 psi cold",
          ],
          values: { targetColdPressures: "FL 26.4, FR 26.6, RL 26.3, RR 26.5 psi" },
        },
        {
          id: "TuneBrakeBiasAndDucts",
          prompt: "Adjust master cylinder brake bias and brake duct apertures for thermal equilibrium.",
          writes: ["calibratedBrakeBias", "brakeDuctLevel"],
          next: "ValidateOperatingWindow",
          steps: [
            "adjusting brake bias to 55.2% front",
            "setting front brake ducts to Duct 3, rear to Duct 2",
          ],
          values: { calibratedBrakeBias: "55.2%", brakeDuctLevel: "Front D3, Rear D2" },
        },
        {
          id: "ValidateOperatingWindow",
          prompt: "Simulate 10 laps of braking performance to ensure zero fade and even wear.",
          writes: ["compliancePassed"],
          next: "ReadyForGarage",
          steps: ["optimal thermal operating window confirmed: 100% stable"],
          values: { compliancePassed: true },
        },
        { id: "ReadyForGarage", final: true },
      ],
    };
  }

  // Strategy / Fuel
  if (p.includes("strategy") || p.includes("fuel") || p.includes("pit") || p.includes("stop") || p.includes("stint")) {
    return {
      name: "CalculatePitStrategy",
      maxVisits: 3,
      store: [
        { key: "stintLengthLaps", kind: "set", value: "32 laps" },
        { key: "fuelConsumptionPerLap", kind: "observed", value: "2.84 L" },
        { key: "optimalStopCount", kind: "agent" },
        { key: "pitStopWindows", kind: "agent" },
        { key: "totalFuelRequired", kind: "agent" },
        { key: "strategySimScore", kind: "observed" },
      ],
      states: [
        {
          id: "CalculateFuelBurnRate",
          prompt: "Ingest fuel burn logs and calculate exact per-lap consumption under race pace.",
          writes: ["fuelConsumptionPerLap"],
          next: "OptimizePitWindows",
          steps: [
            "analyzing telemetry fuel channel: 2.84 L/lap average under racing conditions",
            "tank capacity: 120 L (max stint length: 42 laps)",
          ],
          values: { fuelConsumptionPerLap: "2.84 L/lap" },
        },
        {
          id: "OptimizePitWindows",
          prompt: "Compute undercut / overcut advantage and determine optimal pit stop lap windows.",
          writes: ["optimalStopCount", "pitStopWindows", "totalFuelRequired"],
          next: "SimulateTrafficAndSafetyCar",
          steps: [
            "optimal strategy: 1-Stop at Lap 24",
            "pit stop window: Laps 22-26",
            "total race fuel needed: 91.2 L + 3.5 L contingency = 94.7 L",
          ],
          values: {
            optimalStopCount: "1-Stop",
            pitStopWindows: "Lap 23 - 26",
            totalFuelRequired: "94.7 L",
          },
        },
        {
          id: "SimulateTrafficAndSafetyCar",
          prompt: "Run 500 Monte Carlo race scenarios factoring traffic delays and safety car likelihood.",
          writes: ["strategySimScore"],
          next: "DeployStrategyPlan",
          steps: [
            "1-stop gives net +8.4 second advantage over 2-stop in clean air",
            "undercut window creates 1.8s track position gain",
          ],
          values: { strategySimScore: "94.2% win probability index" },
        },
        { id: "DeployStrategyPlan", final: true },
      ],
    };
  }

  // Fallback to comprehensive GT3 setup synthesizer
  return {
    name: "SynthesizeGT3Setup",
    maxVisits: 3,
    store: [
      { key: "telemetryLapTime", kind: "observed", value: "2:18.240" },
      { key: "frontAeroRake", kind: "agent" },
      { key: "mechanicalGripIndex", kind: "agent" },
      { key: "damperPackers", kind: "agent" },
      { key: "vaultDeployReady", kind: "observed" },
    ],
    states: [
      {
        id: "IngestTelemetryBaseline",
        prompt: "Review current vehicle telemetry baseline, driver feedback, and track surface conditions.",
        writes: ["telemetryLapTime"],
        next: "CalibrateChassisAero",
        steps: ["ingesting vehicle baseline telemetry", "extracting handling characteristics across all sectors"],
        values: { telemetryLapTime: "2:18.240" },
      },
      {
        id: "CalibrateChassisAero",
        prompt: "Calculate front/rear downforce rake, wing angle, and ride height for high-speed stability.",
        writes: ["frontAeroRake"],
        next: "CalibrateSuspensionKinetics",
        steps: ["tuning front splitter rake: 52mm front / 72mm rear", "trimming rear wing to Wing P6"],
        values: { frontAeroRake: "52mm / 72mm (+20mm rake)" },
      },
      {
        id: "CalibrateSuspensionKinetics",
        prompt: "Optimize anti-roll bars, wheel spring rates, and damper valving.",
        writes: ["mechanicalGripIndex", "damperPackers"],
        next: "SimulateSetupLapDelta",
        steps: [
          "calibrating front springs: 170 N/mm, rear springs: 140 N/mm",
          "adjusting bumpstop packers: front 12mm, rear 16mm",
        ],
        values: { mechanicalGripIndex: "+14% mechanical compliance", damperPackers: "12mm / 16mm" },
      },
      {
        id: "SimulateSetupLapDelta",
        prompt: "Run vehicle dynamic lap simulation to predict delta against baseline.",
        writes: ["vaultDeployReady"],
        next: "SetupReady",
        steps: ["predicted lap time delta: -0.380s", "vehicle balance confidence: 97%"],
        values: { vaultDeployReady: true },
      },
      { id: "SetupReady", final: true },
    ],
  };
}

/**
 * Intelligent State Executor for Sim Racing
 */
export async function simRacingExecutor(ctx: StateContext): Promise<void> {
  ctx.log(`[Chief Race Engineer] Executing phase: ${ctx.state.id}...`);

  // Small delay for realism if running live
  await new Promise((r) => setTimeout(r, 400));

  if (ctx.state.steps) {
    const list = Array.isArray(ctx.state.steps[0]) ? (ctx.state.steps as string[][])[0] : (ctx.state.steps as string[]);
    for (const step of list) {
      ctx.log(`  > ${step}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (ctx.state.values) {
    for (const [k, v] of Object.entries(ctx.state.values)) {
      const val = Array.isArray(v) ? v[0] : v;
      ctx.write(k, val);
      ctx.log(`  * Store updated: ${k} = "${val}"`);
    }
  }

  ctx.log(`[Chief Race Engineer] State ${ctx.state.id} completed.`);
}
