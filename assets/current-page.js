import { fetchJson, hydrateShell, setError } from "./common.js?v=db9a9838728e";
import { t } from "./i18n.js?v=db9a9838728e";
import { setupRankingPage } from "./ranking-page.js?v=db9a9838728e";

try {
  const [manifest, current] = await Promise.all([fetchJson("data/manifest.json"), fetchJson("data/current.json")]);
  await hydrateShell(manifest);
  document.querySelector("#page-summary").textContent = t("index.summary", {
    cutoffDate: current.cutoff_date,
    eligiblePlayers: current.eligible_players,
  });
  setupRankingPage({ rows: current.ranking, cutoffDate: current.cutoff_date });
  const rankingSource = document.querySelector("#world-ranking-source");
  if (current.world_rankings) {
    rankingSource.textContent = t("ranking.worldRankSource", { date: current.world_rankings.retrieved_at_utc.slice(0, 10) });
    rankingSource.title = t("ranking.worldRankSnapshot", { date: current.world_rankings.retrieved_at_utc });
  } else rankingSource.hidden = true;
} catch (error) { setError(error); }
