const AVG_CHAR_WIDTH_RATIO = 0.52;
const WIDTH_PADDING = 0.92;
const HEIGHT_PADDING = 0.78;
const MIN_FONT_SIZE = 10;

const CHAR_WIDTH_RATIOS: Record<string, number> = {
  " ": 0.28,
  I: 0.32,
  i: 0.32,
  l: 0.3,
  W: 0.78,
  M: 0.76,
  m: 0.72,
};

export function estimateTextWidthPx(
  name: string,
  fontSizePx: number,
  fontWeight: number
): number {
  const weightFactor = fontWeight >= 700 ? 1.06 : 1;
  let ratio = 0;

  for (const char of name) {
    ratio += CHAR_WIDTH_RATIOS[char] ?? AVG_CHAR_WIDTH_RATIO;
  }

  return ratio * fontSizePx * weightFactor;
}

export function fitNameFontSize(
  name: string,
  boxWidthPx: number,
  boxHeightPx: number,
  fontWeight: number
): number {
  const trimmed = name.trim();
  if (!trimmed || boxWidthPx <= 0 || boxHeightPx <= 0) {
    return MIN_FONT_SIZE;
  }

  const maxByHeight = Math.floor(boxHeightPx * HEIGHT_PADDING);
  const maxSize = Math.max(MIN_FONT_SIZE, maxByHeight);
  const targetWidth = boxWidthPx * WIDTH_PADDING;

  let low = MIN_FONT_SIZE;
  let high = maxSize;
  let best = MIN_FONT_SIZE;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const width = estimateTextWidthPx(trimmed, mid, fontWeight);

    if (width <= targetWidth && mid <= maxByHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

export function measureFitFontSize(
  name: string,
  boxWidthPx: number,
  boxHeightPx: number,
  fontWeight: number,
  fontFamily = "'Times New Roman', Georgia, serif"
): number {
  if (typeof document === "undefined") {
    return fitNameFontSize(name, boxWidthPx, boxHeightPx, fontWeight);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return fitNameFontSize(name, boxWidthPx, boxHeightPx, fontWeight);
  }

  const trimmed = name.trim();
  if (!trimmed || boxWidthPx <= 0 || boxHeightPx <= 0) {
    return MIN_FONT_SIZE;
  }

  const maxByHeight = Math.floor(boxHeightPx * HEIGHT_PADDING);
  const targetWidth = boxWidthPx * WIDTH_PADDING;

  let low = MIN_FONT_SIZE;
  let high = Math.max(MIN_FONT_SIZE, maxByHeight);
  let best = MIN_FONT_SIZE;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    context.font = `${fontWeight} ${mid}px ${fontFamily}`;
    const width = context.measureText(trimmed).width;

    if (width <= targetWidth && mid <= maxByHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
