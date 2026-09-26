"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  TrackMapData,
  TrackMapPoint,
  TrackCorner,
  LapComparisonSummary,
} from "@/types/telemetry";

interface TrackMap2DProps {
  data: TrackMapData;
  hoverIndex?: number;
  onHoverPoint?: (index: number) => void;
  lapComparison?: LapComparisonSummary | null;
  benchmarkMode?: "pro" | "off";
  activeCornerId?: string | null;
  onSelectCorner?: (corner: TrackCorner | null) => void;
}

type MapColorMode = "speed" | "timeDelta" | "pedals" | "latG";

export const TrackMap2D: React.FC<TrackMap2DProps> = ({
  data,
  hoverIndex = -1,
  onHoverPoint,
  lapComparison,
  benchmarkMode = "pro",
  activeCornerId = null,
  onSelectCorner,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [colorMode, setColorMode] = useState<MapColorMode>("speed");
  const [showCorners, setShowCorners] = useState(true);
  const [hoveredCorner, setHoveredCorner] = useState<TrackCorner | null>(null);

  // Active corner resolved from hovered state or external activeCornerId
  const activeCorner = useMemo(() => {
    if (hoveredCorner) return hoveredCorner;
    if (!activeCornerId) return null;
    return (
      data.corners.find(
        (c) =>
          c.id === activeCornerId ||
          c.shortName === activeCornerId ||
          c.name === activeCornerId ||
          c.shortName.toLowerCase() === activeCornerId.toLowerCase()
      ) || null
    );
  }, [hoveredCorner, activeCornerId, data.corners]);

  // Speed color gradient helper: 70 km/h (blue) -> 180 km/h (cyan) -> 250 km/h (yellow) -> 320 km/h (red)
  const getSpeedColor = (speed: number): string => {
    const s = Math.max(60, Math.min(330, speed));
    if (s < 140) {
      const f = (s - 60) / 80;
      return `rgb(${Math.round(30 + 10 * f)}, ${Math.round(140 + 60 * f)}, ${Math.round(230 + 25 * f)})`; // Deep blue to sky blue
    } else if (s < 220) {
      const f = (s - 140) / 80;
      return `rgb(${Math.round(40 + 180 * f)}, ${Math.round(200 + 40 * f)}, ${Math.round(255 - 150 * f)})`; // Sky blue to lime green
    } else if (s < 280) {
      const f = (s - 220) / 60;
      return `rgb(${Math.round(220 + 35 * f)}, ${Math.round(240 - 80 * f)}, ${Math.round(105 - 80 * f)})`; // Lime to amber yellow
    } else {
      const f = (s - 280) / 50;
      return `rgb(255, ${Math.round(160 - 110 * f)}, ${Math.round(25 + 30 * f)})`; // Amber to red
    }
  };

  // Pedal color: Red for heavy brake, green for throttle, gray for coasting
  const getPedalColor = (throttle: number, brake: number): string => {
    if (brake > 15) {
      const intensity = Math.min(1, brake / 100);
      return `rgb(244, ${Math.round(63 * (1 - intensity * 0.4))}, ${Math.round(94 * (1 - intensity * 0.4))})`; // Rose red
    }
    if (throttle > 40) {
      const intensity = Math.min(1, (throttle - 40) / 60);
      return `rgb(${Math.round(16 + 20 * (1 - intensity))}, ${Math.round(185 + 30 * intensity)}, ${Math.round(129 + 10 * (1 - intensity))})`; // Emerald green
    }
    return "rgba(148, 163, 184, 0.65)"; // Slate coasting
  };

  // Time delta color: Green if gaining (delta <= 0), Red if losing (delta > 0)
  const getDeltaColor = (delta: number | undefined): string => {
    if (delta == null) return "#38BDF8";
    if (delta <= -0.05) return "#10B981"; // Emerald gaining
    if (delta >= 0.05) return "#F43F5E"; // Rose losing
    return "#F59E0B"; // Neutral amber
  };

  // Lat G color: 0G (subtle cyan) to 2.5G+ (vibrant purple/magenta)
  const getLatGColor = (latG: number): string => {
    const g = Math.min(3.0, Math.abs(latG));
    const f = Math.min(1, g / 2.5);
    return `rgb(${Math.round(56 + 180 * f)}, ${Math.round(189 - 120 * f)}, ${Math.round(248 + 7 * f)})`;
  };

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data || data.points.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = Math.max(340, rect.width);
    const height = Math.min(520, Math.max(380, width * 0.58));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Padding & Isometric 1:1 Aspect Ratio Transform
    const pad = 36;
    const viewW = width - pad * 2;
    const viewH = height - pad * 2;
    const size = Math.min(viewW, viewH);
    const offsetX = pad + (viewW - size) / 2;
    const offsetY = pad + (viewH - size) / 2;

    const toCanvasX = (rawX: number) => offsetX + (rawX / 1000) * size;
    const toCanvasY = (rawY: number) => offsetY + (rawY / 1000) * size;

    // Subtle background grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Asphalt Base Layer (Wide dark track surface)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    data.points.forEach((pt, idx) => {
      const cx = toCanvasX(pt.x);
      const cy = toCanvasY(pt.y);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.stroke();

    // 2. Track Borders / Curbs
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    data.points.forEach((pt, idx) => {
      const cx = toCanvasX(pt.x);
      const cy = toCanvasY(pt.y);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Colored Racing Line (Segment by Segment based on active colorMode)
    for (let i = 0; i < data.points.length; i++) {
      const p1 = data.points[i];
      const p2 = data.points[(i + 1) % data.points.length];

      const x1 = toCanvasX(p1.x);
      const y1 = toCanvasY(p1.y);
      const x2 = toCanvasX(p2.x);
      const y2 = toCanvasY(p2.y);

      let strokeColor = "#38BDF8";
      if (colorMode === "speed") {
        strokeColor = getSpeedColor(p1.speed);
      } else if (colorMode === "pedals") {
        strokeColor = getPedalColor(p1.throttle, p1.brake);
      } else if (colorMode === "timeDelta") {
        strokeColor = getDeltaColor(p1.timeDelta);
      } else if (colorMode === "latG") {
        strokeColor = getLatGColor(p1.latG);
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4.2;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // 4. Start / Finish Line
    if (data.points.length > 0) {
      const sf = data.points[0];
      const nextPt = data.points[1] || data.points[0];
      const cx = toCanvasX(sf.x);
      const cy = toCanvasY(sf.y);

      // Tangent vector
      const dx = toCanvasX(nextPt.x) - cx;
      const dy = toCanvasY(nextPt.y) - cy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      ctx.beginPath();
      ctx.moveTo(cx - nx * 14, cy - ny * 14);
      ctx.lineTo(cx + nx * 14, cy + ny * 14);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Start/Finish Pill Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S/F", cx + nx * 24, cy + ny * 24);
    }

    // 5. Corner Markers
    if (showCorners) {
      data.corners.forEach((corner) => {
        const cx = toCanvasX(corner.x);
        const cy = toCanvasY(corner.y);
        const isHovered =
          activeCorner?.id === corner.id ||
          activeCorner?.shortName === corner.shortName ||
          (hoverIndex >= 0 && Math.abs(data.points[hoverIndex]?.dist - corner.dist) < 140);

        // Highlight ring on active corner
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
          ctx.fill();
        }

        // Badge pill circle
        ctx.beginPath();
        ctx.arc(cx, cy, isHovered ? 12.5 : 9.5, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? "#38BDF8" : "rgba(15, 23, 42, 0.9)";
        ctx.fill();
        ctx.strokeStyle = isHovered ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = isHovered ? 2.2 : 1;
        ctx.stroke();

        // Corner Text
        ctx.fillStyle = isHovered ? "#0B0E14" : "rgba(255, 255, 255, 0.9)";
        ctx.font = `bold ${isHovered ? "9px" : "8px"} 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(corner.shortName, cx, cy + 0.5);
      });
    }

    // 6. Active Car Position Dot (Synchronized with hoverIndex)
    if (hoverIndex >= 0 && hoverIndex < data.points.length) {
      const curPt = data.points[hoverIndex];
      const carX = toCanvasX(curPt.x);
      const carY = toCanvasY(curPt.y);

      // Outer pulse glow
      ctx.beginPath();
      ctx.arc(carX, carY, 14, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.fill();

      // Mid ring
      ctx.beginPath();
      ctx.arc(carX, carY, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.5)";
      ctx.fill();

      // Center solid core
      ctx.beginPath();
      ctx.arc(carX, carY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = "#0284C7";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    ctx.restore();
  }, [data, colorMode, showCorners, hoverIndex, activeCorner]);

  // Handle user scrubbing on the track map canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current || !data.points.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = rect.width;
    const height = Math.min(520, Math.max(380, width * 0.58));
    const pad = 36;
    const viewW = width - pad * 2;
    const viewH = height - pad * 2;
    const size = Math.min(viewW, viewH);
    const offsetX = pad + (viewW - size) / 2;
    const offsetY = pad + (viewH - size) / 2;

    const normMouseX = ((mouseX - offsetX) / size) * 1000;
    const normMouseY = ((mouseY - offsetY) / size) * 1000;

    // 1. Check if hovering near a corner badge (radius <= 32 in norm space)
    let foundCorner: TrackCorner | null = null;
    for (const c of data.corners) {
      const dist = Math.hypot(c.x - normMouseX, c.y - normMouseY);
      if (dist < 32) {
        foundCorner = c;
        break;
      }
    }
    setHoveredCorner(foundCorner);
    if (foundCorner) {
      onSelectCorner?.(foundCorner);
    }

    // 2. Find nearest track point to scrub
    let closestIdx = -1;
    let minDist = Infinity;

    for (let i = 0; i < data.points.length; i++) {
      const p = data.points[i];
      const d = Math.hypot(p.x - normMouseX, p.y - normMouseY);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    // Only update if reasonably close to the circuit line (<= 90 normalized units)
    if (minDist < 90 && closestIdx !== -1) {
      onHoverPoint?.(closestIdx);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCorner(null);
    onHoverPoint?.(-1);
    onSelectCorner?.(null);
  };

  const handleCornerClick = (corner: TrackCorner) => {
    // Jump hover scrubber directly to corner apex
    let closestIdx = 0;
    let minDiff = Infinity;
    data.points.forEach((p, idx) => {
      const diff = Math.abs(p.dist - corner.dist);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    onHoverPoint?.(closestIdx);
    onSelectCorner?.(corner);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current || !data.points.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = rect.width;
    const height = Math.min(520, Math.max(380, width * 0.58));
    const pad = 36;
    const viewW = width - pad * 2;
    const viewH = height - pad * 2;
    const size = Math.min(viewW, viewH);
    const offsetX = pad + (viewW - size) / 2;
    const offsetY = pad + (viewH - size) / 2;

    const normMouseX = ((mouseX - offsetX) / size) * 1000;
    const normMouseY = ((mouseY - offsetY) / size) * 1000;

    let clickedCorner: TrackCorner | null = null;
    for (const c of data.corners) {
      const dist = Math.hypot(c.x - normMouseX, c.y - normMouseY);
      if (dist < 32) {
        clickedCorner = c;
        break;
      }
    }

    if (clickedCorner) {
      handleCornerClick(clickedCorner);
      return;
    }

    let closestIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < data.points.length; i++) {
      const p = data.points[i];
      const d = Math.hypot(p.x - normMouseX, p.y - normMouseY);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    if (minDist < 90 && closestIdx !== -1) {
      onHoverPoint?.(closestIdx);
    }
  };

  const currentHoverPoint: TrackMapPoint | null =
    hoverIndex >= 0 && hoverIndex < data.points.length ? data.points[hoverIndex] : null;

  // Find nearest corner to current hover position
  const nearestCorner = useMemo(() => {
    if (!currentHoverPoint) return null;
    let nearest: TrackCorner | null = null;
    let minD = Infinity;
    data.corners.forEach((c) => {
      const diff = Math.abs(c.dist - currentHoverPoint.dist);
      if (diff < minD && diff < 300) {
        minD = diff;
        nearest = c;
      }
    });
    return nearest;
  }, [currentHoverPoint, data.corners]);

  return (
    <div className="trackmap-module glass-card-nested">
      {/* Header with Title, Circuit Info & Channel Selectors */}
      <div className="trackmap-header">
        <div className="trackmap-title-group">
          <div className="trackmap-badge-row">
            <span className="trackmap-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 0-4 19.18" />
              </svg>
              2D GPS CIRCUIT TRACE & RACING LINE
            </span>
            <span className="trackmap-dist-pill">{data.totalDistance.toLocaleString()}m CIRCUIT</span>
          </div>
          <h4 className="trackmap-circuit-name">{data.circuitName}</h4>
        </div>

        {/* Heatmap Channel Selectors */}
        <div className="trackmap-controls">
          <div className="trackmap-color-toggles">
            <button
              type="button"
              className={`trackmap-toggle-btn ${colorMode === "speed" ? "active" : ""}`}
              onClick={() => setColorMode("speed")}
              title="Color track by speed telemetry"
            >
              <span className="toggle-dot dot-speed"></span>
              Speed Heatmap
            </button>

            {lapComparison && (
              <button
                type="button"
                className={`trackmap-toggle-btn ${colorMode === "timeDelta" ? "active" : ""}`}
                onClick={() => setColorMode("timeDelta")}
                title="Color track by time delta vs pro benchmark"
              >
                <span className="toggle-dot dot-timedelta"></span>
                Delta (Δt)
              </button>
            )}

            <button
              type="button"
              className={`trackmap-toggle-btn ${colorMode === "pedals" ? "active" : ""}`}
              onClick={() => setColorMode("pedals")}
              title="Color track by throttle and braking zones"
            >
              <span className="toggle-dot dot-pedals"></span>
              Pedal Zones
            </button>

            <button
              type="button"
              className={`trackmap-toggle-btn ${colorMode === "latG" ? "active" : ""}`}
              onClick={() => setColorMode("latG")}
              title="Color track by lateral G-force"
            >
              <span className="toggle-dot dot-steer"></span>
              Lateral G
            </button>
          </div>

          <button
            type="button"
            className={`trackmap-corner-toggle ${showCorners ? "active" : ""}`}
            onClick={() => setShowCorners(!showCorners)}
            title="Toggle corner markers"
          >
            {showCorners ? "Hide Turn Badges" : "Show Turn Badges"}
          </button>
        </div>
      </div>

      {/* Main Canvas Track Area */}
      <div className="trackmap-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          onClick={handleCanvasClick}
          className="trackmap-canvas"
        />

        {/* Synchronized Real-Time Floating Car HUD */}
        {currentHoverPoint && (
          <div className="trackmap-hover-card">
            <div className="hover-card-header">
              <span className="hover-dot-pulse"></span>
              {nearestCorner && (
                <span className="corner-badge-tag">{nearestCorner.shortName}</span>
              )}
              <span className="hover-card-title">
                {nearestCorner ? nearestCorner.name : `Sector at ${currentHoverPoint.dist}m`}
              </span>
              <span className="hover-card-dist">@{currentHoverPoint.dist}m</span>
            </div>
            <div className="hover-card-metrics">
              <div className="hover-metric">
                <span className="m-label">Driver Speed:</span>
                <span className="m-val text-sky">{currentHoverPoint.speed} km/h</span>
              </div>

              {benchmarkMode === "pro" && currentHoverPoint.refSpeed != null && (
                <div className="hover-metric">
                  <span className="m-label">Benchmark:</span>
                  <span className="m-val text-amber">{currentHoverPoint.refSpeed} km/h</span>
                </div>
              )}

              {benchmarkMode === "pro" && currentHoverPoint.timeDelta != null && (
                <div className="hover-metric">
                  <span className="m-label">Delta (Δt):</span>
                  <span
                    className={`m-val ${
                      currentHoverPoint.timeDelta <= 0 ? "text-emerald" : "text-rose"
                    }`}
                  >
                    {currentHoverPoint.timeDelta > 0 ? "+" : ""}
                    {currentHoverPoint.timeDelta}s
                  </span>
                </div>
              )}

              <div className="hover-metric">
                <span className="m-label">Pedals:</span>
                <span className="m-val">
                  <span className="text-emerald">T: {currentHoverPoint.throttle}%</span> /{" "}
                  <span className="text-rose">B: {currentHoverPoint.brake}%</span>
                </span>
              </div>

              <div className="hover-metric">
                <span className="m-label">Lateral G:</span>
                <span className="m-val text-slate">{currentHoverPoint.latG} G</span>
              </div>
            </div>

            {nearestCorner?.verdict && Math.abs(currentHoverPoint.dist - nearestCorner.dist) < 220 && (
              <div className="hover-card-verdict-line">
                <span className="verdict-icon">⚡</span>
                <span className="verdict-text">{nearestCorner.verdict}</span>
              </div>
            )}
          </div>
        )}

        {/* Synchronized Corner Tooltip Card */}
        {activeCorner && (
          <div className="trackmap-corner-card">
            <div className="corner-card-top">
              <span className="corner-badge-tag">{activeCorner.shortName}</span>
              <span className="corner-name">{activeCorner.name}</span>
            </div>
            <div className="corner-card-details">
              <span>Dist: {activeCorner.dist}m</span>
              {activeCorner.driverSpeed != null && (
                <span className="text-sky">Driver Apex: {activeCorner.driverSpeed} km/h</span>
              )}
              {benchmarkMode === "pro" && activeCorner.refSpeed != null && (
                <span className="text-amber">Ref: {activeCorner.refSpeed} km/h</span>
              )}
              {benchmarkMode === "pro" && activeCorner.speedDelta != null && (
                <span className={activeCorner.speedDelta >= 0 ? "text-emerald" : "text-rose"}>
                  Δv: {activeCorner.speedDelta > 0 ? "+" : ""}{activeCorner.speedDelta} km/h
                </span>
              )}
              {benchmarkMode === "pro" && activeCorner.timeDelta != null && (
                <span
                  className={activeCorner.timeDelta <= 0 ? "text-emerald" : "text-rose"}
                >
                  Δt: {activeCorner.timeDelta > 0 ? "+" : ""}
                  {activeCorner.timeDelta}s
                </span>
              )}
            </div>

            {benchmarkMode === "pro" && (activeCorner.brakingPointDeltaMeters != null || activeCorner.throttleCommitDeltaMeters != null) && (
              <div className="corner-card-deltas-row">
                {activeCorner.brakingPointDeltaMeters != null && (
                  <span className={`corner-delta-item ${activeCorner.brakingPointDeltaMeters >= 0 ? "text-emerald" : "text-rose"}`}>
                    Braking: {activeCorner.brakingPointDeltaMeters > 0 ? `+${activeCorner.brakingPointDeltaMeters}m early` : activeCorner.brakingPointDeltaMeters < 0 ? `${Math.abs(activeCorner.brakingPointDeltaMeters)}m late` : "Matched"}
                  </span>
                )}
                {activeCorner.throttleCommitDeltaMeters != null && (
                  <span className={`corner-delta-item ${activeCorner.throttleCommitDeltaMeters >= 0 ? "text-emerald" : "text-rose"}`}>
                    Throttle: {activeCorner.throttleCommitDeltaMeters > 0 ? `${activeCorner.throttleCommitDeltaMeters}m earlier` : activeCorner.throttleCommitDeltaMeters < 0 ? `${Math.abs(activeCorner.throttleCommitDeltaMeters)}m delayed` : "Matched"}
                  </span>
                )}
              </div>
            )}

            {activeCorner.verdict && (
              <div className="corner-card-verdict">
                <span className="verdict-icon">⚡</span>
                <span className="verdict-text">{activeCorner.verdict}</span>
              </div>
            )}

            <button
              type="button"
              className="corner-jump-btn"
              onClick={() => handleCornerClick(activeCorner)}
            >
              Jump Telemetry to Apex →
            </button>
          </div>
        )}
      </div>

      {/* Legend & Quick Corner Navigation Bar */}
      <div className="trackmap-footer">
        {/* Dynamic Legend */}
        <div className="trackmap-legend">
          {colorMode === "speed" && (
            <div className="legend-speed-bar">
              <span className="legend-speed-label">60 km/h</span>
              <div className="speed-gradient-strip"></div>
              <span className="legend-speed-label">320+ km/h</span>
            </div>
          )}

          {colorMode === "timeDelta" && (
            <div className="legend-delta-row">
              <span className="legend-item">
                <span className="legend-dot dot-emerald"></span> Gaining Time (Ahead)
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-rose"></span> Losing Time (Behind)
              </span>
            </div>
          )}

          {colorMode === "pedals" && (
            <div className="legend-delta-row">
              <span className="legend-item">
                <span className="legend-dot dot-emerald"></span> Throttle Zone (&gt;40%)
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-rose"></span> Braking Zone (&gt;15%)
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-slate"></span> Coast / Transition
              </span>
            </div>
          )}

          {colorMode === "latG" && (
            <div className="legend-delta-row">
              <span className="legend-item">
                <span className="legend-dot dot-cyan"></span> Low Lat G (Straight)
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-purple"></span> High Lat G (Heavy Cornering)
              </span>
            </div>
          )}
        </div>

        {/* Clickable Quick Corner Pills */}
        <div className="trackmap-corners-strip">
          <span className="corners-strip-title">APEX JUMP:</span>
          {data.corners.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`corner-pill-btn ${
                activeCorner?.id === c.id ||
                activeCorner?.shortName === c.shortName ||
                (currentHoverPoint && Math.abs(currentHoverPoint.dist - c.dist) < 180)
                  ? "active"
                  : ""
              }`}
              onClick={() => handleCornerClick(c)}
              onMouseEnter={() => {
                setHoveredCorner(c);
                onSelectCorner?.(c);
              }}
              onMouseLeave={() => {
                setHoveredCorner(null);
                onSelectCorner?.(null);
              }}
              title={`${c.name} (@${c.dist}m)`}
            >
              {c.shortName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
