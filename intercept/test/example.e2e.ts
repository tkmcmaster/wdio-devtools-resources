import CDP from "devtools-protocol";
import { CDPSession } from "puppeteer-core";
import { join as pathJoin } from "path";

const RESULTS_PATH = process.env.RESULTS_PATH || "."

describe('Basic Test', () => {
  const timeout: number = 30000;
  let resourceCount = 0;

  it('should go to page and log resources', async () => {
    try {
    await browser.maximizeWindow();

    // Set up resource counting
    const puppeteer = await browser.getPuppeteer();
    const [page] = await puppeteer.pages();
    if (!page) {
      throw new Error("Could not load the puppeeter page");
    }
    await page.setRequestInterception(true);
    page.on("request", (interceptedRequest /*: HTTPRequest*/) => {
      resourceCount++;
      // console.log("request", { resourceCount, interceptedRequest, method: interceptedRequest.method(), url: interceptedRequest.url() });
      interceptedRequest.continue();
    });

    await browser.url('/africa/');
    browser.waitUntil(() => document.readyState === "complete", { timeout });
    await $('//*[contains(text(),"Create Your Family Tree")]').waitForExist({ timeout });

    await expect($('h4')).toBeExisting();
    console.log("requestWillBeSent resourceCount: " + resourceCount);
    expect(resourceCount).toBeGreaterThanOrEqual(100);
    } finally {
      const screenshot = pathJoin(RESULTS_PATH, `intercept-${new Date().toISOString().replace(/[-:\.Z]/g, "")}.png`);
      console.log("Saving Screenshot: " + screenshot);
      await browser.saveScreenshot(screenshot).catch((error) => console.error("Could not save screenshot " + screenshot, error));
    }
  });
});

