import { chromium, webkit, firefox } from 'playwright';
const url = 'file://' + process.cwd() + '/grid-morph.html';

const analyse = (w) => {
  const uniq = [...new Set(w)];
  const start = w[0], end = w[w.length - 1];
  const inter = uniq.filter(v => v !== start && v !== end).length;
  // monotonic? (allow equal steps)
  let mono = true;
  const dir = Math.sign(end - start);
  for (let i = 1; i < w.length; i++) {
    if (dir > 0 && w[i] < w[i-1] - 0.5) mono = false;
    if (dir < 0 && w[i] > w[i-1] + 0.5) mono = false;
  }
  return { start, end, steps: uniq.length, intermediates: inter, monotonic: mono,
           tweened: inter >= 5 };
};

for (const [name, type] of [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]) {
  const b = await type.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  await p.goto(url);
  const sup = await p.evaluate(() => window.__support);
  console.log(`\n=== ${name.toUpperCase()} ===`);
  console.log('  support:', Object.entries(sup).map(([k,v]) => `${k}=${v}`).join('  '));
  for (const id of ['a','b','c','d']) {
    const pr = p.evaluate((i) => window.__sample(i, 500), id);
    await p.evaluate((i) => window.__go(i), id);
    const widths = await pr;
    const r = analyse(widths);
    console.log(`  ${id}: ${String(r.start).padStart(7)} → ${String(r.end).padStart(7)}  ` +
      `steps=${String(r.steps).padStart(3)} inter=${String(r.intermediates).padStart(3)} ` +
      `mono=${r.monotonic ? 'Y' : 'N'}  ${r.tweened ? 'TWEENED' : '*** SNAPPED ***'}`);
  }
  await b.close();
}
