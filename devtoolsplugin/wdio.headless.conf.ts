import type { Options } from '@wdio/types'
import { config as baseConfig } from "./wdio.conf";

export const config: Options.Testrunner = {
    ...baseConfig,

    capabilities: [{
    
        // maxInstances can get overwritten per capability. So if you have an in-house Selenium
        // grid with only 5 firefox instances available you can make sure that not more than
        // 5 instances get started at a time.
        maxInstances: 5,
        //
        browserName: 'chrome',
        "goog:chromeOptions": {
            prefs: {
              // disable chrome's password manager - https://github.com/angular/protractor/issues/4146
              "profile.password_manager_enabled": false,
              "profile.default_content_setting_values.geolocation": 1, // This doesn't work headless
              "credentials_enable_service": false,
              "password_manager_enabled": false
            },
            // https://help.applitools.com/hc/en-us/articles/360007189411--Chrome-is-being-controlled-by-automated-test-software-notification
            excludeSwitches: ["enable-automation"],
            args: [
                "--headless",
                "--disable-gpu",
                "--hide-scrollbars",
                "--mute-audio"
            ]
        },
        acceptInsecureCerts: true
        // If outputDir is provided WebdriverIO can capture driver session logs
        // it is possible to configure which logTypes to include/exclude.
        // excludeDriverLogs: ['*'], // pass '*' to exclude all driver session logs
        // excludeDriverLogs: ['bugreport', 'server'],
    }],
}
