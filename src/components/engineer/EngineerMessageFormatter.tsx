"use client";

import React from "react";

interface FormatterProps {
  content: string;
  role: "user" | "assistant";
}

/**
 * Parses inline markdown:
 * - **bold** -> <strong>
 * - *italic* -> <em>
 * - `code` -> <code>
 */
export function formatInlineText(text: string): React.ReactNode[] {
  // Regex to match **bold**, *italic*, and `code`
  const regex = /(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={idx} className="text-slate-200 italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/50 text-cyan-300 border border-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

/**
 * Structured Motorsport Race Engineer Message Renderer
 * Transforms raw markdown telemetry and setup notes into a legible, high-contrast, structured layout.
 */
export const EngineerMessageContent: React.FC<FormatterProps> = ({ content, role }) => {
  if (role === "user") {
    return <div className="text-white text-xs md:text-sm leading-relaxed">{content}</div>;
  }

  // Pre-process content into logical lines
  const rawLines = content.split("\n");

  // Group lines into structured sections
  type SectionType =
    | "radio_opener"
    | "header"
    | "numbered_action"
    | "telemetry_group"
    | "bullet_item"
    | "paragraph"
    | "radio_signoff";

  interface Block {
    type: SectionType;
    lines: string[];
    headerTitle?: string;
    actionNumber?: string;
    paramLabel?: string;
    paramBody?: string;
  }

  const blocks: Block[] = [];
  let currentTelemetryGroup: string[] = [];

  const flushTelemetryGroup = () => {
    if (currentTelemetryGroup.length > 0) {
      blocks.push({
        type: "telemetry_group",
        lines: [...currentTelemetryGroup],
      });
      currentTelemetryGroup = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();

    if (!line) {
      flushTelemetryGroup();
      continue;
    }

    // Check for Radio Opener (e.g., "Copy, driver.", "Radio check driver...")
    if (
      i === 0 &&
      /^(copy|radio check|understood|affirmative|loud and clear)/i.test(line) &&
      line.length < 50
    ) {
      flushTelemetryGroup();
      blocks.push({ type: "radio_opener", lines: [line] });
      continue;
    }

    // Check for Header (e.g. "**Telemetry snapshot:**", "### Next Steps", "- **Next steps:**")
    const headerMatch =
      line.match(/^(?:###|##)\s*(.*)/) ||
      line.match(/^[-*•]?\s*\*\*(.*?)\*\*:?$/) ||
      line.match(/^[-*•]?\s*\*\*([A-Za-z0-9\s—–-]+:?)\*\*(.*)$/);

    // If it looks like a section header (e.g. "Telemetry snapshot", "Next steps", "Recommendations")
    const isSectionHeader =
      headerMatch &&
      /telemetry|snapshot|next step|adjustment|recommendation|feedback|operating window|chassis balance|driver coaching/i.test(
        headerMatch[1]
      ) &&
      line.length < 75;

    if (isSectionHeader && headerMatch) {
      flushTelemetryGroup();
      blocks.push({
        type: "header",
        headerTitle: headerMatch[1].replace(/[:*]/g, "").trim(),
        lines: headerMatch[2] ? [headerMatch[2].trim()] : [],
      });
      continue;
    }

    // Check for Numbered Action Item (e.g. "1. **Diff Power:** +2% (to 17%)...")
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      flushTelemetryGroup();
      const num = numberedMatch[1];
      const rest = numberedMatch[2];

      // Extract parameter if bolded at start: **Parameter:** rest
      const paramMatch = rest.match(/^\*\*([^*]+)\*\*[:\s-]*(.*)/);
      if (paramMatch) {
        blocks.push({
          type: "numbered_action",
          actionNumber: num,
          paramLabel: paramMatch[1].trim(),
          paramBody: paramMatch[2].trim(),
          lines: [rest],
        });
      } else {
        blocks.push({
          type: "numbered_action",
          actionNumber: num,
          lines: [rest],
        });
      }
      continue;
    }

    // Check for Telemetry Data Point or Bullet Item
    const bulletMatch = line.match(/^[-*•]\s+(.*)/);
    if (bulletMatch) {
      const itemText = bulletMatch[1];
      // If it contains engineering metrics (slip ratio, load shift, ERS, temps, G, delta, %)
      const isTelemetryMetric =
        /slip ratio|load shift|ers|temp|pressure|g-force|delta|km\/h|psi|%/i.test(itemText);

      if (isTelemetryMetric) {
        currentTelemetryGroup.push(itemText);
      } else {
        flushTelemetryGroup();
        blocks.push({
          type: "bullet_item",
          lines: [itemText],
        });
      }
      continue;
    }

    // If we're at the very end and it ends with "Over." or "Out."
    if (i === rawLines.length - 1 && /(?:over\.|out\.)$/i.test(line)) {
      flushTelemetryGroup();
      blocks.push({ type: "radio_signoff", lines: [line] });
      continue;
    }

    // Standard paragraph line
    flushTelemetryGroup();
    blocks.push({
      type: "paragraph",
      lines: [line],
    });
  }

  flushTelemetryGroup();

  return (
    <div className="flex flex-col gap-3 font-sans text-xs md:text-[13px] leading-relaxed select-text">
      {blocks.map((block, idx) => {
        // 1. Radio Opener
        if (block.type === "radio_opener") {
          return (
            <div key={idx} className="flex items-center gap-2 text-slate-300 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="font-semibold tracking-wide text-white uppercase text-[11px]">
                Radio Comms
              </span>
              <span className="text-slate-500">—</span>
              <span className="text-slate-300 italic">{block.lines[0]}</span>
            </div>
          );
        }

        // 2. Section Header
        if (block.type === "header") {
          const isTelemetry = /telemetry|snapshot|data/i.test(block.headerTitle || "");
          const isAction = /step|adjustment|change|action/i.test(block.headerTitle || "");

          return (
            <div key={idx} className="pt-2 border-t border-white/[0.08] mt-1 first:pt-0 first:border-0 first:mt-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`text-[10.5px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                    isTelemetry
                      ? "bg-sky-500/10 text-sky-300 border-sky-500/25"
                      : isAction
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {block.headerTitle}
                </span>
              </div>
              {block.lines.length > 0 && (
                <div className="text-slate-300 text-xs mt-1">
                  {formatInlineText(block.lines[0])}
                </div>
              )}
            </div>
          );
        }

        // 3. Numbered Setup Action Item
        if (block.type === "numbered_action") {
          return (
            <div
              key={idx}
              className="bg-[#0e131d] border border-white/[0.08] rounded-md p-2.5 flex items-start gap-2.5 hover:border-blue-500/30 transition-colors"
            >
              <div className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                {block.actionNumber}
              </div>
              <div className="flex-1 min-w-0">
                {block.paramLabel ? (
                  <div>
                    <span className="text-white font-mono font-semibold text-xs tracking-tight bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10 mr-1.5">
                      {block.paramLabel}
                    </span>
                    <span className="text-slate-300 text-xs">
                      {formatInlineText(block.paramBody || "")}
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-300 text-xs">
                    {formatInlineText(block.lines[0])}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // 4. Telemetry Metric Group
        if (block.type === "telemetry_group") {
          return (
            <div
              key={idx}
              className="bg-[#0a0e16] border border-sky-500/15 rounded-md p-2.5 space-y-1.5 my-0.5"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-sky-400 font-semibold tracking-wider uppercase mb-1">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>Telemetry Ingest Metrics</span>
              </div>
              <div className="space-y-1">
                {block.lines.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-start gap-2 text-xs font-mono text-slate-300">
                    <span className="text-sky-400 shrink-0 select-none">›</span>
                    <span className="leading-snug">{formatInlineText(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // 5. Generic Bullet Item
        if (block.type === "bullet_item") {
          return (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 pl-1">
              <span className="text-slate-400 text-sm leading-none mt-0.5 shrink-0 select-none">•</span>
              <span className="leading-relaxed">{formatInlineText(block.lines[0])}</span>
            </div>
          );
        }

        // 6. Radio Sign-Off
        if (block.type === "radio_signoff") {
          return (
            <div
              key={idx}
              className="mt-1 pt-2 border-t border-white/[0.08] text-slate-400 italic text-xs font-mono flex items-center justify-between"
            >
              <span>{formatInlineText(block.lines[0])}</span>
              <span className="text-[10px] not-italic text-slate-500 font-semibold uppercase tracking-widest">
                RADIO OUT
              </span>
            </div>
          );
        }

        // 7. Regular Paragraph
        return (
          <p key={idx} className="text-slate-300 text-xs md:text-[13px] leading-relaxed">
            {formatInlineText(block.lines[0])}
          </p>
        );
      })}
    </div>
  );
};
