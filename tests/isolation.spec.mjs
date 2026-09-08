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

await teardown()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`)
process.exit(failed.length ? 1 : 0)