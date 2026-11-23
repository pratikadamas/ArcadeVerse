const test=require('node:test');
const assert=require('node:assert/strict');
const {deflect,diskLight,starfield,LensingRenderer}=require('../assets/js/gravitational-lensing-canvas.js');
test('deflection is radial, symmetric and inversely proportional to radius',()=>{
 assert.deepEqual(deflect(20,0,0,0,100),[15,0]);
 assert.deepEqual(deflect(-20,0,0,0,100),[-15,0]);
 assert.equal(40-deflect(40,0,0,0,100)[0],2.5);
 assert.deepEqual(deflect(5,5,5,5,100),[5,5]);
});
test('approaching side has stronger beaming at equal spiral phase',()=>{
 assert.ok(diskLight(25,0,10,0)>diskLight(-25,0,10,0));
 assert.equal(diskLight(0,0,10,0),0);
});
test('starfield is deterministic and opaque',()=>{
 assert.deepEqual(starfield(40,20),starfield(40,20));
 assert.equal(starfield(40,20).filter((_,i)=>i%4===3&&starfield(40,20)[i]!==255).length,0);
});
test('renderer reuses its typed buffer, shadows singularity, and responds to dragging',()=>{
 const r=new LensingRenderer(100,80),buffer=r.render(50,40,0);
 assert.equal(buffer[(40*100+50)*4],0);
 const old=buffer.slice();
 assert.equal(r.render(30,20,1),buffer);
 assert.notDeepEqual(buffer,old);
 assert.equal(buffer.length,100*80*4);
});
