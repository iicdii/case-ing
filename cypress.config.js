const { defineConfig } = require("cypress");

module.exports = defineConfig({
  fixturesFolder: "cypress/fixtures",
  chromeWebSecurity: false,
  retries: 20,
  responseTimeout: 300000,
  e2e: {
    supportFile: false,
  },
});
