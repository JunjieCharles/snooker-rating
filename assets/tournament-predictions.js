import { currentLocale, t } from "./i18n.js?v=5427d62e11e3";
import { setPlayerName } from "./player-display.js?v=5427d62e11e3";
import { filterRanking } from "./state.js?v=5427d62e11e3";

export async function loadTournamentPredictions(fetcher, manifest) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const snapshot = await fetcher("data/tournament-predictions.json",
        { cache: attempt ? "reload" : "default" });
      if (!snapshot || typeof snapshot !== "object" || !snapshot.run_id
          || !["available", "unavailable"].includes(snapshot.availability)) {
        throw new Error("Invalid prediction document");
      }
      if (snapshot.run_id === manifest?.run?.run_id) return snapshot;
      if (attempt) return { availability: "unavailable", reason: "version_mismatch" };
    } catch {
      if (attempt) return { availability: "unavailable", reason: "load_failed" };
    }
  }
}

export function predictionMessage(snapshot, manifest) {
  if (!snapshot || snapshot.reason === "load_failed") return "tournament.loadFailed";
  if (snapshot.reason === "version_mismatch" || snapshot.run_id !== manifest?.run?.run_id) {
    return "tournament.versionMismatch";
  }
  return "tournament.unavailable";
}

export function sortTournamentRows(rows, column, direction = "desc", locale = "zh-CN") {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (column === "benefit") {
      const av = a.draw_benefit_pp, bv = b.draw_benefit_pp;
      if (Number.isFinite(av) !== Number.isFinite(bv)) return Number.isFinite(av) ? -1 : 1;
    }
    const compared = column === "name" ? a.name.localeCompare(b.name, locale)
      : column === "benefit" ? (a.draw_benefit_pp ?? 0) - (b.draw_benefit_pp ?? 0)
        : a.probabilities[column] - b.probabilities[column];
    return sign * compared || String(a.player_id || a.player_key || a.name)
      .localeCompare(String(b.player_id || b.player_key || b.name), "en");
  });
}

export function formatDrawBenefit(value) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0.00";
  return `${value > 0 ? "+" : "−"}${Math.abs(value) < .005 ? "<0.01" : Math.abs(value).toFixed(2)}`;
}

export function formatTournamentProbability(value, reached, qualifiedLabel = "Qualified") {
  if (!Number.isFinite(value) || value < 0 || value > 1) return "—";
  if (reached) return qualifiedLabel;
  if (value === 0) return "0%";
  if (value < 0.0001) return "<0.01%";
  // A rounded forecast must never masquerade as confirmed advancement.
  if (value >= 0.99995) return ">99.99%";
  return `${(value * 100).toFixed(2)}%`;
}

