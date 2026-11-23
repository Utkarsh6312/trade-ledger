import { expect, it } from 'vitest';
import { parsePrice, parseQuote, quoteStatus } from '../src/quotes';

it('accepts grouped positive rupee prices and rejects invalid money', () => {
  expect(parsePrice('₹1,25,450.75')).toBe('125450.75');
  expect(parsePrice('10,1.25')).toBeUndefined();
  expect(parsePrice('0')).toBeUndefined();
});

it('checks the instrument and freshness of a provider response', () => {
  const now = Date.parse('2026-11-23T08:31:00Z');
  const payload = { price: '250.15', asOf: new Date(now).toISOString(), kind: 'realtime', symbol: 'TEST', exchange: 'NSE' };
  const quote = parseQuote(payload, 'TEST', 'NSE', now);
  expect(quoteStatus(quote, now)).toBe('Live quote');
  expect(quoteStatus(quote, now + 60_001)).toBe('Stale quote');
  expect(() => parseQuote(payload, 'OTHER', 'NSE', now)).toThrow();
});
