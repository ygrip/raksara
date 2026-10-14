// Local lab samples, not field Core Web Vitals or a hardware GPU benchmark.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.argv[2] ?? 'http://127.0.0.1:4174';
const samples = [];
try {
  for (const path of ['/', '/profile/']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.labMetrics = { lcpMs: null, cls: 0, longTasks: 0 };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.labMetrics.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.labMetrics.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { window.labMetrics.longTasks += list.getEntries().length; })
        .observe({ type: 'longtask', buffered: true });
    });
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    const metrics = async () => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const before = await metrics();
    await page.waitForTimeout(2000);
    const after = await metrics();
    samples.push({
      path, ...await page.evaluate(() => window.labMetrics),
      mainThreadTaskMsOver2s: Number(((after.TaskDuration - before.TaskDuration) * 1000).toFixed(2)),
      layoutMsOver2s: Number(((after.LayoutDuration - before.LayoutDuration) * 1000).toFixed(2)),
      styleMsOver2s: Number(((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000).toFixed(2)),
      errors
    });
    await page.close();
  }
  console.log(JSON.stringify({ environment: 'Unthrottled local headless Chromium; worker/GPU time and INP not measured', samples }, null, 2));
} finally { await browser.close(); }
