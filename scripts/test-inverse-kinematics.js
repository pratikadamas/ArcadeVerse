const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createIKChain: chain, createIKPreset } = require('../assets/js/inverse-kinematics-physics.js');
const near = (a,b,e=1e-7) => assert(Math.abs(a-b)<e,`${a} != ${b}`);
const wrap = n => Math.atan2(Math.sin(n),Math.cos(n));
function verify(c,length,root={x:0,y:0},baseAngle=0) {
 const p=c.getPoints(),limits=c.getLimits();near(p[0].x,root.x);near(p[0].y,root.y);let parent=baseAngle;
 for(let i=0;i<p.length-1;i++){near(Math.hypot(p[i+1].x-p[i].x,p[i+1].y-p[i].y),length);const angle=Math.atan2(p[i+1].y-p[i].y,p[i+1].x-p[i].x),relative=wrap(angle-parent);assert(relative>=limits[i].min-1e-8&&relative<=limits[i].max+1e-8);parent=angle;}
}
test('reachable targets converge across repeated bounded frame solves while retaining every link length',()=>{
 for(const target of[{x:80,y:60},{x:0,y:0},{x:-20,y:30},{x:100,y:-40}]){const c=chain(8,20);let r;for(let frame=0;frame<12;frame++){r=c.solve(target);assert(r.iterations>=1&&r.iterations<=5);verify(c,20);}assert(r.converged);assert(r.error<.05);}
});
test('unreachable collinear targets approach the analytical maximum reach',()=>{
 const c=chain(6,10);let r;for(let i=0;i<10;i++)r=c.solve({x:100,y:0});assert.equal(r.withinReach,false);near(r.error,50,.001);near(c.getPoints().at(-1).x,50,.001);verify(c,10);
});
test('a locked two-link chain gives its exact forward-kinematics endpoint and cannot pretend to reach another',()=>{
 const c=chain(3,10,[{min:0,max:0},{min:Math.PI/2,max:Math.PI/2}]);const r=c.solve({x:10,y:10});near(r.error,0);assert(r.converged);const blocked=c.solve({x:15,y:0});assert.equal(blocked.converged,false);near(blocked.error,Math.sqrt(125));verify(c,10);
});
test('joint angles stay inside asymmetric limits under 160 deterministic target moves',()=>{
 const c=chain(7,12,Array.from({length:6},(_,i)=>i===0?{min:-.6,max:.8}:{min:.1,max:.7}));let seed=31;
 for(let i=0;i<160;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed/2**32*Math.PI*2;c.solve({x:100*Math.cos(a),y:100*Math.sin(a)});verify(c,12);}
});
test('root relocation and orientation preserve a valid anchored chain',()=>{
 const c=chain(5,15);c.setRoot({x:50,y:-30},Math.PI/3);for(let i=0;i<5;i++)c.solve({x:70,y:0});verify(c,15,{x:50,y:-30},Math.PI/3);
});
test('returned joint/limit snapshots and constructor inputs cannot mutate the solver',()=>{
 const limits=[{min:-.2,max:.2}],c=chain(2,10,limits);limits[0].max=3;c.getLimits()[0].max=3;c.getPoints()[0].x=999;verify(c,10);assert.equal(c.getLimits()[0].max,.2);
});
test('invalid sizes, points, limits and solve options fail without corrupting the last valid pose',()=>{
 for(const n of[1,65,2.5,NaN,'3'])assert.throws(()=>chain(n,10));for(const l of[0,-1,Infinity,'10',10001])assert.throws(()=>chain(4,l));for(const cs of[null,{},[null],[{min:1,max:0}],[{min:NaN,max:1}],[{min:-4,max:4}],Array(5).fill({min:0,max:1})])assert.throws(()=>chain(4,10,cs));
 const c=chain(5,10),old=c.getPoints();for(const p of[null,{x:NaN,y:0},{x:0,y:Infinity},{x:1e9,y:0},{x:'1',y:0}])assert.throws(()=>c.solve(p));for(const o of[{iterations:2},{iterations:6},{iterations:3.5},{tolerance:0},{tolerance:Infinity}])assert.throws(()=>c.solve({x:1,y:1},o));assert.deepEqual(c.getPoints(),old);
});
test('all generators produce independent, bounded chains and valid poses',()=>{
 for(const name of['arm','limb','tentacles']){const list=createIKPreset(name);assert.equal(list.length,name==='tentacles'?3:1);for(const c of list){const r=c.solve({x:350,y:180});assert(Number.isFinite(r.error));assert(c.jointCount>=3&&c.jointCount<=9);}}
 assert.throws(()=>createIKPreset('unknown'));const a=createIKPreset('arm'),b=createIKPreset('arm');a[0].setRoot({x:0,y:0});assert.notDeepEqual(a[0].getPoints(),b[0].getPoints());
});
test('browser attachment preserves the SDK object, unrelated physics helpers and CommonJS import purity',()=>{
 const sdk={ready:true,physics:{gravity:9.8}},window={document:{querySelector(){return null}},ArcadeVerse:sdk};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/inverse-kinematics-physics.js'),'utf8'),{window});assert.equal(window.ArcadeVerse,sdk);assert.equal(sdk.physics.gravity,9.8);assert.equal(typeof sdk.physics.createIKChain,'function');assert.equal(global.ArcadeVerse,undefined);
});
