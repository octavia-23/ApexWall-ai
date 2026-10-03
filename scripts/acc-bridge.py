"""
=============================================================================
ASSETTO CORSA COMPETIZIONE (ACC) // SHARED MEMORY TELEMETRY BRIDGE
=============================================================================
Connects directly to Assetto Corsa Competizione's native Windows Shared Memory
mapping (Local\\acpmf_physics, Local\\acpmf_graphics, and Local\\acpmf_static)
and streams normalized 60Hz telemetry frames to stdout (for Node.js
telemetry-bridge.js) or UDP.

Usage:
  python scripts/acc-bridge.py               # Stream JSON frames to stdout
  python scripts/acc-bridge.py --selftest    # Verify struct unpacking from synthetic buffer
  python scripts/acc-bridge.py --test        # Synthetic 60Hz test stream (no game needed)
  python scripts/acc-bridge.py --udp 9003    # Broadcast via UDP to port 9003
=============================================================================
"""

import sys
import time
import json
import math
import mmap
import ctypes
import socket
import argparse

# ---------------------------------------------------------------------------
# CTYPES STRUCT DEFINITIONS (Matching Kunos ACC Shared Memory Layouts)
# Source of truth: pyaccsharedmemory / acc_shared_memory_rs
# ---------------------------------------------------------------------------

class SPageFilePhysics(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", ctypes.c_int32),
        ("gas", ctypes.c_float),
        ("brake", ctypes.c_float),
        ("fuel", ctypes.c_float),
        ("gear", ctypes.c_int32),
        ("rpms", ctypes.c_int32),
        ("steerAngle", ctypes.c_float),
        ("speedKmh", ctypes.c_float),
        ("velocity", ctypes.c_float * 3),
        ("accG", ctypes.c_float * 3),
        ("wheelSlip", ctypes.c_float * 4),
        ("wheelLoad", ctypes.c_float * 4),
        ("wheelsPressure", ctypes.c_float * 4),
        ("wheelAngularSpeed", ctypes.c_float * 4),
        ("tyreWear", ctypes.c_float * 4),
        ("tyreDirtyLevel", ctypes.c_float * 4),
        ("tyreCoreTemperature", ctypes.c_float * 4),
        ("camberRAD", ctypes.c_float * 4),
        ("suspensionTravel", ctypes.c_float * 4),
        ("drs", ctypes.c_int32),
        ("tc", ctypes.c_float),
        ("heading", ctypes.c_float),
        ("pitch", ctypes.c_float),
        ("roll", ctypes.c_float),
        ("cgHeight", ctypes.c_float),
        ("carDamage", ctypes.c_float * 5),
        ("numberOfTyresOut", ctypes.c_int32),
        ("pitLimiterOn", ctypes.c_int32),
        ("abs", ctypes.c_float),
        ("kersCharge", ctypes.c_float),
        ("kersInput", ctypes.c_float),
        ("autoshifterOn", ctypes.c_int32),
        ("rideHeight", ctypes.c_float * 2),
        ("turboBoost", ctypes.c_float),
        ("ballast", ctypes.c_float),
        ("airDensity", ctypes.c_float),
        ("airTemp", ctypes.c_float),
        ("roadTemp", ctypes.c_float),
        ("localAngularVel", ctypes.c_float * 3),
        ("finalFF", ctypes.c_float),
        ("performanceMeter", ctypes.c_float),
        ("engineBrake", ctypes.c_int32),
        ("ersRecoveryLevel", ctypes.c_int32),
        ("ersPowerLevel", ctypes.c_int32),
        ("ersHeatCharging", ctypes.c_int32),
        ("ersIsCharging", ctypes.c_int32),
        ("kersCurrentKJ", ctypes.c_float),
        ("drsAvailable", ctypes.c_int32),
        ("drsEnabled", ctypes.c_int32),
        ("brakeTemp", ctypes.c_float * 4),
        ("clutch", ctypes.c_float),
        ("tyreTempI", ctypes.c_float * 4),
        ("tyreTempM", ctypes.c_float * 4),
        ("tyreTempO", ctypes.c_float * 4),
        ("isAIControlled", ctypes.c_int32),
        ("tyreContactPoint", (ctypes.c_float * 3) * 4),
        ("tyreContactNormal", (ctypes.c_float * 3) * 4),
        ("tyreContactHeading", (ctypes.c_float * 3) * 4),
        ("brakeBias", ctypes.c_float),
        ("localVelocity", ctypes.c_float * 3),
        ("P2PActivation", ctypes.c_int32),
        ("P2PStatus", ctypes.c_int32),
        ("currentMaxRpm", ctypes.c_int32),
        ("mz", ctypes.c_float * 4),
        ("fz", ctypes.c_float * 4),
        ("my", ctypes.c_float * 4),
        ("slipRatio", ctypes.c_float * 4),
        ("slipAngle", ctypes.c_float * 4),
        ("tcinAction", ctypes.c_int32),
        ("absinAction", ctypes.c_int32),
        ("suspensionDamage", ctypes.c_float * 4),
        ("tyreTemp", ctypes.c_float * 4),
        ("waterTemp", ctypes.c_float),
        ("brakePressure", ctypes.c_float * 4),
        ("frontBrakeCompound", ctypes.c_int32),
        ("rearBrakeCompound", ctypes.c_int32),
        ("padLife", ctypes.c_float * 4),
        ("discLife", ctypes.c_float * 4),
        ("ignitionOn", ctypes.c_int32),
        ("starterEngineOn", ctypes.c_int32),
        ("isEngineRunning", ctypes.c_int32),
        ("kerbVibration", ctypes.c_float),
        ("slipVibrations", ctypes.c_float),
        ("gVibrations", ctypes.c_float),
        ("absVibrations", ctypes.c_float),
    ]

