import { fetchJson, linkWithText, playerHref } from "./common.js?v=9dbdaa705a0c";
import { RatingChart, widgetSeriesColors } from "./chart.js?v=9dbdaa705a0c";
import { t } from "./i18n.js?v=9dbdaa705a0c";
import { filterRanking, formatRating, pageRows, sortRows, toggleSelection } from "./state.js?v=9dbdaa705a0c";

function tableCell(text, className = "") { const cell = document.createElement("td"); cell.textContent = text; if (className) cell.className = className; return cell; }

function renderPagination(root, page, pages, onPage) {
  root.replaceChildren();
  const previous = document.createElement("button"); previous.type = "button"; previous.textContent = t("common.previous"); previous.disabled = page <= 1; previous.addEventListener("click", () => onPage(page - 1));
  const label = document.createElement("span"); label.textContent = t("common.page", { page, pages });
  const next = document.createElement("button"); next.type = "button"; next.textContent = t("common.next"); next.disabled = page >= pages; next.addEventListener("click", () => onPage(page + 1));
  root.append(previous, label, next);
}

export function setupRankingPage({ rows, cutoffDate, endSequence = null }) {
  const body = document.querySelector("#ranking-body");
  const count = document.querySelector("#ranking-count");
  const pagination = document.querySelector("#ranking-pagination");
  const search = document.querySelector("#ranking-search");
  const selectedRoot = document.querySelector("#selected-players");
  const selectionCount = document.querySelector("#selection-count");
  const chart = new RatingChart(document.querySelector("#rating-chart"));
  const rowByKey = new Map(rows.map((row) => [row.player_key, row]));
  const curveCache = new Map();
  const topTen = rows.slice(0, 10).map((row) => row.player_key);
  let selected = new Set(topTen);
  let sortKey = "rank";
  let sortDirection = "asc";
  let page = 1;
  let years = 10;
  let chartGeneration = 0;

  function selectionColors(keys) {
    const rankedKeys = [...keys].sort((left, right) => (rowByKey.get(left)?.rank ?? Number.POSITIVE_INFINITY) - (rowByKey.get(right)?.rank ?? Number.POSITIVE_INFINITY));
    return widgetSeriesColors(rankedKeys);
  }

  function renderTable() {
    const filtered = sortRows(filterRanking(rows, search.value), sortKey, sortDirection);
    const paged = pageRows(filtered, page); page = paged.page;
    body.replaceChildren(...paged.rows.map((row) => {
      const tr = document.createElement("tr");
      const compare = document.createElement("td"); compare.className = "compare-column";
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = selected.has(row.player_key); checkbox.setAttribute("aria-label", t("ranking.comparePlayerAria", { name: row.name }));
      checkbox.addEventListener("change", () => { selected = toggleSelection(selected, row.player_key, checkbox.checked); renderSelection(); renderTable(); }); compare.append(checkbox);
      const rank = tableCell(row.rank, "rank-cell");
      const name = document.createElement("td"); name.append(linkWithText(playerHref(row.player_key), row.name, "player-link"));
      tr.append(compare, rank, name, tableCell(row.nationality), tableCell(formatRating(row.rating), "numeric rating-cell"), tableCell(row.last_played), tableCell(row.matches, "numeric"));
      return tr;
    }));
    count.textContent = t("ranking.playerCount", { count: filtered.length });
    renderPagination(pagination, page, paged.pages, (next) => { page = next; renderTable(); body.closest(".ranking-panel").scrollIntoView({ behavior: "smooth" }); });
  }

  async function renderChart() {
    const generation = ++chartGeneration;
    const keys = [...selected];
    const colors = selectionColors(keys);
    const documents = await Promise.all(keys.map(async (key) => {
      if (!curveCache.has(key)) curveCache.set(key, fetchJson(`data/curves/${encodeURIComponent(key)}.json`));
      return curveCache.get(key);
    }));
    if (generation !== chartGeneration) return;
    chart.render(documents.map((document) => ({
      player_key: document.player_key,
      name: document.name,
      points: document.points,
      rank: rowByKey.get(document.player_key)?.rank,
      color: colors.get(document.player_key),
    })), { years, endSequence, endDate: cutoffDate });
  }

  function renderSelection() {
    const keys = [...selected];
    const colors = selectionColors(keys);
    selectionCount.textContent = t("ranking.selectedCount", { count: keys.length });
    selectedRoot.replaceChildren(...keys.map((key) => {
      const row = rowByKey.get(key); const name = row?.name || key;
      const chip = document.createElement("button"); chip.type = "button"; chip.className = "player-chip"; chip.setAttribute("aria-label", t("ranking.removePlayerAria", { name }));
      const swatch = document.createElement("span"); swatch.className = "player-chip-swatch"; swatch.style.backgroundColor = colors.get(key); swatch.setAttribute("aria-hidden", "true");
      const label = document.createElement("span"); label.textContent = name;
      const remove = document.createElement("span"); remove.className = "player-chip-remove"; remove.textContent = "×"; remove.setAttribute("aria-hidden", "true");
      chip.append(swatch, label, remove);
      chip.addEventListener("pointerenter", () => chart.focusSeries(key)); chip.addEventListener("pointerleave", () => chart.clearSeriesFocus());
      chip.addEventListener("focus", () => chart.focusSeries(key)); chip.addEventListener("blur", () => chart.clearSeriesFocus());
      chip.addEventListener("click", () => { selected.delete(key); chart.clearSeriesFocus(); renderSelection(); renderTable(); }); return chip;
    }));
    const mobile = document.querySelector("#mobile-chart-return"); if (mobile) mobile.hidden = keys.length === 0;
    renderChart().catch((error) => { document.querySelector("#rating-chart").textContent = error.message; });
  }

  search.addEventListener("input", () => { page = 1; renderTable(); });
  document.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.sort; if (sortKey === key) sortDirection = sortDirection === "asc" ? "desc" : "asc"; else { sortKey = key; sortDirection = key === "rating" || key === "matches" ? "desc" : "asc"; } renderTable(); }));
  document.querySelector("#restore-top-ten").addEventListener("click", () => { selected = new Set(topTen); renderSelection(); renderTable(); });
  document.querySelector("#clear-selection").addEventListener("click", () => { selected = new Set(); renderSelection(); renderTable(); });
  document.querySelectorAll("#range-switcher [data-years]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("#range-switcher button").forEach((item) => item.classList.toggle("is-active", item === button)); years = button.dataset.years === "all" ? null : Number(button.dataset.years); renderChart(); }));
  window.addEventListener("resize", () => { window.clearTimeout(window.__ratingResize); window.__ratingResize = window.setTimeout(renderChart, 120); });
  renderTable(); renderSelection();
  document.querySelector("#ranking-app").setAttribute("aria-busy", "false");
}
