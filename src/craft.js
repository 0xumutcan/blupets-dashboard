// Crafting / evolution logic for Blupets.
//
// Evolution chain:
//   T0 (Mystery)  -> reveals to a random T1 base color
//   T1 (base color) x2  -> T2  (family is determined by the color pair)
//   T2 (same family) x2 -> T3  (one of 3 archetypes)
//   T3 (same family) x2 -> T4  (the family's canonical ascended form)
//   Rule: keeper survives, donors burn.
//
// Base-color cost to build one unit from scratch:
//   T2 = 2 base, T3 = 4 base, T4 = 8 base (of the family's color(s)).

export const STAGE = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 }

// Build a unified family model from /catalog + /colors/merge.
// Returns { baseColors, families, familyById, colorIdByName }.
export function buildModel(catalog, colorMerge) {
  const baseColors = catalog.baseColors // [{id,name,key,hex}]
  const colorIdByName = {}
  baseColors.forEach((c) => {
    colorIdByName[c.name] = c.id
  })

  // /colors/merge gives the authoritative numeric family id + base pair.
  // /catalog.families gives t2/t3/t4 names keyed by family key.
  const catByKey = {}
  catalog.families.forEach((f) => {
    catByKey[f.key || f.id] = f
  })

  const families = colorMerge.pairs.map((p) => {
    const after = p.after
    const cat = catByKey[after.key] || {}
    const pair = p.before // [colorName, colorName]
    return {
      id: after.id,
      key: after.key,
      name: after.name,
      hex: after.hex,
      pair,
      pairColorIds: pair.map((n) => colorIdByName[n]),
      isSameColor: pair[0] === pair[1],
      t2: cat.t2 || [],
      t3: cat.t3 || [],
      t4: after.t4 || cat.t4 || '?',
    }
  })

  const familyById = {}
  families.forEach((f) => (familyById[f.id] = f))
  return { baseColors, families, familyById, colorIdByName }
}

// Turn a wallet token list into counts the planner can use.
//   t1[colorId], t2[familyId], t3[familyId], t4[familyId]
//   t0 = unrevealed mystery count, special = non-merge custom tokens.
export function buildInventory(tokens, model) {
  // t2f / t3f hold per-form counts keyed by "familyId:form".
  const inv = { t0: 0, t1: {}, t2: {}, t3: {}, t4: {}, t2f: {}, t3f: {}, special: [], total: tokens.length }
  const validFamily = (id) => model.familyById[id] != null
  for (const t of tokens) {
    switch (t.stage) {
      case STAGE.T0:
        inv.t0++
        break
      case STAGE.T1:
        inv.t1[t.lineage] = (inv.t1[t.lineage] || 0) + 1
        break
      case STAGE.T2:
        if (validFamily(t.lineage)) {
          inv.t2[t.lineage] = (inv.t2[t.lineage] || 0) + 1
          const k = `${t.lineage}:${t.form}`
          inv.t2f[k] = (inv.t2f[k] || 0) + 1
        } else inv.special.push(t)
        break
      case STAGE.T3:
        if (validFamily(t.lineage)) {
          inv.t3[t.lineage] = (inv.t3[t.lineage] || 0) + 1
          const k = `${t.lineage}:${t.form}`
          inv.t3f[k] = (inv.t3f[k] || 0) + 1
        } else inv.special.push(t)
        break
      case STAGE.T4:
        // Merge-derived T4 has a real family id; genesis "Unhatched" tokens
        // use an out-of-range lineage and are treated as special.
        if (validFamily(t.lineage)) inv.t4[t.lineage] = (inv.t4[t.lineage] || 0) + 1
        else inv.special.push(t)
        break
      default:
        inv.special.push(t)
    }
  }
  return inv
}

// Base-color tokens this family needs for ONE T2.
// Same-color family: 2 of one color. Mixed: 1 of each.
function baseCostPerT2(fam) {
  const cost = {}
  if (fam.isSameColor) cost[fam.pairColorIds[0]] = 2
  else fam.pairColorIds.forEach((id) => (cost[id] = (cost[id] || 0) + 1))
  return cost
}

