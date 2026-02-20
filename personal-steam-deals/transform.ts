/**
 * CheapShark store ID → store name.
 * @see Stores Info endpoint https://apidocs.cheapshark.com/
 */
const STORE_NAMES: Record<string, string> = {
  "1": "Steam",
  "2": "GamersGate",
  "3": "GreenManGaming",
  "4": "Amazon",
  "5": "GameStop",
  "6": "Direct2Drive",
  "7": "GOG",
  "8": "Origin",
  "9": "Get Games",
  "10": "Shiny Loot",
  "11": "Humble Store",
  "12": "Desura",
  "13": "Uplay",
  "14": "IndieGameStand",
  "15": "Fanatical",
  "16": "Gamesrocket",
  "17": "Games Republic",
  "18": "SilaGames",
  "19": "Playfield",
  "20": "ImperialGames",
  "21": "WinGameStore",
  "22": "FunStockDigital",
  "23": "GameBillet",
  "24": "Voidu",
  "25": "Epic Games Store",
  "26": "Razer Game Store",
  "27": "Gamesplanet",
  "28": "Gamesload",
  "29": "2Game",
  "30": "IndieGala",
  "31": "Blizzard Shop",
  "32": "AllYouPlay",
  "33": "DLGamer",
  "34": "Noctre",
  "35": "DreamGame",
};

/** CheapShark store icon base URL; icon path is /img/stores/icons/{index}.png (index = storeID - 1) */
const CHEAPSHARK_ICON_BASE = "https://www.cheapshark.com/img/stores/icons";

/** Raw deal from CheapShark API (IDX_0.data items) */
interface RawDeal {
  dealID: string;
  storeID: string;
  steamAppID: string;
  gameID: string;
  title: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  dealRating: string;
  metacriticScore: string;
  steamRatingPercent: string;
  steamRatingCount: string;
  steamRatingText: string;
  releaseDate: number;
  lastChange: number;
  thumb: string;
  internalName: string;
}

/** Normalized deal (camelCase keys) */
interface NormalizedDeal {
  dealId: string;
  storeId: string;
  storeName: string;
  storeIconUrl: string;
  steamAppId: string;
  gameId: string;
  title: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  dealRating: string;
  metacriticScore: string;
  steamRatingPercent: string;
  steamRatingCount: string;
  steamRatingText: string;
  releaseDate: number;
  lastChange: number;
  thumb: string;
  internalName: string;
}

/** Steam GetOwnedGames response game item */
interface SteamGame {
  appid: number;
}

/** Plugin custom field values from settings */
interface PluginCustomFields {
  min_savings?: string | number;
  min_deal_rating?: string | number;
  wishlist_only?: boolean;
}

/** Steam GetWishlist response: uses response.items[] with { appid } objects */
interface SteamWishlistResponse {
  response?: {
    items?: Array<{ appid?: number }>;
    rgWishlist?: number[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Transform input: IDX_0 = CheapShark deals, IDX_1 = Steam GetOwnedGames, IDX_2 = Steam GetWishlist */
interface TransformInput {
  IDX_0?: { data?: RawDeal[] };
  IDX_1?: { response?: { games?: SteamGame[] } };
  IDX_2?: SteamWishlistResponse;
  trmnl?: {
    plugin_settings?: {
      custom_fields_values?: PluginCustomFields;
    };
  };
}

/** Transform output */
interface TransformOutput {
  dealInfo: NormalizedDeal | null;
  totalDeals: number;
  filteredCount: number;
  ownedCount: number;
  wishlistCount: number;
}

function parseWishlistAppIdsFromApi(apiResponse: SteamWishlistResponse | undefined): number[] {
  if (!apiResponse?.response || typeof apiResponse.response !== "object") return [];
  const r = apiResponse.response as Record<string, unknown>;
  // IWishlistService/GetWishlist returns response.items with { appid, priority, date_added }
  if (Array.isArray(r.items)) {
    return r.items
      .map((item) => (item && typeof item === "object" && "appid" in item ? (item as { appid: number }).appid : NaN))
      .filter((n): n is number => typeof n === "number" && Number.isInteger(n));
  }
  if (Array.isArray(r.rgWishlist)) {
    return r.rgWishlist.filter((n): n is number => typeof n === "number" && Number.isInteger(n));
  }
  for (const key of Object.keys(r)) {
    const val = r[key];
    if (Array.isArray(val) && val.every((n) => typeof n === "number")) {
      return val as number[];
    }
  }
  return [];
}

function transform(input: TransformInput): TransformOutput {
  const rawDeals = Array.isArray(input.IDX_0?.data) ? input.IDX_0.data : [];
  const steamResponse = input.IDX_1?.response ?? {};
  const wishlistAppIds = new Set<number>(parseWishlistAppIdsFromApi(input.IDX_2));
  const games = Array.isArray(steamResponse.games) ? steamResponse.games : [];
  const ownedAppIds = new Set(games.map((g) => g.appid));

  const vals = input.trmnl?.plugin_settings?.custom_fields_values;
  let minSaving = 0;
  let minDealRating = 0;
  let wishlistOnly = false;

  if (vals) {
    minSaving = Number(vals.min_savings) || 0;
    minDealRating = Number(vals.min_deal_rating) || 0;
    wishlistOnly = Boolean(vals.wishlist_only);
  }

  function normalizeDeal(raw: RawDeal): NormalizedDeal {
    const storeIdNum = parseInt(raw.storeID, 10) || 0;
    const iconIndex = Math.max(0, storeIdNum - 1);
    return {
      dealId: raw.dealID,
      storeId: raw.storeID,
      storeName: STORE_NAMES[raw.storeID] ?? `Store ${raw.storeID}`,
      storeIconUrl: `${CHEAPSHARK_ICON_BASE}/${iconIndex}.png`,
      steamAppId: raw.steamAppID,
      gameId: raw.gameID,
      title: raw.title,
      salePrice: raw.salePrice,
      normalPrice: raw.normalPrice,
      savings: raw.savings,
      dealRating: raw.dealRating,
      metacriticScore: raw.metacriticScore,
      steamRatingPercent: raw.steamRatingPercent,
      steamRatingCount: raw.steamRatingCount,
      steamRatingText: raw.steamRatingText,
      releaseDate: raw.releaseDate,
      lastChange: raw.lastChange,
      thumb: raw.thumb,
      internalName: raw.internalName
    };
  }

  const deals = rawDeals.map(normalizeDeal);
  const filtered = deals.filter((d) => {
    const savings = parseFloat(String(d.savings)) || 0;
    const rating = parseFloat(String(d.dealRating)) || 0;
    const appId = parseInt(String(d.steamAppId), 10);
    const passesSavingsAndRating = savings >= minSaving && rating >= minDealRating;
    if (wishlistOnly) {
      return passesSavingsAndRating && wishlistAppIds.has(appId);
    }
    const notOwned = !ownedAppIds.has(appId);
    return passesSavingsAndRating && notOwned;
  });

  let dealInfo: NormalizedDeal | null = null;
  if (filtered.length > 0) {
    dealInfo = filtered[Math.floor(Math.random() * filtered.length)];
  }

  return {
    dealInfo,
    totalDeals: deals.length,
    filteredCount: filtered.length,
    ownedCount: ownedAppIds.size,
    wishlistCount: wishlistAppIds.size
  };
}