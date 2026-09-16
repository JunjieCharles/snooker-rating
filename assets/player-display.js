// JSON keeps English names and optional, reviewed Simplified Chinese alternatives.
// Resolve them once at the loading boundary so every page uses the same policy.
const NAME_FIELDS = ["name", "opponent_name", "player_a_name", "player_b_name", "nationality", "tournament_name", "event_name"];

export function englishPlayerName(player, field = "name") {
  const english = player?.[field + "_en"];
  return typeof english === "string" && english !== player[field] ? english : "";
}

export function setPlayerName(element, player, field = "name") {
  element.textContent = player[field];
  const english = englishPlayerName(player, field);
  if (english) element.title = english;
  else element.removeAttribute("title");
  return element;
}

export function localizePlayerData(value, locale) {
  if (Array.isArray(value)) return value.map((item) => localizePlayerData(item, locale));
  if (value === null || typeof value !== "object") return value;
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, localizePlayerData(item, locale)]),
  );
  for (const field of NAME_FIELDS) {
    if (typeof value[field] !== "string" || typeof value[field + "_zh"] !== "string") continue;
    const english = value[field + "_en"] ?? value[field];
    result[field + "_en"] = english;
    result[field] = locale === "zh-CN" ? value[field + "_zh"] : english;
  }
  return result;
}
