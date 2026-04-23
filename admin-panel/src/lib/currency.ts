export type Currency = "UZS" | "USD" | "RUB";

const SYMBOL: Record<Currency, string> = {
  UZS: "so'm",
  USD: "$",
  RUB: "₽",
};

const PREFIX: Record<Currency, boolean> = {
  UZS: false,
  USD: true,
  RUB: false,
};

/**
 * Format a price for display in the admin panel.
 * Drops decimals for zero-fraction numbers and uses space as thousands sep
 * (e.g. "55 000 so'm", "$10.50", "350 ₽").
 */
export function formatPrice(
  amount: number | string | null | undefined,
  currency: Currency | string = "USD",
): string {
  if (amount == null || amount === "") return "";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "";

  const hasFraction = n % 1 !== 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })
    .format(n)
    .replace(/,/g, " ");

  const cur = (currency as Currency) in SYMBOL ? (currency as Currency) : "USD";
  const sym = SYMBOL[cur];
  return PREFIX[cur] ? `${sym}${formatted}` : `${formatted} ${sym}`;
}

export function currencySymbol(currency: Currency | string = "USD"): string {
  return currency in SYMBOL ? SYMBOL[currency as Currency] : String(currency);
}
