/**
 * Centralized Numeric Telemetry Parser & Conversion Utilities
 * Enforces strict distinction between genuine zero (0) and missing/unmeasured data (null).
 */

/**
 * Parses an unknown value into a finite number or null.
 * 
 * Rules:
 * - "12.5"      -> 12.5
 * - "0"         -> 0
 * - "0.0"       -> 0
 * - "  "        -> null
 * - ""          -> null
 * - null        -> null
 * - undefined   -> null
 * - "NaN"       -> null
 * - "abc"       -> null
 * - "N/A"       -> null
 * - "-"         -> null
 * 
 * CRITICAL:
 * parseOptionalNumber("0") === 0
 * parseOptionalNumber("") === null
 */
export function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null;
  }

  if (typeof value === "string") {
    let trimmed = value.trim();

    // Check for quoted strings: e.g. '""' or "''"
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1).trim();
    }

    if (
      trimmed === "" ||
      trimmed === "-" ||
      trimmed === "—" ||
      trimmed.toLowerCase() === "nan" ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "undefined" ||
      trimmed.toLowerCase() === "n/a" ||
      trimmed.toLowerCase() === "na" ||
      trimmed.toLowerCase() === "none"
    ) {
      return null;
    }

    // Number("") in JS is 0, but we've already handled empty string above.
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      return null;
    }

    return Object.is(num, -0) ? 0 : num;
  }

  return null;
}

/**
 * Safe unit conversion that strictly preserves null for missing values
 * and preserves genuine zero values.
 * 
 * null km/h -> null m/s
 * 0 km/h -> 0 m/s
 */
export function convertOptionalNumber(
  val: number | null | undefined,
  converter: (n: number) => number
): number | null {
  if (val == null || !Number.isFinite(val)) {
    return null;
  }
  const res = converter(val);
  return Number.isFinite(res) ? (Object.is(res, -0) ? 0 : res) : null;
}

/**
 * Compute the minimum of an array of nullable numbers, excluding missing observations.
 * Returns null if no valid numbers are present.
 */
export function safeMin(values: (number | null | undefined)[]): number | null {
  let min: number | null = null;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      if (min === null || v < min) {
        min = v;
      }
    }
  }
  return min;
}

/**
 * Compute the maximum of an array of nullable numbers, excluding missing observations.
 * Returns null if no valid numbers are present.
 */
export function safeMax(values: (number | null | undefined)[]): number | null {
  let max: number | null = null;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      if (max === null || v > max) {
        max = v;
      }
    }
  }
  return max;
}

/**
 * Compute the arithmetic mean of an array of nullable numbers, excluding missing observations.
 * Returns null if no valid numbers are present.
 */
export function safeMean(values: (number | null | undefined)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Formats an optional number for display in the UI.
 * Missing numbers render as "—" or a custom fallback, NEVER fake 0 or 0.00.
 * Genuine 0 values render as "0", "0.0", etc.
 */
export function formatOptionalNumber(
  val: number | null | undefined,
  optionsOrDecimals?:
    | number
    | {
        decimals?: number;
        unit?: string;
        fallback?: string;
        prefixPlus?: boolean;
      },
  fallbackStr?: string
): string {
  const options =
    typeof optionsOrDecimals === "number"
      ? { decimals: optionsOrDecimals, fallback: fallbackStr }
      : optionsOrDecimals;

  if (val == null || !Number.isFinite(val)) {
    return options?.fallback ?? fallbackStr ?? "—";
  }

  const decimals = options?.decimals;
  const formatted = decimals !== undefined ? val.toFixed(decimals) : String(val);
  const prefix = options?.prefixPlus && val > 0 ? "+" : "";
  const unitSuffix = options?.unit ? ` ${options.unit}` : "";

  return `${prefix}${formatted}${unitSuffix}`;
}
