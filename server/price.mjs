// Server-side price service. Runs in Node (Vite dev middleware / serverless),
// never in the browser — the OpenSea key stays here.
//
// It returns, per base color, the cheapest LISTED T1 prices (ETH), by querying
// OpenSea's best-listings filtered on the "Lineage" trait (= base color name;
// only T1 tokens carry a color name, T2+ carry family names). Results come
// price-ascending; we dedupe by token (a token can have several listings) and
// keep the cheapest N. The client sums the N cheapest for what it still needs.

const OS = 'https://api.opensea.io/api/v2'
const SLUG = 'blupets'

// OpenSea key. Optional: if empty, the first request auto-mints a free-tier key
// (single-flight, see mintKey). Set OPENSEA_KEY env for a stable/full key.
let osKey = process.env.OPENSEA_KEY || ''

// Base color names indexed by color id (0..7).
const COLOR_NAMES = ['Red', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Black', 'White']

const DEPTH = 30          // cheapest unique-token listings to keep per color
const MAX_PAGES = 5       // listing pages per color (100 each)
const LISTINGS_TTL = 3 * 60 * 1000
const USD_TTL = 5 * 60 * 1000

const cache = { colors: null, colorsAt: 0, floors: null, floorsAt: 0, usd: 0, usdAt: 0 }

// Mint a fresh free-tier key, single-flight so concurrent 401s share one POST
// (avoids hammering the "3 key creations / hour" limit on parallel requests).
let mintPromise = null
function mintKey() {
  if (!mintPromise) {
    mintPromise = fetch(`${OS}/auth/keys`, { method: 'POST' })
      .then((r) => r.json())
      .then((k) => { if (k?.api_key) osKey = k.api_key; return osKey })
      .finally(() => { mintPromise = null })
  }
  return mintPromise
}

async function osFetch(path) {
  if (!osKey) await mintKey() // no key yet — mint one (single-flight)
  const call = () => fetch(`${OS}${path}`, { headers: { 'X-API-KEY': osKey, accept: 'application/json' } })
  let res = await call()
  if (res.status === 401) {
    await mintKey() // key expired/missing — refresh once and retry
    res = await call()
  }
  if (!res.ok) throw new Error(`OpenSea ${path.split('?')[0]} -> ${res.status}`)
  return res.json()
}

// Cheapest DEPTH unique-token base listing prices (ETH, ascending) for one color.
// Lineage=<color> already implies base, but AND Stage=Base is explicit/robust.
// (Note: OpenSea labels the base stage "Base", not "T1".)
async function cheapestForColor(name) {
  const traits = encodeURIComponent(
    JSON.stringify([
      { traitType: 'Lineage', value: name },
      { traitType: 'Stage', value: 'Base' },
    ])
  )
  const prices = []
  const seen = new Set()
  let cursor = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    const d = await osFetch(`/listings/collection/${SLUG}/best?limit=100&traits=${traits}${cursor ? `&next=${cursor}` : ''}`)
    for (const l of d.listings || []) {
      const id = l?.asset?.identifier
      const wei = l?.price?.current?.value
      if (!id || !wei || seen.has(id)) continue // first appearance = cheapest (ascending)
      seen.add(id)
      prices.push(Number(BigInt(wei)) / 1e18)
    }
    if (prices.length >= DEPTH || !d.next) break
    cursor = d.next
  }
  return prices.slice(0, DEPTH)
}

// Cheapest listing price (ETH) for an optional trait filter.
async function floorFor(traitsArr) {
  const q = traitsArr ? `&traits=${encodeURIComponent(JSON.stringify(traitsArr))}` : ''
  const d = await osFetch(`/listings/collection/${SLUG}/best?limit=1${q}`)
  const wei = d.listings?.[0]?.price?.current?.value
  return wei ? Number(BigInt(wei)) / 1e18 : null
}

// Collection floor + per-stage floors used for the entry cards and wallet value.
async function getFloors() {
  if (cache.floors && Date.now() - cache.floorsAt < LISTINGS_TTL) return cache.floors
  const [collection, unrevealed, origin] = await Promise.all([
    floorFor(null),
    floorFor([{ traitType: 'Stage', value: 'Unrevealed' }]),
    floorFor([{ traitType: 'Stage', value: 'Origin' }]),
  ])
  cache.floors = { collection, unrevealed, origin }
  cache.floorsAt = Date.now()
  return cache.floors
}

async function getEthUsd() {
  if (cache.usd && Date.now() - cache.usdAt < USD_TTL) return cache.usd
  try {
    const d = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd').then((r) => r.json())
    cache.usd = d?.ethereum?.usd || 0
    cache.usdAt = Date.now()
  } catch {
    /* keep stale */
  }
  return cache.usd
}

async function getColorPrices() {
  if (cache.colors && Date.now() - cache.colorsAt < LISTINGS_TTL) return cache.colors
  const lists = await Promise.all(COLOR_NAMES.map(cheapestForColor))
  const colors = {}
  lists.forEach((arr, id) => (colors[id] = arr))
  cache.colors = colors
  cache.colorsAt = Date.now()
  return colors
}

export async function priceColors() {
  const [colors, floors, ethUsd] = await Promise.all([getColorPrices(), getFloors(), getEthUsd()])
  return { ethUsd, updatedAt: cache.colorsAt, colors, floors }
}
