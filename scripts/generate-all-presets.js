const fs = require("fs");
const path = require("path");
const { generateTrackTelemetry, pointsToCSV } = require("./realistic-physics-engine");

const outDir = path.join(__dirname, "..", "public", "sample-telemetry");

// ----------------------------------------------------------------------------
// 1. SPA-FRANCORCHAMPS (7,004m) - FERRARI 296 GT3
// ----------------------------------------------------------------------------
const spaCorners = [
  // T1 La Source
  { name: "La Source", brakeDist: 280, apexDist: 400, exitDist: 530, apexSpeed: 68, maxBrake: 98, dir: 1, radius: 25, peakSteer: 75 },
  // T2-T4 Eau Rouge / Raidillon
  { name: "Eau Rouge", brakeDist: 1120, apexDist: 1220, exitDist: 1420, apexSpeed: 232, maxBrake: 0, dir: -1, radius: 120, peakSteer: 25 },
  // T5-T7 Les Combes
  { name: "Les Combes (T5)", brakeDist: 2150, apexDist: 2320, exitDist: 2420, apexSpeed: 135, maxBrake: 92, dir: 1, radius: 55, peakSteer: 48 },
  { name: "Malmedy (T6)", brakeDist: 2430, apexDist: 2520, exitDist: 2640, apexSpeed: 140, maxBrake: 20, dir: -1, radius: 60, peakSteer: 45 },
  // T8 Bruxelles (Rivage)
  { name: "Bruxelles", brakeDist: 2880, apexDist: 3040, exitDist: 3200, apexSpeed: 104, maxBrake: 88, dir: 1, radius: 40, peakSteer: 65 },
  // T9 Speakers Corner
  { name: "No Name", brakeDist: 3320, apexDist: 3440, exitDist: 3560, apexSpeed: 146, maxBrake: 65, dir: -1, radius: 65, peakSteer: 42 },
  // T10-T11 Pouhon
  { name: "Pouhon", brakeDist: 3950, apexDist: 4120, exitDist: 4350, apexSpeed: 196, maxBrake: 35, dir: -1, radius: 100, peakSteer: 38 },
  // T12-T13 Fagnes
  { name: "Fagnes", brakeDist: 4720, apexDist: 4850, exitDist: 4980, apexSpeed: 136, maxBrake: 85, dir: 1, radius: 55, peakSteer: 48 },
  // T14-T15 Campus / Stavelot
  { name: "Stavelot", brakeDist: 5280, apexDist: 5420, exitDist: 5580, apexSpeed: 148, maxBrake: 55, dir: 1, radius: 70, peakSteer: 38 },
  // T16-T17 Blanchimont
  { name: "Blanchimont", brakeDist: 6050, apexDist: 6200, exitDist: 6450, apexSpeed: 258, maxBrake: 0, dir: -1, radius: 140, peakSteer: 22 },
  // T18-T19 Bus Stop Chicane
  { name: "Bus Stop Chicane", brakeDist: 6620, apexDist: 6780, exitDist: 6920, apexSpeed: 72, maxBrake: 98, dir: 1, radius: 28, peakSteer: 72 },
];

console.log("Generating Spa Driver & Pro Reference...");
const spaDriver = generateTrackTelemetry({
  trackLength: 7004,
  isF1: false,
  isPro: false,
  corners: spaCorners,
  baselineTemps: { FL: 84.5, FR: 88.2, RL: 82.0, RR: 84.8 },
  baselinePress: { FL: 26.9, FR: 27.4, RL: 26.7, RR: 27.1 },
  topSpeedKmh: 276,
});
fs.writeFileSync(path.join(outDir, "spa-gt3-motec.csv"), pointsToCSV(spaDriver));

const spaPro = generateTrackTelemetry({
  trackLength: 7004,
  isF1: false,
  isPro: true,
  corners: spaCorners,
  baselineTemps: { FL: 85.0, FR: 89.0, RL: 82.5, RR: 85.2 },
  baselinePress: { FL: 26.95, FR: 27.45, RL: 26.75, RR: 27.15 },
  topSpeedKmh: 278,
});
fs.writeFileSync(path.join(outDir, "spa-gt3-pro-reference.csv"), pointsToCSV(spaPro));

