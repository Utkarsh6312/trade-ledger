import { describe, expect, it } from 'vitest';
import { calculateTrade } from '../src/calculations/charges';
import { breakEvenPrice } from '../src/calculations/profit';
import { BROKER_RULES } from '../src/config/chargeRules';
import type { TradeCalculation } from '../src/types';

const amount = (trade: TradeCalculation, name: string) => trade.charges.find(fee => fee.name === name)?.amount.toFixed(2);

describe('equity charge engine', () => {
  it.each([
    { broker: 'Groww', mode: 'DELIVERY', buyFees: '23.69', sellFees: '45.79', dp: '20.00' },
    { broker: 'Groww', mode: 'INTRADAY', buyFees: '12.49', sellFees: '15.19', dp: '0.00' },
    { broker: 'Zerodha', mode: 'DELIVERY', buyFees: '11.88', sellFees: '25.72', dp: '13.00' },
    { broker: 'Zerodha', mode: 'INTRADAY', buyFees: '4.22', sellFees: '6.92', dp: '0.00' },
    { broker: 'Angel One', mode: 'DELIVERY', buyFees: '23.68', sellFees: '45.78', dp: '20.00' },
    { broker: 'Angel One', mode: 'INTRADAY', buyFees: '12.48', sellFees: '15.18', dp: '0.00' },
    { broker: 'Upstox', mode: 'DELIVERY', buyFees: '35.48', sellFees: '57.58', dp: '20.00' },
    { broker: 'Upstox', mode: 'INTRADAY', buyFees: '12.48', sellFees: '15.18', dp: '0.00' },
    { broker: 'Paytm Money', mode: 'DELIVERY', buyFees: '35.48', sellFees: '49.91', dp: '13.50' },
    { broker: 'Paytm Money', mode: 'INTRADAY', buyFees: '24.28', sellFees: '26.98', dp: '0.00' },
    { broker: 'Dhan', mode: 'DELIVERY', buyFees: '12.38', sellFees: '25.13', dp: '12.50' },
    { broker: 'Dhan', mode: 'INTRADAY', buyFees: '3.92', sellFees: '6.92', dp: '0.00' }
  ] as const)('applies $broker $mode charges and reconciles net proceeds on both sides', scenario => {
    const input = { price: 1000, quantity: 10, exchange: 'NSE', mode: scenario.mode } as const;
    const rules = BROKER_RULES[scenario.broker];
    const buy = calculateTrade({ ...input, side: 'BUY' }, rules);
    const sell = calculateTrade({ ...input, side: 'SELL' }, rules);
    expect(buy.totalCharges.toFixed(2)).toBe(scenario.buyFees);
    expect(sell.totalCharges.toFixed(2)).toBe(scenario.sellFees);
    expect(amount(buy, 'DP charge')).toBe('0.00');
    expect(amount(sell, 'DP charge')).toBe(scenario.dp);
    expect(amount(sell, 'Stamp duty')).toBe('0.00');
    expect(sell.finalValue.minus(buy.finalValue).eq(buy.totalCharges.plus(sell.totalCharges).negated())).toBe(true);
  });

  it.each(['Groww', 'Zerodha'] as const)('rounds %s STT turnover and liability at half a rupee', broker => {
    const trade = { quantity: 1, exchange: 'NSE', mode: 'DELIVERY', side: 'BUY' } as const;
    const rules = BROKER_RULES[broker];
    expect(amount(calculateTrade({ ...trade, price: '499.49' }, rules), 'STT')).toBe('0.00');
    expect(amount(calculateTrade({ ...trade, price: '499.50' }, rules), 'STT')).toBe('1.00');
  });

  it('caps brokerage and applies the Groww small-order floor', () => {
    const base = { quantity: 1, exchange: 'NSE', mode: 'INTRADAY', side: 'BUY' } as const;
    expect(amount(calculateTrade({ ...base, price: 10 }), 'Brokerage')).toBe('0.25');
    expect(amount(calculateTrade({ ...base, price: 400 }), 'Brokerage')).toBe('5.00');
    expect(amount(calculateTrade({ ...base, price: 100_000 }), 'Brokerage')).toBe('20.00');
    expect(amount(calculateTrade({ ...base, price: 100_000 }, BROKER_RULES.Zerodha), 'Brokerage')).toBe('20.00');
  });

  it('respects the low-turnover brokerage cap for the three new brokers', () => {
    const trade = { price: 100, quantity: 1, exchange: 'NSE', mode: 'DELIVERY', side: 'BUY' } as const;
    for (const name of ['Angel One', 'Upstox', 'Paytm Money'] as const) {
      expect(amount(calculateTrade(trade, BROKER_RULES[name]), 'Brokerage')).toBe('2.50');
    }
  });

  it('keeps only the depository component below the Groww delivery waiver threshold', () => {
    const base = { quantity: 1, exchange: 'NSE', mode: 'DELIVERY', side: 'SELL' } as const;
    expect(amount(calculateTrade({ ...base, price: '99.99' }), 'DP charge')).toBe('3.50');
    expect(amount(calculateTrade({ ...base, price: '100.00' }), 'DP charge')).toBe('20.00');
  });

  it('avoids double charging Zerodha NSE IPFT and flags unverified Groww BSE IPFT', () => {
    const base = { price: 100, quantity: 2, mode: 'DELIVERY', side: 'BUY' } as const;
    const bse = calculateTrade({ ...base, exchange: 'BSE' });
    expect(bse.charges.find(fee => fee.name === 'IPFT')?.status).toBe('unknown');
    expect(bse.notices.join(' ')).toMatch(/IPFT/);
    const nse = calculateTrade({ ...base, exchange: 'NSE' }, BROKER_RULES.Zerodha);
    expect(nse.charges.find(fee => fee.name === 'IPFT')?.status).toBe('included');
    expect(amount(nse, 'IPFT')).toBe('0.00');
  });

  it.each([
    { broker: 'Groww', price: 89, tick: '0.01' },
    { broker: 'Zerodha', price: 499, tick: '0.05' }
  ] as const)('returns the first feasible sell tick for $broker', ({ broker, price, tick }) => {
    const trade = { price, quantity: 1, exchange: 'NSE', mode: 'DELIVERY' } as const;
    const rules = BROKER_RULES[broker];
    const buy = calculateTrade({ ...trade, side: 'BUY' }, rules);
    const priceAtEven = breakEvenPrice(trade, buy.finalValue, rules, tick);
    const sell = (price: typeof priceAtEven) => calculateTrade({ ...trade, price, side: 'SELL' }, rules).finalValue;
    expect(priceAtEven.mod(tick).isZero()).toBe(true);
    expect(sell(priceAtEven).gte(buy.finalValue)).toBe(true);
    expect(sell(priceAtEven.minus(tick)).lt(buy.finalValue)).toBe(true);
    if (broker === 'Groww') expect(priceAtEven.lt(100)).toBe(true);
  });
});
