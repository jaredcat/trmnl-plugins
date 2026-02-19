# [Personal Steam Deals](https://trmnl.com/recipes/246965)

A [TRMNL](https://trmnl.com?ref=krylic) plugin that shows **personalized Steam deals you don’t already own**.

It fetches deals from [CheapShark](https://www.cheapshark.com) and filters them using your Steam library (via the Steam Web API), then displays a random qualifying deal.

Originally forked from the [Steam Deals of the Day](https://trmnl.com/recipes/18131) recipe.

## Requirements

- **Steam API Key** — from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
- **Steam ID** — your 17-digit Steam ID (e.g. from [steamid.io](https://steamid.io)); profile and game details must be public

## How it works

1. **Polling** — The plugin calls two URLs on each refresh:
   - **CheapShark Deals API** — Deals filtered by store, price, Metacritic, Steam rating, etc. (see settings).
   - **Steam GetOwnedGames** — Your owned games list (using your API key and Steam ID).

2. **Transform** — `transform.ts` (compiled to `transform.js` in build):
   - Normalizes deal data and maps store IDs to names.
   - Filters out any deal whose Steam App ID is in your owned games.
   - Applies optional **Min Discount %** and **Min Deal Rating** from plugin settings.
   - Picks one random deal from the filtered list for display.

## Settings (custom fields)

Defined in `settings.yml`; key options:

| Setting | Description |
|--------|-------------|
| Steam API Key / Steam ID | Required for owned-games filtering. |
| Store IDs | Comma-separated CheapShark store IDs (default `1,3,11,15` = Steam, GreenManGaming, Humble, Fanatical). [Full list](https://apidocs.cheapshark.com/#a2620d3f-683e-0396-61e7-3fe4d30ea376). |
| Max Deal Age, Upper/Lower Price | Time and price filters for the CheapShark request. |
| Min Metacritic / Min Steam Rating / Min Review Count | Quality filters (CheapShark API). |
| AAA Only | Only deals with retail price &gt; $29. |
| Sort By / Sort Descending | Order of deals from the API. |
| Min Discount % / Min Deal Rating | Applied in the transform after fetch; deals below these are dropped. |

More detail is in the [CheapShark API docs](https://apidocs.cheapshark.com/#b9b738bf-2916-2a13-e40d-d05bccdce2ba).