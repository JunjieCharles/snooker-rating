import { clipPoints, formatRating, pointTime, samplePoints } from "./state.js?v=9dbdaa705a0c";
import { t } from "./i18n.js?v=9dbdaa705a0c";

const SVG_NS = "http://www.w3.org/2000/svg";
const SERIES_PALETTE = [
  "#8E24AA", "#A88700", "#00897B", "#D81B60", "#5E35B1", "#E53935", "#43A047", "#FB8C00",
  "#6D4C41", "#3949AB", "#2E7D32", "#F06292", "#00ACC1", "#F4511E", "#757575", "#7CB342",
  "#1E88E5", "#EF6C00", "#AD1457", "#546E7A", "#C62828", "#6A1B9A", "#283593", "#827717",
  "#00838F", "#C2185B", "#5D4037", "#FF7043", "#7E57C2", "#7D8F00", "#0277BD", "#8D6E63",
];
const MIN_SERIES_COLOR_DISTANCE_SQUARED = 12000;
let nextClipPathId = 0;

function svg(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

export function seriesColor(key) {
  let hash = 2166136261;
  for (const character of key) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b); hash ^= hash >>> 16;
  return SERIES_PALETTE[(hash >>> 0) % SERIES_PALETTE.length];
}

function colorDistanceSquared(colorA, colorB) {
  const channels = (color) => [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const a = channels(colorA);
  const b = channels(colorB);
  return a.reduce((total, channel, index) => total + (channel - b[index]) ** 2, 0);
}

export function widgetSeriesColors(keys) {
  const colors = new Map();
  const assigned = [];
  for (const key of keys) {
    if (colors.has(key)) continue;
    const preferred = seriesColor(key);
    const preferredIndex = SERIES_PALETTE.indexOf(preferred);
    const rotated = Array.from({ length: SERIES_PALETTE.length }, (_, offset) => SERIES_PALETTE[(preferredIndex + offset) % SERIES_PALETTE.length]);
    const unused = rotated.filter((candidate) => !assigned.includes(candidate));
    const candidates = unused.length ? unused : rotated;
    const minimumDistance = (candidate) => assigned.length
      ? Math.min(...assigned.map((color) => colorDistanceSquared(color, candidate)))
      : Number.POSITIVE_INFINITY;
    const preferredDistance = minimumDistance(candidates[0]);
    const color = preferredDistance >= MIN_SERIES_COLOR_DISTANCE_SQUARED
      ? candidates[0]
      : candidates.reduce((best, candidate) => minimumDistance(candidate) > minimumDistance(best) ? candidate : best);
    colors.set(key, color);
    assigned.push(color);
  }
  return colors;
}

export function comparisonSeriesColors(keyA, keyB) {
  const colors = widgetSeriesColors([keyA, keyB]);
  return [colors.get(keyA), colors.get(keyB)];
}

export function orderSeriesForPainting(series) {
  return series.map((item, index) => ({ item, index })).sort((left, right) => {
    const leftRanked = Number.isFinite(left.item.rank);
    const rightRanked = Number.isFinite(right.item.rank);
    if (leftRanked && rightRanked && left.item.rank !== right.item.rank) return right.item.rank - left.item.rank;
    if (leftRanked !== rightRanked) return leftRanked ? 1 : -1;
    return left.index - right.index;
  }).map(({ item }) => item);
}

function linePath(points, sx, sy, ratingAccessor = (point) => point.rating) {
  return points.map((point, index) => `${index ? "L" : "M"}${sx(pointTime(point)).toFixed(2)},${sy(ratingAccessor(point)).toFixed(2)}`).join(" ");
}

function bandPath(points, sx, sy) {
  const upper = points.map((point) => [sx(pointTime(point)), sy(point.rating + point.uncertainty_elo)]);
  const lower = [...points].reverse().map((point) => [sx(pointTime(point)), sy(point.rating - point.uncertainty_elo)]);
  return [...upper, ...lower].map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") + " Z";
}

function nearestPoint(points, target) {
  return points.reduce((best, point) => Math.abs(pointTime(point) - target) < Math.abs(pointTime(best) - target) ? point : best);
}

export class RatingChart {
  constructor(container) {
    this.container = container;
    this.clipPathId = `rating-chart-clip-${nextClipPathId += 1}`;
    this.series = [];
    this.options = {};
    this.groupByKey = new Map();
    this.focusedKey = null;
  }

  focusSeries(key) {
    this.focusedKey = key;
    this.groupByKey.forEach((group, groupKey) => {
      group.classList.toggle("is-muted", groupKey !== key);
      group.classList.toggle("is-focused", groupKey === key);
    });
  }

  clearSeriesFocus() {
    this.focusedKey = null;
    this.groupByKey.forEach((group) => {
      group.classList.remove("is-muted", "is-focused");
    });
  }

  render(series, options = {}) {
    this.series = series;
    this.options = options;
    this.container.replaceChildren();
    this.groupByKey = new Map();
    if (!series.length) {
      const empty = document.createElement("div"); empty.className = "chart-empty"; empty.textContent = t("chart.empty");
      this.container.append(empty); return;
    }
    const width = Math.max(640, this.container.clientWidth || 900);
    const height = options.height || 470;
    const margin = { top: 24, right: 22, bottom: 52, left: 62 };
    const automaticColors = widgetSeriesColors(series.map((item) => item.player_key));
    const filtered = series.map((item) => ({ ...item, points: clipPoints(item.points, { ...options, years: null }) })).filter((item) => item.points.length);
    if (!filtered.length) {
      const empty = document.createElement("div"); empty.className = "chart-empty"; empty.textContent = t("chart.emptyRange");
      this.container.append(empty); return;
    }
    const filteredPoints = filtered.flatMap((item) => item.points);
    const xMaxRaw = Math.max(...filteredPoints.map(pointTime));
    let xMax = options.endDate ? Math.max(Date.parse(`${options.endDate}T00:00:00Z`), xMaxRaw) : xMaxRaw;
    let xMin = Math.min(...filteredPoints.map(pointTime));
    if (options.years) {
      const boundary = new Date(xMax);
      boundary.setUTCFullYear(boundary.getUTCFullYear() - options.years);
      xMin = boundary.getTime();
    }
    const clipped = orderSeriesForPainting(filtered.map((item) => ({ ...item, points: clipPoints(item.points, { startTime: xMin }) })).filter((item) => item.points.length));
    if (!clipped.length) {
      const empty = document.createElement("div"); empty.className = "chart-empty"; empty.textContent = t("chart.emptyRange");
      this.container.append(empty); return;
    }
    if (xMax === xMin) xMax = xMin + 86400000;
    const allPoints = clipped.flatMap((item) => item.points);
    const ratings = allPoints.map((point) => point.rating);
    let yMin = Math.floor((Math.min(...ratings) - 45) / 50) * 50;
    let yMax = Math.ceil((Math.max(...ratings) + 45) / 50) * 50;
    if (yMax === yMin) yMax += 100;
    const sx = (value) => margin.left + (value - xMin) / (xMax - xMin) * (width - margin.left - margin.right);
    const sy = (value) => margin.top + (yMax - value) / (yMax - yMin) * (height - margin.top - margin.bottom);
    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": t("chart.comparisonAria", { count: clipped.length }) });
    root.classList.add("chart-svg");
    const defs = svg("defs");
    const clipPath = svg("clipPath", { id: this.clipPathId });
    clipPath.append(svg("rect", { x: margin.left, y: margin.top, width: width - margin.left - margin.right, height: height - margin.top - margin.bottom }));
    defs.append(clipPath);
    root.append(defs);
    const grid = svg("g", { class: "chart-grid" });
    for (let value = yMin; value <= yMax; value += 50) {
      const y = sy(value); grid.append(svg("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y }));
      const label = svg("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end" }); label.textContent = value; grid.append(label);
    }
    const startYear = new Date(xMin).getUTCFullYear();
    const endYear = new Date(xMax).getUTCFullYear();
    const yearStep = Math.max(1, Math.ceil((endYear - startYear + 1) / 6));
    for (let year = startYear; year <= endYear; year += yearStep) {
      const x = sx(Date.UTC(year, 0, 1));
      const label = svg("text", { x, y: height - 18, "text-anchor": "middle" }); label.textContent = year; grid.append(label);
    }
    root.append(grid);
    const plot = svg("g", { class: "chart-plot", "clip-path": `url(#${this.clipPathId})` });
    const tooltip = document.createElement("div"); tooltip.className = "chart-tooltip"; tooltip.hidden = true;
    clipped.forEach((item) => {
      const sampled = samplePoints(item.points, Math.max(400, Math.floor(width * 1.5)));
      const color = item.color || automaticColors.get(item.player_key);
      const group = svg("g", { class: `chart-series${clipped.length === 1 ? " is-single" : ""}`, "data-player-key": item.player_key });
      const band = svg("path", { class: "rating-band", d: bandPath(sampled, sx, sy), fill: color });
      const pathData = linePath(sampled, sx, sy);
      const line = svg("path", { class: "rating-line", d: pathData, stroke: color });
      const hit = svg("path", { class: "rating-hit", d: pathData, tabindex: 0, "aria-label": item.name });
      const focus = () => this.focusSeries(item.player_key);
      const clear = () => { this.clearSeriesFocus(); tooltip.hidden = true; };
      hit.addEventListener("pointerenter", focus); hit.addEventListener("focus", focus);
      hit.addEventListener("pointerleave", clear); hit.addEventListener("blur", clear);
      hit.addEventListener("pointermove", (event) => {
        const bounds = root.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * width;
        const target = xMin + (x - margin.left) / (width - margin.left - margin.right) * (xMax - xMin);
        const point = nearestPoint(item.points, target);
        tooltip.replaceChildren();
        const strong = document.createElement("strong"); strong.textContent = item.name;
        const dateLabel = point.date_quality === "tournament_end" ? t("chart.tournamentEndBatch", { date: point.played_on }) : point.played_on;
        const details = document.createElement("span"); details.textContent = `${dateLabel} · ${formatRating(point.rating, 1)} ± ${formatRating(point.uncertainty_elo, 1)}`;
        const match = document.createElement("small");
        match.textContent = point.window_boundary ? t("chart.windowBoundary") : t("chart.matchDetail", { opponent: point.opponent_name, scoreFor: point.score_for, scoreAgainst: point.score_against });
        tooltip.append(strong, details);
        if (!point.window_boundary) {
          const tournament = document.createElement("small"); tournament.textContent = point.tournament_name;
          tooltip.append(tournament);
        }
        tooltip.append(match); tooltip.hidden = false;
        tooltip.style.left = `${Math.min(event.clientX - bounds.left + 14, bounds.width - 230)}px`;
        tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 78)}px`;
      });
      group.append(band, line, hit); plot.append(group); this.groupByKey.set(item.player_key, group);
    });
    if (this.focusedKey) this.focusSeries(this.focusedKey);
    root.append(plot); this.container.append(root, tooltip);
  }
}
