import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-branding">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"></span>
          <span>ApexWall AI Engineering Platform</span>
        </div>
        <div className="footer-text">
          Calibrated baselines for competitive simulation. Validate tyre pressures and balance during live stints.
        </div>
        <div className="footer-meta">
          <span>Protocol v2.5</span>
          <span className="text-slate-600">/</span>
          <span>MoTeC Compliant</span>
        </div>
      </div>
    </footer>
  );
};
