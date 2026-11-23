import Decimal from 'decimal.js';
import type { ChargeRules } from '../config/chargeRules';
import type { TradeInput } from '../types';
import { calculateTrade } from './charges';

export function breakEvenPrice(input: Omit<TradeInput, 'side'>, buyCost: Decimal, rules: ChargeRules, tickSize: string) {
  const tick = new Decimal(tickSize);
  const sellAt = (index: Decimal) =>
    calculateTrade({ ...input, price: index.mul(tick), side: 'SELL' }, rules);
  const one = new Decimal(1);
  let upperTick = Decimal.max(one, buyCost.div(input.quantity).mul(2).plus(100).div(tick).ceil());
  while (sellAt(upperTick).finalValue.lt(buyCost)) upperTick = upperTick.mul(2);

  function findTick(first: Decimal, last: Decimal): Decimal | undefined {
    if (first.gt(last)) return;
    const upperBound = (index: Decimal) => {
      const trade = sellAt(index);
      const rawFees = trade.charges.reduce((sum, fee) => sum.plus(fee.raw), new Decimal(0));
      const roundingAllowance = new Decimal('0.005').mul(trade.charges.length - 1).plus('0.5');
      return trade.gross.minus(rawFees).plus(roundingAllowance);
    };
    if (upperBound(last).lt(buyCost)) return;

    // Within each fixed DP regime, unrounded proceeds rise with turnover.
    // Scan candidate ticks after finding the earliest possible match.
    let low = first;
    let high = last;
    while (low.lt(high)) {
      const middle = low.plus(high).div(2).floor();
      if (upperBound(middle).gte(buyCost)) high = middle;
      else low = middle.plus(1);
    }
    for (let index = low; index.lte(last); index = index.plus(1)) {
      if (sellAt(index).finalValue.gte(buyCost)) return index;
    }
  }

  const dpBoundary = input.mode === 'DELIVERY'
    ? Decimal.max(one, new Decimal(rules.dp.waiveBrokerFeeBelow).div(input.quantity).div(tick).ceil())
    : one;
  const index = findTick(one, Decimal.min(upperTick, dpBoundary.minus(1))) ?? findTick(dpBoundary, upperTick);
  if (!index) throw new Error('No break-even price under the configured rules.');
  return index.mul(tick);
}
