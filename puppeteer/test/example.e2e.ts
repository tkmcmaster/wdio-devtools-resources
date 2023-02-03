import CDP from "devtools-protocol";
import { CDPSession } from "puppeteer-core";

describe('Basic Test', () => {
  const timeout: number = 30000;
  let resourceCount = 0;

  it('should go to page and log resources', async () => {
    await browser.maximizeWindow();

    // Set up resource counting
    const puppeteer = await browser.getPuppeteer();
    const [page] = await puppeteer.pages();
    if (!page) {
      throw new Error("Could not load the puppeeter page");
    }
    // const cdpSession: CDPSession = await puppeteer.target().createCDPSession() as unknown as CDPSession;
    const cdpSession: CDPSession = await page.target().createCDPSession() as unknown as CDPSession;
    console.log("cdpSession init", { sessionId: browser.sessionId, cdpSessionId: cdpSession.id });
    await cdpSession.send("Network.enable", { }),
    cdpSession.on("Network.requestWillBeSent", (e: CDP.Network.RequestWillBeSentEvent) => {
      resourceCount++;
      // console.log("requestWillBeSent", { resourceCount, e });
    });

    await browser.url('/africa/');
    browser.waitUntil(() => document.readyState === "complete", { timeout });
    await $('//*[contains(text(),"Create Your Family Tree")]').waitForExist({ timeout });

    await expect($('h4')).toBeExisting();
    console.log("requestWillBeSent resourceCount: " + resourceCount);
    expect(resourceCount).toBeGreaterThanOrEqual(100);
  });
});

