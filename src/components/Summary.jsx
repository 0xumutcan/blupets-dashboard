// Top summary: total holdings, stage breakdown, base-color distribution.

const STAGE_META = [
  { key: 't0', label: 'T0', name: 'Mystery' },
  { key: 't1', label: 'T1', name: 'Base' },
  { key: 't2', label: 'T2', name: 'Pet' },
  { key: 't3', label: 'T3', name: 'Archetype' },
  { key: 't4', label: 'T4', name: 'Ascended' },
]

export function Summary({ summary, inv, address, prices }) {
  const { stageTotals, colorTotals } = summary
  const maxColor = Math.max(1, ...colorTotals.map((c) => c.count))

  // Wallet value, tier-weighted off the collection (base) floor:
  //   T1 = 1x, T2 = 2x, T3 = 4x, T4 = 8x floor (each tier is worth that many
  //   base tokens). T0 at unrevealed floor, Origin tokens at origin floor.
  const floors = prices?.floors
  const F = floors?.collection
  const value =
    floors && F != null && floors.unrevealed != null && floors.origin != null
      ? stageTotals.t1 * F +
        stageTotals.t2 * 2 * F +
        stageTotals.t3 * 4 * F +
        stageTotals.t4 * 8 * F +
        stageTotals.t0 * floors.unrevealed +
        stageTotals.special * floors.origin
      : null
  const usd = prices?.ethUsd

  return (
    <section className="summary card">
      <div className="summary-head">
        <div>
          <div className="addr">{`${address.slice(0, 5)}...${address.slice(-4)}`}</div>
        </div>
        {value != null && (
          <div className="wallet-value">
            <div className="muted small">Approx. portfolio value</div>
            <div className="wallet-value-eth">{value.toFixed(value < 10 ? 3 : 2)} Ξ</div>
            {usd ? <div className="wallet-value-usd">≈ ${Math.round(value * usd).toLocaleString('en-US')}</div> : null}
          </div>
        )}
        <div className="big-count">
          <span>{inv.total}</span>
          <small>Blupet</small>
        </div>
      </div>

      <div className="stage-row">
        {STAGE_META.map((s) => (
          <div className={`stage-pill ${stageTotals[s.key] ? '' : 'empty'}`} key={s.key}>
            <div className="stage-label">{s.label}</div>
            <div className="stage-count">{stageTotals[s.key]}</div>
            <div className="stage-name">{s.name}</div>
          </div>
        ))}
        {stageTotals.special > 0 && (
          <div className="stage-pill special">
            <div className="stage-label">★</div>
            <div className="stage-count">{stageTotals.special}</div>
            <div className="stage-name">Genesis</div>
          </div>
        )}
      </div>

      <div className="color-dist">
        <div className="muted small">Base color distribution (T1)</div>
        <div className="color-bars">
          {colorTotals.map((c) => (
            <div className="color-bar" key={c.id} title={`${c.name}: ${c.count}`}>
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${(c.count / maxColor) * 100}%`, background: c.hex }} />
              </div>
              <div className="bar-count">{c.count}</div>
              <div className="bar-swatch" style={{ background: c.hex }} />
              <div className="bar-name">{c.name}</div>
            </div>
          ))}
        </div>
        {inv.t0 > 0 && (
          <div className="hint">+ {inv.t0} T0 (Mystery) — reveals into a random base color, not counted toward a color yet.</div>
        )}
      </div>
    </section>
  )
}
