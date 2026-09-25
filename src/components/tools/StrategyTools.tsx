"use client";

import React, { useState } from "react";
import { TyrePressureCalculator } from "./TyrePressureCalculator";
import { FuelStrategyCalculator } from "./FuelStrategyCalculator";

interface StrategyToolsProps {
  onApplyPressuresToSetup?: (pressures: { FL: number; FR: number; RL: number; RR: number }) => void;
  onApplyFuelToSetup?: (liters: number) => void;
}

export const StrategyTools: React.FC<StrategyToolsProps> = ({
  onApplyPressuresToSetup,
  onApplyFuelToSetup,
}) => {
  const [activeTab, setActiveTab] = useState<"tyres" | "fuel" | "all">("all");

  return (
    <div className="strategy-tools-workspace max-w-[1440px] mx-auto px-6 py-4">
      {/* Workspace Header Sub-Bar */}
      <div className="tools-subnav-bar">
        <div className="tools-subnav-info">
          <span className="subnav-pill">STRATEGY MODULES</span>
          <span className="subnav-text">Thermodynamics & Stint Pit Planning</span>
        </div>

        <div className="segmented">
          <button
            type="button"
            className={`seg-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Strategy Tools
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === "tyres" ? "active" : ""}`}
            onClick={() => setActiveTab("tyres")}
          >
            Tyre Pressures
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === "fuel" ? "active" : ""}`}
            onClick={() => setActiveTab("fuel")}
          >
            Race Fuel & Pit
          </button>
        </div>
      </div>

      <div className="tools-grid-layout">
        {(activeTab === "all" || activeTab === "tyres") && (
          <div className="tool-column">
            <TyrePressureCalculator onApplyPressures={onApplyPressuresToSetup} />
          </div>
        )}

        {(activeTab === "all" || activeTab === "fuel") && (
          <div className="tool-column">
            <FuelStrategyCalculator onApplyFuelLoad={onApplyFuelToSetup} />
          </div>
        )}
      </div>
    </div>
  );
};
