import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, fetchColorMerge, fetchWallet, fetchPriceColors } from './api'
import { buildModel, buildInventory, planFamily, buildTree, summarize } from './craft'
import { Summary } from './components/Summary.jsx'
import { FloorCards } from './components/FloorCards.jsx'
import { FamilySelector } from './components/FamilySelector.jsx'
import { FamilyTree } from './components/FamilyTree.jsx'
import { WishlistTab } from './components/WishlistTab.jsx'

export default function App() {
  const [model, setModel] = useState(null)
  const [modelErr, setModelErr] = useState(null)

  const [address, setAddress] = useState('')
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selectedId, setSelectedId] = useState(0) // family id of the active tree
  const [tab, setTab] = useState('tree')          // 'tree' | 'wishlist'
  const [wish, setWish] = useState({})            // { familyId: quantity }

  // Market prices (floors + per-color listings + ETH/USD). Fetched once up front
  // so the entry floor cards and wallet value work before any wallet lookup.
  const [prices, setPrices] = useState(null)
  const [priceState, setPriceState] = useState({ loading: true, error: null })
  const loadPrices = () => {
    setPriceState({ loading: true, error: null })
    fetchPriceColors()
      .then((p) => { setPrices(p); setPriceState({ loading: false, error: null }) })
      .catch((e) => setPriceState({ loading: false, error: e.message }))
  }

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchColorMerge()])
      .then(([cat, merge]) => setModel(buildModel(cat, merge)))
      .catch((e) => setModelErr(e.message))
    loadPrices()
  }, [])

  async function lookup(addr) {
    const a = (addr ?? address).trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
      setError('Enter a valid 0x... wallet address.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const w = await fetchWallet(a)
      setWallet(w)
      setAddress(a)
    } catch (e) {
      setError(e.message)
      setWallet(null)
    } finally {
      setLoading(false)
    }
  }

  const { inv, summary } = useMemo(() => {
    if (!model || !wallet) return {}
    const inv = buildInventory(wallet.tokens, model)
    return { inv, summary: summarize(inv, model) }
  }, [model, wallet])

  const tree = useMemo(() => {
    if (!model || !inv) return null
    const fam = model.familyById[selectedId]
    return fam ? buildTree(fam, inv, model) : null
  }, [model, inv, selectedId])

  // Selector badge: how many of this family's T4 the holder could craft.
  const hintFor = useMemo(() => {
    if (!model || !inv) return null
    return (fam) => planFamily(fam, inv, model).maxT4
  }, [model, inv])

  const wishCount = Object.values(wish).reduce((a, b) => a + b, 0)

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <div className="hero-intro">
            <h1><span className="logo-dot" /> Blupets Holder Dashboard</h1>
            <p className="sub">Enter a wallet to see its summary, then pick an evolution tree to explore the T2 / T3 / T4 path and what you're missing.</p>
          </div>
          <FloorCards prices={prices} priceState={priceState} />
        </div>

        <div className="search">
          <input
            value={address}
            placeholder="0x... wallet address"
            spellCheck={false}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <button className="primary" onClick={() => lookup()} disabled={loading || !model}>
            {loading ? 'Loading…' : 'View'}
          </button>
        </div>

        {modelErr && <div className="banner error">Failed to load collection data: {modelErr}</div>}
        {error && <div className="banner error">{error}</div>}
        {!model && !modelErr && <div className="banner">Loading collection data…</div>}
      </header>

      {summary && (
        <>
          <Summary summary={summary} inv={inv} address={wallet.wallet} prices={prices} />

          <div className="tabs">
            <button className={`tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')}>
              🌳 Family Tree
            </button>
            <button className={`tab ${tab === 'wishlist' ? 'active' : ''}`} onClick={() => setTab('wishlist')}>
              ⭐ Wishlist
              {wishCount > 0 && <span className="tab-badge">{wishCount}</span>}
            </button>
          </div>

          {tab === 'tree' ? (
            <>
              <FamilySelector
                families={model.families}
                selectedId={selectedId}
                onSelect={setSelectedId}
                hintFor={hintFor}
              />

              {tree && (
                <>
                  <div className="tree-title">
                    <span className="tree-dot" style={{ background: tree.family.hex }} />
                    <h2>{tree.family.t4}</h2>
                    <span className="muted">{tree.family.name} ailesi · {tree.family.pair.join(' + ')}</span>
                  </div>
                  <FamilyTree tree={tree} />
                </>
              )}
            </>
          ) : (
            <WishlistTab
              families={model.families}
              inv={inv}
              model={model}
              wish={wish}
              setWish={setWish}
              prices={prices}
              priceState={priceState}
              onRefresh={loadPrices}
            />
          )}
        </>
      )}

      <footer className="foot">
        Data: <code>blupix.app/api/blukit</code> · Prices: <code>OpenSea</code> · Contracts are the on-chain source of truth; this panel is a read-only layer.
        {model && <> · Merge: T1×2→T2, T2×2→T3, T3×2→T4 (keeper stays, donors burn).</>}
      </footer>
    </div>
  )
}
