import { chromium, webkit, firefox } from 'playwright';
for (const [name, t] of [['chromium',chromium],['webkit',webkit],['firefox',firefox]]) {
  const b = await t.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:3005/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  // sample nav width every frame while we trigger the collapse
  const sampler = p.evaluate(() => new Promise(res => {
    const nav = document.querySelector('[data-vane]');
    const w = []; const t0 = performance.now();
    const tick = () => { w.push(+nav.getBoundingClientRect().width.toFixed(2));
      if (performance.now() - t0 < 900) requestAnimationFrame(tick); else res(w); };
    requestAnimationFrame(tick);
  }));
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(25); }
  const w = await sampler;
  const uniq = [...new Set(w)];
  const inter = uniq.filter(v => v !== w[0] && v !== w[w.length-1]).length;
  console.log(`${name.padEnd(9)} ${w[0]} → ${w[w.length-1]}  uniq=${String(uniq.length).padStart(3)} inter=${String(inter).padStart(3)}  ${inter>=5?'TWEENED':'*** SNAPPED ***'}`);
  await b.close();
}
