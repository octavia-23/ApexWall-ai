/**
 * Realistic Sim Racing Telemetry Generator
 * Replaces low-density/crude telemetry files with authentic 25Hz multi-thousand point datasets
 * featuring authentic vehicle dynamics, progressive trail-braking, steering slip angles,
 * gearshift RPM cuts, lateral load transfers, and tyre thermodynamics.
 */

const fs = require("fs");
const path = require("path");

// Gaussian noise helper
function gaussianNoise(mean = 0, stdev = 1) {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

// Gear ratios for GT3 (6-speed) and F1 (8-speed)
const GT3_GEARS = [
  { minSpeed: 0, maxSpeed: 105, gear: 1, rpmRatio: 78 },
  { minSpeed: 95, maxSpeed: 145, gear: 2, rpmRatio: 57 },
  { minSpeed: 135, maxSpeed: 185, gear: 3, rpmRatio: 44 },
  { minSpeed: 175, maxSpeed: 225, gear: 4, rpmRatio: 36 },
  { minSpeed: 215, maxSpeed: 260, gear: 5, rpmRatio: 30 },
  { minSpeed: 250, maxSpeed: 300, gear: 6, rpmRatio: 26 },
];

const F1_GEARS = [
  { minSpeed: 0, maxSpeed: 110, gear: 1, rpmRatio: 115 },
  { minSpeed: 95, maxSpeed: 145, gear: 2, rpmRatio: 88 },
  { minSpeed: 135, maxSpeed: 180, gear: 3, rpmRatio: 70 },
  { minSpeed: 170, maxSpeed: 220, gear: 4, rpmRatio: 58 },
  { minSpeed: 210, maxSpeed: 260, gear: 5, rpmRatio: 48 },
  { minSpeed: 250, maxSpeed: 295, gear: 6, rpmRatio: 41 },
  { minSpeed: 285, maxSpeed: 325, gear: 7, rpmRatio: 37 },
  { minSpeed: 315, maxSpeed: 360, gear: 8, rpmRatio: 33 },
];

function getGearAndRPM(speedKmh, isF1 = false) {
  const table = isF1 ? F1_GEARS : GT3_GEARS;
  let selected = table[0];
  for (const g of table) {
    if (speedKmh >= g.minSpeed) selected = g;
  }
  const idle = isF1 ? 4200 : 1800;
  const maxRpm = isF1 ? 12800 : 8400;
  let rpm = Math.round(selected.rpmRatio * speedKmh);
  if (rpm < idle) rpm = idle;
  if (rpm > maxRpm) rpm = maxRpm;
  return { gear: selected.gear, rpm };
}

/**
 * Generate telemetry track points
 */
function generateTrackTelemetry(config) {
  const {
    trackLength,
    isF1 = false,
    isPro = false,
    corners = [], // Array of { name, brakeDist, apexDist, exitDist, apexSpeed, maxBrake, dir: 1|-1, radius }
    baselineTemps = { FL: 84, FR: 87, RL: 82, RR: 85 },
    baselinePress = { FL: 26.8, FR: 27.2, RL: 26.7, RR: 27.1 },
    topSpeedKmh = 275,
    lapTimeSec = 137.5,
  } = config;

  const dt = 0.040; // 25 Hz sampling rate
  const points = [];

  let time = 0.0;
  let dist = 0.0;
  let speed = 180.0; // Starting rolling speed across finish line
  let throttle = 100.0;
  let brake = 0.0;
  let steer = 0.0;

  let tempFL = baselineTemps.FL;
  let tempFR = baselineTemps.FR;
  let tempRL = baselineTemps.RL;
  let tempRR = baselineTemps.RR;

  let pressFL = baselinePress.FL;
  let pressFR = baselinePress.FR;
  let pressRL = baselinePress.RL;
  let pressRR = baselinePress.RR;

  // Driver vs Pro differences:
  // Pro brakes later, carries higher apex speed (+2 to +4 km/h), smoother trail brake, earlier full throttle
  const brakeDeltaMeters = isPro ? 0 : 8; // Driver brakes 8m earlier
  const apexSpeedOffset = isPro ? 0 : -3.5; // Driver is 3.5 km/h slower at apex
  const understeerMultiplier = isPro ? 1.0 : 1.18; // Driver scrubs more front wheel angle
  const exitCommitDelta = isPro ? 0 : 6; // Driver hesitates 6m on exit

  while (dist < trackLength) {
    // Find active or upcoming corner
    let activeCorner = null;
    for (const c of corners) {
      const bDist = c.brakeDist - brakeDeltaMeters;
      const eDist = c.exitDist + (isPro ? 0 : exitCommitDelta);
      if (dist >= bDist && dist <= eDist) {
        activeCorner = c;
        break;
      }
    }

    let targetLatG = 0;
    let targetLongG = 0;

    if (!activeCorner) {
      // STRAIGHTAWAY ACCELERATION
      brake = 0.0;
      throttle = 100.0;
      steer = gaussianNoise(0, 0.4); // Subtle wheel flutter on straight

      // Acceleration physics: decays with air drag v^2
      const dragFactor = isF1 ? 0.00035 : 0.00045;
      const powerFactor = isF1 ? 48.0 : 26.0;
      const accelMs2 = Math.max(0.4, (powerFactor / Math.max(15, speed / 3.6)) - dragFactor * Math.pow(speed / 3.6, 2));

      speed += (accelMs2 * 3.6) * dt;
      if (speed > topSpeedKmh) speed = topSpeedKmh + gaussianNoise(0, 0.3);

      targetLongG = Number((accelMs2 / 9.81).toFixed(2));
      targetLatG = Number(gaussianNoise(0, 0.02).toFixed(2));

      // Tyre cooling on straights
      tempFL = Math.max(baselineTemps.FL - 2, tempFL - 0.012);
      tempFR = Math.max(baselineTemps.FR - 2, tempFR - 0.012);
      tempRL = Math.max(baselineTemps.RL - 2, tempRL - 0.012);
      tempRR = Math.max(baselineTemps.RR - 2, tempRR - 0.012);
    } else {
      const bDist = activeCorner.brakeDist - brakeDeltaMeters;
      const aDist = activeCorner.apexDist;
      const eDist = activeCorner.exitDist + (isPro ? 0 : exitCommitDelta);
      const cApexSpeed = activeCorner.apexSpeed + apexSpeedOffset;

      if (dist < aDist) {
        // CORNER ENTRY & BRAKING ZONE
        const entryProgress = (dist - bDist) / Math.max(1, (aDist - bDist));

        if (entryProgress < 0.45) {
          // Hard initial threshold braking
          throttle = 0.0;
          brake = Math.min(100, Math.round(activeCorner.maxBrake * (entryProgress / 0.15)));
          if (brake > activeCorner.maxBrake) brake = activeCorner.maxBrake;
          steer = gaussianNoise(0, 0.8);
          targetLongG = isF1 ? -4.2 : -1.85;
        } else {
          // Trail braking into apex (pedal decays, steering increases)
          throttle = 0.0;
          const trailProgress = (entryProgress - 0.45) / 0.55; // 0 to 1
          brake = Math.max(0, Math.round(activeCorner.maxBrake * Math.pow(1 - trailProgress, 1.4)));
          
          // Steering angle ramps in
          const peakSteer = (activeCorner.peakSteer || 50) * activeCorner.dir * understeerMultiplier;
          steer = Number((peakSteer * Math.sin(trailProgress * Math.PI * 0.5) + gaussianNoise(0, 0.5)).toFixed(1));
          
          targetLongG = Number((-1.4 * (1 - trailProgress)).toFixed(2));
          targetLatG = Number((Math.sign(activeCorner.dir) * Math.min(isF1 ? 3.8 : 2.1, (Math.pow(speed / 3.6, 2) / (activeCorner.radius || 40)) / 9.81) * trailProgress).toFixed(2));
        }

        // Deceleration rate
        const decelKmhS = isF1 ? 160 : 75;
        speed = Math.max(cApexSpeed, speed - decelKmhS * (brake / 100) * dt);

        // Front tyres heat up under heavy braking & lateral load
        tempFL += 0.04;
        tempFR += 0.04;
        if (activeCorner.dir > 0) tempFL += 0.08; // Right turn loads left tyre
        else tempFR += 0.08;
      } else {
        // CORNER APEX & EXIT ACCELERATION
        const exitProgress = (dist - aDist) / Math.max(1, (eDist - aDist)); // 0 to 1
        brake = 0.0;

        // Progressive throttle application out of apex
        const targetThrottle = Math.min(100, Math.round(Math.pow(exitProgress, 0.85) * 100));
        throttle = targetThrottle;

        // Steering unwinds
        const peakSteer = (activeCorner.peakSteer || 50) * activeCorner.dir * understeerMultiplier;
        steer = Number((peakSteer * (1 - exitProgress) + gaussianNoise(0, 0.4)).toFixed(1));

        // Cornering lateral G decaying as car straightens
        const peakG = isF1 ? 3.4 : 1.95;
        targetLatG = Number((Math.sign(activeCorner.dir) * peakG * (1 - exitProgress * 0.8)).toFixed(2));
        targetLongG = Number((0.65 * exitProgress).toFixed(2));

        // Acceleration out of corner
        speed = Math.min(topSpeedKmh, speed + (28.0 / Math.max(10, speed / 3.6)) * (throttle / 100) * dt * 3.6);

        // Rear tyres heat up under power traction
        tempRL += 0.035;
        tempRR += 0.035;
      }
    }

    // Dynamic pressure expansion from temperature (ideal gas law ~0.08 psi per deg C)
    pressFL = Number((baselinePress.FL + (tempFL - baselineTemps.FL) * 0.075).toFixed(2));
    pressFR = Number((baselinePress.FR + (tempFR - baselineTemps.FR) * 0.075).toFixed(2));
    pressRL = Number((baselinePress.RL + (tempRL - baselineTemps.RL) * 0.075).toFixed(2));
    pressRR = Number((baselinePress.RR + (tempRR - baselineTemps.RR) * 0.075).toFixed(2));

    const { gear, rpm } = getGearAndRPM(speed, isF1);

    // Subtle gear shift RPM dip
    let currentRpm = rpm;
    if (dist > 10 && Math.abs(speed % 40) < 1.2 && throttle > 90) {
      currentRpm = Math.round(rpm * 0.88); // Shift RPM drop
    }

    points.push({
      time: Number(time.toFixed(3)),
      dist: Math.round(dist),
      speed: Number(speed.toFixed(1)),
      throttle: Math.min(100, Math.max(0, Math.round(throttle))),
      brake: Math.min(100, Math.max(0, Math.round(brake))),
      steer: Number(steer.toFixed(1)),
      gear,
      rpm: currentRpm,
      latG: targetLatG,
      longG: targetLongG,
      tempFL: Number(tempFL.toFixed(1)),
      tempFR: Number(tempFR.toFixed(1)),
      tempRL: Number(tempRL.toFixed(1)),
      tempRR: Number(tempRR.toFixed(1)),
      pressFL,
      pressFR,
      pressRL,
      pressRR,
    });

    // Advance distance by speed * dt
    const vMs = speed / 3.6;
    dist += vMs * dt;
    time += dt;
  }

  return points;
}

function pointsToCSV(points) {
  const header = "Time,Distance,Speed,Throttle,Brake,Steering,Gear,RPM,LatG,LongG,TyreTemp_FL,TyreTemp_FR,TyreTemp_RL,TyreTemp_RR,Press_FL,Press_FR,Press_RL,Press_RR";
  const rows = points.map(p =>
    `${p.time},${p.dist},${p.speed},${p.throttle},${p.brake},${p.steer},${p.gear},${p.rpm},${p.latG},${p.longG},${p.tempFL},${p.tempFR},${p.tempRL},${p.tempRR},${p.pressFL},${p.pressFR},${p.pressRL},${p.pressRR}`
  );
  return [header, ...rows].join("\n");
}

module.exports = {
  generateTrackTelemetry,
  pointsToCSV,
};
