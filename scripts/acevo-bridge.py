"""
=============================================================================
ASSETTO CORSA EVO (ACE) // SHARED MEMORY TELEMETRY BRIDGE
=============================================================================
Connects directly to Assetto Corsa Evo's native Windows Shared Memory mapping
(Local\\acevo_pmf_physics & Local\\acevo_pmf_graphics) and streams normalized
60Hz telemetry frames to stdout (for Node.js telemetry-bridge.js) or UDP.

Usage:
  python scripts/acevo-bridge.py               # Stream JSON frames to stdout
  python scripts/acevo-bridge.py --udp 9002     # Broadcast via UDP to port 9002
  python scripts/acevo-bridge.py --test         # Synthetic test stream (no game needed)
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
# CTYPES STRUCT DEFINITIONS (Matching Kunos SPageFilePhysics & SPageFileGraphic)
# ---------------------------------------------------------------------------

class SPageFilePhysics(ctypes.Structure):
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
    ]

class SPageFileGraphic(ctypes.Structure):
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
    ]

# ---------------------------------------------------------------------------
# SHARED MEMORY OPENER WITH FALLBACK
# ---------------------------------------------------------------------------

PHYSICS_MAPS = ["Local\\acevo_pmf_physics", "Local\\acpmf_physics"]
GRAPHICS_MAPS = ["Local\\acevo_pmf_graphics", "Local\\acpmf_graphics"]

def open_shm_block(map_names, size):
    for name in map_names:
        try:
            shm = mmap.mmap(0, size, name, access=mmap.ACCESS_READ)
            return shm, name
        except FileNotFoundError:
            continue
        except Exception:
            continue
    return None, None

def run_synthetic_stream(emit_fn):
    """Outputs synthetic AC Evo test frames at 60Hz when in test mode."""
    sys.stderr.write("[TEST] Streaming synthetic Assetto Corsa Evo telemetry (60Hz)...\n")
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
        speed = 85 + abs(corner_phase) * 45 if is_braking else 240 + math.sin(progress * 4) * 40
        gear = 5 if speed > 200 else (4 if speed > 150 else 3)
        rpm = int(5200 + (speed % 50) * 65)
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
            "lapDistance": round(progress * 4909),
            "totalDistance": 4909,
            "lapTime": round(progress * 104.5, 2),
            "delta": -0.12,
            "tyreTemps": {
                "FL": round(88.0 + abs(steer) * 0.1, 1),
                "FR": round(86.5 + abs(steer) * 0.08, 1),
                "RL": 84.2,
                "RR": 83.8,
            },
            "tyrePressures": {
                "FL": 26.9,
                "FR": 27.1,
                "RL": 26.7,
                "RR": 26.8,
            },
        }
        emit_fn(frame)
        time.sleep(1.0 / 60.0)

def main():
    parser = argparse.ArgumentParser(description="Assetto Corsa Evo Shared Memory Telemetry Bridge")
    parser.add_argument("--test", action="store_true", help="Run in synthetic test broadcast mode")
    parser.add_argument("--udp", type=int, default=0, help="Broadcast JSON frames over UDP to localhost port")
    args = parser.parse_args()

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
    sys.stderr.write("  🏁 ASSETTO CORSA EVO SHARED MEMORY BRIDGE\n")
    sys.stderr.write("  • Reading Windows Shared Memory: Local\\acevo_pmf_*\n")
    if args.udp > 0:
        sys.stderr.write(f"  • Broadcasting to UDP Port: {args.udp}\n")
    else:
        sys.stderr.write("  • Piping JSON Telemetry Frames to Stdout\n")
    sys.stderr.write("=====================================================\n\n")
    sys.stderr.flush()

    physics_size = ctypes.sizeof(SPageFilePhysics)
    graphics_size = ctypes.sizeof(SPageFileGraphic)

    physics_shm = None
    graphics_shm = None
    last_packet_id = -1

    while True:
        # Check connection
        if not physics_shm:
            physics_shm, phys_name = open_shm_block(PHYSICS_MAPS, physics_size)
            graphics_shm, _ = open_shm_block(GRAPHICS_MAPS, graphics_size)

            if physics_shm:
                sys.stderr.write(f"[AC EVO BRIDGE] ✓ Successfully attached to {phys_name}!\n")
                sys.stderr.flush()
            else:
                sys.stderr.write("[AC EVO BRIDGE] Waiting for Assetto Corsa Evo to launch (Local\\acevo_pmf_physics)...\n")
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
            lap_time = 0.0
            distance_traveled = 0.0
            if graphics_shm:
                try:
                    graphics_shm.seek(0)
                    graph_buf = graphics_shm.read(graphics_size)
                    graphics = SPageFileGraphic.from_buffer_copy(graph_buf)
                    lap_time = max(0.0, graphics.iCurrentTime / 1000.0)
                    distance_traveled = max(0.0, float(graphics.distanceTraveled))
                except Exception:
                    pass

            # Gear normalization (Kunos: 0=R, 1=N, 2=1st, 3=2nd, etc.)
            raw_gear = physics.gear
            if raw_gear == 0:
                gear_display = "R"
            elif raw_gear == 1:
                gear_display = "N"
            elif raw_gear > 1:
                gear_display = raw_gear - 1
            else:
                gear_display = raw_gear

            # Steering angle in degrees
            steer_deg = round((physics.steerAngle * 180.0 / math.pi), 1)

            # Normalize pressures: if in psi (~27.0) vs bar (~1.8-2.0)
            fl_press = float(physics.wheelsPressure[0])
            fr_press = float(physics.wheelsPressure[1])
            rl_press = float(physics.wheelsPressure[2])
            rr_press = float(physics.wheelsPressure[3])
            # If pressure is in bar, convert to PSI
            if 0 < fl_press < 5.0:
                fl_press *= 14.5038
                fr_press *= 14.5038
                rl_press *= 14.5038
                rr_press *= 14.5038

            frame = {
                "speed": max(0, round(float(physics.speedKmh))),
                "rpm": max(0, int(physics.rpms)),
                "maxRpm": 8500,
                "gear": gear_display,
                "throttle": max(0, min(100, round(float(physics.gas) * 100))),
                "brake": max(0, min(100, round(float(physics.brake) * 100))),
                "steer": steer_deg,
                "latG": round(float(physics.accG[0]), 2),
                "longG": round(float(physics.accG[2]), 2),
                "lapDistance": round(distance_traveled),
                "totalDistance": 4909,
                "lapTime": round(lap_time, 2),
                "delta": 0.0,
                "tyreTemps": {
                    "FL": round(float(physics.tyreCoreTemperature[0]), 1),
                    "FR": round(float(physics.tyreCoreTemperature[1]), 1),
                    "RL": round(float(physics.tyreCoreTemperature[2]), 1),
                    "RR": round(float(physics.tyreCoreTemperature[3]), 1),
                },
                "tyrePressures": {
                    "FL": round(fl_press, 1),
                    "FR": round(fr_press, 1),
                    "RL": round(rl_press, 1),
                    "RR": round(rr_press, 1),
                },
            }

            emit_frame(frame)
            time.sleep(1.0 / 60.0)

        except Exception as e:
            sys.stderr.write(f"[AC EVO BRIDGE] Error reading shared memory: {e}\n")
            sys.stderr.flush()
            physics_shm = None
            graphics_shm = None
            time.sleep(1.5)

if __name__ == "__main__":
    main()
