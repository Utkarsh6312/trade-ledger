import type { Exchange, TradeMode, Side } from '../types';

export type Broker = 'Groww' | 'Zerodha' | 'Angel One' | 'Upstox' | 'Paytm Money' | 'Dhan';
type Brokerage = { rate: string; minimum: string; maximum: string; floorCap: string };

export interface ChargeRules {
  pricingUrl: string;
  verifiedOn: string;
  planNote?: string;
  brokerage: Record<TradeMode, Brokerage>;
  stt: Record<TradeMode, Record<Side, string>>;
  stamp: Record<TradeMode, string>;
  stampWholeRupee?: boolean;
  exchange: Record<Exchange, string>;
  sebi: string;
  nseIpft: { rate: string } | 'included';
  bseIpftUnknown: boolean;
  gst: string;
  dp: { brokerFee: string; depositoryFee: string; waiveBrokerFeeBelow: string };
}

const equityRates = {
  stt: { DELIVERY: { BUY: '0.001', SELL: '0.001' }, INTRADAY: { BUY: '0', SELL: '0.00025' } },
  stamp: { DELIVERY: '0.00015', INTRADAY: '0.00003' },
  exchange: { NSE: '0.0000307', BSE: '0.0000375' },
  sebi: '0.000001',
  gst: '0.18'
};

const cappedPercent = { rate: '0.001', minimum: '5', maximum: '20', floorCap: '0.025' };
const flatTwenty = { rate: '0', minimum: '20', maximum: '20', floorCap: '0.025' };
// NSE/FA/73061, cash-equity rates per side since March 1, 2026.
const nseSplit = { exchange: { ...equityRates.exchange, NSE: '0.000030699' }, nseIpft: { rate: '0.000000001' } };

// Rates reviewed against each broker's current cash equity pricing page.
export const BROKER_RULES: Readonly<Record<Broker, ChargeRules>> = {
  Groww: {
    ...equityRates,
    pricingUrl: 'https://groww.in/pricing',
    verifiedOn: '2026-11-23',
    brokerage: { DELIVERY: cappedPercent, INTRADAY: cappedPercent },
    nseIpft: { rate: '0.000001' },
    bseIpftUnknown: true,
    dp: { brokerFee: '16.5', depositoryFee: '3.5', waiveBrokerFeeBelow: '100' }
  },
  Zerodha: {
    ...equityRates,
    pricingUrl: 'https://zerodha.com/charges/',
    verifiedOn: '2026-11-23',
    brokerage: {
      DELIVERY: { rate: '0', minimum: '0', maximum: '0', floorCap: '0' },
      INTRADAY: { rate: '0.0003', minimum: '0', maximum: '20', floorCap: '0' }
    },
    nseIpft: 'included',
    bseIpftUnknown: false,
    dp: { brokerFee: '9.5', depositoryFee: '3.5', waiveBrokerFeeBelow: '0' }
  },
  'Angel One': {
    ...equityRates,
    ...nseSplit,
    pricingUrl: 'https://www.angelone.in/exchange-transaction-charges',
    verifiedOn: '2026-11-23',
    planNote: 'Standard retail rates after introductory offers. Pro Plus pricing differs.',
    brokerage: { DELIVERY: cappedPercent, INTRADAY: cappedPercent },
    bseIpftUnknown: false,
    dp: { brokerFee: '16.5', depositoryFee: '3.5', waiveBrokerFeeBelow: '0' }
  },
  Upstox: {
    ...equityRates,
    pricingUrl: 'https://upstox.com/brokerage-charges/',
    verifiedOn: '2026-11-23',
    planNote: 'Upstox Basic pricing. Upstox Plus pricing differs.',
    brokerage: {
      DELIVERY: flatTwenty,
      INTRADAY: { rate: '0.001', minimum: '0', maximum: '20', floorCap: '0' }
    },
    nseIpft: 'included',
    bseIpftUnknown: false,
    dp: { brokerFee: '16.5', depositoryFee: '3.5', waiveBrokerFeeBelow: '0' }
  },
  'Paytm Money': {
    ...equityRates,
    ...nseSplit,
    pricingUrl: 'https://www.paytmmoney.com/stocks/pricing',
    verifiedOn: '2026-11-23',
    planNote: 'Standard brokerage and published DP fees. NSE exchange fees use the exchange tariff.',
    brokerage: { DELIVERY: flatTwenty, INTRADAY: flatTwenty },
    bseIpftUnknown: false,
    dp: { brokerFee: '10', depositoryFee: '3.5', waiveBrokerFeeBelow: '0' }
  },
  Dhan: {
    ...equityRates,
    ...nseSplit,
    pricingUrl: 'https://dhan.co/pricing/',
    verifiedOn: '2026-11-23',
    brokerage: {
      DELIVERY: { rate: '0', minimum: '0', maximum: '0', floorCap: '0' },
      INTRADAY: { rate: '0.0003', minimum: '0', maximum: '20', floorCap: '0' }
    },
    stampWholeRupee: true,
    bseIpftUnknown: false,
    dp: { brokerFee: '12.5', depositoryFee: '0', waiveBrokerFeeBelow: '0' }
  }
};

export const BROKERS = Object.keys(BROKER_RULES) as Broker[];

export function isBroker(value: unknown): value is Broker {
  return typeof value === 'string' && Object.hasOwn(BROKER_RULES, value);
}