// ----------------------------------------------------------------------------
// 2. MONZA (5,793m) - PORSCHE 992 GT3 R
// ----------------------------------------------------------------------------
const monzaCorners = [
  // T1-T2 Variante del Rettifilo
  { name: "Variante del Rettifilo", brakeDist: 980, apexDist: 1150, exitDist: 1300, apexSpeed: 72, maxBrake: 100, dir: 1, radius: 26, peakSteer: 78 },
  // T3 Curva Grande
  { name: "Curva Grande", brakeDist: 1520, apexDist: 1750, exitDist: 1980, apexSpeed: 255, maxBrake: 0, dir: 1, radius: 150, peakSteer: 22 },
  // T4-T5 Variante della Roggia
  { name: "Variante della Roggia", brakeDist: 2180, apexDist: 2320, exitDist: 2450, apexSpeed: 108, maxBrake: 94, dir: -1, radius: 45, peakSteer: 58 },
  // T6 Lesmo 1
  { name: "Lesmo 1", brakeDist: 2720, apexDist: 2840, exitDist: 2950, apexSpeed: 158, maxBrake: 75, dir: 1, radius: 68, peakSteer: 44 },
  // T7 Lesmo 2
  { name: "Lesmo 2", brakeDist: 3100, apexDist: 3220, exitDist: 3340, apexSpeed: 145, maxBrake: 80, dir: 1, radius: 58, peakSteer: 48 },
  // T8-T10 Variante Ascari
  { name: "Variante Ascari", brakeDist: 4180, apexDist: 4340, exitDist: 4550, apexSpeed: 158, maxBrake: 88, dir: -1, radius: 72, peakSteer: 46 },
  // T11 Parabolica
  { name: "Parabolica", brakeDist: 5200, apexDist: 5380, exitDist: 5680, apexSpeed: 165, maxBrake: 82, dir: 1, radius: 85, peakSteer: 42 },
];

console.log("Generating Monza Driver & Pro Reference...");
const monzaDriver = generateTrackTelemetry({
  trackLength: 5793,
  isF1: false,
  isPro: false,
  corners: monzaCorners,
  baselineTemps: { FL: 85.0, FR: 86.5, RL: 83.2, RR: 84.5 },
  baselinePress: { FL: 27.1, FR: 27.2, RL: 26.8, RR: 27.0 },
  topSpeedKmh: 286,
});
fs.writeFileSync(path.join(outDir, "monza-gt3-motec.csv"), pointsToCSV(monzaDriver));

const monzaPro = generateTrackTelemetry({
  trackLength: 5793,
  isF1: false,
  isPro: true,
  corners: monzaCorners,
  baselineTemps: { FL: 85.8, FR: 87.0, RL: 83.8, RR: 85.0 },
  baselinePress: { FL: 27.15, FR: 27.25, RL: 26.85, RR: 27.05 },
  topSpeedKmh: 288,
});
fs.writeFileSync(path.join(outDir, "monza-gt3-pro-reference.csv"), pointsToCSV(monzaPro));

// ----------------------------------------------------------------------------
// 3. SILVERSTONE GP (5,891m) - RED BULL RB20 F1
// ----------------------------------------------------------------------------
const silverstoneCorners = [
  // T1 Abbey
  { name: "Abbey", brakeDist: 350, apexDist: 480, exitDist: 600, apexSpeed: 292, maxBrake: 0, dir: 1, radius: 160, peakSteer: 18 },
  // T3-T4 Village & Loop
  { name: "Village", brakeDist: 880, apexDist: 1020, exitDist: 1120, apexSpeed: 110, maxBrake: 98, dir: 1, radius: 36, peakSteer: 65 },
  { name: "The Loop", brakeDist: 1130, apexDist: 1220, exitDist: 1320, apexSpeed: 82, maxBrake: 45, dir: -1, radius: 28, peakSteer: 75 },
  // T6-T7 Brooklands & Luffield
  { name: "Brooklands", brakeDist: 2280, apexDist: 2420, exitDist: 2540, apexSpeed: 162, maxBrake: 90, dir: -1, radius: 68, peakSteer: 48 },
  { name: "Luffield", brakeDist: 2560, apexDist: 2680, exitDist: 2820, apexSpeed: 115, maxBrake: 35, dir: 1, radius: 45, peakSteer: 62 },
  // T9 Copse
  { name: "Copse", brakeDist: 3380, apexDist: 3520, exitDist: 3680, apexSpeed: 274, maxBrake: 25, dir: 1, radius: 145, peakSteer: 24 },
  // T10-T14 Maggotts, Becketts & Chapel
  { name: "Maggotts", brakeDist: 3820, apexDist: 3940, exitDist: 4040, apexSpeed: 295, maxBrake: 0, dir: -1, radius: 155, peakSteer: 22 },
  { name: "Becketts (T12)", brakeDist: 4050, apexDist: 4160, exitDist: 4260, apexSpeed: 235, maxBrake: 45, dir: 1, radius: 95, peakSteer: 36 },
  { name: "Chapel (T14)", brakeDist: 4280, apexDist: 4380, exitDist: 4500, apexSpeed: 255, maxBrake: 0, dir: -1, radius: 125, peakSteer: 25 },
  // T15 Stowe
  { name: "Stowe", brakeDist: 5180, apexDist: 5340, exitDist: 5480, apexSpeed: 195, maxBrake: 95, dir: 1, radius: 82, peakSteer: 42 },
  // T16-T18 Vale & Club
  { name: "Vale", brakeDist: 5580, apexDist: 5680, exitDist: 5760, apexSpeed: 98, maxBrake: 96, dir: -1, radius: 32, peakSteer: 68 },
  { name: "Club", brakeDist: 5770, apexDist: 5830, exitDist: 5891, apexSpeed: 145, maxBrake: 15, dir: 1, radius: 60, peakSteer: 45 },
];

