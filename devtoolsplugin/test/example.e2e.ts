import CDP from "devtools-protocol";

describe('Basic Test', () => {
  const timeout: number = 30000;
  let resourceCount = 0;

  it('should go to page and log resources', async () => {
    await browser.maximizeWindow();

    // Set up resource counting
    await browser.cdp("Network", "enable", { }),
    browser.on("Network.requestWillBeSent", (e: CDP.Network.RequestWillBeSentEvent) => {
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

