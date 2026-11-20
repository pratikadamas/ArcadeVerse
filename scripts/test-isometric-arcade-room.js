const { test } = require('node:test');
const assert = require('node:assert/strict');
const floor = require('../assets/js/isometric-arcade-room.js');
test('assigns categories and tags to deterministic aisles with a general action fallback', () => {
  for (const [game, index] of [[{category:'Shooter'},0],[{category:'Puzzle / Physics'},3],[{category:'Word'},1],[{category:'Classic Arcade'},2],[{category:'Action',tags:['gravity']},3],[{category:'Unknown'},0]]) assert.equal(floor.aisleFor(game), index);
});
test('groups each known game once, preserves filtered sort order, and treats IDs as data', () => {
  const games = [{id:'__proto__',title:'B',category:'Puzzle'},{id:'a',title:'A',category:'Puzzle'},{id:'a',title:'Duplicate'},null,{id:'',title:'Bad'}];
  const groups = floor.group(games);
  assert.deepEqual(groups.map(g=>g.name), floor.aisles);
  assert.deepEqual(groups[1].games.map(g=>g.id), ['__proto__','a']);
  assert.equal(groups.flatMap(g=>g.games).length,2); assert.deepEqual(floor.group([]).map(g=>g.games.length),[0,0,0,0]);
});
test('sizes rows for uneven aisle populations without overflowing the floor', () => {
  const groups = floor.group(Array.from({length:122},(_,i)=>({id:String(i),title:String(i),category:i<120?'Physics':'Puzzle'})));
  const geometry = floor.geometry(groups);
  assert.ok(geometry.bottom >= Math.ceil(120/floor.columns)*130+90);
  assert.equal(geometry.height, geometry.top+geometry.bottom+170);
  assert.equal(geometry.projectedWidth,(geometry.width+geometry.height)/Math.SQRT2);
  assert.equal(geometry.projectedHeight,geometry.projectedWidth/2);
});
test('fits the whole projected room and bounds extreme pan and zoom inputs', () => {
  const room = floor.geometry(floor.group([])), view = {width:1280,height:650};
  const fit = floor.camera(view,room);
  assert.ok(room.projectedWidth*fit.scale <= view.width-48);
  assert.ok(room.projectedHeight*fit.scale <= view.height-70);
  const far = floor.camera(view,room,{scale:100000,x:1e9,y:-1e9});
  assert.equal(far.scale,1.8); assert.ok(far.x<5000); assert.ok(far.y>-5000);
  const near = floor.camera(view,room,{scale:-10,x:NaN,y:Infinity});
  assert.equal(near.scale,fit.scale*.7); assert.equal(near.x,0); assert.equal(near.y,0);
});
test('retains finite camera geometry at narrow and temporarily collapsed sizes', () => {
  const room = floor.geometry(floor.group([]));
  for (const width of [0,320,700,1280]) for (const height of [0,650]) {
    const position=floor.camera({width,height},room);
    assert.ok(Object.values(position).every(Number.isFinite)); assert.ok(position.scale>0);
  }
});
