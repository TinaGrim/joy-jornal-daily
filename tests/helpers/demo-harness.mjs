import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const PORT = 4317
export const BASE = `http://127.0.0.1:${PORT}/`

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

export const REAL_KEYS = ['journal_pages', 'journal_metadata', 'journal_anon_uid', 'journal_book_closed']
export const DEMO_KEYS = [
  'demo:pages', 'demo:metadata', 'demo:uid', 'demo:migrated-legacy-once',
  'demo:adoption-consumed', 'demo:adoption-intent', 'demo:book_closed',
]

let serverProcess = null
let browser = null

/** Fail fast with an actionable message when the chromium browser is missing. */
export function ensureBrowsers() {
  let execPath
  try {
    execPath = chromium.executablePath()
  } catch {
    execPath = null
  }
  if (!execPath || !fs.existsSync(execPath)) {
    console.error('\n[harness] Playwright chromium is not installed.')
    console.error('[harness] Install it with:')
    console.error('[harness]   npx playwright install chromium\n')
    process.exit(2)
  }
}

/** Serve the built site with `vite preview` and wait until it accepts requests. */
export async function startPreview() {
  serverProcess = spawn(process.execPath, [VITE_BIN, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess.stderr.on('data', d => {
    if (process.env.DEBUG_HARNESS) process.stderr.write(d)
  })
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) break
    try {
      const res = await fetch(BASE)
      if (res.status < 500) return
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 250))
  }
  console.error('[harness] vite preview did not become ready. Run `npm run build` first.')
  process.exit(3)
}

export async function launch() {
  browser = await chromium.launch()
  return browser
}

/** Seed localStorage before any app script runs (per page in this context). */
export function seedKeys(context, keys) {
  return context.addInitScript((k) => {
    for (const [key, value] of Object.entries(k)) {
      try { localStorage.setItem(key, value) } catch { /* ignore */ }
    }
  }, keys)
}

/**
 * Open a fresh page against the app and watch its network + errors.
 * Returns { ctx, page } where page carries counters read by the assertions.
 */
export async function newPage(browser, { seeds = null } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1200 } })
  if (seeds) await seedKeys(ctx, seeds)
  const page = await ctx.newPage()
  page.__rtdbCount = 0
  page.__fbOtherCount = 0
  page.__pageErrors = []
  page.on('pageerror', e => { page.__pageErrors.push(String((e && e.message) || e)) })
  page.on('request', req => {
    try {
      const host = new URL(req.url()).hostname
      if (host.includes('firebasedatabase.app') || host.endsWith('firebaseio.com')) {
        page.__rtdbCount++
      } else if (/(identitytoolkit|securetoken|firestore\.|firebasestorage|firebaseauth)/.test(host)) {
        page.__fbOtherCount++
      }
    } catch { /* ignore */ }
  })
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  return { ctx, page }
}

/** Click the demo entry on AuthScreen and wait for the journal chrome to render. */
export async function enterDemo(page) {
  await page.getByRole('button', { name: /Try the demo journey/ }).click()
  await page.getByText(/Pg\s+\d/).waitFor({ timeout: 10000 })
}

/**
 * Expand the right tools rail so its icon buttons (Photo/Text/History/...) sit
 * inside the visible fold and are action-eligible. The rail is collapsed by
 * default and its icon row is clipped by the rail's overflow, so Playwright
 * reports the buttons as outside the viewport until expanded.
 */
export async function openTools(page) {
  const open = page.getByTitle('Open tools')
  if (await open.count()) {
    await open.click()
    await page.getByTitle('Close tools').waitFor({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

/** Snapshot the real journal localStorage keys (byte-exact). */
export function readRealKeys(page) {
  return page.evaluate((keys) => {
    const out = {}
    for (const k of keys) { try { out[k] = localStorage.getItem(k) } catch { out[k] = null } }
    return out
  }, REAL_KEYS)
}

/** Snapshot a set of localStorage keys. */
export function readKeys(page, keys) {
  return page.evaluate((ks) => {
    const out = {}
    for (const k of ks) { try { out[k] = localStorage.getItem(k) } catch { out[k] = null } }
    return out
  }, keys)
}

/** Parse demo:pages (or null when absent). */
export async function readDemoPages(page) {
  const raw = await page.evaluate(() => {
    try { return localStorage.getItem('demo:pages') } catch { return null }
  })
  return raw ? JSON.parse(raw) : null
}

/** Debounced demo storage writes land after ~2s; wait past that. */
export function waitPersist(ms = 2400) {
  return new Promise(r => setTimeout(r, ms))
}

export async function teardown() {
  if (browser) { await browser.close(); browser = null }
  if (serverProcess) { serverProcess.kill(); serverProcess = null }
}