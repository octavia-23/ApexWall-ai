"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  TrackMapData,
  TrackMapPoint,
  TrackCorner,
  LapComparisonSummary,
} from "@/types/telemetry";
import { REAL_CIRCUITS, getCircuitsByCategory } from "@/lib/circuit-geometries";
import {
  calculateVehicleHeading,
  formatLapTimestamp,
  findSampleIndexAtTime,
  calculateGhostPosition,
} from "@/lib/ghost-replay-engine";

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

  // Synchronized Telemetry Replay & Virtual Ghost State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [showGhost, setShowGhost] = useState(true);
  const [replayTimeSec, setReplayTimeSec] = useState<number>(0);

  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const totalLapTimeSec = useMemo(() => {
    if (!data?.points || data.points.length === 0) return 90;
    const lastPt = data.points[data.points.length - 1];
    if (lastPt.time != null && lastPt.time > 0) return lastPt.time;
    return data.totalDistance / 55;
  }, [data]);

  // Synchronize playback loop via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || !data?.points?.length) {
      lastTimestampRef.current = null;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const step = (now: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = now;
      }
      const dt = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      setReplayTimeSec((prev) => {
        let next = prev + dt * playbackSpeed;
        if (next >= totalLapTimeSec) {
          if (isLooping) {
            next = 0;
          } else {
            setIsPlaying(false);
            next = totalLapTimeSec;
          }
        }

        const targetIdx = findSampleIndexAtTime(data.points, next);
        onHoverPoint?.(targetIdx);

        return next;
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, isLooping, totalLapTimeSec, data.points, onHoverPoint]);

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (hoverIndex >= data.points.length - 2 || replayTimeSec >= totalLapTimeSec - 0.5) {
        setReplayTimeSec(0);
        onHoverPoint?.(0);
      } else if (hoverIndex >= 0 && data.points[hoverIndex]?.time != null) {
        setReplayTimeSec(data.points[hoverIndex].time!);
      }
      setIsPlaying(true);
    }
  };

  const handleResetReplay = () => {
    setIsPlaying(false);
    setReplayTimeSec(0);
    onHoverPoint?.(0);
  };

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
  const getSpeedColor = (speed: number | null | undefined): string => {
    if (speed == null) return "rgba(100, 116, 139, 0.4)";
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
  const getPedalColor = (throttle: number | null | undefined, brake: number | null | undefined): string => {
    if (throttle == null && brake == null) return "rgba(100, 116, 139, 0.4)";
    if (brake != null && brake > 15) {
      const intensity = Math.min(1, brake / 100);
      return `rgb(244, ${Math.round(63 * (1 - intensity * 0.4))}, ${Math.round(94 * (1 - intensity * 0.4))})`;
    }
    if (throttle != null && throttle > 40) {
      const intensity = Math.min(1, (throttle - 40) / 60);
      return `rgb(${Math.round(16 + 20 * (1 - intensity))}, ${Math.round(185 + 30 * intensity)}, ${Math.round(129 + 10 * (1 - intensity))})`;
    }
    return "rgba(148, 163, 184, 0.65)";
  };

  // Time delta color: Green if gaining, Red if losing
  const getDeltaColor = (delta: number | null | undefined): string => {
    if (delta == null) return "#38BDF8";
    if (delta <= -0.05) return "#10B981";
    if (delta >= 0.05) return "#F43F5E";
    return "#F59E0B";
  };

  // Lat G color
  const getLatGColor = (latG: number | null | undefined): string => {
    if (latG == null) return "rgba(100, 116, 139, 0.4)";
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

    // 7. Active Driver Car, Virtual Ghost & Dynamic Tether
    if (hoverIndex >= 0 && hoverIndex < data.points.length) {
      const curPt = data.points[hoverIndex];
      const carX = toCanvasX(curPt.x);
      const carY = toCanvasY(curPt.y);
      const driverHeading = calculateVehicleHeading(data.points, hoverIndex);

      // 7A. Virtual Ghost Car & Elastic Telemetry Tether
      if (showGhost) {
        const ghostState = calculateGhostPosition(data.points, hoverIndex);
        if (ghostState) {
          const gx = toCanvasX(ghostState.x);
          const gy = toCanvasY(ghostState.y);
          const distBetweenPx = Math.hypot(gx - carX, gy - carY);

          // Draw dynamic tether line if cars have separated
          if (distBetweenPx > 10) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(carX, carY);
            ctx.lineTo(gx, gy);
            ctx.strokeStyle = ghostState.distDelta > 0 ? "rgba(244, 63, 94, 0.65)" : "rgba(56, 189, 248, 0.65)";
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Tether midpoint delta badge
            const midX = (carX + gx) / 2;
            const midY = (carY + gy) / 2;
            const gapText = ghostState.distDelta > 0
              ? `Ghost +${Math.abs(ghostState.distDelta)}m (+${Math.abs(ghostState.timeDelta)}s)`
              : `Driver +${Math.abs(ghostState.distDelta)}m (-${Math.abs(ghostState.timeDelta)}s)`;

            ctx.font = "bold 8.5px sans-serif";
            const gtw = ctx.measureText(gapText).width + 10;
            ctx.fillStyle = "rgba(10, 10, 15, 0.92)";
            ctx.strokeStyle = ghostState.distDelta > 0 ? "rgba(244, 63, 94, 0.6)" : "rgba(56, 189, 248, 0.6)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midX - gtw / 2, midY - 7, gtw, 14, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = ghostState.distDelta > 0 ? "#fca5a5" : "#7dd3fc";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(gapText, midX, midY + 0.5);
            ctx.restore();
          }

          // Render Virtual Ghost Vehicle Silhouette
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(ghostState.heading);

          // Slipstream wake trails
          ctx.strokeStyle = "rgba(212, 163, 115, 0.3)";
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(-10, -4);
          ctx.lineTo(-24, -6);
          ctx.moveTo(-10, 4);
          ctx.lineTo(-24, 6);
          ctx.stroke();
          ctx.setLineDash([]);

          // Ghost body
          ctx.fillStyle = "rgba(212, 163, 115, 0.35)";
          ctx.strokeStyle = "#d4a373";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(8, -4);
          ctx.lineTo(-6, -5);
          ctx.lineTo(-11, -7);
          ctx.lineTo(-13, -7);
          ctx.lineTo(-13, 7);
          ctx.lineTo(-11, 7);
          ctx.lineTo(-6, 5);
          ctx.lineTo(8, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Ghost Front wing
          ctx.beginPath();
          ctx.moveTo(10, -7);
          ctx.lineTo(10, 7);
          ctx.strokeStyle = "#d4a373";
          ctx.lineWidth = 2.2;
          ctx.stroke();

          // Core
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.restore();

          // Floating Ghost Speed Tag
          ctx.save();
          ctx.translate(gx, gy - 20);
          const gText = `Ghost: ${Math.round(ghostState.speed)} km/h`;
          ctx.font = "bold 9px sans-serif";
          const gtw = ctx.measureText(gText).width + 10;
          ctx.fillStyle = "rgba(24, 24, 27, 0.88)";
          ctx.strokeStyle = "rgba(212, 163, 115, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-gtw / 2, -7.5, gtw, 15, 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#d4a373";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(gText, 0, 0.5);
          ctx.restore();
        }
      }

      // 7B. Render Driver Car
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(driverHeading);

      // Forward directional apex illumination beam
      const beamGrad = ctx.createLinearGradient(0, 0, 34, 0);
      beamGrad.addColorStop(0, "rgba(56, 189, 248, 0.45)");
      beamGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(36, -11);
      ctx.lineTo(36, 11);
      ctx.closePath();
      ctx.fill();

      // Chassis body
      ctx.fillStyle = "#0F172A";
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(8, -4);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-11, -7);
      ctx.lineTo(-13, -7);
      ctx.lineTo(-13, 7);
      ctx.lineTo(-11, 7);
      ctx.lineTo(-6, 5);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front wing
      ctx.beginPath();
      ctx.moveTo(10, -8);
      ctx.lineTo(10, 8);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Wheels
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(5, -9, 5, 2.5);
      ctx.fillRect(5, 6.5, 5, 2.5);
      ctx.fillRect(-9, -9.5, 6, 2.5);
      ctx.fillRect(-9, 7, 6, 2.5);

      // Cockpit Halo Core
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#38BDF8";
      ctx.fill();
      ctx.restore();

      // Floating Driver Telemetry Tag
      ctx.save();
      ctx.translate(carX, carY - 20);
      const dText = `Driver: ${Math.round(curPt.speed || 0)} km/h${curPt.gear ? ` • G${curPt.gear}` : ""}`;
      ctx.font = "bold 9px sans-serif";
      const dtw = ctx.measureText(dText).width + 10;
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-dtw / 2, -7.5, dtw, 15, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#38BDF8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dText, 0, 0.5);
      ctx.restore();
    }

    ctx.restore();
  }, [data, colorMode, showCorners, showDrsSectors, hoverIndex, activeCorner, showGhost]);

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
              {data.country ? `${data.country.toUpperCase()} | ` : ""}
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
                  fontFamily: "var(--font-mono)",
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
                <span className="m-val text-sky">
                  {currentHoverPoint.speed != null ? `${Math.round(currentHoverPoint.speed)} km/h` : "—"}
                </span>
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
                  <span className="text-emerald">
                    T: {currentHoverPoint.throttle != null ? `${Math.round(currentHoverPoint.throttle)}%` : "—"}
                  </span>{" "}
                  /{" "}
                  <span className="text-rose">
                    B: {currentHoverPoint.brake != null ? `${Math.round(currentHoverPoint.brake)}%` : "—"}
                  </span>
                </span>
              </div>

              <div className="hover-metric">
                <span className="m-label">Lateral G:</span>
                <span className="m-val text-slate">
                  {currentHoverPoint.latG != null ? `${currentHoverPoint.latG.toFixed(2)} G` : "—"}
                </span>
              </div>
            </div>

            {nearestCorner?.verdict && Math.abs(currentHoverPoint.dist - nearestCorner.dist) < 220 && (
              <div className="hover-card-verdict-line">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="verdict-icon text-amber-400 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
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
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="verdict-icon text-amber-400 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
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

      {/* Synced Telemetry Replay & Virtual Ghost Deck */}
      <div className="trackmap-replay-deck">
        <div className="replay-deck-left">
          <button
            type="button"
            className={`replay-btn replay-play-btn ${isPlaying ? "active" : ""}`}
            onClick={togglePlayback}
            title={isPlaying ? "Pause Telemetry Replay" : "Play Synced Telemetry Replay"}
          >
            {isPlaying ? (
              <>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>PLAY REPLAY</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="replay-btn replay-reset-btn"
            onClick={handleResetReplay}
            title="Rewind to Start / Finish"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          {/* Speed Multipliers */}
          <div className="replay-speed-group">
            {[0.5, 1.0, 2.0, 4.0].map((spd) => (
              <button
                key={spd}
                type="button"
                className={`replay-speed-btn ${playbackSpeed === spd ? "active" : ""}`}
                onClick={() => setPlaybackSpeed(spd)}
              >
                {spd === 1.0 ? "1x Real-Time" : `${spd}x`}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live Scrubber & Time Display */}
        <div className="replay-deck-center">
          <div className="replay-time-display font-sans">
            <span className="replay-time-cur text-sky-400 font-medium">
              {formatLapTimestamp(
                currentHoverPoint?.time != null
                  ? currentHoverPoint.time
                  : hoverIndex >= 0 && data.points.length > 0
                  ? (hoverIndex / (data.points.length - 1)) * totalLapTimeSec
                  : replayTimeSec
              )}
            </span>
            <span className="text-zinc-500">/</span>
            <span className="replay-time-total text-zinc-400">
              {formatLapTimestamp(totalLapTimeSec)}
            </span>
            <span className="replay-dist-tag text-zinc-400 text-[11px] ml-1">
              ({Math.round(currentHoverPoint?.dist ?? 0)}m / {Math.round(data.totalDistance)}m)
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(1, data.points.length - 1)}
            value={hoverIndex >= 0 ? hoverIndex : 0}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              onHoverPoint?.(idx);
              if (data.points[idx]?.time != null) {
                setReplayTimeSec(data.points[idx].time!);
              }
            }}
            className="replay-progress-slider"
          />
        </div>

        {/* Right: Ghost & Loop Toggles */}
        <div className="replay-deck-right">
          <button
            type="button"
            className={`replay-pill-toggle ${showGhost ? "active-ghost" : ""}`}
            onClick={() => setShowGhost(!showGhost)}
            title="Toggle Virtual Ghost Car on track"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>{showGhost ? "Ghost Car ON" : "Ghost Car OFF"}</span>
          </button>

          <button
            type="button"
            className={`replay-pill-toggle ${isLooping ? "active-loop" : ""}`}
            onClick={() => setIsLooping(!isLooping)}
            title="Toggle automatic lap replay looping"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>{isLooping ? "Loop Lap" : "Once"}</span>
          </button>
        </div>
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