class SPageFileGraphic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", ctypes.c_int32),
        ("status", ctypes.c_int32),
        ("session", ctypes.c_int32),
        ("currentTime", ctypes.c_wchar * 15),
        ("lastTime", ctypes.c_wchar * 15),
        ("bestTime", ctypes.c_wchar * 15),
        ("split", ctypes.c_wchar * 15),
        ("completedLaps", ctypes.c_int32),
        ("position", ctypes.c_int32),
        ("iCurrentTime", ctypes.c_int32),
        ("iLastTime", ctypes.c_int32),
        ("iBestTime", ctypes.c_int32),
        ("sessionTimeLeft", ctypes.c_float),
        ("distanceTraveled", ctypes.c_float),
        ("isInPit", ctypes.c_int32),
        ("currentSectorIndex", ctypes.c_int32),
        ("lastSectorTime", ctypes.c_int32),
        ("numberOfLaps", ctypes.c_int32),
        ("tyreCompound", ctypes.c_wchar * 33),
        ("replayTimeMultiplier", ctypes.c_float),
        ("normalizedCarPosition", ctypes.c_float),
        ("activeCars", ctypes.c_int32),
        ("carCoordinates", (ctypes.c_float * 3) * 60),
        ("carID", ctypes.c_int32 * 60),
        ("playerCarID", ctypes.c_int32),
        ("penaltyTime", ctypes.c_float),
        ("flag", ctypes.c_int32),
        ("penalty", ctypes.c_int32),
        ("idealLineOn", ctypes.c_int32),
        ("isInPitLane", ctypes.c_int32),
        ("surfaceGrip", ctypes.c_float),
        ("mandatoryPitDone", ctypes.c_int32),
        ("windSpeed", ctypes.c_float),
        ("windDirection", ctypes.c_float),
        ("isSetupMenuVisible", ctypes.c_int32),
        ("mainDisplayIndex", ctypes.c_int32),
        ("secondaryDisplayIndex", ctypes.c_int32),
        ("TC", ctypes.c_int32),
        ("TCCUT", ctypes.c_int32),
        ("EngineMap", ctypes.c_int32),
        ("ABS", ctypes.c_int32),
        ("fuelXLap", ctypes.c_float),
        ("rainLights", ctypes.c_int32),
        ("flashingLights", ctypes.c_int32),
        ("lightStage", ctypes.c_int32),
        ("exhaustTemperature", ctypes.c_float),
        ("wiperStage", ctypes.c_int32),
        ("driverStintTotalTimeLeft", ctypes.c_int32),
        ("driverStintTimeLeft", ctypes.c_int32),
        ("rainTyres", ctypes.c_int32),
        ("sessionIndex", ctypes.c_int32),
        ("usedFuel", ctypes.c_float),
        ("deltaLapTime", ctypes.c_wchar * 15),
        ("ideltaLapTime", ctypes.c_int32),
        ("estimatedLapTime", ctypes.c_wchar * 15),
        ("iestimatedLapTime", ctypes.c_int32),
        ("isDeltaPositive", ctypes.c_int32),
        ("iSplit", ctypes.c_int32),
        ("isValidLap", ctypes.c_int32),
        ("fuelEstimatedLaps", ctypes.c_float),
        ("trackStatus", ctypes.c_wchar * 33),
        ("missingMandatoryPits", ctypes.c_int32),
        ("Clock", ctypes.c_float),
        ("directionLightsLeft", ctypes.c_int32),
        ("directionLightsRight", ctypes.c_int32),
        ("GlobalYellow", ctypes.c_int32),
        ("GlobalYellow1", ctypes.c_int32),
        ("GlobalYellow2", ctypes.c_int32),
        ("GlobalYellow3", ctypes.c_int32),
        ("GlobalWhite", ctypes.c_int32),
        ("GlobalGreen", ctypes.c_int32),
        ("GlobalChequered", ctypes.c_int32),
        ("GlobalRed", ctypes.c_int32),
        ("mfdTyreSet", ctypes.c_int32),
        ("mfdFuelToAdd", ctypes.c_float),
        ("mfdTyrePressureFL", ctypes.c_float),
        ("mfdTyrePressureFR", ctypes.c_float),
        ("mfdTyrePressureRL", ctypes.c_float),
        ("mfdTyrePressureRR", ctypes.c_float),
        ("trackGripStatus", ctypes.c_int32),
        ("rainIntensity", ctypes.c_int32),
        ("rainIntensityIn10min", ctypes.c_int32),
        ("rainIntensityIn30min", ctypes.c_int32),
        ("currentTyreSet", ctypes.c_int32),
        ("strategyTyreSet", ctypes.c_int32),
        ("gapAhead", ctypes.c_int32),
        ("gapBehind", ctypes.c_int32),
    ]

