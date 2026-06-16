// Thin wrapper around the public BluKit API.
// In dev, requests go through the Vite proxy (/api/blukit -> https://blupix.app).
const BASE = '/api/blukit'

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.json()
}

// Collection-wide static data: stages, base colors, family definitions.
export function fetchCatalog() {
  return getJSON('/catalog')
}

// Authoritative numeric family-id <-> family-key mapping (lineage id for T2+).
export function fetchColorMerge() {
  return getJSON('/colors/merge')
}

// A holder's full inventory.
export function fetchWallet(address) {
  return getJSON(`/wallet/${address.trim().toLowerCase()}`)
}

export function tokenImage(tokenId) {
  return `${BASE}/token/${tokenId}/image.svg`
}

// Per-color cheapest T1 listing prices (ETH) + ETH/USD, via the server proxy.
export async function fetchPriceColors() {
  const res = await fetch('/api/price/colors')
  if (!res.ok) throw new Error(`price -> HTTP ${res.status}`)
  return res.json()
}

// Pixel-art render for any form by stage + lineage (color id for T1, family id
// for T2+) + form index (position in the catalog t2/t3 arrays).
export function renderUrl(stage, lineage, form = 0) {
  return `${BASE}/render?stage=${stage}&lineage=${lineage}&form=${form}`
}
