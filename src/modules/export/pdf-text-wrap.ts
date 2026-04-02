/** 按宽度折行（适合中文与长串替代说明）。 */
export function wrapTextToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const trial = line + char;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      line = char;
    }
  }
  if (line) lines.push(line);
  return lines;
}