console.log("Generating Silverstone F1 Driver & Pro Reference...");
const silverstoneDriver = generateTrackTelemetry({
  trackLength: 5891,
  isF1: true,
  isPro: false,
  corners: silverstoneCorners,
  baselineTemps: { FL: 95.0, FR: 98.5, RL: 91.0, RR: 94.2 },
  baselinePress: { FL: 22.8, FR: 23.2, RL: 20.8, RR: 21.2 },
  topSpeedKmh: 334,
});
fs.writeFileSync(path.join(outDir, "silverstone-f1.csv"), pointsToCSV(silverstoneDriver));

const silverstonePro = generateTrackTelemetry({
  trackLength: 5891,
  isF1: true,
  isPro: true,
  corners: silverstoneCorners,
  baselineTemps: { FL: 96.0, FR: 99.5, RL: 92.0, RR: 95.0 },
  baselinePress: { FL: 22.9, FR: 23.3, RL: 20.9, RR: 21.3 },
  topSpeedKmh: 338,
});
fs.writeFileSync(path.join(outDir, "silverstone-f1-pro-reference.csv"), pointsToCSV(silverstonePro));

// ----------------------------------------------------------------------------
// 4. IMOLA (4,909m) - ASSETTO CORSA EVO (FERRARI 296 GT3)
// ----------------------------------------------------------------------------
const imolaCorners = [
  { name: "Variante Tamburello", brakeDist: 520, apexDist: 680, exitDist: 820, apexSpeed: 132, maxBrake: 92, dir: -1, radius: 52, peakSteer: 52 },
  { name: "Variante Villeneuve", brakeDist: 1120, apexDist: 1260, exitDist: 1380, apexSpeed: 158, maxBrake: 82, dir: -1, radius: 66, peakSteer: 44 },
  { name: "Tosa", brakeDist: 1520, apexDist: 1650, exitDist: 1780, apexSpeed: 88, maxBrake: 96, dir: -1, radius: 30, peakSteer: 72 },
  { name: "Piratella", brakeDist: 2050, apexDist: 2180, exitDist: 2300, apexSpeed: 182, maxBrake: 55, dir: -1, radius: 85, peakSteer: 38 },
  { name: "Acque Minerali", brakeDist: 2580, apexDist: 2720, exitDist: 2900, apexSpeed: 128, maxBrake: 90, dir: 1, radius: 50, peakSteer: 55 },
  { name: "Variante Alta", brakeDist: 3350, apexDist: 3480, exitDist: 3600, apexSpeed: 120, maxBrake: 88, dir: 1, radius: 46, peakSteer: 56 },
  { name: "Rivazza 1", brakeDist: 4120, apexDist: 4240, exitDist: 4350, apexSpeed: 118, maxBrake: 92, dir: -1, radius: 45, peakSteer: 58 },
  { name: "Rivazza 2", brakeDist: 4360, apexDist: 4460, exitDist: 4580, apexSpeed: 124, maxBrake: 30, dir: -1, radius: 48, peakSteer: 54 },
];

console.log("Generating Imola (AC Evo)...");
const imolaDriver = generateTrackTelemetry({
  trackLength: 4909,
  isF1: false,
  isPro: false,
  corners: imolaCorners,
  baselineTemps: { FL: 83.5, FR: 86.8, RL: 81.2, RR: 84.0 },
  baselinePress: { FL: 26.85, FR: 27.25, RL: 26.65, RR: 27.05 },
  topSpeedKmh: 274,
});
fs.writeFileSync(path.join(outDir, "acevo-imola-gt3.csv"), pointsToCSV(imolaDriver));

