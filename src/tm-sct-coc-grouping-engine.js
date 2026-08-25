/**
 * HNL Pile Standards AI v1.25.7
 * TM SCT Coc — DCE VBA group-label / proximity-grouping reference engine
 *
 * Reverse-engineered from workbook VBA module A_Function:
 *   Public Function NhomCoc(...)
 *   Public Sub DoTimSoLuongCocGanNhau()
 *   Function CountPointsWithinDistance(...)
 *
 * IMPORTANT:
 * - This is DCE behavior reproduction, not a TCVN pile resistance rule.
 * - It does not participate in TM SCT Coc K/L/M numeric compression check.
 * - Proximity grouping is tagged DCE_HEURISTIC / productionNumeric=false.
 */

export const TM_SCT_COC_GROUPING_STATUS = Object.freeze({
  id: "tm-sct-coc-dce-proximity-grouping",
  status: "LOCKED_REFERENCE_BEHAVIOR",
  productionNumeric: false,
  authority: "DCE_VBA_REFERENCE_ONLY",
  numericReactionDependency: false
});

export function dceNhomCocLabel(slCoc, prefix = "Đài ", suffix = " cọc") {
  const n = Number(slCoc);
  if (!Number.isFinite(n)) return "";
  let out = "";
  if (n === 1) out = `${prefix}${n}${suffix}`;
  if (n >= 2 && n <= 5) out = `${prefix}2 - 5${suffix}`;
  if (n >= 6 && n <= 10) out = `${prefix}6 - 10${suffix}`;
  if (n >= 11 && n <= 20) out = `${prefix}11 - 20${suffix}`;
  if (n > 20) out = `${prefix}>20${suffix}`;
  return out;
}

function finite(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  return n;
}

/**
 * Reproduces CountPointsWithinDistance + TenCoc.Count behavior.
 *
 * DCE quirks intentionally preserved:
 * - threshold A is fixed from the STARTING pile: kccoc * starting diameter.
 * - transitive neighbors are recursively included.
 * - unique identity is pointName/TC, not coordinate row.
 * - kccoc defaults to 3.1 only when supplied value equals 0.
 *
 * With unequal diameters, starting from pile A vs pile B can yield different
 * group counts. This is one reason the logic remains DCE_HEURISTIC.
 */
export function dceProximityGroupForPile({
  pile,
  piles,
  kccoc = 0
}) {
  if (!pile) throw new Error("pile is required");
  if (!Array.isArray(piles) || !piles.length) throw new Error("piles[] is required");

  const factorRaw = finite(kccoc, "kccoc");
  const factor = factorRaw === 0 ? 3.1 : factorRaw;
  const diameter = finite(pile.diameterMm ?? pile.Dmm ?? pile.D, "pile.diameterMm");
  const thresholdMm = factor * diameter;

  const normalized = piles.map((p, i) => ({
    pointName: String(p.pointName ?? p.pointId ?? p.name ?? i + 1),
    xMm: finite(p.xMm ?? p.x, `piles[${i}].xMm`),
    yMm: finite(p.yMm ?? p.y, `piles[${i}].yMm`)
  }));
  const startX = finite(pile.xMm ?? pile.x, "pile.xMm");
  const startY = finite(pile.yMm ?? pile.y, "pile.yMm");

  const seen = new Set();
  const order = [];

  function recurse(x, y) {
    let count = 0;
    for (const p of normalized) {
      const dx = p.xMm - x;
      const dy = p.yMm - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= thresholdMm && !seen.has(p.pointName)) {
        seen.add(p.pointName);
        order.push(p.pointName);
        count += 1;
        count += recurse(p.xMm, p.yMm);
      }
    }
    return count;
  }

  const recursiveCount = recurse(startX, startY);
  return {
    status: "DCE_HEURISTIC_REFERENCE",
    factor,
    thresholdMm,
    groupCount: seen.size,          // macro ultimately writes TenCoc.Count
    recursiveReturnCount: recursiveCount,
    pointNames: order,
    label: dceNhomCocLabel(seen.size)
  };
}

export function dceProximityGroups({ piles, kccoc = 0 }) {
  if (!Array.isArray(piles)) throw new Error("piles[] is required");
  return piles.map((pile) => ({
    pointName: String(pile.pointName ?? pile.pointId ?? pile.name ?? ""),
    ...dceProximityGroupForPile({ pile, piles, kccoc })
  }));
}
