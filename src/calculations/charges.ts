import Decimal from 'decimal.js';
import { BROKER_RULES, type ChargeRules } from '../config/chargeRules';
import type { ChargeLine, TradeCalculation, TradeInput } from '../types';
import { money } from './rounding';

export function calculateTrade(input: TradeInput, rules: ChargeRules = BROKER_RULES.Groww): TradeCalculation {
  const price = new Decimal(input.price);
  if (!price.isFinite() || price.lte(0) || !Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new Error('Price must be positive and quantity must be a positive integer.');
  }
  const gross = price.mul(input.quantity);
  const delivery = input.mode === 'DELIVERY';
  const buy = input.side === 'BUY';
  const lines: ChargeLine[] = [];
  const notices: string[] = [];
  const add = (name: ChargeLine['name'], value: Decimal.Value, status?: ChargeLine['status']) => {
    const raw = new Decimal(value);
    const wholeRupee = name === 'STT' || (name === 'Stamp duty' && rules.stampWholeRupee);
    const amount = wholeRupee ? raw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : money(raw);
    lines.push({ name, raw, amount, status });
  };

  const brokerage = rules.brokerage[input.mode];
  const floor = Decimal.min(gross.mul(brokerage.floorCap), brokerage.minimum);
  const brokerFee = Decimal.min(Decimal.max(gross.mul(brokerage.rate), floor), brokerage.maximum);
  add('Brokerage', brokerFee);
  // STT Rules 2004, rule 4. Round taxable turnover and the resulting tax to rupees.
  add('STT', gross.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(rules.stt[input.mode][input.side]));
  add('Stamp duty', buy ? gross.mul(rules.stamp[input.mode]) : 0);
  const exchangeFee = gross.mul(rules.exchange[input.exchange]);
  const sebiFee = gross.mul(rules.sebi);
  add('Exchange transaction charge', exchangeFee);
  add('SEBI turnover fee', sebiFee);

  let ipft = new Decimal(0);
  if (input.exchange === 'NSE') {
    if (rules.nseIpft === 'included') add('IPFT', 0, 'included');
    else {
      ipft = gross.mul(rules.nseIpft.rate);
      add('IPFT', ipft);
    }
  } else {
    add('IPFT', 0, rules.bseIpftUnknown ? 'unknown' : undefined);
    if (rules.bseIpftUnknown) notices.push('Unverified BSE IPFT is excluded.');
    notices.push('BSE estimates use the standard A/B rate. Fees can vary by security group.');
  }

  const dp = rules.dp;
  const dpFee = !buy && delivery
    ? new Decimal(dp.depositoryFee).plus(gross.lt(dp.waiveBrokerFeeBelow) ? 0 : dp.brokerFee)
    : new Decimal(0);
  add('DP charge', dpFee);
  add('GST', brokerFee.plus(exchangeFee).plus(sebiFee).plus(ipft).plus(dpFee).mul(rules.gst));

  const totalCharges = lines.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
  return { gross, charges: lines, totalCharges, finalValue: buy ? gross.plus(totalCharges) : gross.minus(totalCharges), notices };
}
