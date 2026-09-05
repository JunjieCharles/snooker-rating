import { fetchJson, historyHref, hydrateShell, linkWithText, setError } from "./common.js?v=9dbdaa705a0c";
import { t } from "./i18n.js?v=9dbdaa705a0c";
import { filterRanking, formatRating, normalizeSearchText } from "./state.js?v=9dbdaa705a0c";

function historyCard(node) {
  const article = document.createElement("article"); article.className = "history-card panel";
  const heading = document.createElement("header");
  const title = linkWithText(historyHref(node.year), t("history.worldChampionship", { year: node.year }), "history-year-link");
  const meta = document.createElement("span"); meta.textContent = t("history.activePlayers", { date: node.node_date, count: node.eligible_players });
  heading.append(title, meta);
  const list = document.createElement("ol");
  node.top_ten.forEach((row) => { const item = document.createElement("li"); const rank = document.createElement("span"); rank.className = "history-rank"; rank.textContent = row.rank; const player = linkWithText(`player.html?player=${encodeURIComponent(row.player_key)}`, row.name); const rating = document.createElement("strong"); rating.textContent = formatRating(row.rating); item.append(rank, player, rating); list.append(item); });
  const detail = linkWithText(historyHref(node.year), t("history.viewDetails"), "card-action");
  article.append(heading, list, detail); return article;
}

try {
  const [manifest, history] = await Promise.all([fetchJson("data/manifest.json"), fetchJson("data/history/index.json")]);
  await hydrateShell(manifest);
  const grid = document.querySelector("#history-grid"); const search = document.querySelector("#history-search"); const count = document.querySelector("#history-count");
  const render = () => { const query = normalizeSearchText(search.value); const nodes = history.nodes.filter((node) => !query || String(node.year).includes(query) || filterRanking(node.top_ten, query).length); grid.replaceChildren(...nodes.map(historyCard)); grid.setAttribute("aria-busy", "false"); count.textContent = t("history.nodeCount", { count: nodes.length }); };
  search.addEventListener("input", render); render();
  if (history.unavailable_nodes.length) { const section = document.querySelector("#unavailable-history"); section.hidden = false; const list = document.querySelector("#unavailable-list"); list.replaceChildren(...history.unavailable_nodes.map((node) => { const item = document.createElement("li"); item.textContent = t("history.unavailable", { year: node.year }); return item; })); }
} catch (error) { setError(error); }
