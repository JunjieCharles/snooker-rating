export const PAGE_SIZE = 50;

export function formatRating(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(decimals);
}

export function formatChange(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}`;
}

export function hasPublicMatchSource(match) {
  const matchId = Number(match?.match_id);
  return Number.isFinite(matchId) && matchId >= 0;
}

export function publicMatchSourceUrl(match) {
  if (!hasPublicMatchSource(match)) return "";
  return match.match_source_url || match.tournament_source_url || "";
}

export function filterRanking(rows, query) {
  const needle = normalizeSearchText(query);
  if (!needle) return [...rows];
  return rows.filter((row) => normalizeSearchText(`${row.name} ${row.nationality}`).includes(needle));
}

export function normalizeSearchText(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

export function searchPlayers(players, query, limit = 12) {
  const needle = normalizeSearchText(query);
  if (!needle || limit < 1) return [];
  return players
    .map((player) => {
      const name = normalizeSearchText(player.name);
      const nationality = normalizeSearchText(player.nationality);
      const key = normalizeSearchText(player.player_key);
      const haystack = `${name} ${nationality} ${key}`;
      if (!haystack.includes(needle)) return null;
      let score = 4;
      if (name === needle) score = 0;
      else if (name.startsWith(needle)) score = 1;
      else if (name.includes(needle)) score = 2;
      else score = 3;
      return { player, score };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      const leftActive = Number.isInteger(left.player.active_rank);
      const rightActive = Number.isInteger(right.player.active_rank);
      if (leftActive !== rightActive) return leftActive ? -1 : 1;
      if (leftActive && left.player.active_rank !== right.player.active_rank) return left.player.active_rank - right.player.active_rank;
      return left.player.name.localeCompare(right.player.name, "zh-CN") || left.player.player_key.localeCompare(right.player.player_key);
    })
    .slice(0, limit)
    .map((item) => item.player);
}

export function sortRows(rows, key, direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = left[key];
    const b = right[key];
    if (typeof a === "number" && typeof b === "number") return (a - b) * multiplier || left.rank - right.rank;
    return String(a ?? "").localeCompare(String(b ?? ""), "zh-CN", { numeric: true }) * multiplier || left.rank - right.rank;
  });
}

export function pageRows(rows, page, pageSize = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, pages };
}

export function toggleSelection(selected, key, checked) {
  const next = new Set(selected);
  if (checked) next.add(key);
  else next.delete(key);
  return next;
}

export function pointTime(point) {
  const base = Date.parse(`${point.played_on}T00:00:00Z`);
  const fraction = Number(point.same_day_sequence || 0) / (Number(point.same_day_match_count || 0) + 1);
  return base + fraction * 86400000;
}

export function clipPoints(points, { years = null, endSequence = null, endDate = null, startTime = null } = {}) {
  let clipped = endSequence === null ? [...points] : points.filter((point) => point.sequence <= endSequence);
  if (endDate) clipped = clipped.filter((point) => point.played_on <= endDate);
  if (clipped.length === 0 || (!years && !Number.isFinite(startTime))) return clipped;
  const boundary = Number.isFinite(startTime)
    ? new Date(startTime)
    : endDate ? new Date(`${endDate}T00:00:00Z`) : new Date(pointTime(clipped[clipped.length - 1]));
  if (!Number.isFinite(startTime)) boundary.setUTCFullYear(boundary.getUTCFullYear() - years);
  const start = boundary.getTime();
  const firstInside = clipped.findIndex((point) => pointTime(point) >= start);
  if (firstInside < 0) return [];
  if (firstInside === 0) return clipped;
  const previous = clipped[firstInside - 1];
  const next = clipped[firstInside];
  const previousTime = pointTime(previous);
  const nextTime = pointTime(next);
  if (nextTime === start) return clipped.slice(firstInside);
  const ratio = (start - previousTime) / (nextTime - previousTime);
  const boundaryPoint = {
    ...previous,
    played_on: boundary.toISOString().slice(0, 10),
    same_day_sequence: 0,
    same_day_match_count: 0,
    rating: previous.rating + (next.rating - previous.rating) * ratio,
    uncertainty_elo: previous.uncertainty_elo + (next.uncertainty_elo - previous.uncertainty_elo) * ratio,
    window_boundary: true,
  };
  return [boundaryPoint, ...clipped.slice(firstInside)];
}

export function samplePoints(points, maxPoints) {
  if (points.length <= maxPoints || maxPoints < 4) return [...points];
  const middle = points.slice(1, -1);
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = middle.length / bucketCount;
  const sampled = [points[0]];
  for (let index = 0; index < bucketCount; index += 1) {
    const bucket = middle.slice(Math.floor(index * bucketSize), Math.floor((index + 1) * bucketSize));
    if (!bucket.length) continue;
    const minimum = bucket.reduce((best, point) => point.rating < best.rating ? point : best);
    const maximum = bucket.reduce((best, point) => point.rating > best.rating ? point : best);
    sampled.push(...[minimum, maximum].sort((a, b) => a.sequence - b.sequence));
  }
  sampled.push(points[points.length - 1]);
  return sampled;
}

export function filterMatches(matches, { query = "", year = "", result = "" } = {}) {
  const needle = normalizeSearchText(query);
  return matches.filter((match) => {
    if (year && !match.played_on.startsWith(`${year}-`)) return false;
    if (result && match.result !== result) return false;
    if (!needle) return true;
    return normalizeSearchText(`${match.tournament_name} ${match.stage} ${match.opponent_name}`).includes(needle);
  });
}

export function frameWinProbability(ratingA, ratingB) {
  const a = Number(ratingA);
  const b = Number(ratingB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError("ratings must be finite numbers");
  return 1 / (1 + 10 ** ((b - a) / 400));
}

export function parseBestOfList(value) {
  const tokens = String(value).trim().split(/[\s,，]+/).filter(Boolean);
  const bestOfs = [];
  for (const token of tokens) {
    const bestOf = Number(token);
    if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf > 99) return [];
    if (!bestOfs.includes(bestOf)) bestOfs.push(bestOf);
  }
  return bestOfs;
}

export function scoreProbabilities(frameProbability, bestOf) {
  const p = Number(frameProbability);
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("frameProbability must be in [0, 1]");
  if (!Number.isInteger(bestOf) || bestOf < 1) throw new RangeError("bestOf must be a positive integer");
  const framesToWin = Math.floor(bestOf / 2) + 1;
  const maximumLosses = bestOf % 2 === 0 ? framesToWin - 2 : framesToWin - 1;
  const q = 1 - p;
  const scores = [];
  let coefficient = 1;
  for (let losses = 0; losses <= maximumLosses; losses += 1) {
    if (losses > 0) coefficient *= (framesToWin + losses - 1) / losses;
    scores.push({
      winner: "a",
      score_a: framesToWin,
      score_b: losses,
      probability: coefficient * p ** framesToWin * q ** losses,
    });
    scores.push({
      winner: "b",
      score_a: losses,
      score_b: framesToWin,
      probability: coefficient * q ** framesToWin * p ** losses,
    });
  }
  if (bestOf % 2 === 0) {
    const tiedFrames = bestOf / 2;
    let drawCoefficient = 1;
    for (let index = 1; index <= tiedFrames; index += 1) drawCoefficient *= (tiedFrames + index) / index;
    scores.push({
      winner: "draw",
      score_a: tiedFrames,
      score_b: tiedFrames,
      probability: drawCoefficient * p ** tiedFrames * q ** tiedFrames,
    });
  }
  return scores.sort((left, right) => right.probability - left.probability || right.score_a - left.score_a || right.score_b - left.score_b);
}

export function headToHeadRecord(matches, opponentKey) {
  const meetings = matches.filter((match) => match.opponent_key === opponentKey);
  return meetings.reduce((record, match) => {
    record.matches += 1;
    record.frames += match.score_for + match.score_against;
    record.frame_wins_a += match.score_for;
    record.frame_wins_b += match.score_against;
    if (match.result === "win") record.match_wins_a += 1;
    else if (match.result === "loss") record.match_wins_b += 1;
    else record.match_draws += 1;
    return record;
  }, { matches: 0, frames: 0, match_wins_a: 0, match_wins_b: 0, match_draws: 0, frame_wins_a: 0, frame_wins_b: 0 });
}

export function findHeadToHeadPlayers(players, query = "", limit = 20) {
  const needle = normalizeSearchText(query);
  return players
    .filter((player) => !needle || normalizeSearchText(`${player.name} ${player.nationality} ${player.player_key}`).includes(needle))
    .sort((left, right) => {
      const leftActive = Number.isInteger(left.active_rank);
      const rightActive = Number.isInteger(right.active_rank);
      if (leftActive !== rightActive) return leftActive ? -1 : 1;
      if (leftActive && left.active_rank !== right.active_rank) return left.active_rank - right.active_rank;
      return left.name.localeCompare(right.name, "zh-CN") || left.player_key.localeCompare(right.player_key);
    })
    .slice(0, limit);
}
