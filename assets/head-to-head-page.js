import { fetchJson, hydrateShell, linkWithText, matchupScoreCell, playerHref, setError } from "./common.js?v=9dbdaa705a0c";
import { comparisonSeriesColors, RatingChart, seriesColor } from "./chart.js?v=9dbdaa705a0c";
import { currentLocale, formatNumber, t } from "./i18n.js?v=9dbdaa705a0c";
import {
  formatRating,
  findHeadToHeadPlayers,
  frameWinProbability,
  hasPublicMatchSource,
  headToHeadRecord,
  parseBestOfList,
  publicMatchSourceUrl,
  scoreProbabilities,
} from "./state.js?v=9dbdaa705a0c";

function cell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function headerCell(text, className = "") {
  const th = document.createElement("th");
  th.scope = "col";
  th.textContent = text;
  if (className) th.className = className;
  return th;
}

function percent(value) {
  return `${formatNumber(value * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function headToHeadHref(playerAKey, playerBKey, bestOf = null) {
  const query = new URLSearchParams({ player1: playerAKey, player2: playerBKey });
  if (Number.isInteger(bestOf) && bestOf >= 1 && bestOf <= 99) {
    query.set("bestOf", bestOf);
  }
  return `head-to-head.html?${query}`;
}

function upcomingTime(value) {
  if (!value) return t("h2h.upcomingTimeTbc");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

function upcomingPlayerName(match, side) {
  if (match[`player_${side}_pending_fixture`]) return t("h2h.playerTbc");
  const name = match[`player_${side}_name`];
  return name || t("h2h.playerTbc");
}

function renderUpcoming(snapshot) {
  const widget = document.querySelector("#upcoming-widget");
  const matches = Array.isArray(snapshot.matches) ? [...snapshot.matches] : [];
  matches.sort((left, right) => {
    const leftTime = Date.parse(left.scheduled_at_utc);
    const rightTime = Date.parse(right.scheduled_at_utc);
    if (Number.isNaN(leftTime)) return Number.isNaN(rightTime) ? 0 : 1;
    if (Number.isNaN(rightTime)) return -1;
    return leftTime - rightTime;
  });
  const cards = matches.map((match) => {
    const article = document.createElement("article");
    article.className = "upcoming-card";
    const body = document.createElement(match.linkable ? "a" : "div");
    if (match.linkable) {
      body.href = headToHeadHref(match.player_a_key, match.player_b_key, match.best_of);
    } else {
      article.classList.add("is-disabled");
      body.className = "upcoming-card-body";
    }
    const time = document.createElement("time");
    time.dateTime = match.scheduled_at_utc || "";
    time.textContent = `${upcomingTime(match.scheduled_at_utc)}${match.estimated ? ` · ${t("h2h.estimated")}` : ""}`;
    const matchup = document.createElement("strong");
    matchup.className = "upcoming-matchup";
    const playerA = document.createElement("span");
    playerA.textContent = upcomingPlayerName(match, "a");
    const versus = document.createElement("b");
    versus.textContent = "VS";
    const playerB = document.createElement("span");
    playerB.textContent = upcomingPlayerName(match, "b");
    matchup.append(playerA, versus, playerB);
    const details = document.createElement("small");
    const format = match.best_of ? t("h2h.upcomingBestOf", { bestOf: match.best_of }) : "";
    details.textContent = [match.event_name, match.round_name, format, match.held_over ? t("h2h.heldOver") : "", match.linkable ? "" : t("h2h.comparisonUnavailable")].filter(Boolean).join(" · ");
    body.append(time, matchup, details);
    article.append(body);
    return article;
  });
  document.querySelector("#upcoming-list").replaceChildren(...cards);
  document.querySelector("#upcoming-count").textContent = t("h2h.upcomingCount", { count: matches.length });
  document.querySelector("#no-upcoming").hidden = matches.length !== 0;
  const source = document.querySelector("#upcoming-source");
  source.replaceChildren();
  const sourceLink = linkWithText(snapshot.source_url || "https://www.wst.tv/matches/", "WST");
  sourceLink.target = "_blank";
  sourceLink.rel = "noreferrer";
  const retrieved = snapshot.retrieved_at_utc ? upcomingTime(snapshot.retrieved_at_utc) : t("h2h.upcomingTimeTbc");
  source.append(document.createTextNode(t("h2h.upcomingSource", { retrieved })), " ", sourceLink);
  widget.hidden = false;
}

function probabilityForA(scores) {
  return scores.filter((score) => score.winner === "a").reduce((total, score) => total + score.probability, 0);
}

function probabilityFor(scores, winner) {
  return scores.filter((score) => score.winner === winner).reduce((total, score) => total + score.probability, 0);
}

class PlayerPicker {
  constructor(input, results, players) {
    this.input = input;
    this.results = results;
    this.players = players;
    this.selected = null;
    this.matches = [];
    this.activeIndex = -1;
    input.addEventListener("focus", () => {
      if (this.selected) input.select();
      this.render(this.selected ? "" : input.value);
    });
    input.addEventListener("input", () => {
      this.selected = null;
      this.render(input.value, 0);
    });
    input.addEventListener("keydown", (event) => this.onKeyDown(event));
    results.addEventListener("click", (event) => {
      const option = event.target.closest("[data-player-key]");
      if (option) this.choose(option.dataset.playerKey);
    });
    document.addEventListener("click", (event) => {
      if (!input.contains(event.target) && !results.contains(event.target)) this.close();
    });
  }

  get key() {
    return this.selected?.player_key || "";
  }

  setKey(key) {
    const player = this.players.find((item) => item.player_key === key);
    if (player) this.choose(player.player_key);
  }

  choose(key) {
    const player = this.players.find((item) => item.player_key === key);
    if (!player) return;
    this.selected = player;
    this.input.value = player.name;
    this.close();
  }

  close() {
    this.results.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.activeIndex = -1;
  }

  setActive(index) {
    if (!this.matches.length) return;
    this.activeIndex = Math.min(Math.max(index, 0), this.matches.length - 1);
    const options = [...this.results.querySelectorAll("[role=option]")];
    options.forEach((option, optionIndex) => {
      const isActive = optionIndex === this.activeIndex;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-selected", String(isActive));
    });
    const active = options[this.activeIndex];
    if (active) {
      this.input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  }

  render(query, activeIndex = -1) {
    this.matches = findHeadToHeadPlayers(this.players, query);
    if (!this.matches.length) {
      const empty = document.createElement("p");
      empty.textContent = t("h2h.noPlayerResults");
      this.results.replaceChildren(empty);
    } else {
      this.results.replaceChildren(...this.matches.map((player, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.id = `${this.results.id}-option-${index}`;
        button.dataset.playerKey = player.player_key;
        button.setAttribute("role", "option");
        const name = document.createElement("strong");
        name.textContent = player.name;
        const details = document.createElement("small");
        details.textContent = `${player.nationality} · ${playerActivityLabel(player)} · ${formatRating(player.rating)}`;
        button.append(name, details);
        return button;
      }));
    }
    this.results.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    if (activeIndex >= 0) this.setActive(activeIndex);
  }

  onKeyDown(event) {
    if (event.key === "Escape") {
      this.close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (this.results.hidden) this.render(this.selected ? "" : this.input.value);
      this.setActive(this.activeIndex + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key === "Enter" && !this.results.hidden && this.activeIndex >= 0) {
      event.preventDefault();
      this.choose(this.matches[this.activeIndex].player_key);
    }
  }
}

function playerActivityLabel(player) {
  return Number.isInteger(player.active_rank)
    ? t("player.activeRank", { rank: player.active_rank })
    : t("player.inactive");
}

function playerCard(profile, color = seriesColor(profile.player_key)) {
  const article = document.createElement("article");
  const swatch = document.createElement("span");
  swatch.className = "h2h-player-swatch";
  swatch.style.backgroundColor = color;
  const heading = document.createElement("h3");
  heading.append(linkWithText(playerHref(profile.player_key), profile.name));
  const rating = document.createElement("strong");
  rating.textContent = formatRating(profile.current_rating);
  const detail = document.createElement("small");
  detail.textContent = `${profile.nationality} · ${playerActivityLabel(profile)}`;
  article.append(swatch, heading, rating, detail);
  return article;
}

const chart = new RatingChart(document.querySelector("#rating-chart"));
let chartSeries = [];
let chartYears = 10;
let selectedProfiles = null;
let bestOf = 9;
let requestNumber = 0;

function renderChart() {
  if (chartSeries.length) chart.render(chartSeries, { years: chartYears, height: 510 });
}

function comparisonColors(profileA, profileB) {
  return comparisonSeriesColors(profileA.player_key, profileB.player_key);
}

function legendItem(name, wins, total, color, side) {
  const item = document.createElement("li");
  item.className = `ring-legend-${side}`;
  const swatch = document.createElement("span");
  swatch.className = "ring-legend-swatch";
  swatch.style.backgroundColor = color;
  const label = document.createElement("span");
  label.textContent = name;
  const value = document.createElement("strong");
  value.textContent = `${formatNumber(wins)} · ${total ? percent(wins / total) : "—"}`;
  item.append(swatch, label, value);
  return item;
}

function ringCard(title, total, winsA, winsB, draws, profileA, profileB) {
  const [colorA, colorB] = comparisonColors(profileA, profileB);
  const article = document.createElement("article");
  article.className = "h2h-ring-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const ring = document.createElement("div");
  ring.className = "h2h-ring";
  const shareA = total ? winsA / total * 100 : 0;
  const shareB = total ? winsB / total * 100 : 0;
  const shareDraw = total ? draws / total * 100 : 0;
  const drawEnd = shareB + shareDraw;
  const aEnd = drawEnd + shareA;
  ring.style.background = total
    ? `conic-gradient(from 0deg, ${colorB} 0 ${shareB}%, #c9c7be ${shareB}% ${drawEnd}%, ${colorA} ${drawEnd}% ${aEnd}%)`
    : "#dedbd1";
  ring.setAttribute("role", "img");
  ring.setAttribute("aria-label", `${title}: ${profileA.name} ${winsA}, ${profileB.name} ${winsB}`);
  const center = document.createElement("span");
  center.className = "h2h-ring-center";
  const totalValue = document.createElement("strong");
  totalValue.textContent = formatNumber(total);
  const totalLabel = document.createElement("small");
  totalLabel.textContent = t("h2h.total");
  center.append(totalValue, totalLabel);
  ring.append(center);
  const legend = document.createElement("ul");
  legend.className = "ring-legend";
  legend.append(legendItem(profileA.name, winsA, total, colorA, "left"), legendItem(profileB.name, winsB, total, colorB, "right"));
  if (draws) legend.append(legendItem(t("player.draw"), draws, total, "#c9c7be", "draw"));
  article.append(heading, ring, legend);
  return article;
}

function renderActual(detailA, profileB) {
  const profileA = detailA.profile;
  const record = headToHeadRecord(detailA.matches, profileB.player_key);
  document.querySelector("#actual-rings").replaceChildren(
    ringCard(t("h2h.matchesPlayed"), record.matches, record.match_wins_a, record.match_wins_b, record.match_draws, profileA, profileB),
    ringCard(t("h2h.framesPlayed"), record.frames, record.frame_wins_a, record.frame_wins_b, 0, profileA, profileB),
  );
  return detailA.matches.filter((match) => match.opponent_key === profileB.player_key);
}

function scoreCard(bestOf, scores, profileA, profileB) {
  const article = document.createElement("article");
  article.className = "score-probability-card";
  const heading = document.createElement("h3");
  heading.textContent = t("h2h.scoreRanking", { bestOf });
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-scroll score-table-scroll";
  const table = document.createElement("table");
  table.className = "score-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(headerCell(t("h2h.rank")), headerCell(t("h2h.score"), "score-matchup-heading"), headerCell(t("h2h.probability"), "numeric"));
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  tbody.append(...scores.map((score, index) => {
    const row = document.createElement("tr");
    row.append(cell(formatNumber(index + 1)), matchupScoreCell(profileA.name, score.score_a, score.score_b, profileB.name), cell(percent(score.probability), "numeric"));
    return row;
  }));
  table.append(thead, tbody);
  tableWrap.append(table);
  article.append(heading, tableWrap);
  return article;
}

function probabilityFeature(title, probabilityA, profileA, profileB, drawProbability = null) {
  const [colorA, colorB] = comparisonColors(profileA, profileB);
  const hasDraw = drawProbability !== null;
  const resolvedDrawProbability = drawProbability ?? 0;
  const probabilityB = Math.max(0, 1 - probabilityA - resolvedDrawProbability);
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const sides = document.createElement("div");
  sides.className = "probability-sides";
  const side = (profile, probability, color) => {
    const item = document.createElement("article");
    const name = document.createElement("span");
    name.textContent = profile.name;
    const value = document.createElement("strong");
    value.textContent = percent(probability);
    value.style.color = color;
    item.append(name, value);
    return item;
  };
  sides.append(side(profileA, probabilityA, colorA));
  if (hasDraw) {
    const draw = side({ name: t("player.draw") }, resolvedDrawProbability, "#77746c");
    draw.className = "probability-draw";
    sides.classList.add("has-draw");
    sides.append(draw);
  }
  sides.append(side(profileB, probabilityB, colorB));
  const track = document.createElement("div");
  track.className = "probability-track";
  const segmentA = document.createElement("span");
  segmentA.style.width = `${probabilityA * 100}%`;
  segmentA.style.backgroundColor = colorA;
  if (hasDraw) {
    const drawSegment = document.createElement("span");
    drawSegment.style.width = `${resolvedDrawProbability * 100}%`;
    drawSegment.style.backgroundColor = "#a9a69d";
    track.append(segmentA, drawSegment);
  } else track.append(segmentA);
  const segmentB = document.createElement("span");
  segmentB.style.width = `${probabilityB * 100}%`;
  segmentB.style.backgroundColor = colorB;
  track.append(segmentB);
  section.append(heading, sides, track);
  return section;
}

function renderPredictions() {
  if (!selectedProfiles) return;
  const [profileA, profileB] = selectedProfiles;
  const frameProbabilityA = frameWinProbability(profileA.current_rating, profileB.current_rating);
  const scores = scoreProbabilities(frameProbabilityA, bestOf);
  const matchProbabilityA = probabilityForA(scores);
  const drawProbability = probabilityFor(scores, "draw");
  document.querySelector("#frame-prediction").replaceChildren(probabilityFeature(t("h2h.singleFramePrediction"), frameProbabilityA, profileA, profileB));
  document.querySelector("#bo-prediction").replaceChildren(probabilityFeature(t("h2h.bestOfPrediction", { bestOf }), matchProbabilityA, profileA, profileB, bestOf % 2 === 0 ? drawProbability : null));
  document.querySelector("#score-probability-grid").replaceChildren(scoreCard(bestOf, scores, profileA, profileB));
}

function renderMeetings(meetings, profileA, profileB) {
  const body = document.querySelector("#meeting-body");
  body.replaceChildren(...meetings.map((match) => {
    const row = document.createElement("tr");
    const tournament = document.createElement("td");
    const name = document.createElement("strong");
    name.textContent = match.tournament_name;
    const stage = document.createElement("small");
    stage.textContent = match.stage;
    tournament.append(name, stage);
    const winner = match.result === "win" ? profileA.name : match.result === "loss" ? profileB.name : t("player.draw");
    const source = document.createElement("td");
    const sourceUrl = publicMatchSourceUrl(match);
    if (sourceUrl) {
      const link = linkWithText(sourceUrl, `#${match.match_id} ↗`);
      link.target = "_blank";
      link.rel = "noreferrer";
      source.append(link);
    } else if (hasPublicMatchSource(match)) source.textContent = `#${match.match_id}`;
    const playedOn = match.date_quality === "tournament_end" ? t("player.tournamentEnd", { date: match.played_on }) : match.played_on;
    row.append(cell(playedOn), tournament, cell(winner, "match-result"), matchupScoreCell(profileA.name, match.score_for, match.score_against, profileB.name), source);
    return row;
  }));
  document.querySelector("#meeting-count").textContent = t("h2h.meetingCount", { count: meetings.length });
  document.querySelector("#no-meetings").hidden = meetings.length !== 0;
}

async function compare(playerAKey, playerBKey) {
  const selectionError = document.querySelector("#h2h-selection-error");
  if (!playerAKey || !playerBKey || playerAKey === playerBKey) {
    selectionError.textContent = t(playerAKey && playerAKey === playerBKey ? "h2h.samePlayerError" : "h2h.chooseBothError");
    selectionError.hidden = false;
    return;
  }
  selectionError.hidden = true;
  document.querySelector("#upcoming-widget").hidden = true;
  const currentRequest = ++requestNumber;
  const content = document.querySelector("#comparison-content");
  content.hidden = true;
  try {
    const [detailA, detailB, curveA, curveB] = await Promise.all([
      fetchJson(`data/players/${encodeURIComponent(playerAKey)}.json`),
      fetchJson(`data/players/${encodeURIComponent(playerBKey)}.json`),
      fetchJson(`data/curves/${encodeURIComponent(playerAKey)}.json`),
      fetchJson(`data/curves/${encodeURIComponent(playerBKey)}.json`),
    ]);
    if (currentRequest !== requestNumber) return;
    const profileA = detailA.profile;
    const profileB = detailB.profile;
    const [colorA, colorB] = comparisonColors(profileA, profileB);
    selectedProfiles = [profileA, profileB];
    chartSeries = [
      { player_key: playerAKey, name: profileA.name, points: curveA.points, color: colorA },
      { player_key: playerBKey, name: profileB.name, points: curveB.points, color: colorB },
    ];
    document.title = t("h2h.dynamicTitle", { playerA: profileA.name, playerB: profileB.name });
    document.querySelector("#h2h-player-cards").replaceChildren(playerCard(profileA, colorA), playerCard(profileB, colorB));
    const meetings = renderActual(detailA, profileB);
    renderPredictions();
    renderMeetings(meetings, profileA, profileB);
    content.hidden = false;
    renderChart();
    const url = new URL(window.location.href);
    url.searchParams.set("player1", playerAKey);
    url.searchParams.set("player2", playerBKey);
    window.history.replaceState(null, "", url);
  } catch (error) {
    setError(error);
  }
}

try {
  const [manifest, playerIndex] = await Promise.all([fetchJson("data/manifest.json"), fetchJson("data/players/index.json")]);
  await hydrateShell(manifest);
  const playerAPicker = new PlayerPicker(document.querySelector("#h2h-player-a"), document.querySelector("#h2h-results-a"), playerIndex.players);
  const playerBPicker = new PlayerPicker(document.querySelector("#h2h-player-b"), document.querySelector("#h2h-results-b"), playerIndex.players);
  const query = new URLSearchParams(window.location.search);
  const playerAKey = query.get("player1") || "";
  const playerBKey = query.get("player2") || "";
  const requestedBestOf = parseBestOfList(query.get("bestOf") || "");
  if (requestedBestOf.length === 1) {
    [bestOf] = requestedBestOf;
    document.querySelector("#best-of-input").value = bestOf;
  }
  playerAPicker.setKey(playerAKey);
  playerBPicker.setKey(playerBKey);
  const hasComparison = Boolean(playerAPicker.key && playerBPicker.key && playerAPicker.key !== playerBPicker.key);
  if (hasComparison) {
    document.querySelector("#upcoming-widget").hidden = true;
  } else {
    renderUpcoming(await fetchJson("data/upcoming.json"));
  }
  document.querySelector("#h2h-form").addEventListener("submit", (event) => {
    event.preventDefault();
    compare(playerAPicker.key, playerBPicker.key);
  });
  document.querySelector("#best-of-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const error = document.querySelector("#best-of-error");
    const parsed = parseBestOfList(document.querySelector("#best-of-input").value);
    if (parsed.length !== 1) {
      error.textContent = t("h2h.bestOfError");
      error.hidden = false;
      return;
    }
    error.hidden = true;
    [bestOf] = parsed;
    const url = new URL(window.location.href);
    url.searchParams.set("bestOf", bestOf);
    window.history.replaceState(null, "", url);
    renderPredictions();
  });
  document.querySelectorAll("#range-switcher [data-years]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("#range-switcher button").forEach((item) => item.classList.toggle("is-active", item === button));
    chartYears = button.dataset.years === "all" ? null : Number(button.dataset.years);
    renderChart();
  }));
  window.addEventListener("resize", () => {
    window.clearTimeout(window.__h2hResize);
    window.__h2hResize = window.setTimeout(renderChart, 120);
  });
  if (hasComparison) await compare(playerAPicker.key, playerBPicker.key);
} catch (error) {
  setError(error);
}