// ----------------------------------------------------------------------------
// 5. ROAD ATLANTA (4,088m) - PORSCHE 992 GT3 R
// ----------------------------------------------------------------------------
const roadAtlantaCorners = [
  { name: "Turn 1", brakeDist: 280, apexDist: 420, exitDist: 540, apexSpeed: 172, maxBrake: 75, dir: 1, radius: 75, peakSteer: 42 },
  { name: "The Esses (T2-T4)", brakeDist: 720, apexDist: 950, exitDist: 1150, apexSpeed: 215, maxBrake: 35, dir: -1, radius: 110, peakSteer: 32 },
  { name: "Turn 5", brakeDist: 1280, apexDist: 1400, exitDist: 1520, apexSpeed: 116, maxBrake: 94, dir: -1, radius: 44, peakSteer: 60 },
  { name: "Turn 7", brakeDist: 1780, apexDist: 1920, exitDist: 2050, apexSpeed: 95, maxBrake: 96, dir: 1, radius: 34, peakSteer: 68 },
  { name: "T10A-10B Chicane", brakeDist: 3240, apexDist: 3420, exitDist: 3600, apexSpeed: 88, maxBrake: 100, dir: -1, radius: 32, peakSteer: 70 },
  { name: "Turn 12", brakeDist: 3780, apexDist: 3920, exitDist: 4050, apexSpeed: 198, maxBrake: 25, dir: 1, radius: 105, peakSteer: 35 },
];

console.log("Generating Road Atlanta...");
const roadAtlantaDriver = generateTrackTelemetry({
  trackLength: 4088,
  isF1: false,
  isPro: false,
  corners: roadAtlantaCorners,
  baselineTemps: { FL: 84.0, FR: 87.5, RL: 82.5, RR: 85.0 },
  baselinePress: { FL: 26.9, FR: 27.3, RL: 26.7, RR: 27.1 },
  topSpeedKmh: 278,
});
fs.writeFileSync(path.join(outDir, "roadatlanta-imsa-gt3.csv"), pointsToCSV(roadAtlantaDriver));

// ----------------------------------------------------------------------------
// 6. JEDDAH CORNICHE (6,174m) - RED BULL RB20 F1
// ----------------------------------------------------------------------------
const jeddahCorners = [
  { name: "T1-T2", brakeDist: 450, apexDist: 580, exitDist: 720, apexSpeed: 105, maxBrake: 98, dir: -1, radius: 35, peakSteer: 68 },
  { name: "T4-T7", brakeDist: 1100, apexDist: 1350, exitDist: 1550, apexSpeed: 235, maxBrake: 40, dir: 1, radius: 100, peakSteer: 35 },
  { name: "T8-T10", brakeDist: 1750, apexDist: 1980, exitDist: 2180, apexSpeed: 245, maxBrake: 30, dir: -1, radius: 115, peakSteer: 32 },
  { name: "T13 Banked Hairpin", brakeDist: 2550, apexDist: 2720, exitDist: 2900, apexSpeed: 145, maxBrake: 85, dir: -1, radius: 60, peakSteer: 52 },
  { name: "T16-T17", brakeDist: 3450, apexDist: 3620, exitDist: 3780, apexSpeed: 230, maxBrake: 45, dir: 1, radius: 95, peakSteer: 36 },
  { name: "T22-T23", brakeDist: 4750, apexDist: 4920, exitDist: 5100, apexSpeed: 220, maxBrake: 50, dir: -1, radius: 90, peakSteer: 38 },
  { name: "T27 Hairpin", brakeDist: 5820, apexDist: 5980, exitDist: 6120, apexSpeed: 110, maxBrake: 98, dir: -1, radius: 38, peakSteer: 65 },
];

console.log("Generating Jeddah F1...");
const jeddahDriver = generateTrackTelemetry({
  trackLength: 6174,
  isF1: true,
  isPro: false,
  corners: jeddahCorners,
  baselineTemps: { FL: 96.0, FR: 99.0, RL: 92.5, RR: 95.5 },
  baselinePress: { FL: 23.0, FR: 23.4, RL: 21.0, RR: 21.4 },
  topSpeedKmh: 336,
});
fs.writeFileSync(path.join(outDir, "jeddah-f1.csv"), pointsToCSV(jeddahDriver));

