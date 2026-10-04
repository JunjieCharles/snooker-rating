import { frameWinProbability, scoreProbabilities } from "./state.js?v=5427d62e11e3";
import { formatNumber, t } from "./i18n.js?v=5427d62e11e3";

export function upcomingPrediction(match, players, versionsMatch = true) {
  if (!versionsMatch) return { reason: "h2h.predictionVersionMismatch" };
  if (!Number.isInteger(match.best_of) || match.best_of < 1 || match.best_of > 99) {
    return { reason: "h2h.predictionFormatMissing" };
  }
  const a = players.get(match.player_a_key);
  const b = players.get(match.player_b_key);
  if (!a || !b || a.player_id === b.player_id
      || match.player_a_pending_fixture || match.player_b_pending_fixture
      || !Number.isFinite(a.rating) || !Number.isFinite(b.rating)) {
    return { reason: "h2h.predictionPlayersMissing" };
  }
  const scores = scoreProbabilities(frameWinProbability(a.rating, b.rating), match.best_of);
  const probability = (winner) => scores.filter((s) => s.winner === winner).reduce((sum, s) => sum + s.probability, 0);
  return {
    winA: probability("a"), winB: probability("b"), draw: probability("draw"),
    scores: scores.filter((s) => Math.abs(s.probability - scores[0].probability) <= 1e-12 * scores[0].probability),
  };
}

export function upcomingPredictionElement(prediction) {
  const container = document.createElement("div");
  container.className = "upcoming-prediction";
  if (prediction.reason) {
    container.textContent = t(prediction.reason);
    return container;
  }
  const percent = (value) => `${formatNumber(value * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const chances = document.createElement("div");
  chances.className = "upcoming-chances";
  for (const text of [percent(prediction.winA), t("h2h.upcomingWinPrediction"), percent(prediction.winB)]) {
    const span = document.createElement("span");
    span.textContent = text;
    chances.append(span);
  }
  const bar = document.createElement("div");
  bar.className = "upcoming-probability-bar";
  bar.setAttribute("aria-hidden", "true");
  for (const [side, probability] of [["a", prediction.winA], ["draw", prediction.draw], ["b", prediction.winB]]) {
    const segment = document.createElement("span");
    segment.className = `upcoming-probability-${side}`;
    segment.style.width = `${probability * 100}%`;
    bar.append(segment);
  }
  const score = document.createElement("div");
  score.textContent = t("h2h.upcomingScorePrediction", {
    scores: prediction.scores.map((s) => `${s.score_a}–${s.score_b}`).join(" / "),
  });
  container.append(chances, bar, score);
  if (prediction.draw > 0) {
    const draw = document.createElement("div");
    draw.textContent = t("h2h.upcomingDrawPrediction", { probability: percent(prediction.draw) });
    container.append(draw);
  }
  return container;
}
