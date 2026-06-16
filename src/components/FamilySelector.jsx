// Buttons to pick which family tree to view. Split into pure-color and mixed.

function Btn({ fam, active, hint, onClick }) {
  return (
    <button
      type="button"
      className={`fam-btn ${active ? 'active' : ''}`}
      style={{ '--fam': fam.hex }}
      onClick={onClick}
      title={`${fam.name} · ${fam.pair.join(' + ')} → ${fam.t4}`}
    >
      <span className="fam-btn-swatch" />
      <span className="fam-btn-text">
        <span className="fam-btn-t4">{fam.t4}</span>
        <span className="fam-btn-sub">{fam.pair.join('+')}</span>
      </span>
      {hint > 0 && <span className="fam-btn-hint">{hint}</span>}
    </button>
  )
}

export function FamilySelector({ families, selectedId, onSelect, hintFor }) {
  const pure = families.filter((f) => f.isSameColor)
  const mixed = families.filter((f) => !f.isSameColor)

  const group = (title, list) => (
    <div className="fam-group">
      <div className="fam-group-title">{title}</div>
      <div className="fam-btns">
        {list.map((f) => (
          <Btn
            key={f.id}
            fam={f}
            active={f.id === selectedId}
            hint={hintFor ? hintFor(f) : 0}
            onClick={() => onSelect(f.id)}
          />
        ))}
      </div>
    </div>
  )

  return (
    <section className="selector card">
      <div className="selector-head">
        <h2>Pick a family tree</h2>
        <span className="muted small">Pick a family to see its evolution tree and what you're missing · badge = T4 you can craft</span>
      </div>
      {group('Pure colors', pure)}
      {group('Mixes', mixed)}
    </section>
  )
}
