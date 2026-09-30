import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  resolveACSetupsRoot,
  matchACCarFolder,
  getWindowsDocsCandidates,
} from "@/lib/sim-path-resolver";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sim, car, track, filename, content, customCarFolder } = body;

    if (!filename || !content) {
      return NextResponse.json(
        { success: false, error: "Missing filename or content payload." },
        { status: 400 }
      );
    }

    if (sim === "assetto-corsa") {
      const rootInfo = resolveACSetupsRoot();
      if (!rootInfo.setupsRoot) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not locate Assetto Corsa setups folder on this PC.",
            searched: rootInfo.searchedCandidates,
          },
          { status: 404 }
        );
      }

      // Determine car folder: custom override or intelligent token match
      let targetCarFolder = (customCarFolder || "").trim();
      if (!targetCarFolder) {
        const match = matchACCarFolder(rootInfo.setupsRoot, car || "");
        targetCarFolder = match.folder || "generic";
      }

      const trackFolder = (track || "generic").trim();
      const targetDir = path.join(rootInfo.setupsRoot, targetCarFolder, trackFolder);
      const genericDir = path.join(rootInfo.setupsRoot, targetCarFolder, "generic");

      // 1. Write to track specific setup directory
      fs.mkdirSync(targetDir, { recursive: true });
      const targetFilePath = path.join(targetDir, filename);
      fs.writeFileSync(targetFilePath, content, "utf8");

      // 2. Write to generic setup directory so it is visible on all tracks in AC
      let genericFilePath: string | null = null;
      try {
        fs.mkdirSync(genericDir, { recursive: true });
        genericFilePath = path.join(genericDir, filename);
        fs.writeFileSync(genericFilePath, content, "utf8");
      } catch (_genErr) {}

      return NextResponse.json({
        success: true,
        message: `Successfully injected setup into Assetto Corsa!`,
        carFolder: targetCarFolder,
        trackFolder,
        setupsRoot: rootInfo.setupsRoot,
        savedPath: targetFilePath,
        genericPath: genericFilePath,
      });
    }

    // For other sims (ACC, iRacing, F1, etc.)
    const docs = getWindowsDocsCandidates();
    const primaryDocs = docs[0] || path.join(process.env.USERPROFILE || "C:\\", "Documents");
    let targetDir = "";

    if (sim === "acc") {
      targetDir = path.join(primaryDocs, "Assetto Corsa Competizione", "Setups", car || "generic", track || "spa");
    } else if (sim === "assetto-corsa-evo" || sim === "acevo") {
      targetDir = path.join(primaryDocs, "Assetto Corsa Evo", "setups", car || "generic", track || "spa");
    } else if (sim === "iracing") {
      targetDir = path.join(primaryDocs, "iRacing", "setups", car || "generic", track || "spa");
    } else if (sim === "f1") {
      targetDir = path.join(primaryDocs, "My Games", "F1 24", "setups", track || "spa");
    } else {
      targetDir = path.join(primaryDocs, "ApexWall_Setups", car || "generic", track || "spa");
    }

    fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, content, "utf8");

    return NextResponse.json({
      success: true,
      message: `Setup injected successfully!`,
      savedPath: filePath,
    });
  } catch (error: any) {
    console.error("[API INJECT ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to inject setup." },
      { status: 500 }
    );
  }
}
