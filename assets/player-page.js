import { fetchJson, hydrateShell, linkWithText, matchupScoreCell, playerHref, setError } from "./common.js?v=9dbdaa705a0c";
import { RatingChart } from "./chart.js?v=9dbdaa705a0c";
import { formatNumber, t } from "./i18n.js?v=9dbdaa705a0c";
import { filterMatches, formatRating, hasPublicMatchSource, pageRows, publicMatchSourceUrl } from "./state.js?v=9dbdaa705a0c";

function fact(term, value) { const dt = document.createElement("dt"); dt.textContent = term; const dd = document.createElement("dd"); dd.textContent = value; return [dt, dd]; }
function cell(text, className = "") { const td = document.createElement("td"); td.textContent = text; if (className) td.className = className; return td; }
function resultText(result) { return t(result === "win" ? "player.win" : result === "loss" ? "player.loss" : "player.draw"); }
function winRate(wins, total) { return total ? `${formatNumber(wins / total * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"; }
function recordText(wins, losses, draws, total) {
  return t("player.record", {
    wins,
    losses,
    draws: draws ? t("player.drawRecord", { draws }) : "",
    winRate: winRate(wins, total),
  });
}

try {
  const key = new URLSearchParams(window.location.search).get("player");
  if (!key) throw new Error(t("player.missingParameter"));
  const [manifest, detail, curve] = await Promise.all([fetchJson("data/manifest.json"), fetchJson(`data/players/${encodeURIComponent(key)}.json`), fetchJson(`data/curves/${encodeURIComponent(key)}.json`)]);
  await hydrateShell(manifest);
  const profile = detail.profile;
  document.title = t("player.dynamicTitle", { name: profile.name });
  document.querySelector("#breadcrumb-player").textContent = profile.name;
  document.querySelector("#player-name").textContent = profile.name;
  document.querySelector("#player-subtitle").textContent = `${profile.nationality} · ${profile.active_rank ? t("player.activeRank", { rank: profile.active_rank }) : t("player.inactive")}`;
  const source = document.querySelector("#player-source"); if (profile.source_url) { source.href = profile.source_url; source.hidden = false; }
  const matchLosses = detail.matches.filter((match) => match.result === "loss").length;
  const matchDraws = detail.matches.filter((match) => match.result === "draw").length;
  const matchRecord = recordText(profile.match_wins, matchLosses, matchDraws, profile.matches);
  document.querySelector("#player-facts").append(...[
    ...fact(t("player.currentRating"), formatRating(profile.current_rating)),
    ...fact(t("player.peakRating"), `${formatRating(profile.peak_rating)} · ${profile.peak_date}`),
    ...fact(t("player.matchRecordFact"), matchRecord),
    ...fact(t("player.frameRecordFact"), recordText(profile.frame_wins, profile.frames - profile.frame_wins, 0, profile.frames)),
    ...fact(t("player.lastPlayed"), profile.last_played),
  ]);
  document.querySelector("#player-profile").setAttribute("aria-busy", "false");
  const chart = new RatingChart(document.querySelector("#rating-chart")); let years = null;
  const renderChart = () => chart.render([{ player_key: key, name: profile.name, points: curve.points }], { years, height: 510 }); renderChart();
  document.querySelectorAll("#range-switcher [data-years]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("#range-switcher button").forEach((item) => item.classList.toggle("is-active", item === button)); years = button.dataset.years === "all" ? null : Number(button.dataset.years); renderChart(); }));
  window.addEventListener("resize", () => { window.clearTimeout(window.__playerResize); window.__playerResize = window.setTimeout(renderChart, 120); });

  const yearsList = [...new Set(detail.matches.map((match) => match.played_on.slice(0, 4)))]; const yearSelect = document.querySelector("#match-year"); yearsList.forEach((year) => { const option = document.createElement("option"); option.value = year; option.textContent = year; yearSelect.append(option); });
  const search = document.querySelector("#match-search"); const resultSelect = document.querySelector("#match-result"); const body = document.querySelector("#match-body"); const pagination = document.querySelector("#match-pagination"); let page = 1;
  const renderMatches = () => {
    const filtered = filterMatches(detail.matches, { query: search.value, year: yearSelect.value, result: resultSelect.value }); const paged = pageRows(filtered, page); page = paged.page;
    body.replaceChildren(...paged.rows.map((match) => { const tr = document.createElement("tr"); const tournament = document.createElement("td"); const name = document.createElement("strong"); name.textContent = match.tournament_name; const stage = document.createElement("small"); stage.textContent = match.stage; tournament.append(name, stage); const opponent = document.createElement("td"); opponent.append(linkWithText(playerHref(match.opponent_key), match.opponent_name)); const result = cell(resultText(match.result), `match-result result-${match.result}`); const sourceCell = document.createElement("td"); const sourceUrl = publicMatchSourceUrl(match); if (sourceUrl) { const sourceLink = linkWithText(sourceUrl, `#${match.match_id} ↗`); sourceLink.target = "_blank"; sourceLink.rel = "noreferrer"; sourceCell.append(sourceLink); } else if (hasPublicMatchSource(match)) sourceCell.textContent = `#${match.match_id}`;
      const playedOn = match.date_quality === "tournament_end" ? t("player.tournamentEnd", { date: match.played_on }) : match.played_on;
      tr.append(cell(playedOn), tournament, opponent, result, matchupScoreCell(profile.name, match.score_for, match.score_against, match.opponent_name), sourceCell); return tr; }));
    document.querySelector("#match-count").textContent = t("player.matchCount", { count: filtered.length }); pagination.replaceChildren(); const previous = document.createElement("button"); previous.type = "button"; previous.textContent = t("common.previous"); previous.disabled = page <= 1; previous.addEventListener("click", () => { page -= 1; renderMatches(); }); const label = document.createElement("span"); label.textContent = t("common.page", { page, pages: paged.pages }); const next = document.createElement("button"); next.type = "button"; next.textContent = t("common.next"); next.disabled = page >= paged.pages; next.addEventListener("click", () => { page += 1; renderMatches(); }); pagination.append(previous, label, next);
  };
  [search, yearSelect, resultSelect].forEach((control) => control.addEventListener(control === search ? "input" : "change", () => { page = 1; renderMatches(); })); renderMatches();
} catch (error) { setError(error); }
