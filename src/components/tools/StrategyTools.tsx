"use client";

import React, { useState } from "react";
import { TyrePressureCalculator } from "./TyrePressureCalculator";
import { FuelStrategyCalculator } from "./FuelStrategyCalculator";
import { SetupMorphTool } from "./SetupMorphTool";
import { SuspensionKinematicsVisualizer } from "../telemetry/SuspensionKinematicsVisualizer";
import { LapTimeSimulatorViewer } from "../telemetry/LapTimeSimulatorViewer";

interface StrategyToolsProps {
  onApplyPressuresToSetup?: (pressures: { FL: number; FR: number; RL: number; RR: number }) => void;
  onApplyFuelToSetup?: (liters: number) => void;
  activeCar?: string;
  activeTrack?: string;
}

export const StrategyTools: React.FC<StrategyToolsProps> = ({
  onApplyPressuresToSetup,
  onApplyFuelToSetup,
  activeCar,
  activeTrack,
}) => {
  const [activeTab, setActiveTab] = useState<"morph" | "tyres" | "fuel" | "kinematics" | "simulation" | "all">("all");

  return (
    <div className="strategy-tools-workspace max-w-[1440px] mx-auto px-6 py-4 space-y-6">
      {/* Workspace Header Sub-Bar */}
      <div className="tools-subnav-bar">
        <div className="tools-subnav-info">
          <span className="subnav-pill">Engineering & Dynamics Tools</span>
          <span className="subnav-text">Kinematics, Lap Simulation, Fuel & Pressures</span>
        </div>

        <div className="segmented">
          <button
            type="button"
            className={`seg-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Tools
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === "kinematics" ? "active" : ""}`}
            onClick={() => setActiveTab("kinematics")}
          >
            Roll Center 2D
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === "simulation" ? "active" : ""}`}
            onClick={() => setActiveTab("simulation")}
          >
            Lap Simulator
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === "morph" ? "active" : ""}`}
            onClick={() => setActiveTab("morph")}
          >
            Setup Morph
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

      {/* Suspension Kinematics Visualizer */}
      {(activeTab === "all" || activeTab === "kinematics") && (
        <div className="w-full">
          <SuspensionKinematicsVisualizer />
        </div>
      )}

      {/* Closed-Loop Lap Time Simulator */}
      {(activeTab === "all" || activeTab === "simulation") && (
        <div className="w-full">
          <LapTimeSimulatorViewer initialTrack={activeTrack || "Autodromo Nazionale Monza"} />
        </div>
      )}

      {/* Setup Morph Studio */}
      {(activeTab === "all" || activeTab === "morph") && (
        <div className="w-full">
          <SetupMorphTool activeCar={activeCar} activeTrack={activeTrack} />
        </div>
      )}

      {/* Secondary Tools Grid */}
      {(activeTab === "all" || activeTab === "tyres" || activeTab === "fuel") && (
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
      )}
    </div>
  );
};
