import CDP from "devtools-protocol";
import { ProtocolProxyApi } from "devtools-protocol/types/protocol-proxy-api";
import { Client as RpcClient } from "noice-json-rpc";
import { URL } from "url";
import WebSocket from "ws";
import axios from "axios";

type DevTools = ProtocolProxyApi.ProtocolApi;
type TabInfo = Record<"description" | "devtoolsFrontendUrl" | "id" | "title" | "type" | "url" | "webSocketDebuggerUrl", string>;

describe('Basic Test', () => {
  const timeout: number = 30000;
  let resourceCount = 0;

  it('should go to page and log resources', async () => {
    await browser.maximizeWindow();
    
    // Set up resource counting
    const puppeteer = await browser.getPuppeteer();
    const wsEndpoint: string = puppeteer.wsEndpoint();
    console.log("wsEndpoint: " + wsEndpoint);
    const httpEndpoint: string = wsEndpoint.replace("ws:", "http:");
    console.log("httpEndpoint: " + httpEndpoint);
    const { webSocketDebuggerUrl }: TabInfo =
      (await axios.get(new URL("/json/list", httpEndpoint).toString())).data.find(({ type }: TabInfo) => type == "page")
      || (await axios.get(new URL("/json/new", httpEndpoint).toString())).data;
      console.log("webSocketDebuggerUrl: " + webSocketDebuggerUrl, webSocketDebuggerUrl);
    const cdpClient =  new RpcClient(new WebSocket(webSocketDebuggerUrl));
    const cdp: DevTools = cdpClient.api();
    await cdp.Network.enable({});
    cdp.Network.on("requestWillBeSent", (e: CDP.Network.RequestWillBeSentEvent) => {
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

