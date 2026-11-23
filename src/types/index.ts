import type Decimal from 'decimal.js';

export type Exchange = 'NSE' | 'BSE';
export type TradeMode = 'DELIVERY' | 'INTRADAY';
export type Side = 'BUY' | 'SELL';
export type ChargeName = 'Brokerage' | 'STT' | 'Stamp duty' | 'Exchange transaction charge' | 'SEBI turnover fee' | 'IPFT' | 'GST' | 'DP charge';
export interface ChargeLine {
  name: ChargeName; raw: Decimal; amount: Decimal; status?: 'included' | 'unknown';
}
export interface TradeInput { price: Decimal.Value; quantity: number; exchange: Exchange; mode: TradeMode; side: Side }
export interface TradeCalculation { gross: Decimal; charges: ChargeLine[]; totalCharges: Decimal; finalValue: Decimal; notices: string[] }
