import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:45000,
  use:{baseURL:'http://127.0.0.1:4317',viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']},trace:'retain-on-failure'},
  webServer:{command:process.env.PLAYBOOK_TEST_PRODUCTION?'npm start':'npm run dev',url:'http://127.0.0.1:4317/api/health',reuseExistingServer:!process.env.CI&&!process.env.PLAYBOOK_TEST_PRODUCTION,timeout:30000},
});