class SPageFileStatic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("smVersion", ctypes.c_wchar * 15),
        ("acVersion", ctypes.c_wchar * 15),
        ("numberOfSessions", ctypes.c_int32),
        ("numCars", ctypes.c_int32),
        ("carModel", ctypes.c_wchar * 33),
        ("track", ctypes.c_wchar * 33),
        ("playerName", ctypes.c_wchar * 33),
        ("playerSurname", ctypes.c_wchar * 33),
        ("playerNick", ctypes.c_wchar * 33),
        ("sectorCount", ctypes.c_int32),
        ("maxTorque", ctypes.c_float),
        ("maxPower", ctypes.c_float),
        ("maxRpm", ctypes.c_int32),
        ("maxFuel", ctypes.c_float),
        ("suspensionMaxTravel", ctypes.c_float * 4),
        ("tyreRadius", ctypes.c_float * 4),
        ("maxTurboBoost", ctypes.c_float),
        ("deprecated_1", ctypes.c_float),
        ("deprecated_2", ctypes.c_float),
        ("penaltiesEnabled", ctypes.c_int32),
        ("aidFuelRate", ctypes.c_float),
        ("aidTireRate", ctypes.c_float),
        ("aidMechanicalDamage", ctypes.c_float),
        ("AllowTyreBlankets", ctypes.c_float),
        ("aidStability", ctypes.c_float),
        ("aidAutoClutch", ctypes.c_int32),
        ("aidAutoBlip", ctypes.c_int32),
        ("hasDRS", ctypes.c_int32),
        ("hasERS", ctypes.c_int32),
        ("hasKERS", ctypes.c_int32),
        ("kersMaxJ", ctypes.c_float),
        ("engineBrakeSettingsCount", ctypes.c_int32),
        ("ersPowerControllerCount", ctypes.c_int32),
        ("trackSplineLength", ctypes.c_float),
    ]

# ---------------------------------------------------------------------------
# FRAME NORMALIZATION LOGIC
# ---------------------------------------------------------------------------

