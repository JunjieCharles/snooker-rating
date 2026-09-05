import { formatRating, searchPlayers } from "./state.js?v=9dbdaa705a0c";
import { applyLocale, formatNumber, setupLanguageSwitcher, t } from "./i18n.js?v=9dbdaa705a0c";

const SITE_VERSION = document.querySelector('meta[name="site-version"]')?.content;

applyLocale();
setupLanguageSwitcher();

export async function fetchJson(path) {
  const separator = path.includes("?") ? "&" : "?";
  const versionedPath = SITE_VERSION ? `${path}${separator}v=${encodeURIComponent(SITE_VERSION)}` : path;
  const response = await fetch(versionedPath, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(t("common.fetchError", { path, status: response.status }));
  return response.json();
}

export function playerHref(key) {
  return `player.html?player=${encodeURIComponent(key)}`;
}

export function historyHref(year) {
  return `history-ranking.html?year=${encodeURIComponent(year)}`;
}

export function setError(error) {
  const element = document.querySelector("#page-error");
  if (!element) return;
  element.textContent = error instanceof Error ? error.message : String(error);
  element.hidden = false;
}

export function renderRunFacts(manifest) {
  const facts = document.querySelector("#run-facts");
  if (!facts) return;
  const items = [
    [t("common.matches"), formatNumber(manifest.counts.rated_matches)],
    [t("common.frames"), formatNumber(manifest.counts.rated_frames)],
    [t("common.players"), formatNumber(manifest.counts.players)],
    [t("common.activePlayers"), formatNumber(manifest.counts.active_players)],
  ];
  facts.replaceChildren(...items.flatMap(([term, value]) => {
    const dt = document.createElement("dt"); dt.textContent = term;
    const dd = document.createElement("dd"); dd.textContent = value;
    return [dt, dd];
  }));
}

function resultLink(player) {
  const link = document.createElement("a");
  link.href = playerHref(player.player_key);
  const name = document.createElement("strong"); name.textContent = player.name;
  const detail = document.createElement("small");
  detail.textContent = `${player.nationality} · ${formatRating(player.rating)}`;
  link.append(name, detail);
  return link;
}

export async function hydrateShell(manifest = null) {
  const resolvedManifest = manifest || await fetchJson("data/manifest.json");
  renderRunFacts(resolvedManifest);
  const root = document.querySelector("[data-player-search]");
  if (!root) return resolvedManifest;
  const input = root.querySelector("input");
  const results = root.querySelector("[data-search-results]");
  let players = null;
  input.addEventListener("focus", async () => {
    if (!players) players = (await fetchJson("data/players/index.json")).players;
  });
  input.addEventListener("input", async () => {
    if (!players) players = (await fetchJson("data/players/index.json")).players;
    if (!input.value.trim()) { results.hidden = true; results.replaceChildren(); return; }
    const matches = searchPlayers(players, input.value, 8);
    results.replaceChildren(...matches.map(resultLink));
    results.hidden = matches.length === 0;
  });
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) results.hidden = true;
  });
  return resolvedManifest;
}

export function linkWithText(href, text, className = "") {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  if (className) link.className = className;
  return link;
}

export function matchupScoreCell(playerA, scoreA, scoreB, playerB) {
  const td = document.createElement("td");
  td.className = "score-matchup-cell";
  const score = document.createElement("span");
  score.className = "score-matchup";
  score.setAttribute("aria-label", `${playerA} ${scoreA} - ${scoreB} ${playerB}`);
  const nameA = document.createElement("span");
  nameA.className = "score-matchup-player score-matchup-player-left";
  nameA.textContent = playerA;
  const valueA = document.createElement("span");
  valueA.className = "score-matchup-value score-matchup-value-left";
  valueA.textContent = scoreA;
  const separator = document.createElement("span");
  separator.className = "score-matchup-separator";
  separator.textContent = "-";
  const valueB = document.createElement("span");
  valueB.className = "score-matchup-value score-matchup-value-right";
  valueB.textContent = scoreB;
  const nameB = document.createElement("span");
  nameB.className = "score-matchup-player score-matchup-player-right";
  nameB.textContent = playerB;
  score.append(nameA, valueA, separator, valueB, nameB);
  td.append(score);
  return td;
}
