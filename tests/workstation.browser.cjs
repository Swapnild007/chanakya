const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"]
  });
  const base = process.env.ASTROLENS_URL || "http://127.0.0.1:8765";
  const screenshots = process.env.SCREENSHOTS_DIR;
  const pages = ["Mission Control", "Planet Discovery", "Light Curve Laboratory",
    "Candidate Investigation", "Discovery Catalogue", "Research Workspace"];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    await page.getByText("Analysis service available").waitFor();
    if (screenshots) await page.screenshot({ path: screenshots + "/AstroLens_Desktop.png", fullPage: true });
    for (const name of pages) {
      await page.getByRole("link", { name, exact: true }).click();
      await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
    }
    await page.getByRole("link", { name: "Planet Discovery", exact: true }).click();
    await page.locator("#file").setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("invalid") });
    await page.getByRole("button", { name: "Run transit search" }).click();
    await page.getByText("Invalid observation:", { exact: false }).waitFor();
    const synthetic = Array.from({ length: 1200 }, (_, i) => {
      const t = i * .02;
      const phase = ((t - .42 + 2.37 / 2 + 2.37) % 2.37) - 2.37 / 2;
      return t + "," + (1 + .001 * Math.sin(i * 2.1) - (Math.abs(phase) < .055 ? .012 : 0));
    }).join("\n");
    await page.locator("#file").setInputFiles({ name: "synthetic-browser-test.csv", mimeType: "text/csv",
      buffer: Buffer.from("time,flux\n" + synthetic) });
    await page.locator("#maximum_period").fill("5");
    await page.getByRole("button", { name: "Run transit search" }).click();
    await page.locator("#open-results").click({ timeout: 45000 });
    await page.getByRole("button", { name: "Show folded curve" }).first().click();
    await page.getByText("Orbital phase · review rank", { exact: false }).waitFor();
    await page.getByRole("link", { name: "Light Curve Laboratory", exact: true }).click();
    await page.locator("#zoom").selectOption(".2");
    await page.locator("#curve-range").waitFor();
    await page.getByRole("link", { name: "Research Workspace", exact: true }).click();
    await page.getByRole("button", { name: "Save current analysis" }).click();
    await page.getByText("Analysis saved.", { exact: true }).waitFor();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON report" }).click();
    assert.equal((await download).suggestedFilename(), "astrolens-analysis.json");
    await page.reload();
    await page.getByRole("button", { name: "Restore" }).click();
    await page.getByText("Restored synthetic-browser-test.csv.").waitFor();
    await page.getByRole("link", { name: "Discovery Catalogue", exact: true }).click();
    await page.locator("#filter").fill("nothing");
    await page.getByText("No candidate records match.").waitFor();
    await page.locator("#filter").fill("synthetic");
    await page.getByRole("button", { name: "Inspect", exact: true }).first().click();
    await page.getByRole("heading", { name: "Candidate Investigation", level: 1 }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of pages) {
      await page.getByRole("link", { name, exact: true }).click();
      await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
    }
    await page.getByRole("link", { name: "Planet Discovery", exact: true }).click();
    if (screenshots) await page.screenshot({ path: screenshots + "/AstroLens_Mobile.png", fullPage: true });
    await page.getByRole("link", { name: "Classic astronomy tools" }).click();
    await page.waitForURL("**/classic.html");
    assert.deepEqual(errors, []);
    console.log("Browser workflow passed on desktop and mobile.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
