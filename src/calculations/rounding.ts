import Decimal from 'decimal.js';
Decimal.set({ precision: 48 });
export const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const grouping = new Intl.NumberFormat('en-IN');
export function formatINR(value: Decimal.Value) {
  const rounded = money(value);
  const [whole, paise] = rounded.abs().toFixed(2).split('.');
  return `${rounded.lt(0) ? '-' : ''}₹${grouping.format(BigInt(whole))}.${paise}`;
}
