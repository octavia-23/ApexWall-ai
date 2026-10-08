@echo off
title ApexWall AI - Universal Sim Rig Bridge
cls
echo ===================================================================
echo   🏁 APEXWALL AI // UNIVERSAL SIM RIG TELEMETRY BRIDGE
echo ===================================================================
echo.
echo Initializing Multi-Sim UDP Listeners & Shared Memory:
echo   [✓] Automobilista 2 & Project CARS 2 : UDP Port 5606 (Physics & Timings)
echo   [✓] Forza Motorsport & Horizon       : UDP Port 5300 (Data Out)
echo   [✓] F1 23 / 24 / 25                 : UDP Port 20777 (Motion, LapData & Telemetry)
echo   [✓] Assetto Corsa & ACC              : Windows Shared Memory (Local\acpmf_*)
echo   [✓] Assetto Corsa Evo                : UDP Port 9002 & Shared Memory
echo.
echo Active Services:
echo   • WebSocket 60Hz Telemetry Stream    : ws://localhost:9001
echo   • 1-Click Game Setup Injector        : http://localhost:9001/api/inject-setup
echo   • Auto-Lap Recorder & Ingest API     : http://localhost:9001/api/latest-lap
echo ===================================================================
echo.
echo Keep this window open while driving on your rig.
echo ApexWall will automatically detect whichever sim you launch!
echo.

node scripts/telemetry-bridge.js
pause