def normalize_acc_frame(physics, graphics=None, max_rpm=8500, track_length=5000):
    """
    Transforms raw ctypes structures into the canonical frame shape consumed
    by the ApexWall JS bridge and web dashboard.
    """
    # Gear normalization (Kunos standard: 0=R, 1=N, 2=1st, 3=2nd, ...)
    raw_gear = physics.gear
    if raw_gear == 0:
        gear_display = "R"
    elif raw_gear == 1:
        gear_display = "N"
    elif raw_gear > 1:
        gear_display = raw_gear - 1
    else:
        gear_display = raw_gear

    # Steer angle: ACC steerAngle is in radians (road wheel angle).
    # Convert radians to degrees (* 180 / pi) and clamp to +-45 scale
    steer_deg = round(max(-45.0, min(45.0, float(physics.steerAngle) * 180.0 / math.pi)), 1)

    # G-Forces: accG is acceleration in m/s^2 (x=lateral, y=vertical, z=longitudinal)
    # Convert from m/s^2 to G (/ 9.80665)
    lat_g = round(float(physics.accG[0]) / 9.80665, 2)
    long_g = round(float(physics.accG[2]) / 9.80665, 2)

    # Tyre Pressures: in ACC GT3, wheelsPressure is in PSI (~26-28 psi).
    # If a vehicle provides bar (< 5.0), convert to PSI.
    pressures = []
    for i in range(4):
        p = float(physics.wheelsPressure[i])
        if 0 < p < 5.0:
            p *= 14.5038
        pressures.append(round(p, 1))

    # Lap timing and positioning from Graphics
    lap_time = 0.0
    normalized_car_pos = 0.0
    if graphics:
        lap_time = max(0.0, float(graphics.iCurrentTime) / 1000.0)
        normalized_car_pos = max(0.0, min(1.0, float(graphics.normalizedCarPosition)))

    total_dist = round(track_length) if track_length and track_length > 0 else 5000
    # distanceTraveled is cumulative session distance, not per-lap distance.
    # Per-lap distance is derived from normalizedCarPosition * totalDistance.
    lap_distance = round(normalized_car_pos * total_dist)

    return {
        "speed": max(0, round(float(physics.speedKmh))),
        "rpm": max(0, int(physics.rpms)),
        "maxRpm": max(1000, int(max_rpm)) if max_rpm else 8500,
        "gear": gear_display,
        "throttle": max(0, min(100, round(float(physics.gas) * 100))),
        "brake": max(0, min(100, round(float(physics.brake) * 100))),
        "steer": steer_deg,
        "latG": lat_g,
        "longG": long_g,
        "lapDistance": lap_distance,
        "totalDistance": total_dist,
        "lapTime": round(lap_time, 2),
        "delta": 0.0,
        "tyreTemps": {
            "FL": round(float(physics.tyreCoreTemperature[0]), 1),
            "FR": round(float(physics.tyreCoreTemperature[1]), 1),
            "RL": round(float(physics.tyreCoreTemperature[2]), 1),
            "RR": round(float(physics.tyreCoreTemperature[3]), 1),
        },
        "tyrePressures": {
            "FL": pressures[0],
            "FR": pressures[1],
            "RL": pressures[2],
            "RR": pressures[3],
        },
    }

# ---------------------------------------------------------------------------
# SHARED MEMORY OPENER
# ---------------------------------------------------------------------------

PHYSICS_MAP = "Local\\acpmf_physics"
GRAPHICS_MAP = "Local\\acpmf_graphics"
STATIC_MAP = "Local\\acpmf_static"

def open_shm(name, size):
    try:
        return mmap.mmap(0, size, name, access=mmap.ACCESS_READ)
    except FileNotFoundError:
        return None
    except Exception:
        return None

