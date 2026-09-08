import fs from 'node:fs'
import {
  ensureBrowsers, startPreview, launch, newPage, enterDemo, openTools,
  readRealKeys, readKeys, readDemoPages, waitPersist, teardown,
  REAL_KEYS, DEMO_KEYS, BASE,
} from './helpers/demo-harness.mjs'

const SEED_PAGES = [
  { id: 'cover', background: '#f0e6d3', pattern: 'blank', elements: [] },
  {
    id: 'page-1', background: '#f0e6d3', pattern: 'grid', gridSize: 40,
    elements: [{
      id: 'legacy-el', type: 'text', x: 50, y: 50, width: 200, height: 40,
      rotation: 0, zIndex: 1,
      data: { text: 'Real journal', font: 'Caveat', fontSize: 24, color: '#2c3e50', textAlign: 'left' },
    }],
  },
  { id: 'page-2', background: '#f0e6d3', pattern: 'grid', gridSize: 40, elements: [] },
]
const SEED_META = {
  anniversaryDate: '01.01.2030',
  milestones: [{ id: 'm-seed', label: 'Existing milestone', emoji: '⭐', done: false }],
  occasions: [],
  journeyDetails: { title: 'Real Trip', dates: 'Jan 2026', destination: 'Home', flag: '🏠' },
}
const LEGACY_SEED = {
  journal_pages: JSON.stringify(SEED_PAGES),
  journal_metadata: JSON.stringify(SEED_META),
  journal_anon_uid: 'seed-uid',
  journal_book_closed: '0',
}

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
function assert(cond, msg) { if (!cond) throw new Error(msg) }
async function scenario(browser, name, fn) {
  try { await fn(browser) } catch (e) { record(name, false, `uncaught: ${e && e.stack ? e.stack : e}`) }
}
function totalElements(pages) {
  return (pages || []).reduce((n, p) => n + (p.elements ? p.elements.filter(e => !e.data?._deleted).length : 0), 0)
}

ensureBrowsers()
await startPreview()
const browser = await launch()

// SC-001 — Fresh demo entry shows sample content and never touches the real journal.
await scenario(browser, 'SC-001 fresh demo entry shows sample content', async (b) => {
  const { ctx, page } = await newPage(b, {})
  try {
    await page.getByRole('button', { name: /Sign in with Google/ }).waitFor({ timeout: 8000 })
    // Baseline: the app may seed a default `journal_metadata` on first load
    // regardless of demo; capture it before any demo interaction.
    const baseline = await readRealKeys(page)
    await enterDemo(page)
    assert(await page.getByTitle(/Leave the demo/).count() === 1, 'DemoChip close (Sign out) visible')
    assert(await page.getByText('Sign in to save', { exact: true }).count() === 1, 'DemoChip "Sign in to save" visible')
    const pages = await readDemoPages(page)
    assert(Array.isArray(pages) && pages.length >= 1 && pages.every(p => Array.isArray(p.elements)), 'demo sample content seeded into demo:pages')
    const real = await readRealKeys(page)
    for (const k of REAL_KEYS) assert(real[k] === baseline[k], `${k} unchanged by entering demo`)
    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('SC-001 fresh demo entry shows sample content', true)
  } finally { await ctx.close() }
})

// SC-002 — Zero requests/writes to firebaseio paths while demo editing, real keys untouched.
await scenario(browser, 'SC-002 zero firebaseio during demo editing', async (b) => {
  const { ctx, page } = await newPage(b, {})
  try {
    const baseline = await readRealKeys(page)
    await enterDemo(page)
    await page.getByTitle('Open sidebar').click()
    const aniv = page.getByPlaceholder('DD.MM.YYYY').first()
    await aniv.waitFor({ timeout: 8000 })
    await aniv.fill('15.08.2030')
    await openTools(page)
    await page.getByTitle('History').click()
    const saveBtn = page.getByRole('button', { name: 'Save Checkpoint' })
    await saveBtn.waitFor({ timeout: 8000 })
    await saveBtn.click()
    await waitPersist()
    assert(page.__rtdbCount === 0, `zero RTDB requests (got ${page.__rtdbCount})`)
    const real = await readRealKeys(page)
    for (const k of REAL_KEYS) assert(real[k] === baseline[k], `${k} unchanged after demo edits`)
    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('SC-002 zero firebaseio during demo editing', true)
  } finally { await ctx.close() }
})