// How many T2 of this family the holder could craft from their base colors,
// IF they dedicated all those colors to this family (independent view).
function craftableT2FromBase(fam, inv) {
  if (fam.isSameColor) {
    const c = fam.pairColorIds[0]
    return Math.floor((inv.t1[c] || 0) / 2)
  }
  const [a, b] = fam.pairColorIds
  return Math.min(inv.t1[a] || 0, inv.t1[b] || 0)
}

// Plan for a single family, T4-focused.
// Returns current holdings, max achievable T4 (dedicating resources), and the
// exact materials still missing to craft ONE more T4.
export function planFamily(fam, inv, model) {
  const have = {
    t1: fam.pairColorIds.map((id) => ({
      id,
      name: model.baseColors[id].name,
      hex: model.baseColors[id].hex,
      count: inv.t1[id] || 0,
    })),
    t2: inv.t2[fam.id] || 0,
    t3: inv.t3[fam.id] || 0,
    t4: inv.t4[fam.id] || 0,
  }

  // De-duplicate color entries for same-color families (show one chip).
  if (fam.isSameColor) have.t1 = [have.t1[0]]

  // ---- Max T4 potential (dedicate this family's colors) ----
  const extraT2 = craftableT2FromBase(fam, inv)
  const t2cap = have.t2 + extraT2
  const t3cap = have.t3 + Math.floor(t2cap / 2)
  const maxT4 = have.t4 + Math.floor(t3cap / 2)

  // ---- Deficit tree to craft ONE more T4 ----
  const t3Need = 2
  const t3Use = Math.min(have.t3, t3Need)
  const t3Make = t3Need - t3Use

  const t2Need = t3Make * 2
  const t2Use = Math.min(have.t2, t2Need)
  const t2Make = t2Need - t2Use

  // Base tokens required for the T2 we still have to craft.
  const perT2 = baseCostPerT2(fam)
  const baseReq = {}
  for (const cid of Object.keys(perT2)) baseReq[cid] = perT2[cid] * t2Make

  // Subtract what they already hold -> still-missing base tokens.
  const missing = []
  for (const cid of Object.keys(baseReq)) {
    const short = Math.max(0, baseReq[cid] - (inv.t1[cid] || 0))
    if (short > 0) {
      missing.push({
        id: Number(cid),
        name: model.baseColors[cid].name,
        hex: model.baseColors[cid].hex,
        count: short,
      })
    }
  }

  const canMakeT4Now = t3Make === 0 || (t2Make === 0 && missing.length === 0) || missing.length === 0

  return {
    family: fam,
    have,
    maxT4,
    nextT4: {
      t3Make,
      t2Make,
      missing,
      canMakeNow: maxT4 > have.t4 && missing.length === 0,
      // progress 0..1 toward the next single T4, measured in base-token units (8 = 1 T4)
      progress: t4Progress(have, extraT2, maxT4),
    },
  }
}

// Progress toward the next craftable T4, in base-token units (T2=2, T3=4, T4=8).
// If a T4 is already craftable, the bar is full. Otherwise it shows how far the
// current materials (existing T2/T3 + T2 craftable from base) get toward 8 units.
function t4Progress(have, extraT2, maxT4) {
  const UNIT_T4 = 8
  if (maxT4 > have.t4) return 1 // a T4 is already reachable
  const units = have.t3 * 4 + (have.t2 + extraT2) * 2
  return Math.min(units / UNIT_T4, 0.99)
}

