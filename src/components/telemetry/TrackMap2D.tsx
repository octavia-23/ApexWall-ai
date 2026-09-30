"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  TrackMapData,
  TrackMapPoint,
  TrackCorner,
  LapComparisonSummary,
} from "@/types/telemetry";
import { REAL_CIRCUITS, getCircuitsByCategory } from "@/lib/circuit-geometries";

interface TrackMap2DProps {
  data: TrackMapData;
  hoverIndex?: number;
  onHoverPoint?: (index: number) => void;
  lapComparison?: LapComparisonSummary | null;
  benchmarkMode?: "pro" | "off";
  activeCornerId?: string | null;
  onSelectCorner?: (corner: TrackCorner | null) => void;
  onSelectCircuit?: (circuitKey: string) => void;
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
  onSelectCircuit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [colorMode, setColorMode] = useState<MapColorMode>("speed");
  const [showCorners, setShowCorners] = useState(true);
  const [showDrsSectors, setShowDrsSectors] = useState(true);
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

  // Speed color gradient helper: 60 km/h (blue) -> 140 km/h (cyan) -> 220 km/h (lime) -> 280 km/h (yellow) -> 330 km/h (red)
  const getSpeedColor = (speed: number): string => {
    const s = Math.max(60, Math.min(330, speed));
    if (s < 140) {
      const f = (s - 60) / 80;
      return `rgb(${Math.round(30 + 10 * f)}, ${Math.round(140 + 60 * f)}, ${Math.round(230 + 25 * f)})`;
    } else if (s < 220) {
      const f = (s - 140) / 80;
      return `rgb(${Math.round(40 + 180 * f)}, ${Math.round(200 + 40 * f)}, ${Math.round(255 - 150 * f)})`;
    } else if (s < 280) {
      const f = (s - 220) / 60;
      return `rgb(${Math.round(220 + 35 * f)}, ${Math.round(240 - 80 * f)}, ${Math.round(105 - 80 * f)})`;
    } else {
      const f = (s - 280) / 50;
      return `rgb(255, ${Math.round(160 - 110 * f)}, ${Math.round(25 + 30 * f)})`;
    }
  };

  // Pedal color: Crimson for heavy brake, emerald for throttle, slate for coasting
  const getPedalColor = (throttle: number, brake: number): string => {
    if (brake > 15) {
      const intensity = Math.min(1, brake / 100);
      return `rgb(244, ${Math.round(63 * (1 - intensity * 0.4))}, ${Math.round(94 * (1 - intensity * 0.4))})`;
    }
    if (throttle > 40) {
      const intensity = Math.min(1, (throttle - 40) / 60);
      return `rgb(${Math.round(16 + 20 * (1 - intensity))}, ${Math.round(185 + 30 * intensity)}, ${Math.round(129 + 10 * (1 - intensity))})`;
    }
    return "rgba(148, 163, 184, 0.65)";
  };

  // Time delta color: Green if gaining, Red if losing
  const getDeltaColor = (delta: number | undefined): string => {
    if (delta == null) return "#38BDF8";
    if (delta <= -0.05) return "#10B981";
    if (delta >= 0.05) return "#F43F5E";
    return "#F59E0B";
  };

