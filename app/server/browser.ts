import { chromium } from "playwright-core";
import serverlessChromium from "@sparticuz/chromium";
export async function launchPdfBrowser() {
  return chromium.launch({
    headless: true,
    args: serverlessChromium.args,
    executablePath: await serverlessChromium.executablePath(),
  });
}