// ----------------------------------------------------------------------------
// 7. NÜRBURGRING NORDSCHLEIFE (20,832m) - PORSCHE 992 GT3 R
// ----------------------------------------------------------------------------
const nordschleifeCorners = [
  { name: "Hatzenbach", brakeDist: 850, apexDist: 1020, exitDist: 1250, apexSpeed: 135, maxBrake: 85, dir: 1, radius: 55, peakSteer: 52 },
  { name: "Flugplatz Crest", brakeDist: 2450, apexDist: 2600, exitDist: 2800, apexSpeed: 215, maxBrake: 25, dir: 1, radius: 110, peakSteer: 32 },
  { name: "Schwedenkreuz", brakeDist: 3450, apexDist: 3620, exitDist: 3800, apexSpeed: 245, maxBrake: 45, dir: -1, radius: 130, peakSteer: 28 },
  { name: "Aremberg", brakeDist: 3950, apexDist: 4120, exitDist: 4280, apexSpeed: 118, maxBrake: 95, dir: 1, radius: 45, peakSteer: 60 },
  { name: "Fuchsröhre", brakeDist: 4850, apexDist: 5050, exitDist: 5300, apexSpeed: 260, maxBrake: 0, dir: -1, radius: 150, peakSteer: 20 },
  { name: "Adenauer Forst", brakeDist: 5650, apexDist: 5800, exitDist: 5950, apexSpeed: 88, maxBrake: 98, dir: -1, radius: 30, peakSteer: 72 },
  { name: "Metzgesfeld", brakeDist: 6650, apexDist: 6800, exitDist: 6980, apexSpeed: 165, maxBrake: 75, dir: -1, radius: 75, peakSteer: 42 },
  { name: "Wehrseifen", brakeDist: 7550, apexDist: 7700, exitDist: 7850, apexSpeed: 85, maxBrake: 98, dir: 1, radius: 28, peakSteer: 74 },
  { name: "Breidscheid / Ex-Mühle", brakeDist: 8550, apexDist: 8720, exitDist: 8900, apexSpeed: 105, maxBrake: 92, dir: 1, radius: 38, peakSteer: 66 },
  { name: "Bergwerk", brakeDist: 10050, apexDist: 10220, exitDist: 10400, apexSpeed: 115, maxBrake: 90, dir: 1, radius: 44, peakSteer: 62 },
  { name: "Kesselchen", brakeDist: 11450, apexDist: 11700, exitDist: 12100, apexSpeed: 235, maxBrake: 0, dir: -1, radius: 135, peakSteer: 24 },
  { name: "Klostertal", brakeDist: 12650, apexDist: 12850, exitDist: 13100, apexSpeed: 195, maxBrake: 55, dir: 1, radius: 95, peakSteer: 36 },
  { name: "Karussell", brakeDist: 13550, apexDist: 13750, exitDist: 13980, apexSpeed: 95, maxBrake: 94, dir: -1, radius: 32, peakSteer: 68 },
  { name: "Hohe Acht", brakeDist: 14450, apexDist: 14600, exitDist: 14780, apexSpeed: 125, maxBrake: 88, dir: 1, radius: 48, peakSteer: 55 },
  { name: "Wippermann", brakeDist: 15250, apexDist: 15420, exitDist: 15600, apexSpeed: 155, maxBrake: 70, dir: 1, radius: 65, peakSteer: 45 },
  { name: "Brünnchen", brakeDist: 16150, apexDist: 16320, exitDist: 16520, apexSpeed: 115, maxBrake: 92, dir: 1, radius: 42, peakSteer: 64 },
  { name: "Pflanzgarten 1 (Jump)", brakeDist: 16950, apexDist: 17150, exitDist: 17350, apexSpeed: 185, maxBrake: 65, dir: 1, radius: 85, peakSteer: 38 },
  { name: "Schwalbenschwanz", brakeDist: 18450, apexDist: 18620, exitDist: 18800, apexSpeed: 145, maxBrake: 80, dir: 1, radius: 60, peakSteer: 48 },
  { name: "Mini-Karussell", brakeDist: 18950, apexDist: 19080, exitDist: 19200, apexSpeed: 90, maxBrake: 95, dir: -1, radius: 30, peakSteer: 70 },
  { name: "Galgenkopf", brakeDist: 19350, apexDist: 19550, exitDist: 19800, apexSpeed: 165, maxBrake: 60, dir: 1, radius: 78, peakSteer: 42 },
  // Döttinger Höhe straight (accelerating to 285 km/h for 2.2 km)
];

console.log("Generating Nordschleife (~10,000 points)...");
const nordschleifeDriver = generateTrackTelemetry({
  trackLength: 20832,
  isF1: false,
  isPro: false,
  corners: nordschleifeCorners,
  baselineTemps: { FL: 83.0, FR: 85.5, RL: 81.0, RR: 83.5 },
  baselinePress: { FL: 26.8, FR: 27.1, RL: 26.6, RR: 26.9 },
  topSpeedKmh: 288,
});
fs.writeFileSync(path.join(outDir, "nordschleife-gt3.csv"), pointsToCSV(nordschleifeDriver));

console.log("All realistic telemetry presets generated successfully!");
