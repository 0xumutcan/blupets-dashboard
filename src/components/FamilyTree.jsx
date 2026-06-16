// Top-down lineage tree (T4 -> T3 -> T2 -> T1) for the selected family.
// Click a node to inspect what you own and what's missing to craft it.
import { useState, useEffect } from 'react'
import { renderUrl } from '../api'

// 20, 33.3, 100 — trim trailing ".0".
const fmtOdds = (n) => `${(Math.round(n * 10) / 10).toString().replace(/\.0$/, '')}%`

function NodeArt({ node }) {
  return (
    <img
      className="node-art"
      loading="lazy"
      src={renderUrl(node.stage, node.lineage, node.form)}
      alt={node.name}
      width={72}
      height={72}
    />
  )
}

function TreeNode({ node, tierLabel, active, onClick }) {
  let state = 'todo'
  if (node.owned > 0) state = 'owned'
  else if (node.canMakeNow && node.stage > 1) state = 'ready'

  // T1 shows the true color count (once per color); others show owned count.
  const badge = node.stage === 1 ? node.badge : node.owned > 0 ? node.owned : null

  return (
    <button type="button" className={`node ${state} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="node-tier">{tierLabel}</span>
      <span className="node-frame" style={{ '--fam': node.hex }}>
        {node.stage === 1
          ? <span className="node-odds slot">{node.slotLabel}</span>
          : <span className="node-odds">{fmtOdds(node.odds)}</span>}
        <NodeArt node={node} />
        {badge != null && <span className="node-count">×{badge}</span>}
      </span>
      <span className="node-name">{node.name}</span>
    </button>
  )
}

function NodeDetail({ node, family }) {
  if (!node) return null
  // For base colors the meaningful total is the whole wallet color count.
  const ownedCount = node.stage === 1 ? node.colorOwned : node.owned

  // Intermediate tiers to craft on the way to ONE of this node — strictly below
  // the target tier (the target itself isn't an "intermediate", and T1 is base).
  const steps = []
  if (node.plan) {
    if (node.stage === 4 && node.plan.t3Make > 0) steps.push(`${node.plan.t3Make}× T3`)
    if (node.stage >= 3 && node.plan.t2Make > 0) steps.push(`${node.plan.t2Make}× T2`)
  }
  const stageName = { 1: 'Base color (T1)', 2: 'Pet form (T2)', 3: 'Archetype (T3)', 4: 'Final form (T4)' }[node.stage]
  const recipe = {
    1: 'A T0 (Mystery) can reveal into this base color.',
    2: `Merge 2× T1 (${family.pair.join(' + ')}).`,
    3: 'Merge 2× same-family T2.',
    4: 'Merge 2× same-family T3.',
  }[node.stage]

  return (
    <div className="node-detail card" style={{ '--fam': node.hex }}>
      <div className="detail-art">
        <img src={renderUrl(node.stage, node.lineage, node.form)} alt={node.name} width={120} height={120} />
      </div>
      <div className="detail-body">
        <div className="detail-head">
          <div>
            <div className="detail-name">{node.name}</div>
            <div className="muted small">{stageName} · {family.name}</div>
          </div>
          <div className={`detail-owned ${ownedCount > 0 ? 'has' : ''}`}>
            <span>{ownedCount}</span><small>{node.stage === 1 ? 'of this color' : 'owned'}</small>
          </div>
        </div>

        <div className="detail-recipe">
          <span className="mat-label">Recipe</span>{recipe}
          {node.stage > 1 && (
            <span className="detail-odds">Chance to get this form from a merge: <strong>{fmtOdds(node.odds)}</strong>{node.stage === 4 ? ' (single canonical form)' : ''}</span>
          )}
        </div>

        {node.stage > 1 && (
          <div className="detail-missing">
            <span className="mat-label">Missing to craft one</span>
            <div className="mat-chips">
              {node.canMakeNow ? (
                <span className="badge good">Nothing missing — craftable now</span>
              ) : node.missing.length ? (
                node.missing.map((m) => (
                  <span className="badge need" key={m.id}>
                    <span className="chip-swatch" style={{ background: m.hex }} />
                    +{m.count} {m.name}
                  </span>
                ))
              ) : (
                <span className="muted small">Merge your existing lower-tier materials</span>
              )}
            </div>
            {steps.length > 0 && (
              <div className="detail-steps muted small">Intermediate crafts: {steps.join(' · ')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function FamilyTree({ tree }) {
  const [sel, setSel] = useState(null)

  // Default the detail panel to the T4 goal whenever the family changes.
  useEffect(() => {
    setSel(tree.tiers[0].nodes[0])
  }, [tree.family.id])

  const isSel = (n) => sel && sel.uid === n.uid

  return (
    <section className="tree-wrap">
      <div className="tree" style={{ '--fam': tree.family.hex }}>
        {tree.tiers.map((tier) => (
          <div className="tier" key={tier.stage}>
            {tier.nodes.map((node) => (
              <div className="tier-cell" key={node.uid}>
                <TreeNode
                  node={node}
                  tierLabel={tier.label}
                  active={isSel(node)}
                  onClick={() => setSel(node)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <NodeDetail node={sel} family={tree.family} />
    </section>
  )
}