// Base tokens still missing to craft ONE unit of `stage` in this family,
// tier-aware: it consumes existing family T2/T3 first, then falls back to base.
// Returns { missing:[{id,name,hex,count}], baseNeeded:{cid:n}, t2Make, t3Make, canMakeNow }.
export function craftMissing(fam, inv, model, stage) {
  const t2 = inv.t2[fam.id] || 0
  const t3 = inv.t3[fam.id] || 0

  let t3Make = 0
  let t2Make = 0
  if (stage === STAGE.T2) {
    t2Make = 1
  } else if (stage === STAGE.T3) {
    t3Make = 1
    t2Make = Math.max(0, 2 - t2)
  } else if (stage === STAGE.T4) {
    const t3Use = Math.min(t3, 2)
    t3Make = 2 - t3Use
    const t2Need = t3Make * 2
    t2Make = Math.max(0, t2Need - t2)
  }

  const perT2 = baseCostPerT2(fam)
  const baseNeeded = {}
  for (const cid of Object.keys(perT2)) baseNeeded[cid] = perT2[cid] * t2Make

  const missing = []
  for (const cid of Object.keys(baseNeeded)) {
    const short = Math.max(0, baseNeeded[cid] - (inv.t1[cid] || 0))
    if (short > 0) {
      const c = model.baseColors[cid]
      missing.push({ id: Number(cid), name: c.name, hex: c.hex, count: short })
    }
  }

  return { missing, baseNeeded, t2Make, t3Make, canMakeNow: missing.length === 0 }
}

// Full lineage tree for one family, top-down (T4 -> T3 -> T2 -> T1), each node
// annotated with art, owned count, and what's missing to craft one.
export function buildTree(fam, inv, model) {
  const baseColors = fam.pairColorIds.map((id) => model.baseColors[id])

  // Each T1 slot is one ingredient the recipe needs. A slot is "covered" if the
  // wallet holds enough of that color for this slot (so Green+Green with 1 green
  // shows one covered + one empty). The true color count is shown once per color
  // (on its first slot) so a single token never looks duplicated.
  const seen = {}
  const t1Nodes = fam.pairColorIds.map((cid, i) => {
    const total = inv.t1[cid] || 0
    const prior = seen[cid] || 0
    seen[cid] = prior + 1
    const covered = total > prior
    return {
      uid: `t1-${i}`,
      stage: STAGE.T1,
      lineage: cid,
      form: 0,
      slot: i,
      slotLabel: String.fromCharCode(65 + i), // A, B — the two merge inputs
      name: baseColors[i].name,
      hex: baseColors[i].hex,
      owned: covered ? 1 : 0,                  // drives owned/faded state
      badge: prior === 0 && total > 0 ? total : null, // real count, shown once
      colorOwned: total,                       // true total of this color
      isBase: true,
      missing: [],
      canMakeNow: covered,
    }
  })

  // Odds of landing a specific form from a merge = 1 / (forms in that tier).
  const tierNodes = (stage, names) =>
    names.map((name, form) => {
      const m = craftMissing(fam, inv, model, stage)
      const ownedMap = stage === STAGE.T2 ? inv.t2f : inv.t3f
      return {
        uid: `t${stage}-${form}`,
        stage,
        lineage: fam.id,
        form,
        name,
        hex: fam.hex,
        odds: 100 / names.length,
        owned: ownedMap[`${fam.id}:${form}`] || 0,
        missing: m.missing,
        canMakeNow: m.canMakeNow,
        plan: m,
      }
    })

  const t4m = craftMissing(fam, inv, model, STAGE.T4)
  const t4Node = {
    uid: 't4-0',
    stage: STAGE.T4,
    lineage: fam.id,
    form: 0,
    name: fam.t4,
    hex: fam.hex,
    odds: 100, // single canonical T4
    owned: inv.t4[fam.id] || 0,
    missing: t4m.missing,
    canMakeNow: t4m.canMakeNow,
    plan: t4m,
  }

  return {
    family: fam,
    tiers: [
      { stage: STAGE.T4, label: 'T4', nodes: [t4Node] },
      { stage: STAGE.T3, label: 'T3', nodes: tierNodes(STAGE.T3, fam.t3) },
      { stage: STAGE.T2, label: 'T2', nodes: tierNodes(STAGE.T2, fam.t2) },
      { stage: STAGE.T1, label: 'T1', nodes: t1Nodes },
    ],
  }
}

