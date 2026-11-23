import { expect, test } from '@playwright/test';

test('dark mode styles the calculator and persists across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Dark mode' });
  const root = page.locator('html');
  const exchange = page.getByLabel('Exchange');

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await expect(exchange).toHaveCSS('background-color', 'rgb(24, 31, 43)');
  await page.getByLabel('Current market price in rupees').fill('250');
  await expect(page.locator('#profit-label')).toHaveText('Net loss');
  await expect(page.locator('#profit-card')).toHaveCSS('background-color', 'rgb(56, 36, 47)');
  expect(await root.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(320);

  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(root).toHaveCSS('color-scheme', 'light');
});

test('mobile calculator changes broker and mode, shows losses, and expands fees', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByLabel('Current market price in rupees').fill('250');
  await expect(page.locator('#profit-label')).toHaveText('Net loss');
  const original = await page.locator('#buy-total').textContent();
  await page.locator('.segments.brokers').getByText('Zerodha', { exact: true }).click();
  await expect(page.locator('#buy-total')).not.toHaveText(original!);
  await expect(page.locator('#active-pricing')).toHaveAttribute('href', 'https://zerodha.com/charges/');
  await expect(page.locator('#rates-verified')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole('row', { name: /DP charge/ })).toContainText('₹13.00');
  await page.getByText('Intraday', { exact: true }).click();
  await expect(page.getByRole('row', { name: /DP charge/ })).not.toContainText('₹13.00');
  await expect(page.locator('#profit-label')).toHaveText('Net loss');
  await expect(page.locator('#sell-fee-note')).toContainText('Sell charges: ₹');
  await page.getByText('Detailed charges', { exact: true }).click();
  await expect(page.locator('.breakdown table')).toBeHidden();
  await page.getByLabel('Quantity').fill('0');
  await expect(page.locator('#break-even')).toHaveText('—');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('production assets and calculator work under a Pages repository subpath', async ({ browser, baseURL }) => {
  // The route mocks asset URLs only. Service worker registration bypasses this interception.
  const page = await browser.newPage({ baseURL, serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  try {
    const prefix = '/trade-ledger/';
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = new URL(route.request().url());
      if (request.origin !== baseURL || !request.pathname.startsWith(prefix)) return route.abort();
      request.pathname = '/' + request.pathname.slice(prefix.length);
      await route.fulfill({ response: await route.fetch({ url: request.href }) });
    });
    await page.goto(prefix);
    await expect(page.locator('#profit')).toHaveText('—');
    await expect(page.locator('#profit-card')).toHaveCSS('background-color', 'rgb(163, 223, 255)');
    await expect(page.locator('#quote-status')).toHaveText('Manual quote');
    await page.getByLabel('Current market price in rupees').fill('240');
    await expect(page.locator('#profit-card')).toHaveCSS('background-color', 'rgb(255, 156, 133)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});

test('one market price instantly calculates buy cost and same-price net sell value', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#buy-total')).toHaveText('—');
  await expect(page.getByLabel('Buy price (₹)')).toHaveCount(0);
  await expect(page.getByLabel('Sell price (₹)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use as buy' })).toHaveCount(0);
  await page.getByLabel('Quantity').fill('10');
  await page.getByLabel('Current market price in rupees').fill('₹1,000');
  await expect(page.locator('#quote-status')).toHaveText('Manual quote');
  await expect(page.locator('#quote-time')).toContainText('IST');
  await expect(page.locator('#buy-total')).toHaveText('₹10,023.69');
  await expect(page.locator('#sell-total')).toHaveText('₹9,954.21');
  await expect(page.locator('#profit')).toHaveText('-₹69.48');
  const comparison = page.getByRole('region', { name: 'Compare brokers' });
  await expect(comparison.locator('tbody tr')).toHaveCount(6);
  for (const [broker, sell, fees] of [
    ['Angel One', '₹9,954.22', '₹69.46'],
    ['Upstox', '₹9,942.42', '₹93.06'],
    ['Paytm Money', '₹9,950.09', '₹85.39'],
    ['Dhan', '₹9,974.87', '₹37.51']
  ]) {
    await page.locator('.segments.brokers').getByText(broker, { exact: true }).click();
    await expect(page.locator('#sell-total')).toHaveText(sell);
    await expect(comparison.getByRole('row', { name: new RegExp(broker) })).toContainText(fees);
  }
  await expect(page.locator('#result-context')).toHaveText('DHAN / DELIVERY');
  await page.getByLabel('Exchange').selectOption('BSE');
  await expect(page.getByLabel('Current market price in rupees')).toHaveValue('₹1,000');
  await expect(page.locator('#charge-notice')).toContainText('BSE');
  await page.getByLabel('Current market price in rupees').clear();
  await expect(page.locator('#sell-total')).toHaveText('—');
});
