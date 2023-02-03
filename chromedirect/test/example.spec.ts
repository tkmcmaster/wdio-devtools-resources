import CDP from "devtools-protocol";
import { ProtocolProxyApi } from "devtools-protocol/types/protocol-proxy-api";
import { Client as RpcClient } from "noice-json-rpc";
import { URL } from "url";
import WebSocket from "ws";
import axios from "axios";
import { join as pathJoin } from "path";
import fs from "fs/promises";
import { tmpdir } from "os";
import { rimraf } from "rimraf";
import { ChildProcess, SpawnOptions, spawn } from "child_process";
import { expect } from "chai";
import { Readable } from "stream";

const RESULTS_PATH = process.env.RESULTS_PATH || "."

type DevTools = ProtocolProxyApi.ProtocolApi;
type TabInfo = Record<"description" | "devtoolsFrontendUrl" | "id" | "title" | "type" | "url" | "webSocketDebuggerUrl", string>;

// some of the CLI args used by chromedriver
const chromeDriverDefaultArgs = [
  "--disable-background-networking",
  "--disable-client-side-phishing-detection",
  "--disable-default-apps",
  "--disable-hang-monitor",
  "--disable-popup-blocking",
  "--disable-sync",
  "--log-level=0",
  "--metrics-recording-only",
  "--no-first-run",
  "--password-store=basic",
  "--safebrowsing-disable-auto-update",
  "--use-mock-keychain"
];

const ARGS = [
  ...chromeDriverDefaultArgs,
  "--disable-breakpad",
  "--noerrdialogs",
  "--allow-insecure-localhost",
  "--disable-notifications",
  "--disable-component-extensions-with-background-pages",
  "--disable-prompt-on-repost",
  "--no-default-browser-check",
  "--no-pings",
  // "--no-sandbox",
  "--remote-debugging-port=0",
  "--disable-infobars",
  // enables the chrome.benchmarking closeConnections and clearHostResolverCache methods
  "--enable-net-benchmarking",
  "about:blank"
];
const preferences = {
  // disable chrome's password manager - https://github.com/angular/protractor/issues/4146
  "profile.password_manager_enabled": false,
  "profile.default_content_setting_values.geolocation": 1, // This doesn't work headless
  "credentials_enable_service": false,
  "password_manager_enabled": false
};

/** Async function that can be used to sleep for x milliseconds */
export async function sleep (ms: number): Promise<void> {
  try {
    await new Promise((resolve) => setTimeout(resolve, ms));
  } catch (error) {
    // swallow it
  }
}

export const withTimeout = <T>(promise: Promise<T>, ms: number, timeoutCb?: (errMsg: string) => string) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      let errorMsg = `Promise timed out after ${ms}ms`;
      if (timeoutCb) {
        errorMsg = timeoutCb(errorMsg);
      }
      reject(new Error(errorMsg));
    }, ms).unref();
    promise.then(resolve).catch(reject);
  });

describe('Basic Test', () => {
  const timeout: number = 30000;
  let resourceCount = 0;

  it('should go to page and log resources', async () => {
    let chromeProcess: ChildProcess | undefined;
    try {
      const launchArgs = [...(ARGS)];
      const width = 1920;
      const height = 1080;
      launchArgs.unshift(
        `--window-size=${width},${height}`,
        `--content-shell-host-window-size=${width},${height}`
      );
      let chromePath = process.env.CHROME_PATH || "google-chrome";
      if (process.env.HEADLESS) {
        launchArgs.push(
          "--headless",
          "--hide-scrollbars",
          "--mute-audio"
        );
      }
      const profileDir = await fs.mkdtemp(pathJoin(tmpdir(), "pagestats-chrome-profile"));
      if (preferences) {
        await fs.mkdir(pathJoin(profileDir, "Default"));
        await fs.writeFile(pathJoin(profileDir, "Default", "Preferences"), JSON.stringify(preferences), "utf8");
      }
      launchArgs.push("--user-data-dir=" + profileDir);
      const removeProfileDir = () =>
        rimraf(profileDir)
        .catch((error) => console.error(`Could not remove chrome profile directory "${profileDir}"`, error));
      const spawnOptions: SpawnOptions = {};
      console.log(`"${[chromePath, ...launchArgs].join("\" \"")}"`);
      chromeProcess = spawn(chromePath, launchArgs, spawnOptions)
      .on("error", removeProfileDir)
      .on("exit", removeProfileDir);
      // chromeProcess.unref();
      const chromeStdErr: string[] = [];
      const listeners: Readable[] = [];
      const checkForDevTools = (resolve: (value: string | PromiseLike<string>) => void, stream: Readable | null) => {
        if (stream) {
          listeners.push(stream);
          stream.setEncoding("utf8").on("data", (s: string) => {
            // split into array and remove empty lines. We can't remove leading and trailing spaces
            // We need to be able to rejoin the lines and have it match our regex string exactly
            chromeStdErr.push(...s.split("\n").filter((line) => line));
            // It can now be split over multile lines and on("data")'s
            // DevTools listening on ws://127.0.0.1:12752/devtools/browser/6afc0d64-a9ee-4338-8d9b-dd5cca1fe67e
            console.log(chromeStdErr.join("\n"));
            const match = /DevTools listening on ws(:\/\/[\w\d.:]+\/devtools\/browser\/\S{8}(-\S{4}){3}-\S{12})/.exec(chromeStdErr.join(""));
            if (match) {
              resolve("http" + match[1]);
              // We need to remove both stdout and stderr ones
              listeners.forEach((listener: Readable) => listener.removeAllListeners("data"));
              chromeProcess.removeAllListeners("error");
            }
          });
        }
      };
      const httpEndpoint = await withTimeout(new Promise<string>((resolve, reject) => {
        chromeProcess.on("error", reject);
        checkForDevTools(resolve, chromeProcess.stderr);
        checkForDevTools(resolve, chromeProcess.stdout);
      }), 10000, (errMsg) => `${errMsg}\nCould not get the DevTools endpoint\nChrome stderr:\n${chromeStdErr.join("\n")}`);

        // Set up resource counting
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

    await cdp.Page.navigate({ url: "https://www.familysearch.org/africa/" });
    await sleep(15000);
    // browser.waitUntil(() => document.readyState === "complete", { timeout });
    // await $('//*[contains(text(),"Create Your Family Tree")]').waitForExist({ timeout });

    // await expect($('h4')).toBeExisting();
    console.log("requestWillBeSent resourceCount: " + resourceCount);
    expect(resourceCount).to.be.greaterThanOrEqual(200);
    } finally {
      if (chromeProcess) {
        chromeProcess.kill();
      }
    }
  });
});