def run_synthetic_stream(emit_fn):
    """Outputs synthetic ACC test frames at 60Hz when in test mode."""
    sys.stderr.write("[TEST] Streaming synthetic Assetto Corsa Competizione telemetry (60Hz)...\n")
    sys.stderr.flush()
    progress = 0.0
    last_time = time.time()
    while True:
        now = time.time()
        dt = now - last_time
        last_time = now
        progress = (progress + dt * 0.015) % 1.0

        is_braking = math.sin(progress * math.pi * 6) < -0.3
        corner_phase = math.sin(progress * math.pi * 12)
        speed = 85 + abs(corner_phase) * 45 if is_braking else 245 + math.sin(progress * 4) * 40
        gear = 5 if speed > 200 else (4 if speed > 150 else 3)
        rpm = int(5800 + (speed % 50) * 60)
        thr = 0 if is_braking else int(min(100, (speed / 280) * 100))
        brk = 85 if is_braking else 0
        steer = round(math.sin(progress * 25) * 45, 1)

        frame = {
            "speed": round(speed),
            "rpm": rpm,
            "maxRpm": 8500,
            "gear": gear,
            "throttle": thr,
            "brake": brk,
            "steer": steer,
            "latG": round((steer / 45) * 2.4, 2),
            "longG": -2.8 if is_braking else 0.9,
            "lapDistance": round(progress * 5793),
            "totalDistance": 5793,
            "lapTime": round(progress * 108.5, 2),
            "delta": -0.15,
            "tyreTemps": {
                "FL": round(88.0 + abs(steer) * 0.1, 1),
                "FR": round(86.5 + abs(steer) * 0.08, 1),
                "RL": 84.2,
                "RR": 83.8,
            },
            "tyrePressures": {
                "FL": 26.8,
                "FR": 27.0,
                "RL": 26.6,
                "RR": 26.7,
            },
        }
        emit_fn(frame)
        time.sleep(1.0 / 60.0)

def run_selftest():
    """Builds synthetic bytes buffer of the correct sizes, unpacks them, and prints frame JSON."""
    phys_bytes = bytes(ctypes.sizeof(SPageFilePhysics))
    graph_bytes = bytes(ctypes.sizeof(SPageFileGraphic))
    stat_bytes = bytes(ctypes.sizeof(SPageFileStatic))

    physics = SPageFilePhysics.from_buffer_copy(phys_bytes)
    graphics = SPageFileGraphic.from_buffer_copy(graph_bytes)
    statics = SPageFileStatic.from_buffer_copy(stat_bytes)

    # Verify zero-buffer unpack does not crash
    frame = normalize_acc_frame(physics, graphics, max_rpm=statics.maxRpm, track_length=statics.trackSplineLength)
    output_line = json.dumps(frame)
    sys.stdout.write(output_line + "\n")
    sys.stdout.flush()

    # Also test with sample non-zero physics values to verify math
    physics.speedKmh = 180.0
    physics.rpms = 7200
    physics.gas = 0.95
    physics.brake = 0.0
    physics.gear = 5  # 4th gear
    physics.steerAngle = 0.35  # ~20 degrees
    physics.accG[0] = 14.71  # ~1.5 G
    physics.accG[2] = -9.81  # ~-1.0 G
    physics.tyreCoreTemperature[0] = 85.2
    physics.tyreCoreTemperature[1] = 86.4
    physics.tyreCoreTemperature[2] = 82.1
    physics.tyreCoreTemperature[3] = 83.0
    physics.wheelsPressure[0] = 27.2
    physics.wheelsPressure[1] = 27.4
    physics.wheelsPressure[2] = 26.9
    physics.wheelsPressure[3] = 27.0
    graphics.iCurrentTime = 45200
    graphics.normalizedCarPosition = 0.42
    statics.maxRpm = 8500
    statics.trackSplineLength = 5793.0

    frame_sampled = normalize_acc_frame(physics, graphics, max_rpm=statics.maxRpm, track_length=statics.trackSplineLength)
    assert frame_sampled["speed"] == 180
    assert frame_sampled["rpm"] == 7200
    assert frame_sampled["gear"] == 4
    assert frame_sampled["throttle"] == 95
    assert frame_sampled["brake"] == 0
    assert abs(frame_sampled["steer"] - 20.1) <= 0.2
    assert abs(frame_sampled["latG"] - 1.5) <= 0.05
    assert abs(frame_sampled["longG"] - (-1.0)) <= 0.05
    assert frame_sampled["lapTime"] == 45.2
    assert frame_sampled["totalDistance"] == 5793
    assert frame_sampled["lapDistance"] == round(0.42 * 5793)

