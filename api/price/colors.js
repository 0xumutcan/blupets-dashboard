// Vercel serverless function -> GET /api/price/colors
// Shares the exact logic used by the Vite dev middleware. The OpenSea key lives
// here (server-side), read from the OPENSEA_KEY env var on Vercel.
import { priceColors } from '../../server/price.mjs'

export default async function handler(req, res) {
  try {
    const data = await priceColors()
    // Cache at Vercel's edge for 2 min so repeat hits don't re-invoke / re-fetch.
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    res.status(200).json(data)
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}
