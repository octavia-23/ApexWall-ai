import { NextRequest, NextResponse } from "next/server";
import {
  resolveACSetupsRoot,
  matchACCarFolder,
  getInstalledACCarFolders,
} from "@/lib/sim-path-resolver";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sim = searchParams.get("sim") || "assetto-corsa";
    const carQuery = searchParams.get("car") || "";

    if (sim === "assetto-corsa") {
      const rootInfo = resolveACSetupsRoot();
      if (!rootInfo.setupsRoot) {
        return NextResponse.json({
          success: false,
          error: "Could not locate Assetto Corsa setups folder on this PC.",
          searched: rootInfo.searchedCandidates,
        });
      }

      const match = carQuery
        ? matchACCarFolder(rootInfo.setupsRoot, carQuery)
        : null;

      const cars = getInstalledACCarFolders(rootInfo.setupsRoot);

      return NextResponse.json({
        success: true,
        sim: "assetto-corsa",
        documentsPath: rootInfo.documentsPath,
        setupsRoot: rootInfo.setupsRoot,
        carCount: cars.length,
        matchedCar: match?.folder || null,
        matchMethod: match?.method || null,
        cars,
      });
    }

    return NextResponse.json({
      success: true,
      sim,
      message: "Direct car scanning currently specialized for Assetto Corsa.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to scan sim cars" },
      { status: 500 }
    );
  }
}