// SC-003 — Signed-in journal bytes identical before/after demo round trip.
await scenario(browser, 'SC-003 signed-in bytes identical after demo', async (b) => {
  const { ctx, page } = await newPage(b, { seeds: LEGACY_SEED })
  try {
    const before = await readRealKeys(page)
    await enterDemo(page)
    await page.getByTitle('Open sidebar').click()
    const aniv = page.getByPlaceholder('DD.MM.YYYY').first()
    await aniv.waitFor({ timeout: 8000 })
    await aniv.fill('02.02.2040')
    await waitPersist()
    await page.getByTitle(/Leave the demo/).click()
    await page.getByRole('button', { name: /Try the demo journey/ }).waitFor({ timeout: 8000 })
    const after = await readRealKeys(page)
    for (const k of REAL_KEYS) assert(after[k] === before[k], `${k} byte-identical before/after demo`)
    assert(page.__rtdbCount === 0, 'no RTDB during demo')
    record('SC-003 signed-in bytes identical after demo', true)
  } finally { await ctx.close() }
})

// SC-004 — Anonymous demo book is fully isolated: real journal content can
// never leak into the demo, and previously-migrated copies are purged once.
const DEMO_MIGRATED_SEED = {
  ...LEGACY_SEED,
  'demo:uid': 'demo',
  'demo:migrated-legacy-once': '1',
  'demo:pages': JSON.stringify(SEED_PAGES),
  'demo:metadata': JSON.stringify(SEED_META),
}

await scenario(browser, 'SC-004 real journal never leaks into demo (fresh visitor)', async (b) => {
  const { ctx, page } = await newPage(b, { seeds: LEGACY_SEED })
  try {
    await enterDemo(page)
    const k1 = await readKeys(page, ['demo:migrated-legacy-once'])
    assert(k1['demo:migrated-legacy-once'] === null, 'no migration marker written')
    const demoPages = await readDemoPages(page)
    const allEls = (demoPages || []).flatMap(p => p.elements || [])
    assert(!allEls.some(e => e.id === 'legacy-el'), 'demo does not contain the legacy real-journal element')
    const meta = JSON.parse((await readKeys(page, ['demo:metadata']))['demo:metadata'])
    assert(meta.journeyDetails?.title !== 'Real Trip', 'demo metadata not imported from the real journal')
    assert(!(meta.milestones || []).some(m => m.id === 'm-seed'), 'demo has none of the real journal milestones')
    const real = await readRealKeys(page)
    for (const rk of REAL_KEYS) assert(real[rk] === LEGACY_SEED[rk], `${rk} byte-identical`)
    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('SC-004 real journal never leaks into demo (fresh visitor)', true)
  } finally { await ctx.close() }
})

await scenario(browser, 'SC-004b previously-migrated demo copy is purged once', async (b) => {
  const { ctx, page } = await newPage(b, { seeds: DEMO_MIGRATED_SEED })
  try {
    // A browser that ran the pre-demo migration holds a copy of the real
    // journal in demo:pages/demo:metadata. The app must drop it at startup
    // before it can render — the returned demo auto-restores onto a fresh seed.
    await page.getByText(/Pg\s+\d/).waitFor({ timeout: 10000 })
    const k1 = await readKeys(page, ['demo:migrated-legacy-once', 'demo:pages', 'demo:metadata'])
    assert(k1['demo:migrated-legacy-once'] === null, 'migration marker cleared after purge')
    const demoPages = JSON.parse(k1['demo:pages'])
    const allEls = (demoPages || []).flatMap(p => p.elements || [])
    assert(!allEls.some(e => e.id === 'legacy-el'), 'purged demo no longer holds the real-journal element')
    assert(JSON.parse(k1['demo:metadata']).journeyDetails?.title !== 'Real Trip', 'purged demo metadata re-seeded (no Real Trip)')
    assert(await page.getByText('legacy-el', { exact: false }).count() === 0, 'no tainted element rendered in the live book')
    const real = await readRealKeys(page)
    for (const rk of REAL_KEYS) assert(real[rk] === LEGACY_SEED[rk], `${rk} byte-identical`)
    // Reload + leave/enter stays on the fresh seed — the purge ran exactly once.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText(/Pg\s+\d/).waitFor({ timeout: 10000 })
    const k2 = await readKeys(page, ['demo:migrated-legacy-once', 'demo:pages'])
    assert(k2['demo:migrated-legacy-once'] === null, 'marker stays cleared — no re-purge loop')
    const els2 = JSON.parse(k2['demo:pages']).flatMap(p => p.elements || [])
    assert(!els2.some(e => e.id === 'legacy-el'), 're-entered demo still isolated')
    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('SC-004b previously-migrated demo copy is purged once', true)
  } finally { await ctx.close() }
})

