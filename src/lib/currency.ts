/**
 * Display currency helpers. Prices are stored in USD (USDC settles in USD),
 * but the product is presented to users in Indian rupees.
 */
export const USD_TO_INR = 88;

export function usdToInr(usd: number): number {
  return (Number(usd) || 0) * USD_TO_INR;
}

/** Format a USD amount as rupees, e.g. ₹176.00 */
export function formatInr(usd: number, fractionDigits = 2): string {
  return `₹${usdToInr(usd).toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}
