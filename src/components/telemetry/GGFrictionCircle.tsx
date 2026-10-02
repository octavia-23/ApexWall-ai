"use client";

import React, { useRef, useEffect } from "react";
import { GGFrictionCircleData, GGPoint } from "@/types/telemetry";

interface GGFrictionCircleProps {
  data: GGFrictionCircleData;
  hoverIndex?: number;
  onHoverPoint?: (index: number) => void;
}

export const GGFrictionCircle: React.FC<GGFrictionCircleProps> = ({
  data,
  hoverIndex = -1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(320, containerRef.current.clientWidth || 300);
    const canvasW = size;
    const canvasH = size;

    if (canvas.width !== canvasW * dpr || canvas.height !== canvasH * dpr) {
      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, canvasH);

    const centerX = canvasW / 2;
    const centerY = canvasH / 2;
    const radius = size * 0.44;
    const maxG = data.scaleMaxG || 2.5;

    // Background quadrant tints
    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Coordinate conversion function
    // X = LatG (right is +, left is -)
    // Y = LongG (accel is +, braking is -)
    // In canvas Y is down, so positive LongG goes UP: centerY - (longG / maxG) * radius
    const getCanvasX = (latG: number) => centerX + (latG / maxG) * radius;
    const getCanvasY = (longG: number) => centerY - (longG / maxG) * radius;

    // Draw Polar Concentric G Rings
    const ringSteps = maxG > 3.0 ? [1.0, 2.0, 3.0, 4.0] : [0.5, 1.0, 1.5, 2.0, 2.5];
    ringSteps.forEach((g) => {
      const r = (g / maxG) * radius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle =
        g === ringSteps[ringSteps.length - 1]
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ring label
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${g}G`, centerX + r - 2, centerY - 4);
    });

    // Crosshair axes
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    // Horizontal axis (Lat G)
    ctx.moveTo(centerX - radius - 8, centerY);
    ctx.lineTo(centerX + radius + 8, centerY);
    // Vertical axis (Long G)
    ctx.moveTo(centerX, centerY - radius - 8);
    ctx.lineTo(centerX, centerY + radius + 8);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
    ctx.font = "8px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("ACCEL (+LONG)", centerX, centerY - radius - 12);
    ctx.fillText("BRAKE (-LONG)", centerX, centerY + radius + 18);
    ctx.textAlign = "right";
    ctx.fillText("LEFT (-LAT)", centerX - radius - 10, centerY + 3);
    ctx.textAlign = "left";
    ctx.fillText("RIGHT (+LAT)", centerX + radius + 10, centerY + 3);

    // 1. Pro Benchmark Envelope Hull (Dashed Gold Outline)
    if (data.refEnvelopeHull && data.refEnvelopeHull.length > 0) {
      ctx.beginPath();
      data.refEnvelopeHull.forEach((p, idx) => {
        const x = getCanvasX(p.latG);
        const y = getCanvasY(p.longG);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Driver Envelope Hull (Cyan Glow Outline & subtle fill)
    if (data.envelopeHull && data.envelopeHull.length > 0) {
      ctx.beginPath();
      data.envelopeHull.forEach((p, idx) => {
        const x = getCanvasX(p.latG);
        const y = getCanvasY(p.longG);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      ctx.fill();
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // 3. Driver Telemetry Scatter Points
    data.points.forEach((p, idx) => {
      const x = getCanvasX(p.latG);
      const y = getCanvasY(p.longG);

      // Color by driving state
      let color = "rgba(56, 189, 248, 0.4)";
      if (p.brake > 20) color = "rgba(244, 63, 94, 0.6)"; // Braking (Rose)
      else if (p.throttle > 50) color = "rgba(16, 185, 129, 0.55)"; // Accel (Emerald)
      else if (Math.abs(p.latG) > 1.0) color = "rgba(245, 158, 11, 0.55)"; // Hard cornering (Amber)

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // 4. Synchronized Hover Cursor (Live Target Reticle)
    if (hoverIndex >= 0 && hoverIndex < data.points.length) {
      const activePt = data.points[hoverIndex];
      const curX = getCanvasX(activePt.latG);
      const curY = getCanvasY(activePt.longG);

      // Outer pulsing ring
      ctx.beginPath();
      ctx.arc(curX, curY, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center solid core
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#38BDF8";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Crosshair tick marks
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.moveTo(curX - 12, curY);
      ctx.lineTo(curX + 12, curY);
      ctx.moveTo(curX, curY - 12);
      ctx.lineTo(curX, curY + 12);
      ctx.stroke();
    }

    ctx.restore();
  }, [data, hoverIndex]);

  const activePoint: GGPoint | null =
    hoverIndex >= 0 && data.points[hoverIndex] ? data.points[hoverIndex] : null;

  return (
    <div className="gg-friction-module glass-card-nested">
      <div className="module-header">
        <div className="module-title-group">
          <span className="module-title">G-G FRICTION CIRCLE & GRIP ENVELOPE</span>
          <span className="module-sub">
            2D POLAR TRACTION ELLIPSE · TRAIL-BRAKING & TRANSITION EXPLOITATION
          </span>
        </div>
        <div className="gg-header-badges">
          {data.refGripUtilizationPct != null && (
            <span className="benchmark-badge">
              PRO ENVELOPE: {data.refGripUtilizationPct}% GRIP
            </span>
          )}
          <span className="status-badge-utilization">
            UTILIZATION: {data.gripUtilizationPct}%
          </span>
        </div>
      </div>

      <div className="gg-layout-grid">
        {/* Polar Canvas View */}
        <div className="gg-canvas-container" ref={containerRef}>
          <canvas ref={canvasRef} />
          {activePoint && (
            <div className="gg-live-hud">
              <span className="hud-metric">
                Lat: <strong>{activePoint.latG > 0 ? `+${activePoint.latG}` : activePoint.latG}G</strong>
              </span>
              <span className="hud-metric">
                Long: <strong>{activePoint.longG > 0 ? `+${activePoint.longG}` : activePoint.longG}G</strong>
              </span>
              <span className="hud-metric">
                Total: <strong className="text-cyan">{activePoint.gTotal}G</strong>
              </span>
              <span className="hud-metric">
                Speed: <strong>{activePoint.speed} km/h</strong>
              </span>
            </div>
          )}
        </div>

        {/* Analytics & Metrics Side Panel */}
        <div className="gg-metrics-side">
          {/* Top 4 KPI Cards */}
          <div className="gg-kpi-grid">
            <div className="gg-kpi-card">
              <span className="gg-kpi-label">Grip Utilization Index</span>
              <div className="gg-kpi-val-row">
                <span className="gg-kpi-val">{data.gripUtilizationPct}%</span>
                {data.refGripUtilizationPct != null && (
                  <span
                    className={`gg-kpi-diff ${
                      data.gripUtilizationPct >= data.refGripUtilizationPct
                        ? "gain"
                        : "loss"
                    }`}
                  >
                    {data.gripUtilizationPct - data.refGripUtilizationPct > 0 ? "+" : ""}
                    {data.gripUtilizationPct - data.refGripUtilizationPct}% vs Pro
                  </span>
                )}
              </div>
              <span className="gg-kpi-sub">Time operating at limit</span>
            </div>

            <div className="gg-kpi-card">
              <span className="gg-kpi-label">Transition Efficiency</span>
              <div className="gg-kpi-val-row">
                <span className="gg-kpi-val">{data.trailBrakingTransitionEfficiency}/100</span>
                <span className="status-badge-efficiency">
                  {data.trailBrakingTransitionEfficiency >= 80 ? "SMOOTH" : "POCKETS"}
                </span>
              </div>
              <span className="gg-kpi-sub">Trail-braking circularity</span>
            </div>

            <div className="gg-kpi-card">
              <span className="gg-kpi-label">Peak Combined Load</span>
              <div className="gg-kpi-val-row">
                <span className="gg-kpi-val">{data.peakCombinedG} G</span>
              </div>
              <span className="gg-kpi-sub">Vector maximum</span>
            </div>

            <div className="gg-kpi-card">
              <span className="gg-kpi-label">Peak Braking Decel</span>
              <div className="gg-kpi-val-row">
                <span className="gg-kpi-val text-rose">{data.peakDecelG} G</span>
              </div>
              <span className="gg-kpi-sub">Straight-line threshold</span>
            </div>
          </div>

          {/* Quadrant Grip Balance */}
          <div className="gg-quadrants-card">
            <span className="gg-quadrants-title">Quadrant Grip Balance</span>
            <div className="gg-quadrants-grid">
              <div className="quadrant-bar-item">
                <div className="quadrant-bar-header">
                  <span>Trail-Braking (Left)</span>
                  <span className="quadrant-pct">{data.quadrantStats.trailBrakingLeftGripPct}%</span>
                </div>
                <div className="quadrant-bar-track">
                  <div
                    className="quadrant-bar-fill fill-rose"
                    style={{ width: `${data.quadrantStats.trailBrakingLeftGripPct}%` }}
                  />
                </div>
              </div>

              <div className="quadrant-bar-item">
                <div className="quadrant-bar-header">
                  <span>Trail-Braking (Right)</span>
                  <span className="quadrant-pct">{data.quadrantStats.trailBrakingRightGripPct}%</span>
                </div>
                <div className="quadrant-bar-track">
                  <div
                    className="quadrant-bar-fill fill-rose"
                    style={{ width: `${data.quadrantStats.trailBrakingRightGripPct}%` }}
                  />
                </div>
              </div>

              <div className="quadrant-bar-item">
                <div className="quadrant-bar-header">
                  <span>Exit Traction (Left)</span>
                  <span className="quadrant-pct">{data.quadrantStats.powerDownLeftGripPct}%</span>
                </div>
                <div className="quadrant-bar-track">
                  <div
                    className="quadrant-bar-fill fill-emerald"
                    style={{ width: `${data.quadrantStats.powerDownLeftGripPct}%` }}
                  />
                </div>
              </div>

              <div className="quadrant-bar-item">
                <div className="quadrant-bar-header">
                  <span>Exit Traction (Right)</span>
                  <span className="quadrant-pct">{data.quadrantStats.powerDownRightGripPct}%</span>
                </div>
                <div className="quadrant-bar-track">
                  <div
                    className="quadrant-bar-fill fill-emerald"
                    style={{ width: `${data.quadrantStats.powerDownRightGripPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Friction Diagnosis Verdict */}
          <div className="gg-verdict-box">
            <div className="gg-verdict-header">
              <span className="verdict-dot"></span>
              <span className="verdict-tag">CHIEF PERFORMANCE ENGINEER FRICTION DIAGNOSIS</span>
            </div>
            <p className="gg-verdict-text">{data.gripDeficitVerdict}</p>
          </div>
        </div>
      </div>

      <div className="chart-footer-legend">
        <span className="legend-item">
          <span className="legend-line line-speed"></span> Driver Envelope Boundary
        </span>
        {data.refEnvelopeHull && (
          <span className="legend-item">
            <span className="legend-line line-ref"></span> Pro Benchmark Boundary
          </span>
        )}
        <span className="legend-item">
          <span className="legend-dot dot-rose"></span> Braking Decel
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-emerald"></span> Exit Traction
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-amber"></span> Lateral Cornering
        </span>
      </div>
    </div>
  );
};
