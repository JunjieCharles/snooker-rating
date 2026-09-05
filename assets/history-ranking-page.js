import { fetchJson, historyHref, hydrateShell, setError } from "./common.js?v=9dbdaa705a0c";
import { t } from "./i18n.js?v=9dbdaa705a0c";
import { setupRankingPage } from "./ranking-page.js?v=9dbdaa705a0c";

try {
  const year = Number(new URLSearchParams(window.location.search).get("year"));
  if (!Number.isInteger(year)) throw new Error(t("historyRanking.invalidYear"));
  const [manifest, historyIndex, history] = await Promise.all([fetchJson("data/manifest.json"), fetchJson("data/history/index.json"), fetchJson(`data/history/${year}.json`)]);
  await hydrateShell(manifest);
  document.title = t("historyRanking.dynamicTitle", { year });
  document.querySelector("#breadcrumb-year").textContent = t("historyRanking.breadcrumb", { year });
  document.querySelector("#history-title").textContent = t("historyRanking.yearHeading", { year });
  document.querySelector("#page-summary").textContent = t("historyRanking.summary", { nodeDate: history.node_date, matchId: history.node_match_id, eligiblePlayers: history.eligible_players });
  const select = document.querySelector("#year-select");
  historyIndex.nodes.forEach((node) => { const option = document.createElement("option"); option.value = node.year; option.textContent = node.year; option.selected = node.year === year; select.append(option); });
  select.addEventListener("change", () => { window.location.href = historyHref(select.value); });
  const chronological = [...historyIndex.nodes].reverse(); const index = chronological.findIndex((node) => node.year === year);
  const previous = document.querySelector("#previous-year"); const next = document.querySelector("#next-year");
  if (index > 0) previous.href = historyHref(chronological[index - 1].year); else { previous.removeAttribute("href"); previous.setAttribute("aria-disabled", "true"); }
  if (index >= 0 && index < chronological.length - 1) next.href = historyHref(chronological[index + 1].year); else { next.removeAttribute("href"); next.setAttribute("aria-disabled", "true"); }
  setupRankingPage({ rows: history.ranking, cutoffDate: history.node_date, endSequence: history.node_sequence });
} catch (error) { setError(error); }
