import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimSetup AI — Professional Telemetry & Chassis Engineering",
  description: "MoTeC-grade telemetry analysis, driver coaching diagnostics, and adaptive chassis setup engineering.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased text-slate-200 bg-[#0B0E14]">
        {children}
      </body>
    </html>
  );
}
