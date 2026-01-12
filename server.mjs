import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;
const APP_API_KEY = process.env.PLAYWRIGHT_API_KEY || process.env.API_KEY;

function checkKey(req) {
  const key = req.headers["x-api-key"] || req.body?.apiKey;
  if (!APP_API_KEY) return true;
  return key === APP_API_KEY;
}

app.get("/", (_req, res) => {
  res.send("Playwright scraper is running");
});

async function scrapeWithPlaywright({ url, takeScreenshot }) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });

  const title = await page.title();
  const textContent = await page.textContent("body");
  const html = await page.content();

  let screenshotBase64 = null;
  if (takeScreenshot) {
    const buffer = await page.screenshot({ fullPage: true });
    screenshotBase64 = buffer.toString("base64");
  }

  await browser.close();

  return { url, title, textContent, html, screenshotBase64 };
}

app.post("/scrape", async (req, res) => {
  try {
    if (!checkKey(req)) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const { url, screenshot } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    const result = await scrapeWithPlaywright({
      url,
      takeScreenshot: !!screenshot
    });

    return res.json(result);
  } catch (err) {
    console.error("SCRAPE_ERROR:", err);
    return res.status(500).json({ error: "Scrape failed" });
  }
});

app.post("/screenshot", async (req, res) => {
  try {
    if (!checkKey(req)) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    const result = await scrapeWithPlaywright({
      url,
      takeScreenshot: true
    });

    return res.json({
      url: result.url,
      title: result.title,
      screenshotBase64: result.screenshotBase64
    });
  } catch (err) {
    console.error("SCREENSHOT_ERROR:", err);
    return res.status(500).json({ error: "Screenshot failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