  // Lat G color
  const getLatGColor = (latG: number): string => {
    const g = Math.min(3.0, Math.abs(latG));
    const f = Math.min(1, g / 2.5);
    return `rgb(${Math.round(56 + 180 * f)}, ${Math.round(189 - 120 * f)}, ${Math.round(248 + 7 * f)})`;
  };

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = Math.max(340, rect.width);
    const height = Math.min(540, Math.max(380, width * 0.58));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Padding & Isometric 1:1 Aspect Ratio Transform from data.bounds
    const bounds = data.bounds && typeof data.bounds.minX === "number" && isFinite(data.bounds.minX)
      ? data.bounds
      : (() => {
          const allPts = data.fullCircuitPoints && data.fullCircuitPoints.length > 0
            ? data.fullCircuitPoints
            : data.points;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const p of allPts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          return {
            minX: isFinite(minX) ? minX : 0,
            maxX: isFinite(maxX) ? maxX : 1000,
            minY: isFinite(minY) ? minY : 0,
            maxY: isFinite(maxY) ? maxY : 1000,
          };
        })();

    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);

    const pad = 42;
    const viewW = width - pad * 2;
    const viewH = height - pad * 2;

    const scale = Math.min(viewW / spanX, viewH / spanY);
    const drawW = spanX * scale;
    const drawH = spanY * scale;
    const offsetX = pad + (viewW - drawW) / 2;
    const offsetY = pad + (viewH - drawH) / 2;

    const toCanvasX = (rawX: number) => offsetX + (rawX - bounds.minX) * scale;
    const toCanvasY = (rawY: number) => offsetY + (rawY - bounds.minY) * scale;

    // 1. Subtle Engineering Blueprint Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    const gridStep = 45;
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

    // 2. Official FIA Compass Indicator (Top Right)
    const compassX = width - 42;
    const compassY = 38;
    ctx.save();
    ctx.beginPath();
    ctx.arc(compassX, compassY, 15, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fill();

    // North arrow
    ctx.beginPath();
    ctx.moveTo(compassX, compassY - 11);
    ctx.lineTo(compassX + 3.5, compassY + 5);
    ctx.lineTo(compassX, compassY + 2);
    ctx.lineTo(compassX - 3.5, compassY + 5);
    ctx.closePath();
    ctx.fillStyle = "#38BDF8";
    ctx.fill();

    ctx.font = "bold 8px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("N", compassX, compassY - 13);
    ctx.restore();

    // 3. Full Surveyed Circuit Background Ribbon (Official FIA Geometry)
    const circuitPoints =
      data.fullCircuitPoints && data.fullCircuitPoints.length > 0
        ? data.fullCircuitPoints
        : data.points;

    if (circuitPoints.length > 1) {
      // 3A. Asphalt Bed (Wide dark composite track base)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(19, 26, 38, 0.95)";
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      circuitPoints.forEach((pt, idx) => {
        const cx = toCanvasX(pt.x);
        const cy = toCanvasY(pt.y);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.stroke();

      // 3B. Track Boundary Edges (White outer and inner rails)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      circuitPoints.forEach((pt, idx) => {
        const cx = toCanvasX(pt.x);
        const cy = toCanvasY(pt.y);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // 3C. FIA Red & White Kerbs along Corner Apexes
      data.corners.forEach((c) => {
        const cx = toCanvasX(c.x);
        const cy = toCanvasY(c.y);
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.22)";
        ctx.lineWidth = 4;
        ctx.stroke();
      });

      // 3D. Official FIA DRS Zones
      if (showDrsSectors && data.drsZones && data.drsZones.length > 0) {
        data.drsZones.forEach((drs) => {
          const drsPts = circuitPoints.filter((p) => {
            if (drs.start < drs.end) {
              return p.dist >= drs.start && p.dist <= drs.end;
            } else {
              // Wrap around start/finish
              return p.dist >= drs.start || p.dist <= drs.end;
            }
          });

          if (drsPts.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
            ctx.lineWidth = 7;
            ctx.lineCap = "round";
            drsPts.forEach((pt, idx) => {
              const cx = toCanvasX(pt.x);
              const cy = toCanvasY(pt.y);
              if (idx === 0) ctx.moveTo(cx, cy);
              else ctx.lineTo(cx, cy);
            });
            ctx.stroke();

            // DRS midpoint pill
            const midPt = drsPts[Math.floor(drsPts.length / 2)];
            if (midPt) {
              const mx = toCanvasX(midPt.x);
              const my = toCanvasY(midPt.y);
              ctx.save();
              ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
              ctx.beginPath();
              ctx.roundRect(mx - 18, my - 7, 36, 14, 4);
              ctx.fill();
              ctx.fillStyle = "#022C22";
              ctx.font = "bold 8px 'JetBrains Mono', monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(drs.name, mx, my);
              ctx.restore();
            }
          }
        });
      }

      // 3E. Official FIA Sector Lines
      if (showDrsSectors && data.sectors && data.sectors.length > 0) {
        data.sectors.forEach((sec) => {
          // Find closest point to sector distance
          let closestPt = circuitPoints[0];
          let nextPt = circuitPoints[1] || circuitPoints[0];
          let minD = Infinity;

          for (let i = 0; i < circuitPoints.length; i++) {
            const diff = Math.abs(circuitPoints[i].dist - sec.dist);
            if (diff < minD) {
              minD = diff;
              closestPt = circuitPoints[i];
              nextPt = circuitPoints[(i + 1) % circuitPoints.length];
            }
          }

          const cx = toCanvasX(closestPt.x);
          const cy = toCanvasY(closestPt.y);
          const dx = toCanvasX(nextPt.x) - cx;
          const dy = toCanvasY(nextPt.y) - cy;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const sectorColor = sec.sector === 1 ? "#EAB308" : sec.sector === 2 ? "#06B6D4" : "#A855F7";

          ctx.beginPath();
          ctx.moveTo(cx - nx * 14, cy - ny * 14);
          ctx.lineTo(cx + nx * 14, cy + ny * 14);
          ctx.strokeStyle = sectorColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Sector pill badge
          ctx.save();
          ctx.fillStyle = sectorColor;
          ctx.beginPath();
          ctx.roundRect(cx + nx * 22 - 10, cy + ny * 22 - 6, 20, 12, 3);
          ctx.fill();
          ctx.fillStyle = "#0B0E14";
          ctx.font = "bold 8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`S${sec.sector}`, cx + nx * 22, cy + ny * 22);
          ctx.restore();
        });
      }
    }

    // 4. Telemetry Racing Line (Segment by Segment based on active colorMode)
    if (data.points.length > 1) {
      for (let i = 0; i < data.points.length - 1; i++) {
        const p1 = data.points[i];
        const p2 = data.points[i + 1];

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
        ctx.lineWidth = 4.8;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    // 5. Official Start / Finish Line
    if (circuitPoints.length > 0) {
      const sf = circuitPoints[0];
      const nextPt = circuitPoints[1] || circuitPoints[0];
      const cx = toCanvasX(sf.x);
      const cy = toCanvasY(sf.y);

      const dx = toCanvasX(nextPt.x) - cx;
      const dy = toCanvasY(nextPt.y) - cy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      ctx.beginPath();
      ctx.moveTo(cx - nx * 16, cy - ny * 16);
      ctx.lineTo(cx + nx * 16, cy + ny * 16);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Start/Finish Pill Badge
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(cx + nx * 24 - 12, cy + ny * 24 - 7, 24, 14, 3);
      ctx.fill();
      ctx.fillStyle = "#0B0E14";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S/F", cx + nx * 24, cy + ny * 24);
      ctx.restore();
    }

    // 6. Official Corner Badges
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
          ctx.arc(cx, cy, 20, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(56, 189, 248, 0.32)";
          ctx.fill();
        }

        // Corner Pill Badge
        ctx.beginPath();
        ctx.arc(cx, cy, isHovered ? 13 : 10, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? "#38BDF8" : "rgba(15, 23, 42, 0.92)";
        ctx.fill();
        ctx.strokeStyle = isHovered ? "#FFFFFF" : "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = isHovered ? 2.2 : 1.2;
        ctx.stroke();

        // Corner Number text
        ctx.fillStyle = isHovered ? "#0B0E14" : "rgba(255, 255, 255, 0.95)";
        ctx.font = `bold ${isHovered ? "10px" : "8.5px"} 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(corner.shortName, cx, cy + 0.5);
      });
    }

    // 7. Active Car Position Dot (Synchronized with hoverIndex)
    if (hoverIndex >= 0 && hoverIndex < data.points.length) {
      const curPt = data.points[hoverIndex];
      const carX = toCanvasX(curPt.x);
      const carY = toCanvasY(curPt.y);

      // Outer pulse glow
      ctx.beginPath();
      ctx.arc(carX, carY, 15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
      ctx.fill();

      // Mid ring
      ctx.beginPath();
      ctx.arc(carX, carY, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
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
  }, [data, colorMode, showCorners, showDrsSectors, hoverIndex, activeCorner]);

  // Handle user scrubbing on the track map canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current || !data.points.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = Math.max(340, rect.width);
    const height = Math.min(540, Math.max(380, width * 0.58));

    const bounds = data.bounds && typeof data.bounds.minX === "number" && isFinite(data.bounds.minX)
      ? data.bounds
      : { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);

    const pad = 42;
    const viewW = width - pad * 2;
    const viewH = height - pad * 2;

    const scale = Math.min(viewW / spanX, viewH / spanY);
    const drawW = spanX * scale;
    const drawH = spanY * scale;
    const offsetX = pad + (viewW - drawW) / 2;
    const offsetY = pad + (viewH - drawH) / 2;

    const toCanvasX = (rawX: number) => offsetX + (rawX - bounds.minX) * scale;
    const toCanvasY = (rawY: number) => offsetY + (rawY - bounds.minY) * scale;

    // 1. Check if hovering near a corner badge (screen distance in pixels)
    let foundCorner: TrackCorner | null = null;
    for (const c of data.corners) {
      const cx = toCanvasX(c.x);
      const cy = toCanvasY(c.y);
      const distPx = Math.hypot(cx - mouseX, cy - mouseY);
      if (distPx < 22) {
        foundCorner = c;
        break;
      }
    }
    setHoveredCorner(foundCorner);
    if (foundCorner) {
      onSelectCorner?.(foundCorner);
    }

    // 2. Find nearest track point to scrub (screen distance in pixels)
    let closestIdx = -1;
    let minDistPx = Infinity;

    for (let i = 0; i < data.points.length; i++) {
      const p = data.points[i];
      const px = toCanvasX(p.x);
      const py = toCanvasY(p.y);
      const distPx = Math.hypot(px - mouseX, py - mouseY);
      if (distPx < minDistPx) {
        minDistPx = distPx;
        closestIdx = i;
      }
    }

    if (minDistPx < 55 && closestIdx !== -1) {
      onHoverPoint?.(closestIdx);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCorner(null);
    onHoverPoint?.(-1);
    onSelectCorner?.(null);
  };

  const handleCornerClick = (corner: TrackCorner) => {
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

  const circuitGroups = useMemo(() => getCircuitsByCategory(), []);

  return (
    <div className="trackmap-module glass-card-nested">
      {/* Header with Title, FIA Grade Badge & Channel Selectors */}
      <div className="trackmap-header">
        <div className="trackmap-title-group">
          <div className="trackmap-badge-row">
            <span className="trackmap-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {data.fiaGrade || "FIA GRADE 1 CERTIFIED"}
            </span>
            <span className="trackmap-dist-pill">
              {data.country ? `${data.country.toUpperCase()} • ` : ""}
              {data.totalDistance.toLocaleString()}m
            </span>
            {data.drsZones && data.drsZones.length > 0 && (
              <span className="trackmap-drs-pill" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38BDF8", fontSize: "10px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700 }}>
                {data.drsZones.length} DRS ZONES
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h4 className="trackmap-circuit-name" style={{ margin: 0 }}>{data.circuitName}</h4>
            {/* Quick Circuit Switcher */}
            {onSelectCircuit && (
              <select
                className="fia-circuit-select"
                value={data.circuitKey || ""}
                onChange={(e) => onSelectCircuit(e.target.value)}
                style={{
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "#E2E8F0",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "6px",
                  fontSize: "11px",
                  padding: "4px 10px",
                  fontFamily: "var(--font-jetbrains)",
                  cursor: "pointer",
                  maxWidth: "280px",
                }}
              >
                <option value="">Auto-Detect ({data.circuitName})</option>
                {circuitGroups.map((group) => (
                  <optgroup key={group.id} label={`${group.badge} — ${group.label}`}>
                    {group.circuits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.officialDistance.toLocaleString()}m)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
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

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className={`trackmap-corner-toggle ${showDrsSectors ? "active" : ""}`}
              onClick={() => setShowDrsSectors(!showDrsSectors)}
              title="Toggle DRS Zones & Timing Sectors"
            >
              {showDrsSectors ? "DRS / Sectors ON" : "DRS / Sectors OFF"}
            </button>

            <button
              type="button"
              className={`trackmap-corner-toggle ${showCorners ? "active" : ""}`}
              onClick={() => setShowCorners(!showCorners)}
              title="Toggle corner markers"
            >
              {showCorners ? "Turn Badges" : "Hide Turns"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Track Area */}
      <div className="trackmap-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
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
                {nearestCorner ? nearestCorner.name : `Track at ${Math.round(currentHoverPoint.dist)}m`}
              </span>
              <span className="hover-card-dist">@{Math.round(currentHoverPoint.dist)}m</span>
            </div>
            <div className="hover-card-metrics">
              <div className="hover-metric">
                <span className="m-label">Driver Speed:</span>
                <span className="m-val text-sky">{Math.round(currentHoverPoint.speed)} km/h</span>
              </div>

              {benchmarkMode === "pro" && currentHoverPoint.refSpeed != null && (
                <div className="hover-metric">
                  <span className="m-label">Benchmark:</span>
                  <span className="m-val text-amber">{Math.round(currentHoverPoint.refSpeed)} km/h</span>
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
                    {currentHoverPoint.timeDelta.toFixed(3)}s
                  </span>
                </div>
              )}

              <div className="hover-metric">
                <span className="m-label">Pedals:</span>
                <span className="m-val">
                  <span className="text-emerald">T: {Math.round(currentHoverPoint.throttle)}%</span> /{" "}
                  <span className="text-rose">B: {Math.round(currentHoverPoint.brake)}%</span>
                </span>
              </div>

              <div className="hover-metric">
                <span className="m-label">Lateral G:</span>
                <span className="m-val text-slate">{currentHoverPoint.latG?.toFixed(2)} G</span>
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
              <span>Apex: {Math.round(activeCorner.dist)}m</span>
              {activeCorner.driverSpeed != null && (
                <span className="text-sky">Driver Apex: {Math.round(activeCorner.driverSpeed)} km/h</span>
              )}
              {benchmarkMode === "pro" && activeCorner.refSpeed != null && (
                <span className="text-amber">Ref: {Math.round(activeCorner.refSpeed)} km/h</span>
              )}
              {benchmarkMode === "pro" && activeCorner.speedDelta != null && (
                <span className={activeCorner.speedDelta >= 0 ? "text-emerald" : "text-rose"}>
                  Δv: {activeCorner.speedDelta > 0 ? "+" : ""}{activeCorner.speedDelta.toFixed(1)} km/h
                </span>
              )}
              {benchmarkMode === "pro" && activeCorner.timeDelta != null && (
                <span
                  className={activeCorner.timeDelta <= 0 ? "text-emerald" : "text-rose"}
                >
                  Δt: {activeCorner.timeDelta > 0 ? "+" : ""}
                  {activeCorner.timeDelta.toFixed(3)}s
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
              <span className="legend-speed-label">330+ km/h</span>
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
                <span className="legend-dot dot-emerald"></span> Full Throttle (&gt;40%)
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-rose"></span> Heavy Braking (&gt;15%)
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
              title={`${c.name} (@${Math.round(c.dist)}m)`}
            >
              {c.shortName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
