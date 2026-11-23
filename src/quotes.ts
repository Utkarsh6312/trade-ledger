import type { Exchange } from './types';

export function parsePrice(input: string): string | undefined {
  const pattern = /^(?:₹\s*)?((?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?)$/;
  const match = input.trim().match(pattern);
  const value = match?.[1].replaceAll(',', '');
  return value && /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && /[1-9]/.test(value) ? value : undefined;
}

export interface MarketQuote {
  price: string;
  asOf: number;
  kind: 'realtime' | 'delayed' | 'last-close';
}

export function parseQuote(payload: unknown, symbol: string, exchange: Exchange, now = Date.now()): MarketQuote {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid quote.');
  const data = payload as Record<string, unknown>;
  const price = typeof data.price === 'string' ? parsePrice(data.price) : undefined;
  const asOf = typeof data.asOf === 'string' ? Date.parse(data.asOf) : NaN;
  if (!price || !Number.isFinite(asOf) || asOf <= 0 || asOf > now + 5000 ||
    data.symbol !== symbol || data.exchange !== exchange ||
    (data.kind !== 'realtime' && data.kind !== 'delayed' && data.kind !== 'last-close')) throw new Error('Invalid quote.');
  return { price, asOf, kind: data.kind };
}

export const quoteStatus = (quote: MarketQuote, now = Date.now()) =>
  quote.kind === 'last-close' ? 'Last close' :
  quote.kind === 'delayed' ? 'Delayed quote' : now - quote.asOf <= 60_000 ? 'Live quote' : 'Stale quote';

export function quoteEndpoint(value: string | undefined) {
  try {
    const endpoint = new URL(value ?? '');
    return endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password ? endpoint : undefined;
  } catch { return undefined; }
}

export async function fetchQuote(endpoint: URL, symbol: string, exchange: Exchange, signal: AbortSignal) {
  const url = new URL(endpoint);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('exchange', exchange);
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', cache: 'no-store', signal });
  if (!response.ok) throw new Error('Quote unavailable.');
  return parseQuote(await response.json(), symbol, exchange);
}