// Base tokens to build ONE T4 of a family: same-color = 8 of one color,
// mixed = 4 of each color. Keyed by color id.
export function baseCostForT4(fam) {
  if (fam.isSameColor) return { [fam.pairColorIds[0]]: 8 }
  return { [fam.pairColorIds[0]]: 4, [fam.pairColorIds[1]]: 4 }
}

// Wishlist planner. `wish` is { familyId: quantity }. Returns total base colors
// required across the whole wishlist, crediting any T2/T3/T4 of those families
// already held (as base-equivalents) and the base T1 colors in the wallet.
export function computeWishlist(wish, inv, model) {
  const grossByColor = {}   // raw requirement
  const freshByColor = {}   // requirement after crediting owned higher tiers
  const items = []
  let totalT4 = 0
  let creditedHigherTier = false

  for (const fam of model.families) {
    const qty = wish[fam.id] || 0
    if (qty <= 0) continue
    totalT4 += qty
    const cost = baseCostForT4(fam)
    items.push({ fam, qty, cost })

    // owned higher tiers of this family, in base-token equivalents (T2=2, T3=4, T4=8)
    const equiv = (inv.t2[fam.id] || 0) * 2 + (inv.t3[fam.id] || 0) * 4 + (inv.t4[fam.id] || 0) * 8
    if (equiv > 0) creditedHigherTier = true

    for (const cid of Object.keys(cost)) {
      const req = cost[cid] * qty
      grossByColor[cid] = (grossByColor[cid] || 0) + req
      // distribute the family's owned equiv across its colors by cost ratio
      const share = Math.min(req, Math.round(equiv * (cost[cid] / 8)))
      freshByColor[cid] = (freshByColor[cid] || 0) + (req - share)
    }
  }

  const perColor = model.baseColors
    .map((c) => {
      const gross = grossByColor[c.id] || 0
      const fresh = freshByColor[c.id] || 0
      const have = inv.t1[c.id] || 0
      return { ...c, gross, fresh, have, still: Math.max(0, fresh - have) }
    })
    .filter((c) => c.gross > 0)

  return {
    totalT4,
    items,
    perColor,
    creditedHigherTier,
    totalBaseGross: perColor.reduce((s, c) => s + c.gross, 0),
    totalStill: perColor.reduce((s, c) => s + c.still, 0),
  }
}

// Estimated cost to acquire the wishlist's still-needed base colors, buying the
// N cheapest listings per color (not floor × N). `prices` is the proxy payload.
export function computeCost(perColor, prices) {
  if (!prices || !prices.colors) return null
  let totalEth = 0
  let shortage = false
  const rows = {}
  for (const c of perColor) {
    if (c.still <= 0) {
      rows[c.id] = { costEth: 0, short: 0, listed: 0 }
      continue
    }
    const arr = prices.colors[c.id] || []
    const take = arr.slice(0, c.still)
    const sum = take.reduce((a, b) => a + b, 0)
    const short = c.still - take.length // not enough listed to fill the need
    if (short > 0) shortage = true
    totalEth += sum
    rows[c.id] = { costEth: sum, short, listed: take.length }
  }
  return { totalEth, usd: totalEth * (prices.ethUsd || 0), rows, shortage, ethUsd: prices.ethUsd, updatedAt: prices.updatedAt }
}

// Aggregate counts for the summary header.
export function summarize(inv, model) {
  const stageTotals = {
    t0: inv.t0,
    t1: sum(inv.t1),
    t2: sum(inv.t2),
    t3: sum(inv.t3),
    t4: sum(inv.t4),
    special: inv.special.length,
  }
  const colorTotals = model.baseColors.map((c) => ({
    ...c,
    count: inv.t1[c.id] || 0,
  }))
  return { stageTotals, colorTotals }
}

function sum(obj) {
  return Object.values(obj).reduce((a, b) => a + b, 0)
}
