// Three collection floor cards on the entry screen.
const fmtEth = (n) => (n == null ? '—' : `${n.toFixed(n < 0.1 ? 4 : n < 10 ? 3 : 2)} Ξ`)

const CARDS = [
  { key: 'collection', label: 'Collection floor' },
  { key: 'unrevealed', label: 'Unrevealed floor' },
  { key: 'origin', label: 'Origin floor' },
]

export function FloorCards({ prices, priceState }) {
  const floors = prices?.floors
  const usd = prices?.ethUsd
  return (
    <div className="floor-cards">
      {CARDS.map((c) => {
        const eth = floors?.[c.key]
        return (
          <div className="floor-card" key={c.key}>
            <div className="floor-label">{c.label}</div>
            <div className="floor-eth">
              {priceState.loading ? '…' : priceState.error ? 'n/a' : fmtEth(eth)}
            </div>
            {eth != null && usd ? <div className="floor-usd">≈ ${Math.round(eth * usd).toLocaleString('en-US')}</div> : <div className="floor-usd">&nbsp;</div>}
          </div>
        )
      })}
    </div>
  )
}
