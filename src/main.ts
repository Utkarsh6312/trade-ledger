import './styles.css';
import { calculateTrade } from './calculations/charges';
import { breakEvenPrice } from './calculations/profit';
import { formatINR } from './calculations/rounding';
import { BROKERS, BROKER_RULES, isBroker } from './config/chargeRules';
import { parsePrice } from './quotes';
import type { ChargeLine, TradeInput } from './types';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const text = (id: string, value: string) => { element(id).textContent = value; };
const form = element<HTMLFormElement>('trade-form');
const quoteInput = input('market-price');
const exchange = element<HTMLSelectElement>('exchange');
const installButton = element<HTMLButtonElement>('install-app');
const quoteTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
let manualTime: number | undefined;

function renderQuote() {
  const badge = element('quote-status');
  badge.textContent = 'Manual quote';
  badge.dataset.live = 'false';
  text('quote-time', manualTime === undefined ? 'Last updated: —' :
    `Last updated: ${quoteTime.format(manualTime)} IST · Entered by you`);
}

function feeText(line: ChargeLine) {
  if (line.status === 'unknown') return 'Unknown';
  if (line.status === 'included') return 'Included in exchange fee';
  return formatINR(line.amount);
}

function compareBrokers(trade: Omit<TradeInput, 'side'>, selectedBroker: string) {
  const rows = BROKERS.map(name => {
    const rules = BROKER_RULES[name];
    const buy = calculateTrade({ ...trade, side: 'BUY' }, rules);
    const sell = calculateTrade({ ...trade, side: 'SELL' }, rules);
    const row = document.createElement('tr');
    row.dataset.selected = String(name === selectedBroker);
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = name;
    row.append(label);
    for (const value of [buy.finalValue, sell.finalValue, buy.totalCharges.plus(sell.totalCharges)]) {
      const cell = document.createElement('td');
      cell.textContent = formatINR(value);
      row.append(cell);
    }
    return row;
  });
  element('comparison-lines').replaceChildren(...rows);
  element('broker-comparison').hidden = false;
}

function renderTrade() {
  const data = new FormData(form);
  const selectedBroker = data.get('broker');
  const broker = isBroker(selectedBroker) ? selectedBroker : 'Groww';
  const rules = BROKER_RULES[broker];
  const ratesDate = element<HTMLTimeElement>('rates-verified');
  ratesDate.dateTime = rules.verifiedOn;
  ratesDate.textContent = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(rules.verifiedOn));
  const source = element<HTMLAnchorElement>('active-pricing');
  source.href = rules.pricingUrl;
  source.textContent = `${broker} pricing`;
  text('plan-note', rules.planNote ?? '');
  const mode = data.get('mode') === 'INTRADAY' ? 'INTRADAY' : 'DELIVERY';
  const venue = exchange.value === 'BSE' ? 'BSE' : 'NSE';
  const price = parsePrice(quoteInput.value);
  const quantityText = input('quantity').value.trim();
  const quantity = Number(quantityText);
  const validQuantity = /^\d+$/.test(quantityText) && Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 1_000_000_000;
  const outputIds = ['profit', 'return', 'buy-total', 'sell-total', 'break-even', 'total-charges', 'buy-fees', 'sell-fees'];
  const profitCard = element('profit-card');
  text('result-context', [broker, mode === 'DELIVERY' ? 'Delivery' : 'Intraday'].join(' / ').toUpperCase());
  quoteInput.setAttribute('aria-invalid', String(Boolean(quoteInput.value.trim()) && !price));
  input('quantity').setAttribute('aria-invalid', String(!validQuantity));
  if (!price || !validQuantity) {
    element('broker-comparison').hidden = true;
    profitCard.dataset.state = 'empty';
    outputIds.forEach(id => text(id, '—'));
    text('profit-label', 'Net profit / loss');
    text('input-status', !price ? 'Enter a positive market price to see both estimates.' :
      'Enter a whole quantity from 1 to 1,000,000,000.');
    text('buy-note', 'Includes buy charges');
    text('sell-note', 'After sell charges');
    text('sell-fee-note', '');
    text('charge-notice', '');
    text('result-announcement', 'Estimate unavailable. Check the trade inputs.');
    element('charge-lines').replaceChildren();
    return;
  }
  text('input-status', 'The same market price is used for buying and selling.');
  const tick = element<HTMLSelectElement>('tick').value;
  const trade = { price, quantity, exchange: venue, mode } as const;
  const buy = calculateTrade({ ...trade, side: 'BUY' }, rules);
  const sell = calculateTrade({ ...trade, side: 'SELL' }, rules);
  const breakEven = breakEvenPrice(trade, buy.finalValue, rules, tick);
  const profit = sell.finalValue.minus(buy.finalValue);
  const label = profit.gt(0) ? 'Net profit' : profit.lt(0) ? 'Net loss' : 'Break-even trade';
  profitCard.dataset.state = profit.gt(0) ? 'profit' : profit.lt(0) ? 'loss' : 'even';
  text('profit-label', label);
  text('profit', formatINR(profit));
  const percent = profit.div(buy.finalValue).mul(100);
  text('return', `${percent.gt(0) ? '+' : ''}${percent.toFixed(2)}% return`);
  text('buy-total', formatINR(buy.finalValue));
  text('sell-total', formatINR(sell.finalValue));
  text('buy-note', `${formatINR(buy.finalValue.div(quantity))} per share incl. fees`);
  text('sell-note', `${formatINR(sell.finalValue.div(quantity))} per share after fees`);
  text('sell-fee-note', `Sell charges: ${formatINR(sell.totalCharges)}`);
  text('break-even', formatINR(breakEven));
  text('total-charges', formatINR(buy.totalCharges.plus(sell.totalCharges)));
  text('buy-fees', formatINR(buy.totalCharges));
  text('sell-fees', formatINR(sell.totalCharges));
  text('charge-notice', [...new Set([...buy.notices, ...sell.notices])].join(' '));
  text('result-announcement', `${label}: ${formatINR(profit)}. Break-even: ${formatINR(breakEven)} per share.`);
  const rows = buy.charges.map((fee, index) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = fee.name;
    const buyCell = document.createElement('td');
    const sellCell = document.createElement('td');
    buyCell.textContent = feeText(fee);
    sellCell.textContent = feeText(sell.charges[index]);
    row.append(heading, buyCell, sellCell);
    return row;
  });
  element('charge-lines').replaceChildren(...rows);
  compareBrokers(trade, broker);
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === quoteInput) {
    manualTime = parsePrice(quoteInput.value) ? Date.now() : undefined;
    renderQuote();
  }
  renderTrade();
});
renderQuote();
renderTrade();

const themeToggle = element<HTMLButtonElement>('theme-toggle');
const root = document.documentElement;
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;

function applyTheme(theme: 'light' | 'dark') {
  root.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeColor.content = getComputedStyle(root).getPropertyValue('--paper');
}

applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
themeToggle.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try {
    localStorage.setItem('trade-ledger-theme', theme);
  } catch {
    // The toggle still works for the current page when storage is unavailable.
  }
});

let installPrompt: BeforeInstallPromptEvent | undefined;
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
if (isMobile && !window.matchMedia('(display-mode: standalone)').matches) installButton.hidden = false;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    text('install-message', 'On iPhone or iPad, open the Share menu and choose “Add to Home Screen”.');
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  text('install-message', 'Trade Ledger has been installed.');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
