"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { getBrandDisplayName } from "@/modules/brand-settings/selectors";
import { getMasterColorById } from "@/modules/palette/services";
import type { BrandId, PatternGenerationResult } from "@/types";

const EMPTY_STYLE: CSSProperties = {
  backgroundColor: "#fafafa",
  backgroundImage:
    "repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 2px, #e2e8f0 2px, #e2e8f0 4px)",
};

type PatternThumbnailProps = {
  result: PatternGenerationResult;
  brand: BrandId;
  maxWidthPx?: number;
  className?: string;
};

export function PatternThumbnail({
  result,
  brand,
  maxWidthPx = 140,
  className,
}: PatternThumbnailProps) {
  const w = result.width;
  const h = result.height;
  const cell = Math.max(2, Math.floor(maxWidthPx / Math.max(w, 1)));
  const gridW = cell * w;

  return (
    <div
      className={cn("overflow-hidden rounded-lg ring-1 ring-slate-200/80", className)}
      style={{ width: gridW }}
      title={`${getBrandDisplayName(brand)} · ${w}×${h}`}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${w}, ${cell}px)`,
          width: gridW,
        }}
      >
        {result.cells.flat().map((cellItem) => {
          const mid = cellItem.masterColorId;
          const isEmpty = mid === null;
          const hex = !isEmpty ? getMasterColorById(mid)?.hex : null;
          return (
            <div
              key={`${cellItem.x}-${cellItem.y}`}
              style={{
                width: cell,
                height: cell,
                ...(isEmpty
                  ? EMPTY_STYLE
                  : { backgroundColor: hex ?? "#ffffff" }),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
