import {
  composeSlide,
  layers,
  shape,
  text,
} from "@oai/artifact-tool";

export const W = 1280;
export const H = 720;

export const C = {
  bg: "#030705",
  panel: "#08100E",
  panel2: "#0D1714",
  stroke: "#21352E",
  hair: "#28473C",
  text: "#DDEFE7",
  muted: "#89A39A",
  dim: "#587068",
  green: "#00FF88",
  blue: "#00A3FF",
  amber: "#FFB020",
  red: "#FF4D5E",
  purple: "#A86CFF",
  white: "#FFFFFF",
};

export function t(value, x, y, w, h, size = 24, color = C.text, opts = {}) {
  return text(value, {
    position: { left: x, top: y },
    width: w,
    height: h,
    style: {
      fontSize: size,
      typeface: opts.face || "Helvetica",
      color,
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      alignment: opts.align || "left",
      anchor: opts.anchor || 1,
      lineSpacing: opts.leading || 1.05,
      wrap: "square",
      insets: opts.insets || { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });
}

export function rect(x, y, w, h, fill = C.panel, line = C.stroke, radius = 0) {
  return shape({
    geometry: "rect",
    position: { left: x, top: y },
    width: w,
    height: h,
    fill,
    line: line === "none" ? { fill: { type: "none" }, width: 0 } : { fill: line, width: 1 },
    borderRadius: radius,
  });
}

export function ellipse(x, y, w, h, fill, line = "none") {
  return shape({
    geometry: "ellipse",
    position: { left: x, top: y },
    width: w,
    height: h,
    fill,
    line: line === "none" ? { fill: { type: "none" }, width: 0 } : { fill: line, width: 1 },
  });
}

export function line(x1, y1, x2, y2, color = C.hair, width = 1) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dx >= dy) {
    return shape({
      geometry: "rect",
      position: { left: Math.min(x1, x2), top: y1 - width / 2 },
      width: Math.max(dx, width),
      height: width,
      fill: color,
      line: { fill: { type: "none" }, width: 0 },
    });
  }
  return shape({
    geometry: "rect",
    position: { left: x1 - width / 2, top: Math.min(y1, y2) },
    width,
    height: Math.max(dy, width),
    fill: color,
    line: { fill: { type: "none" }, width: 0 },
  });
}

export function base(slide, meta = {}) {
  const items = [
    rect(0, 0, W, H, C.bg, "none"),
    rect(0, 0, W, 720, "linear(135deg, #030705 0%, #07120F 58%, #07100D 100%)", "none"),
  ];
  for (let x = 80; x < W; x += 80) items.push(line(x, 0, x, H, "#0D1B17", 0.6));
  for (let y = 80; y < H; y += 80) items.push(line(0, y, W, y, "#0D1B17", 0.6));
  items.push(t("SWARMDAQ", 44, 30, 140, 22, 13, C.green, { bold: true }));
  if (meta.kicker) items.push(t(meta.kicker.toUpperCase(), 44, 74, 260, 24, 12, C.green, { bold: true }));
  if (meta.title) items.push(t(meta.title, 44, 102, 760, 94, meta.titleSize || 42, C.text, { bold: true, leading: 1.0 }));
  if (meta.source) items.push(t(meta.source, 44, 684, 780, 18, 10, C.dim));
  if (meta.page) items.push(t(String(meta.page).padStart(2, "0"), 1190, 682, 48, 20, 11, C.dim, { align: "right" }));
  return items;
}

export function chip(label, x, y, w, color = C.green) {
  return [
    rect(x, y, w, 30, `${color}14`, `${color}55`, 2),
    ellipse(x + 12, y + 11, 8, 8, color),
    t(label, x + 28, y + 7, w - 34, 18, 11, color, { bold: true }),
  ];
}

export function metric(value, label, x, y, w, color = C.green) {
  return [
    t(value, x, y, w, 56, 48, color, { bold: true }),
    t(label, x + 2, y + 54, w, 34, 14, C.muted, { leading: 1.1 }),
    line(x, y + 96, x + w, y + 96, `${color}88`, 2),
  ];
}

export function node(label, sub, x, y, w, h, color = C.green) {
  return [
    rect(x, y, w, h, `${color}10`, `${color}66`, 4),
    t(label, x + 16, y + 14, w - 32, 24, 17, C.text, { bold: true }),
    t(sub, x + 16, y + 43, w - 32, h - 52, 12.5, C.muted, { leading: 1.12 }),
  ];
}

export function finish(slide, elements) {
  composeSlide(slide, layers({ width: W, height: H }, elements));
  return slide;
}