export function renderTournamentPredictions(container, snapshot, manifest) {
  container.replaceChildren();
  container.hidden = false;
  const heading = document.createElement("h2");
  heading.id = "tournament-predictions-heading";
  heading.textContent = t("tournament.heading");
  const headingRow = document.createElement("div");
  headingRow.className = "upcoming-widget-heading";
  const headingText = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "TOURNAMENT";
  headingText.append(eyebrow, heading);
  const count = document.createElement("span");
  count.className = "result-count";
  count.setAttribute("aria-live", "polite");
  headingRow.append(headingText, count);
  container.append(headingRow);
  if (snapshot?.availability !== "available" || snapshot.run_id !== manifest?.run?.run_id) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = t(predictionMessage(snapshot, manifest));
    container.append(message);
    return;
  }
  const subtitle = document.createElement("p");
  subtitle.className = "upcoming-introduction";
  subtitle.textContent = t("tournament.summary", {
    event: snapshot.event_name, cutoff: snapshot.rating_cutoff, count: snapshot.rows.length,
  });
  const note = document.createElement("p");
  note.className = "chart-note";
  note.textContent = t("tournament.policy");
  const tools = document.createElement("div");
  tools.className = "table-tools tournament-tools";
  const searchLabel = document.createElement("label");
  const searchText = document.createElement("span");
  searchText.className = "sr-only";
  searchText.textContent = t("tournament.search");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = t("tournament.search");
  search.value = "";
  searchLabel.append(searchText, search);
  tools.append(searchLabel);
  const status = document.createElement("p");
  status.className = "tournament-sort-status";
  status.setAttribute("aria-live", "polite");
  const scroll = document.createElement("div");
  scroll.className = "table-scroll tournament-table-scroll";
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", t("tournament.heading"));
  const table = document.createElement("table");
  table.className = "tournament-table";
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  let sortColumn = snapshot.columns.length - 1;
  let direction = "desc";
  const headers = [];
  const labels = [t("ranking.player"), ...snapshot.columns.map((n) => t(`tournament.round${n}`)), t("tournament.benefitColumn")];
  for (const [index, label] of labels.entries()) {
    const th = document.createElement("th");
    th.scope = "col";
    const button = document.createElement("button");
    button.type = "button";
    const column = index === 0 ? "name" : index === labels.length - 1 ? "benefit" : index - 1;
    button.addEventListener("click", () => {
      direction = sortColumn === column ? (direction === "desc" ? "asc" : "desc")
        : column === "name" ? "asc" : "desc";
      sortColumn = column;
      renderRows();
    });
    th.append(button);
    headers.push({ th, button, label, column });
    header.append(th);
  }
  head.append(header);
  const body = document.createElement("tbody");
  function renderRows() {
    const filtered = filterRanking(snapshot.rows, search.value);
    const visibleRows = sortTournamentRows(filtered, sortColumn, direction, currentLocale());
    count.textContent = t("tournament.count", { count: visibleRows.length, total: snapshot.rows.length });
    for (const { th, button, label, column } of headers) {
      const selected = column === sortColumn;
      th.setAttribute("aria-sort", selected ? (direction === "desc" ? "descending" : "ascending") : "none");
      button.textContent = `${label} ${selected ? (direction === "desc" ? "↓" : "↑") : "↕"}`;
      button.setAttribute("aria-label", t("tournament.sortBy", { column: label }));
    }
    status.textContent = t("tournament.sortStatus", {
      column: headers.find((h) => h.column === sortColumn).label,
      direction: t(direction === "desc" ? "tournament.desc" : "tournament.asc"),
    });
    body.replaceChildren();
    scroll.scrollTop = 0;
    for (const player of visibleRows) {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.className = "tournament-player-cell";
      const name = document.createElement(player.player_key ? "a" : "span");
      if (player.player_key) name.href = `player.html?player=${encodeURIComponent(player.player_key)}`;
      setPlayerName(name, player);
      name.className = "player-link";
      nameCell.append(name);
      if (player.provisional) nameCell.append(" †");
      row.append(nameCell);
      player.probabilities.forEach((value, i) => {
        const cell = document.createElement("td");
        const reached = player.reached[i];
        const text = formatTournamentProbability(value, reached,
          t(snapshot.columns[i] === 1 ? "tournament.won" : "tournament.qualified"));
        cell.className = "numeric";
        if (reached) {
          const badge = document.createElement("span");
          badge.className = "is-qualified";
          badge.textContent = `✓ ${text}`;
          cell.append(badge);
        } else {
          cell.textContent = text;
        }
        row.append(cell);
      });
      const benefit = document.createElement("td");
      const value = player.draw_benefit_pp;
      benefit.className = `numeric draw-benefit${Number.isFinite(value) && value !== 0 ? (value > 0 ? " positive" : " negative") : ""}`;
      benefit.textContent = formatDrawBenefit(value);
      if (Number.isFinite(player.random_champion_probability) && Number.isFinite(player.random_standard_error_pp)) {
        benefit.title = t("tournament.benefitDetail", {
          baseline: (100 * player.random_champion_probability).toFixed(2),
          error: player.random_standard_error_pp.toFixed(3),
        });
      }
      row.append(benefit);
      body.append(row);
    }
    if (!visibleRows.length) {
      const row = document.createElement("tr");
      const empty = document.createElement("td");
      empty.colSpan = snapshot.columns.length + 2;
      empty.className = "empty-state";
      empty.textContent = t("tournament.noResults");
      row.append(empty);
      body.append(row);
    }
  }
  search.addEventListener("input", renderRows);
  renderRows();
  table.append(head, body);
  scroll.append(table);
  const details = document.createElement("details");
  details.className = "tournament-method";
  const summary = document.createElement("summary");
  summary.textContent = t("tournament.method");
  details.append(summary, note);
  const benefitNote = document.createElement("p");
  benefitNote.className = "chart-note";
  benefitNote.textContent = t("tournament.benefitPolicy", { trials: snapshot.draw_benefit?.trials ?? 3000000 });
  details.append(benefitNote);
  if (snapshot.draw_benefit?.availability !== "available") {
    const unavailable = document.createElement("p");
    unavailable.className = "chart-note";
    unavailable.textContent = t("tournament.benefitUnavailable");
    details.append(unavailable);
  }
  container.append(subtitle, tools, status, scroll, details);
  if (snapshot.rows.some((r) => r.provisional)) {
    const prior = document.createElement("p");
    prior.className = "chart-note";
    prior.textContent = t("tournament.prior");
    container.append(prior);
  }
  const source = document.createElement("p");
  source.className = "upcoming-source";
  const link = document.createElement("a");
  link.textContent = t("tournament.drawSource");
  if (/^https:\/\//.test(snapshot.source_url)) link.href = snapshot.source_url;
  source.append(link, ` · ${t("tournament.drawVersion", { version: snapshot.draw_version })}`);
  container.append(source);
}
