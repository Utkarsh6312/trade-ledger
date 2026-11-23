# Trade Ledger

A static Indian cash-equity calculator for Groww, Zerodha, Angel One, Upstox, Paytm Money, and Dhan. Compare the same Delivery or Intraday trade across brokers, see effective costs and proceeds, and calculate the lowest break-even sell price at the chosen tick.

## Run locally

Use Node.js 22 and npm to match the GitHub Pages workflow.

```sh
npm ci
npm run dev
```

Run `npm run build` to create the static site in `dist/`, then use `npm run preview` to serve that build locally.

## Run tests

`npm test` runs the unit tests. Playwright tests serve the production build, so run the build before testing in Chromium.

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

## Files in Git

Commit source code, assets in `public/`, tests, project configuration, and `package-lock.json`. The `.gitignore` rules cover generated dependencies (`node_modules/`), build output (`dist/`), test artifacts (`test-results/`, `playwright-report/`, and `coverage/`), caches, logs, and local editor and OS files. Local `.env` files are ignored, with an exception for `.env.example` if you add a sample configuration.

## Publish on GitHub Pages

Push the project to a GitHub repository with a `main` branch. In the repository, open **Settings → Pages** and select **GitHub Actions** as the source. The included workflow runs the unit tests, builds `dist/`, and publishes that output on pushes to `main`. Relative asset paths support repository subpaths.

If the published page loads without styles, check the Pages source. Publishing from the repository branch serves Vite’s source HTML, which references the TypeScript entry point directly. After switching the source to **GitHub Actions**, open **Actions → Deploy Trade Ledger → Run workflow** on `main`. The workflow creates `dist/` from a clean checkout, so you can delete the local build folder at any time and regenerate it with `npm run build`.

## Market quotes

Enter one market price to compare the total cost of buying with the net amount from selling at that same price. The quote is applied instantly to both sides. The manual timestamp records when you entered it.

## Install the app

Open the deployed site and select **Install app** when your browser offers it. On iPhone or iPad, open Safari’s **Share** menu and choose **Add to Home Screen**.

## Calculation scope

- Standard resident retail cash-equity estimates for one buy and one sell order in the same mode and exchange. No ETF, debt, F&O, MTF, or account-level fees. Closing the position normally is assumed.
- [Groww pricing](https://groww.in/pricing) and [Groww's brokerage floor guidance](https://groww.in/help/stocks/sx-reports/what-are-the-different-charges-mentioned-in-the-report) provide the default schedule. Delivery DP uses the standard male-holder fee. Only Groww's own DP component is waived below ₹100.
- [Zerodha pricing](https://zerodha.com/charges/) lists zero standard delivery brokerage, the intraday order cap, and ₹15.34 standard DP including GST. [Zerodha exchange fees](https://support.zerodha.com/category/account-opening/resident-individual/ri-charges/articles/exchange-transaction-charges) include NSE IPFT.
- [Angel One pricing](https://www.angelone.in/exchange-transaction-charges), [brokerage support](https://www.angelone.in/support/charges-and-cashbacks/brokerage-charges), and [DP support](https://www.angelone.in/support/charges-and-cashbacks/dp-charges) are the sources for standard retail pricing after promotional offers. The estimate excludes Pro Plus.
- [Upstox pricing](https://upstox.com/brokerage-charges/) and the [Basic account tariff](https://assets.upstox.com/website/forms/individual-account-opening-form.pdf) apply to the Upstox estimate. The estimate excludes Upstox Plus. NSE IPFT is included in the exchange fee.
- Paytm Money uses its [flat brokerage update](https://www.paytmmoney.com/blog/all-new-paytm-money-updates-revisions-and-more/), [delivery DP tariff](https://www.paytmmoney.com/blog/paytm-money-pricing-update-revised-charges-effective-1st-october/), and the [NSE cash-market circular](https://nsearchives.nseindia.com/content/circulars/FA73061.pdf) for the exchange fee and IPFT split. Account offers are excluded.
- [Dhan pricing](https://dhan.co/pricing/) sets zero equity Delivery brokerage, caps equity Intraday brokerage at the lower of ₹20 or 0.03% per order, and lists a ₹12.50 DP fee before GST for Delivery sales. The estimate follows Dhan's whole-rupee stamp duty rounding.
- The app displays the selected schedule’s verification date. Published rates are reviewed manually. Taxable turnover for STT and the resulting STT are rounded to whole rupees for each modeled side under [rule 4 of the Securities Transaction Tax Rules](https://thc.nic.in/Central%20Governmental%20Rules/Income-Tax%20Rules%2C1962%20%28Part-D%29.pdf).
- BSE estimates use the standard A/B rate. Scrip group fees can differ. Groww's unverified BSE IPFT is excluded and marked unknown. Contract-note aggregation, account entitlements, and rounding may change actual charges.
- Break-even uses the selected tick. Use the scrip's published tick for an orderable result. The default is ₹0.01. It is not inferred from the entered quote.
