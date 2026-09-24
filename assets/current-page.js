import { fetchJson, hydrateShell, setError } from "./common.js?v=caa0dbaa7e6a";
import { t } from "./i18n.js?v=caa0dbaa7e6a";
import { setupRankingPage } from "./ranking-page.js?v=caa0dbaa7e6a";

try {
  const [manifest, current] = await Promise.all([fetchJson("data/manifest.json"), fetchJson("data/current.json")]);
  await hydrateShell(manifest);
  document.querySelector("#page-summary").textContent = t("index.summary", {
    cutoffDate: current.cutoff_date,
    activeWithinDays: manifest.ranking_policy.active_within_days,
    minimumMatches: manifest.ranking_policy.minimum_matches,
    eligiblePlayers: current.eligible_players,
  });
  setupRankingPage({ rows: current.ranking, cutoffDate: current.cutoff_date });
} catch (error) { setError(error); }
