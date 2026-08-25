/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 5.2 — CSi Live API Bridge contract + CSV/Excel fallback adapters.
 *
 * Boundary:
 *   EXTERNAL SOURCE -> bridge raw payload -> canonical Pass 5.1 importer only.
 * This module MUST NOT calculate reactions, capacities, utilization, governing
 * combinations, pile counts, or rigid-cap distributions.
 */

import fs from "node:fs";
import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import {
  rowsFromCsiFlatTable,
  importDceStructuralTableBundle,
  assertImporterContainsNoNumericEngineeringResults
} from "./etabs-sap-importer.js";

const execFileAsync = promisify(nodeExecFile);

export const CSI_LIVE_BRIDGE_STATUS = Object.freeze({
  id: "csi-live-api-bridge",
  pass: "P1_PASS_5_2",
  status: "READY_NOT_CERTIFIED_LIVE_WINDOWS",
  productionNumeric: false,
  units: "kN_m_C_REQUIRED",
  responsibility: "CONNECT_READ_RAW_EXPORT_ONLY",
  forbiddenResponsibilities: Object.freeze([
    "PILE_REACTION_CALCULATION",
    "PILE_CAPACITY_CALCULATION",
    "UTILIZATION_CALCULATION",
    "GOVERNING_COMBINATION_SELECTION",
    "PILE_COUNT_SELECTION",
    "RIGID_CAP_DISTRIBUTION"
  ])
});

export const CSI_TABLE_ROLE_ALIASES = Object.freeze({
  pointCoordinates: Object.freeze([
    "Point Coordinates", "Joint Coordinates", "Joint Coordinates - General", "POINT COORDINATES"
  ]),
  nodalReactions: Object.freeze([
    "Nodal Reactions", "Joint Reactions", "Joint Reactions - General", "JOINT REACTIONS"
  ]),
  pointSpringAssignments: Object.freeze([
    "Point Spring Assignments", "Joint Spring Assignments", "Joint Assignments - Springs",
    "Joint Assignments - Point Springs", "POINT SPRING ASSIGNMENTS"
  ]),
  pierForces: Object.freeze([
    "PIERFORCES", "Pier Forces", "Pier Forces - General", "Pier Forces - Analysis"
  ]),
  pierSection: Object.freeze([
    "PIERSECTION", "Pier Section", "Pier Section Properties", "Pier Assignments - Section Properties"
  ])
});

