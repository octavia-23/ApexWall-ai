import { SavedSetupRecord, getSavedSetups, saveSetupToVault, deleteSetupFromVault } from "./setup-vault";
import { createClient } from "./supabase/client";

/**
 * Fetch all setups:
 * If authenticated with Supabase, fetches cloud setups and merges with local storage.
 * If unauthenticated or offline, falls back to local storage.
 */
export async function getUnifiedSetups(): Promise<SavedSetupRecord[]> {
  const localSetups = getSavedSetups();
  if (typeof window === "undefined") return localSetups;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return localSetups;
    }

    // User is logged in, fetch user's cloud setups
    const { data, error } = await supabase
      .from("pitwall_setups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return localSetups;
    }

    const cloudSetups: SavedSetupRecord[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      game: row.game,
      car: row.car,
      track: row.track,
      sessionType: row.session_type,
      weather: row.weather,
      trackTemp: row.track_temp,
      airTemp: row.air_temp,
      tyreCompound: row.tyre_compound,
      fuelLoad: row.fuel_load,
      lapTime: row.lap_time,
      driverStyle: row.driver_style,
      summary: row.summary,
      engineerNotes: row.engineer_notes,
      sections: row.sections || [],
      userId: row.user_id,
      isPublic: row.is_public ?? true,
      shareSlug: row.share_slug,
    }));

    // Merge: cloud setups take priority for matching IDs, then unique local ones
    const cloudIds = new Set(cloudSetups.map((s) => s.id));
    const uniqueLocal = localSetups.filter((s) => !cloudIds.has(s.id));
    return [...cloudSetups, ...uniqueLocal];
  } catch (err) {
    console.error("Cloud vault sync error:", err);
    return localSetups;
  }
}

/**
 * Save setup to both local storage and Supabase cloud (if authenticated)
 */
export async function saveUnifiedSetup(
  record: Omit<SavedSetupRecord, "id" | "createdAt"> & { id?: string }
): Promise<SavedSetupRecord> {
  // 1. Always save to local storage first for instant zero-latency UX
  const localSaved = saveSetupToVault(record);

  // 2. If authenticated, persist to Supabase
  if (typeof window !== "undefined") {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session && session.user) {
        const payload = {
          id: localSaved.id,
          user_id: session.user.id,
          name: localSaved.name,
          game: localSaved.game,
          car: localSaved.car,
          track: localSaved.track,
          session_type: localSaved.sessionType || null,
          weather: localSaved.weather || null,
          track_temp: localSaved.trackTemp || null,
          air_temp: localSaved.airTemp || null,
          tyre_compound: localSaved.tyreCompound || null,
          fuel_load: localSaved.fuelLoad || null,
          lap_time: localSaved.lapTime || null,
          driver_style: localSaved.driverStyle || null,
          summary: localSaved.summary || null,
          engineer_notes: localSaved.engineerNotes || null,
          sections: localSaved.sections || [],
          is_public: localSaved.isPublic ?? true,
          share_slug: localSaved.shareSlug || localSaved.id,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("pitwall_setups")
          .upsert(payload, { onConflict: "id" });

        if (error) {
          console.warn("Could not sync setup to Supabase table (table may not exist yet):", error.message);
        } else {
          localSaved.userId = session.user.id;
          localSaved.isPublic = true;
        }
      }
    } catch (err) {
      console.warn("Supabase cloud sync skipped:", err);
    }
  }

  return localSaved;
}

/**
 * Delete a setup from both local storage and Supabase
 */
export async function deleteUnifiedSetup(id: string): Promise<void> {
  deleteSetupFromVault(id);

  if (typeof window !== "undefined") {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        await supabase.from("pitwall_setups").delete().eq("id", id);
      }
    } catch (err) {
      console.warn("Failed to delete setup from cloud:", err);
    }
  }
}

/**
 * Fetch a single setup by ID from Supabase public records or local storage
 */
export async function getSetupById(id: string): Promise<SavedSetupRecord | null> {
  // Check local first
  const locals = getSavedSetups();
  const match = locals.find((s) => s.id === id);
  if (match) return match;

  // Try Supabase public query
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pitwall_setups")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        createdAt: data.created_at,
        game: data.game,
        car: data.car,
        track: data.track,
        sessionType: data.session_type,
        weather: data.weather,
        trackTemp: data.track_temp,
        airTemp: data.air_temp,
        tyreCompound: data.tyre_compound,
        fuelLoad: data.fuel_load,
        lapTime: data.lap_time,
        driverStyle: data.driver_style,
        summary: data.summary,
        engineerNotes: data.engineer_notes,
        sections: data.sections || [],
        userId: data.user_id,
        isPublic: data.is_public,
        shareSlug: data.share_slug,
      };
    }
  } catch (err) {
    console.warn("Could not query setup from Supabase:", err);
  }

  return null;
}