def main():
    parser = argparse.ArgumentParser(description="Assetto Corsa Competizione Shared Memory Telemetry Bridge")
    parser.add_argument("--selftest", action="store_true", help="Verify struct unpacking with synthetic buffers and exit")
    parser.add_argument("--test", action="store_true", help="Run in synthetic test broadcast mode (60Hz)")
    parser.add_argument("--udp", type=int, default=0, help="Broadcast JSON frames over UDP to localhost port")
    args = parser.parse_args()

    if args.selftest:
        run_selftest()
        return

    udp_socket = None
    if args.udp > 0:
        udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    def emit_frame(frame_dict):
        line = json.dumps(frame_dict)
        if udp_socket:
            udp_socket.sendto(line.encode("utf-8"), ("127.0.0.1", args.udp))
        else:
            sys.stdout.write(line + "\n")
            sys.stdout.flush()

    if args.test:
        run_synthetic_stream(emit_frame)
        return

    sys.stderr.write("=====================================================\n")
    sys.stderr.write("  🏁 ASSETTO CORSA COMPETIZIONE SHARED MEMORY BRIDGE\n")
    sys.stderr.write("  • Reading Windows Shared Memory: Local\\acpmf_*\n")
    if args.udp > 0:
        sys.stderr.write(f"  • Broadcasting to UDP Port: {args.udp}\n")
    else:
        sys.stderr.write("  • Piping JSON Telemetry Frames to Stdout\n")
    sys.stderr.write("=====================================================\n\n")
    sys.stderr.flush()

    physics_size = ctypes.sizeof(SPageFilePhysics)
    graphics_size = ctypes.sizeof(SPageFileGraphic)
    static_size = ctypes.sizeof(SPageFileStatic)

    physics_shm = None
    graphics_shm = None
    max_rpm = 8500
    track_length = 5000.0
    last_packet_id = -1

    # Read Static block once at startup if available
    try:
        static_shm = open_shm(STATIC_MAP, 784)
        if static_shm:
            stat_buf = static_shm.read(static_size)
            statics = SPageFileStatic.from_buffer_copy(stat_buf)
            if statics.maxRpm > 0:
                max_rpm = statics.maxRpm
            if statics.trackSplineLength > 0:
                track_length = statics.trackSplineLength
            static_shm.close()
            sys.stderr.write(f"[ACC BRIDGE] ✓ Loaded static data: maxRpm={max_rpm}, trackLength={track_length:.0f}m\n")
            sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"[ACC BRIDGE] Note: Could not read static map: {e}\n")
        sys.stderr.flush()

    while True:
        # Check connection
        if not physics_shm:
            physics_shm = open_shm(PHYSICS_MAP, physics_size)
            graphics_shm = open_shm(GRAPHICS_MAP, graphics_size)

            if physics_shm:
                sys.stderr.write(f"[ACC BRIDGE] ✓ Successfully attached to {PHYSICS_MAP}!\n")
                sys.stderr.flush()
            else:
                sys.stderr.write("[ACC BRIDGE] Waiting for Assetto Corsa Competizione to launch (Local\\acpmf_physics)...\n")
                sys.stderr.flush()
                time.sleep(1.5)
                continue

        try:
            # Read Physics
            physics_shm.seek(0)
            phys_buf = physics_shm.read(physics_size)
            physics = SPageFilePhysics.from_buffer_copy(phys_buf)

            # Skip duplicate frames if packetId hasn't changed
            if physics.packetId == last_packet_id and physics.packetId != 0:
                time.sleep(1.0 / 120.0)
                continue
            last_packet_id = physics.packetId

            # Read Graphics (if available)
            graphics = None
            if graphics_shm:
                try:
                    graphics_shm.seek(0)
                    graph_buf = graphics_shm.read(graphics_size)
                    graphics = SPageFileGraphic.from_buffer_copy(graph_buf)
                except Exception:
                    graphics = None

            frame = normalize_acc_frame(physics, graphics, max_rpm=max_rpm, track_length=track_length)
            emit_frame(frame)
            time.sleep(1.0 / 60.0)

        except Exception as e:
            sys.stderr.write(f"[ACC BRIDGE] Error reading shared memory: {e}\n")
            sys.stderr.flush()
            physics_shm = None
            graphics_shm = None
            time.sleep(1.5)

if __name__ == "__main__":
    main()