// SC-006 — Two tabs in one context: demo metadata stays isolated (no cross-tab echo).
await scenario(browser, 'SC-006 two-tab metadata isolation', async (b) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } })
  try {
    const pA = await ctx.newPage(); await pA.goto(BASE, { waitUntil: 'domcontentloaded' })
    const pB = await ctx.newPage(); await pB.goto(BASE, { waitUntil: 'domcontentloaded' })
    await enterDemo(pA); await enterDemo(pB)
    await pA.getByTitle('Open sidebar').click()
    const aInput = pA.getByPlaceholder('DD.MM.YYYY').first(); await aInput.waitFor({ timeout: 8000 })
    const origA = await aInput.inputValue()
    await pB.getByTitle('Open sidebar').click()
    const bInput = pB.getByPlaceholder('DD.MM.YYYY').first(); await bInput.waitFor({ timeout: 8000 })
    const origB = await bInput.inputValue()
    assert(origA === origB, 'both tabs share the same demo metadata')
    await aInput.fill('11.11.2099')
    await waitPersist()
    const afterB = await bInput.inputValue()
    assert(afterB === origB, `tab B unchanged while tab A edits (still ${afterB})`)
    record('SC-006 two-tab metadata isolation', true)
  } finally { await ctx.close() }
})

// SC-009 — Demo persists across reload (no AuthScreen, edits survive).
await scenario(browser, 'SC-009 demo persists across reload', async (b) => {
  const { ctx, page } = await newPage(b, {})
  try {
    await enterDemo(page)
    await page.getByTitle('Open sidebar').click()
    await page.locator('button:has(svg.lucide-plus)').first().click()
    const input = page.getByPlaceholder("What's next?")
    await input.waitFor({ timeout: 8000 })
    await input.fill('Persist me')
    await input.press('Enter')
    await waitPersist()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText(/Pg\s+\d/).waitFor({ timeout: 10000 })
    assert(await page.getByText(/Try the demo journey/).count() === 0, 'no AuthScreen after reload')
    const metaRaw = await readKeys(page, ['demo:metadata'])
    const meta = JSON.parse(metaRaw['demo:metadata'])
    assert(meta.milestones && meta.milestones.some(m => m.label === 'Persist me'), 'milestone persisted in demo:metadata')
    await page.getByTitle('Open sidebar').click()
    await page.getByText('Persist me', { exact: true }).waitFor({ timeout: 8000 })
    record('SC-009 demo persists across reload', true)
  } finally { await ctx.close() }
})

// FR-013 — Demo interaction parity: add element → undo → add page → checkpoint no-throw → backup.
await scenario(browser, 'FR-013 demo interaction parity smoke', async (b) => {
  const { ctx, page } = await newPage(b, {})
  try {
    await enterDemo(page)
    const basePages = (await readDemoPages(page)) || []
    const baseCount = totalElements(basePages)
    const baseLen = basePages.length

    await openTools(page)
    await page.getByTitle('Text').click()
    const addText = page.getByText('Add Text', { exact: true })
    await addText.waitFor({ timeout: 8000 })
    await addText.click()
    await waitPersist()
    const afterAdd = totalElements(await readDemoPages(page))
    assert(afterAdd === baseCount + 1, `add element → +1 element (${baseCount} → ${afterAdd})`)

    await page.getByText(/Pg\s+\d/).click()
    await page.keyboard.press('Control+z')
    await waitPersist()
    const afterUndo = totalElements(await readDemoPages(page))
    assert(afterUndo === baseCount, `undo reverts element (${afterAdd} → ${afterUndo})`)

    const indicator = page.getByText(/Pg\s+\d/)
    const addPageBtn = indicator.locator('xpath=following-sibling::button[1]')
    await addPageBtn.click()
    await waitPersist()
    const afterPage = (await readDemoPages(page)) || []
    // addPage appends a full 2-page spread by design.
    assert(afterPage.length === baseLen + 2, `add page → +1 spread (${baseLen} → ${afterPage.length})`)

    await openTools(page)
    await page.getByTitle('History').click()
    const saveBtn = page.getByRole('button', { name: 'Save Checkpoint' })
    await saveBtn.waitFor({ timeout: 8000 })
    await saveBtn.click()
    await waitPersist()
    assert((await page.getByText('No checkpoints yet', { exact: false }).count()) >= 1, 'refreshCheckpoints/loadCheckpoint no-throw (empty list in demo)')

    await page.getByTitle('Open sidebar').click()
    await page.getByTitle('Export page').hover()
    const dlP = page.waitForEvent('download')
    await page.getByText('Download Backup', { exact: true }).click()
    const dl = await dlP
    const text = fs.readFileSync(await dl.path(), 'utf8')
    const backup = JSON.parse(text)
    assert(Array.isArray(backup.pages) && backup.pages.length > 0, 'backup contains local pages')
    assert(backup.checkpoint === null, 'backup has no cloud checkpoint (fbSync null)')
    assert(backup.metadata && typeof backup.metadata === 'object', 'backup contains metadata')
    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('FR-013 demo interaction parity smoke', true)
  } finally { await ctx.close() }
})