function normName(x) {
  return String(x ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function requiredSign(v, label) {
  if (!['compression-positive','compression-negative'].includes(v)) {
    throw new Error(`${label} must explicitly be compression-positive or compression-negative`);
  }
  return v;
}

export function resolveCsiTableRole(table, aliases = CSI_TABLE_ROLE_ALIASES) {
  const names = [table?.role, table?.tableKey, table?.tableName].filter(Boolean).map(normName);
  for (const [role, candidates] of Object.entries(aliases)) {
    const cs = candidates.map(normName);
    if (names.some(n => cs.includes(n))) return role;
  }
  return null;
}

export function csiBridgeTableToRows(table) {
  if (!table) return [];
  if (Array.isArray(table.rows)) return table.rows.map((r,i)=>({...r,_sourceRow:r._sourceRow ?? i+2}));
  const fields = table.fields ?? table.fieldsIncluded ?? table.fieldKeysIncluded;
  const flatData = table.flatData ?? table.tableData;
  return rowsFromCsiFlatTable({ fields, flatData, tableKey: table.tableKey ?? table.tableName ?? table.role ?? "CSI_TABLE" });
}

function indexBridgeTables(payload) {
  const out = {};
  const list = Array.isArray(payload?.tables) ? payload.tables : Object.entries(payload?.tables ?? {}).map(([role,t])=>({role,...t}));
  for (const t of list) {
    const role = t.role ?? resolveCsiTableRole(t);
    if (role && !out[role]) out[role] = t;
  }
  return out;
}

function directPointRows(payload) {
  return (payload?.direct?.pointCoordinates ?? []).map((r,i)=>({
    Point: r.Point ?? r.pointId ?? r.Name ?? r.name,
    GlobalX: r.GlobalX ?? r.x,
    GlobalY: r.GlobalY ?? r.y,
    GlobalZ: r.GlobalZ ?? r.z,
    SpecialPt: r.SpecialPt ?? r.specialPoint ?? null,
    _sourceRow: r._sourceRow ?? i+1
  }));
}

function directReactionRows(payload) {
  return (payload?.direct?.jointReactions ?? []).map((r,i)=>({
    Node: r.Node ?? r.nodeId ?? r.Obj ?? r.objectName ?? r.Point,
    Point: r.Point ?? r.pointId ?? r.Obj ?? r.objectName ?? r.Node,
    OutputCase: r.OutputCase ?? r.LoadCase ?? r.loadCase ?? r.combinationId,
    CaseType: r.CaseType ?? r.StepType ?? r.stepType ?? "",
    Fx: r.Fx ?? r.F1,
    Fy: r.Fy ?? r.F2,
    Fz: r.Fz ?? r.F3,
    Mx: r.Mx ?? r.M1,
    My: r.My ?? r.M2,
    Mz: r.Mz ?? r.M3,
    StepNum: r.StepNum ?? r.stepNum ?? null,
    _sourceRow: r._sourceRow ?? i+1
  }));
}

function pointMap(rows) {
  const m=new Map();
  for (const r of rows) m.set(String(r.Point ?? r.pointId ?? r.UniqueName ?? '').trim(), r);
  return m;
}

export function auditDirectVsTableCoordinates(directRows, tableRows, tolerance=1e-9) {
  if (!directRows.length || !tableRows.length) return {status:"NOT_AVAILABLE",matches:null,checked:0,mismatches:[]};
  const t=pointMap(tableRows); const mismatches=[]; let checked=0;
  for (const d of directRows) {
    const id=String(d.Point ?? '').trim(); const r=t.get(id); if (!r) { mismatches.push({pointId:id,type:"MISSING_TABLE"}); continue; }
    checked++;
    const dx=Math.abs(Number(d.GlobalX)-Number(r.GlobalX ?? r.X ?? r.x));
    const dy=Math.abs(Number(d.GlobalY)-Number(r.GlobalY ?? r.Y ?? r.y));
    const dz=Math.abs(Number(d.GlobalZ)-Number(r.GlobalZ ?? r.Z ?? r.z));
    if (dx>tolerance||dy>tolerance||dz>tolerance) mismatches.push({pointId:id,dx,dy,dz});
  }
  return {status:mismatches.length?"FAIL":"PASS",matches:mismatches.length===0,checked,mismatches};
}


function reactionIdentity(row) {
  const point=String(row.Point ?? row.pointId ?? row.Node ?? row.Joint ?? row.UniqueName ?? row.Obj ?? '').trim();
  const combo=String(row.OutputCase ?? row.LoadCase ?? row.loadCase ?? row.Combo ?? row.combinationId ?? '').trim();
  const fz=Number(row.Fz ?? row.F3);
  return {point,combo,fz};
}

export function auditDirectVsTableReactions(directRows, tableRows, tolerance=1e-9) {
  if (!directRows.length || !tableRows.length) return {status:'NOT_AVAILABLE',matches:null,checkedGroups:0,mismatches:[]};
  function groups(rows) {
    const m=new Map();
    for (const row of rows) {
      const x=reactionIdentity(row); if (!x.point || !x.combo || !Number.isFinite(x.fz)) continue;
      const k=`${x.point}\u0000${x.combo}`; if (!m.has(k)) m.set(k,[]); m.get(k).push(x.fz);
    }
    for (const a of m.values()) a.sort((x,y)=>x-y);
    return m;
  }
  const d=groups(directRows), t=groups(tableRows); const keys=new Set([...d.keys(),...t.keys()]); const mismatches=[];
  for (const k of keys) {
    const a=d.get(k)??[], b=t.get(k)??[]; const [pointId,combinationId]=k.split('\u0000');
    if (a.length!==b.length) { mismatches.push({pointId,combinationId,type:'COUNT',direct:a.length,table:b.length}); continue; }
    for (let i=0;i<a.length;i++) if (Math.abs(a[i]-b[i])>tolerance) { mismatches.push({pointId,combinationId,type:'FZ',index:i,direct:a[i],table:b[i]}); break; }
  }
  return {status:mismatches.length?'FAIL':'PASS',matches:mismatches.length===0,checkedGroups:keys.size,mismatches};
}

export function importCsiBridgePayload(payload, {
  sourceId = null,
  nodalReactionCompressionSign,
  pierForceCompressionSign,
  preferDirectCoordinates = true,
  preferDirectJointReactions = true,
  requireDirectTableAgreement = true,
  crossCheckTolerance = 1e-6
} = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('CSI bridge payload is required');
  if (payload.ok === false) throw new Error(`CSI bridge failed: ${payload.error ?? 'unknown error'}`);
  if (payload.units?.normalizedTo !== 'kN_m_C' || payload.units?.verified !== true) {
    throw new Error('CSI bridge units are not verified as kN_m_C');
  }
  const nodalSign=requiredSign(nodalReactionCompressionSign ?? payload.signConventions?.nodalReactions,'nodalReactionCompressionSign');
  const pierSign=requiredSign(pierForceCompressionSign ?? payload.signConventions?.pierForces,'pierForceCompressionSign');
  const tables=indexBridgeTables(payload);
  const tablePointRows=csiBridgeTableToRows(tables.pointCoordinates);
  const tableReactionRows=csiBridgeTableToRows(tables.nodalReactions);
  const directPoints=directPointRows(payload);
  const directReactions=directReactionRows(payload);
  const pointRows=(preferDirectCoordinates && directPoints.length) ? directPoints : tablePointRows;
  const reactionRows=(preferDirectJointReactions && directReactions.length) ? directReactions : tableReactionRows;
  if (!pointRows.length) throw new Error('CSI bridge did not provide point coordinates');
  if (!reactionRows.length) throw new Error('CSI bridge did not provide joint/nodal reactions');
  if (!tables.pointSpringAssignments) throw new Error('CSI bridge did not provide point spring assignments table');

  const coordinateCrossCheck=auditDirectVsTableCoordinates(directPoints,tablePointRows,crossCheckTolerance);
  const reactionCrossCheck=auditDirectVsTableReactions(directReactions,tableReactionRows,crossCheckTolerance);
  if (requireDirectTableAgreement && (coordinateCrossCheck.status==='FAIL' || reactionCrossCheck.status==='FAIL')) {
    throw new Error(`CSI direct/table cross-check failed: coordinates=${coordinateCrossCheck.status}; reactions=${reactionCrossCheck.status}`);
  }

  const imported=importDceStructuralTableBundle({
    pointCoordinates: pointRows,
    nodalReactions: reactionRows,
    pointSpringAssignments: csiBridgeTableToRows(tables.pointSpringAssignments),
    pierForces: csiBridgeTableToRows(tables.pierForces),
    pierSection: csiBridgeTableToRows(tables.pierSection),
    sourceId: sourceId ?? `CSI_LIVE_${payload.product ?? 'UNKNOWN'}`,
    nodalReactionCompressionSign: nodalSign,
    pierForceCompressionSign: pierSign
  });

  const noEngineering=assertImporterContainsNoNumericEngineeringResults(imported);
  if (!noEngineering.pass) throw new Error(`Live bridge importer leaked engineering results: ${noEngineering.offenders.join(', ')}`);

  return {
    ...imported,
    status: 'LOCKED_CSI_BRIDGE_PAYLOAD_ADAPTER',
    bridge: {
      product: payload.product ?? null,
      apiVersion: payload.apiVersion ?? null,
      modelFile: payload.modelFile ?? null,
      sourceMode: payload.sourceMode ?? 'LIVE_API',
      units: payload.units,
      tableRolesAvailable: Object.keys(tables),
      directCoordinatesUsed: pointRows === directPoints,
      directJointReactionsUsed: reactionRows === directReactions,
      directVsTableCoordinates: coordinateCrossCheck,
      directVsTableReactions: reactionCrossCheck
    }
  };
}


export function importExcelFallbackPayload(payload, {
  unitsProfile,
  sourceId='EXCEL_FALLBACK',
  nodalReactionCompressionSign,
  pierForceCompressionSign
} = {}) {
  if (unitsProfile !== 'kN_m_C') throw new Error('Excel fallback unitsProfile must explicitly be kN_m_C');
  const verified={
    ...payload,
    units:{normalizedTo:'kN_m_C',verified:true,verificationSource:'EXPLICIT_FALLBACK_PROFILE'}
  };
  return importCsiBridgePayload(verified,{
    sourceId,
    nodalReactionCompressionSign,
    pierForceCompressionSign,
    preferDirectCoordinates:false,
    preferDirectJointReactions:false
  });
}

export function parseCsvText(csvText, { delimiter=',' } = {}) {
  const text=String(csvText ?? '').replace(/^\uFEFF/,'');
  const rows=[]; let row=[]; let field=''; let quoted=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (quoted) {
      if (c==='"' && text[i+1]==='"') { field+='"'; i++; }
      else if (c==='"') quoted=false;
      else field+=c;
    } else {
      if (c==='"') quoted=true;
      else if (c===delimiter) { row.push(field); field=''; }
      else if (c==='\n') { row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
      else field+=c;
    }
  }
  if (quoted) throw new Error('CSV has unterminated quoted field');
  if (field.length || row.length) { row.push(field.replace(/\r$/,'')); rows.push(row); }
  const nonempty=rows.filter(r=>r.some(x=>String(x).trim()!==''));
  if (!nonempty.length) return [];
  const headers=nonempty[0].map((h,i)=>String(h).trim() || `Column${i+1}`);
  return nonempty.slice(1).map((r,i)=>{
    const o={_sourceRow:i+2};
    headers.forEach((h,j)=>o[h]=r[j] ?? '');
    return o;
  });
}

export function importStructuralCsvBundle({
  pointCoordinatesCsv,
  nodalReactionsCsv,
  pointSpringAssignmentsCsv,
  pierForcesCsv = '',
  pierSectionCsv = '',
  sourceId='CSV_FALLBACK',
  nodalReactionCompressionSign,
  pierForceCompressionSign,
  unitsProfile
}) {
  if (unitsProfile !== 'kN_m_C') throw new Error('CSV fallback unitsProfile must explicitly be kN_m_C');
  return importDceStructuralTableBundle({
    pointCoordinates: parseCsvText(pointCoordinatesCsv),
    nodalReactions: parseCsvText(nodalReactionsCsv),
    pointSpringAssignments: parseCsvText(pointSpringAssignmentsCsv),
    pierForces: parseCsvText(pierForcesCsv),
    pierSection: parseCsvText(pierSectionCsv),
    sourceId,
    nodalReactionCompressionSign: requiredSign(nodalReactionCompressionSign,'nodalReactionCompressionSign'),
    pierForceCompressionSign: requiredSign(pierForceCompressionSign,'pierForceCompressionSign')
  });
}

export async function runWindowsCsiBridge({
  executable,
  args=[],
  timeoutMs=120000,
  execFileImpl=execFileAsync
}) {
  if (!executable) throw new Error('CSI bridge executable is required');
  const {stdout,stderr}=await execFileImpl(executable,args,{windowsHide:true,timeout:timeoutMs,maxBuffer:64*1024*1024});
  let payload;
  try { payload=JSON.parse(stdout); }
  catch { throw new Error(`CSI bridge returned invalid JSON. stderr=${String(stderr ?? '').slice(0,1000)}`); }
  if (payload.ok===false) throw new Error(`CSI bridge failed: ${payload.error ?? 'unknown error'}`);
  return payload;
}

export async function runWindowsExcelFallback({
  powershell='powershell.exe',
  scriptPath,
  workbookPath,
  outputJsonPath,
  timeoutMs=120000,
  execFileImpl=execFileAsync
}) {
  if (!scriptPath || !workbookPath || !outputJsonPath) throw new Error('scriptPath, workbookPath and outputJsonPath are required');
  await execFileImpl(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-File',scriptPath,'-InputWorkbook',workbookPath,'-OutputJson',outputJsonPath],{windowsHide:true,timeout:timeoutMs,maxBuffer:16*1024*1024});
  return JSON.parse(fs.readFileSync(outputJsonPath,'utf8'));
}
