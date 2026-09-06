import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
import { verifyPiledRaft10304 } from '../src/tcvn10304-advanced.js';
const solve=q=>solveEngineeringQuestion(q).result;
test('P5.8 dense sand applicability can reach verified method gate',()=>{const x=solve('móng bè-cọc nền cát chặt vừa loose_sand=0m site_consolidated=true');assert.equal(x.ok,true);assert.equal(x.status,'VERIFIED_METHOD');assert.equal(x.eligible,true);assert.equal(x.numericalModelRequired,true);});
test('P5.8 cohesive soil requires IL<0.5 and E>8 MPa',()=>{const x=solve('móng bè-cọc đất sét IL=0.4 E=10MPa loose_sand=0m site_consolidated=true');assert.equal(x.ok,true);assert.equal(x.eligible,true);});
test('P5.8 cohesive IL boundary rejects IL=0.5',()=>{const x=solve('móng bè-cọc đất sét IL=0.5 E=10MPa loose_sand=0m site_consolidated=true');assert.equal(x.eligible,false);assert.match(x.reasons.join(' '),/I_L<0,5/);});
test('P5.8 cohesive E boundary rejects E=8 MPa',()=>{const x=solve('móng bè-cọc đất sét IL=0.4 E=8MPa loose_sand=0m site_consolidated=true');assert.equal(x.eligible,false);assert.match(x.reasons.join(' '),/E>8/);});
test('P5.8 loose sand layer thicker than 1m prohibits combined piled raft',()=>{const x=solve('móng bè-cọc nền cát chặt loose_sand=1.2m site_consolidated=true');assert.equal(x.eligible,false);assert.match(x.reasons.join(' '),/>1 m/);});
test('P5.8 unconsolidated construction site is prohibited',()=>{const x=solve('móng bè-cọc nền cát chặt loose_sand=0m site_consolidated=false');assert.equal(x.eligible,false);assert.match(x.reasons.join(' '),/chưa kết thúc cố kết/);});
test('P5.8 rock-supported piles switch to pile-only mode',()=>{const x=solve('móng bè-cọc cọc tựa đá');assert.equal(x.mode,'PILE_ONLY_NO_RAFT_TRANSFER');assert.equal(x.eligible,false);});
test('P5.8 method-only result can never export Production workbook',()=>{const q='móng bè-cọc nền cát chặt loose_sand=0m site_consolidated=true';const x=solve(q);assert.equal(x.methodOnly,true);assert.equal(x.productionNumeric,false);assert.equal(engineeringExcelPayload(q).canExport,false);});
test('P5.8 missing loose-sand declaration stays REVIEW',()=>{const x=verifyPiledRaft10304('móng bè-cọc đất sét IL=0.4 E=10MPa site_consolidated=true');assert.equal(x.ok,false);assert.equal(x.status,'REVIEW');assert.match(x.missing.join(' '),/cát rời/);});
test('P5.8 undeclared consolidation preserves legacy eligibility but emits explicit warning',()=>{const x=verifyPiledRaft10304('móng bè-cọc IL=0.4 E=10 MPa loose_sand=0.5 m');assert.equal(x.ok,true);assert.equal(x.eligible,true);assert.match(x.warnings.join(' '),/chưa khai báo trạng thái cố kết/);assert.equal(x.interactions.length,4);assert.ok(x.designChecks.includes('độ lún lệch'));});