// SC-010 — Duplicate-collapse heal: a messy visual stack in stored pages is
// collapsed to one per visual on load (same collapse the cloud merge uses).
const MESSY_PAGES = [
  { id: 'cover', background: '#f0e6d3', pattern: 'blank', elements: [] },
  {
    id: 'page-1', background: '#f0e6d3', pattern: 'grid', gridSize: 40,
    elements: [
      { id: 'stk-1', type: 'sticker', x: 120, y: 90, width: 100, height: 100, rotation: 0, zIndex: 1, data: { src: '🎀', label: 'Heart', _updatedAt: 100 } },
      { id: 'stk-2', type: 'sticker', x: 121, y: 92, width: 100, height: 100, rotation: 0, zIndex: 1, data: { src: '🎀', label: 'Heart', _updatedAt: 200 } },
      { id: 'txt-1', type: 'text', x: 300, y: 200, width: 200, height: 50, rotation: 0, zIndex: 1, data: { text: '', font: 'Caveat', fontSize: 24, color: '#2c3e50', textAlign: 'left', _updatedAt: 100 } },
      { id: 'txt-2', type: 'text', x: 301, y: 201, width: 200, height: 50, rotation: 0, zIndex: 1, data: { text: '', font: 'Caveat', fontSize: 24, color: '#2c3e50', textAlign: 'left', _updatedAt: 300 } },
      { id: 'lone', type: 'sticker', x: 500, y: 400, width: 100, height: 100, rotation: 0, zIndex: 1, data: { src: '🌸', _updatedAt: 150 } },
    ],
  },
  { id: 'page-2', background: '#f0e6d3', pattern: 'grid', gridSize: 40, elements: [] },
]
const MESSY_SEED = { 'demo:uid': 'demo', 'demo:pages': JSON.stringify(MESSY_PAGES) }

await scenario(browser, 'SC-010 stacked duplicates collapse to one visual on load', async (b) => {
  const { ctx, page } = await newPage(b, { seeds: MESSY_SEED })
  try {
    await page.getByText(/Pg\s+\d/).waitFor({ timeout: 10000 })
    await page.waitForTimeout(600)
    const rendered = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-elem-id]')).map(el => el.getAttribute('data-elem-id'))
    )
    assert(rendered.length === 3, `messy stack collapsed to 3 rendered visuals (got ${rendered.length}: ${rendered.join(', ')})`)
    assert(rendered.includes('stk-2'), 'newest sticker copy rendered')
    assert(!rendered.includes('stk-1'), 'older sticker duplicate not rendered')
    assert(rendered.includes('txt-2'), 'newest empty-text placeholder rendered')
    assert(!rendered.includes('txt-1'), 'older empty-text placeholder not rendered')
    assert(rendered.includes('lone'), 'non-duplicate sticker rendered')
    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('SC-010 stacked duplicates collapse to one visual on load', true)
  } finally { await ctx.close() }
})

