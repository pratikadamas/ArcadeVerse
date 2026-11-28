const test = require('node:test');
const assert = require('node:assert/strict');
const {encode,decode,timeline,envelope} = require('../assets/js/morse-code-audio-keyer.js');
test('international alphabet and digits round trip', () => {
 const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789';
 assert.equal(decode(encode(text)),text);
 assert.equal(encode('SOS'), '... --- ...');
});
test('word, letter and element gaps have independent timing', () => {
 const t=timeline('.- . / -',12);
 assert.deepEqual(t.map(x=>Number(x.time.toFixed(5))),[0,0.2,0.8,1.6]);
});
test('PARIS standard word occupies 50 units including trailing word gap', () => {
 const t=timeline(encode('PARIS'),20),last=t.at(-1);
 assert.ok(Math.abs(last.time+last.duration+7*(1.2/20)-3)<1e-9);
});
test('bad characters and malformed symbols are rejected',()=>{
 assert.throws(()=>encode('💥'));
 assert.throws(()=>decode('......'));
 assert.throws(()=>timeline('.',0));
 assert.deepEqual(timeline('',15),[]);
});
test('envelope has a five millisecond attack and release and exact silent end',()=>{
 const calls=[];
 const param={setValueAtTime:(...a)=>calls.push(['set',...a]),exponentialRampToValueAtTime:(...a)=>calls.push(['ramp',...a])};
 envelope(param,2,0.08,0.3);
 assert.deepEqual(calls,[['set',0.00001,2],['ramp',0.3,2.005],['set',0.3,2.075],['ramp',0.00001,2.08],['set',0,2.081]]);
});
