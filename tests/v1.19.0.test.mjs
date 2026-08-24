import test from 'node:test'; import assert from 'node:assert/strict';
import {calcCrackFlexure5574,calcDeflectionSimple5574,calcPrestressLosses5574} from '../src/tcvn5574-core.js';
import {solveEngineeringQuestion} from '../src/engineering-router.js';
test('5574 crack flexure numeric',()=>{const r=calcCrackFlexure5574({grade:'B30',steel:'CB400-V',b:300,h:500,h0:450,As:1800,Asp:0,a:50,ap:40,M:180,ds:20,Abt:60000,RbtSer:1.15,RsSer:400,duration:'short',ribbed:true});assert.equal(r.ok,true);assert.ok(r.McrcKnM>0);assert.ok(r.acrcMm>=0);});
test('5574 deformation uncracked',()=>{const r=calcDeflectionSimple5574({grade:'B30',L:6,b:300,h:500,Mmax:120,longTerm:false});assert.equal(r.ok,true);assert.ok(r.deflectionMm>0);});
test('5574 prestress losses',()=>{const r=calcPrestressLosses5574({sigmaSp:900,Rsn:1200,Asp:1000,method:'mechanical',steelType:'strand',deltaT:0,epsShrink:0.0002,creepLoss:40});assert.equal(r.ok,true);assert.ok(r.P2Kn>0);assert.ok(r.lossesMpa.total>=100);});
test('router recognizes crack',()=>{const r=solveEngineeringQuestion('tính vết nứt B30 CB400-V b=300 h=500 h0=450 As=1800 a=50 M=180 ds=20 Abt=60000 RbtSer=1.15 RsSer=400');assert.equal(r.workflow?.id,'5574-crack');});

test('5574 crack auto-loads structured SLS strengths after v1.20 hardening',()=>{const r=calcCrackFlexure5574({grade:'B30',steel:'CB400-V',b:300,h:500,h0:450,As:1800,a:50,M:180,ds:20,Abt:60000});assert.equal(r.ok,true);assert.equal(r.inputs.RbtSer,1.75);assert.equal(r.inputs.RsSer,400);});