// SC-011 — Export: PDF carries EVERY page in the book (not just the visible
// spread) and PNG is one sheet of all pages; pages render with the real page
// chrome.
const EXPORT_PAGES = [
  { id: 'cover', background: '#c39b6e', pattern: 'blank', elements: [
    { id: 'cvt', type: 'text', x: 200, y: 360, width: 240, height: 60, rotation: 0, zIndex: 1, data: { text: 'Our Trip', font: 'Playfair Display', fontSize: 40, color: '#ffffff', _updatedAt: 1 } },
  ] },
  { id: 'page-1', background: '#fdf6e3', pattern: 'dots', gridSize: 36, elements: [
    { id: 'e1', type: 'sticker', x: 60, y: 80, width: 100, height: 100, rotation: 0, zIndex: 1, data: { src: '🌊', _updatedAt: 2 } },
    { id: 'e2', type: 'text', x: 90, y: 220, width: 300, height: 60, rotation: 0, zIndex: 1, data: { text: 'Wave day!', font: 'Caveat', fontSize: 34, color: '#2c3e50', _updatedAt: 3 } },
    { id: 'e3', type: 'drawing', x: 80, y: 300, width: 260, height: 120, rotation: 0, zIndex: 1, data: { paths: ['M 0 20 L 40 60 L 80 10 L 120 70 L 160 30 L 200 80 L 260 40'], color: '#d97757', strokeWidth: 4, brush: 'pen', _updatedAt: 4 } },
    { id: 'e4', type: 'emoji', x: 20, y: 500, width: 80, height: 80, rotation: 0, zIndex: 1, data: { emoji: '🐚', _updatedAt: 5 } },
  ] },
  { id: 'page-2', background: '#fdf6e3', pattern: 'grid', gridSize: 40, elements: [
    { id: 'e5', type: 'shape', x: 100, y: 120, width: 160, height: 160, rotation: 0, zIndex: 1, data: { shape: 'circle', fill: '#97a97c', opacity: 0.8, _updatedAt: 6 } },
    { id: 'e6', type: 'sticker', x: 400, y: 240, width: 90, height: 90, rotation: 0, zIndex: 1, data: { src: '🌸', _updatedAt: 7 } },
  ] },
  { id: 'page-3', background: '#fdf6e3', pattern: 'blank', elements: [
    { id: 'e7', type: 'text', x: 60, y: 140, width: 320, height: 80, rotation: 0, zIndex: 1, data: { text: 'Empty note', font: 'Caveat', fontSize: 28, color: '#2c3e50', _updatedAt: 8 } },
  ] },
  { id: 'page-4', background: '#fdf6e3', pattern: 'dots', gridSize: 28, elements: [
    { id: 'e8', type: 'emoji', x: 200, y: 300, width: 100, height: 100, rotation: 0, zIndex: 1, data: { emoji: '💌', _updatedAt: 9 } },
  ] },
]
const EXPORT_SEED = { 'demo:uid': 'demo', 'demo:pages': JSON.stringify(EXPORT_PAGES) }

await scenario(browser, 'SC-011 export PDF has all pages + PNG sheet organized', async (b) => {
  const { ctx, page } = await newPage(b, { seeds: EXPORT_SEED })
  try {
    await page.getByText(/Pg\s+\d/).waitFor({ timeout: 10000 })
    await page.waitForTimeout(600)
    await page.getByTitle('Open sidebar').click()
    await page.getByTitle(/Close sidebar/).waitFor({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(300)

    const exportBtn = page.getByTitle('Export page')
    await exportBtn.hover()
    await page.getByText('Export as PDF', { exact: true }).waitFor({ timeout: 8000 })

    const pdfEvent = page.waitForEvent('download', { timeout: 15000 })
    await page.getByText('Export as PDF', { exact: true }).click()
    const pdf = await pdfEvent
    const pdfName = pdf.suggestedFilename()
    assert(/journal-.*\.pdf$/.test(pdfName), `PDF filename ${pdfName}`)
    const pdfBuf = fs.readFileSync(await pdf.path())
    const pdfHead = pdfBuf.subarray(0, 5).toString()
    assert(pdfHead === '%PDF-', `PDF signature (${pdfHead})`)
    const pdfCount = (pdfBuf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) || []).length
    assert(pdfCount === EXPORT_PAGES.length, `PDF contains all ${EXPORT_PAGES.length} pages (got ${pdfCount})`)
    assert(!pdfBuf.toString('latin1').includes('Tap to start creating'), 'no empty-page placeholder in the export')

    await exportBtn.hover()
    await page.getByText('Export as PNG', { exact: true }).waitFor({ timeout: 8000 }).catch(() => exportBtn.hover())
    const pngEvent = page.waitForEvent('download', { timeout: 15000 })
    await page.getByText('Export as PNG', { exact: true }).click()
    const png = await pngEvent
    const pngBuf = fs.readFileSync(await png.path())
    assert(pngBuf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'PNG signature')
    const w = pngBuf.readUInt32BE(16)
    const h = pngBuf.readUInt32BE(20)
    assert(w > 2000 && h > 2000, `PNG sheet sized for a 2-column grid (${w}×${h})`)

    assert(page.__pageErrors.length === 0, `no page errors (${page.__pageErrors.join('; ')})`)
    record('SC-011 export PDF has all pages + PNG sheet organized', true, `pdf=${pdfCount}p, png=${w}x${h}`)
  } finally { await ctx.close() }
})

await teardown()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`)
process.exit(failed.length ? 1 : 0)