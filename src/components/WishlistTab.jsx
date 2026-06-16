// Wishlist tab: pick the T4s you want (left), see a live "cart" of required
// base colors and quantities (right).
import { useState } from 'react'
import { renderUrl } from '../api'
import { computeWishlist, computeCost, baseCostForT4 } from '../craft'

const fmtEth = (n) => `${n.toFixed(n < 0.1 ? 4 : 3)} Ξ`
const fmtUsd = (n) => `$${Math.round(n).toLocaleString('en-US')}`
const agoMin = (ts) => Math.max(0, Math.round((Date.now() - ts) / 60000))

function costLabel(fam, model) {
  const cost = baseCostForT4(fam)
  return Object.entries(cost)
    .map(([cid, n]) => `${n}× ${model.baseColors[cid].name}`)
    .join(' + ')
}

function WishCard({ fam, qty, model, onChange }) {
  const sel = qty > 0
  return (
    <div className={`wish-card ${sel ? 'sel' : ''}`} style={{ '--fam': fam.hex }}>
      <div className="wish-art">
        <img src={renderUrl(4, fam.id, 0)} alt={fam.t4} width={84} height={84} loading="lazy" />
      </div>
      <div className="wish-name">{fam.t4}</div>
      <div className="wish-pair">
        {fam.pair.map((p, i) => (
          <span className="chip" key={i}>
            <span className="chip-swatch" style={{ background: model.baseColors[fam.pairColorIds[i]].hex }} />
            {p}
          </span>
        ))}
      </div>
      <div className="wish-cost">{fam.name} · {costLabel(fam, model)}</div>
      {sel ? (
        <div className="qty">
          <button onClick={() => onChange(qty - 1)} aria-label="decrease">−</button>
          <span>{qty}</span>
          <button onClick={() => onChange(qty + 1)} aria-label="increase">+</button>
        </div>
      ) : (
        <button className="wish-add" onClick={() => onChange(1)}>+ Add</button>
      )}
    </div>
  )
}

function Cart({ selected, wish, res, model, cost, priceState, onQty, onClear, onRefresh }) {
  return (
    <aside className="wish-cart card">
      <div className="cart-head">
        <h3>🛒 Cart</h3>
        {res.totalT4 > 0 && <button className="ghost small-btn" onClick={onClear}>Clear</button>}
      </div>

      {selected.length === 0 ? (
        <div className="muted cart-empty">Cart is empty. Add T4s from the left — the required base colors add up here.</div>
      ) : (
        <>
          <div className="cart-items">
            {selected.map((f) => (
              <div className="cart-item" key={f.id} style={{ '--fam': f.hex }}>
                <img className="cart-thumb" src={renderUrl(4, f.id, 0)} alt={f.t4} width={42} height={42} loading="lazy" />
                <div className="cart-item-info">
                  <div className="cart-item-name">{f.t4}</div>
                  <div className="muted small">{costLabel(f, model)}</div>
                </div>
                <div className="qty mini">
                  <button onClick={() => onQty(f.id, wish[f.id] - 1)} aria-label="decrease">−</button>
                  <span>{wish[f.id]}</span>
                  <button onClick={() => onQty(f.id, wish[f.id] + 1)} aria-label="increase">+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-section-title">Required base colors</div>
          <div className="cart-summary">
          <div className="cart-colors">
            {res.perColor.map((c) => {
              const row = cost?.rows?.[c.id]
              return (
                <div className="cart-color" key={c.id}>
                  <span className="bar-swatch" style={{ background: c.hex }} />
                  <span className="cart-color-name">{c.name}</span>
                  <span className="cart-color-have muted small">{c.have}/{c.gross}</span>
                  <span className="cart-color-still">
                    {c.still > 0 ? <span className="accent-need">+{c.still}</span> : <span className="accent-good">✓</span>}
                  </span>
                  <span className="cart-color-cost muted small">
                    {c.still > 0 && row ? (row.short > 0 ? `${fmtEth(row.costEth)}+` : fmtEth(row.costEth)) : ''}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="cart-total">
            <div className="cart-total-row"><span>Total T4</span><strong>{res.totalT4}</strong></div>
            <div className="cart-total-row"><span>Total base</span><strong>{res.totalBaseGross}</strong></div>
            <div className="cart-total-row big"><span>Still to collect</span><strong className="accent-need">{res.totalStill}</strong></div>
          </div>

          {res.totalStill > 0 && (
            <div className="cart-cost">
              <div className="cart-section-title">Estimated cost · cheapest {res.totalStill} listings</div>
              {priceState.loading ? (
                <div className="muted small">Loading prices…</div>
              ) : priceState.error ? (
                <div className="muted small">Couldn't load prices. <button className="linklike" onClick={onRefresh}>retry</button></div>
              ) : cost ? (
                <>
                  <div className="cost-big">{fmtEth(cost.totalEth)} <span className="muted">≈ {fmtUsd(cost.usd)}</span></div>
                  {cost.shortage && <div className="hint">Some colors don't have enough listings — the shortfall isn't included in the price (+).</div>}
                  <div className="cart-cost-foot muted small">
                    OpenSea · {agoMin(cost.updatedAt)} min ago · excl. gas/fees · <button className="linklike" onClick={onRefresh}>refresh</button>
                  </div>
                  <a className="os-link" href="https://opensea.io/collection/blupets" target="_blank" rel="noopener noreferrer">
                    View on OpenSea →
                  </a>
                </>
              ) : null}
            </div>
          )}

          {res.creditedHigherTier && <div className="hint">Your T2/T3/T4 are credited as base equivalents.</div>}
          </div>{/* /cart-summary */}
        </>
      )}
    </aside>
  )
}

export function WishlistTab({ families, inv, model, wish, setWish, prices, priceState, onRefresh }) {
  const res = computeWishlist(wish, inv, model)
  // Default: top group open, bottom collapsed.
  const [open, setOpen] = useState({ pure: true, mixed: false })
  const cost = computeCost(res.perColor, prices)
  const setQty = (id, q) =>
    setWish((w) => {
      const n = { ...w }
      if (q <= 0) delete n[id]
      else n[id] = q
      return n
    })

  const pure = families.filter((f) => f.isSameColor)
  const mixed = families.filter((f) => !f.isSameColor)
  const selected = families.filter((f) => wish[f.id] > 0)

  const group = (key, title, list) => {
    const isOpen = open[key]
    const selCount = list.reduce((s, f) => s + (wish[f.id] ? 1 : 0), 0)
    return (
      <div className="fam-group">
        <button className="group-toggle" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} aria-expanded={isOpen}>
          <span className={`chevron ${isOpen ? 'open' : ''}`}>▶</span>
          <span className="group-toggle-title">{title}</span>
          <span className="muted small">{list.length}</span>
          {selCount > 0 && <span className="group-count">{selCount} selected</span>}
        </button>
        {isOpen && (
          <div className="wish-grid">
            {list.map((f) => (
              <WishCard key={f.id} fam={f} qty={wish[f.id] || 0} model={model} onChange={(q) => setQty(f.id, q)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="wish-layout">
      <div className="wish-main">
        {group('pure', 'Pure colors', pure)}
        {group('mixed', 'Mixes', mixed)}
      </div>
      <Cart
        selected={selected}
        wish={wish}
        res={res}
        model={model}
        cost={cost}
        priceState={priceState}
        onQty={setQty}
        onClear={() => setWish({})}
        onRefresh={onRefresh}
      />
    </div>
  )
}
