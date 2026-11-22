const test = require('node:test');
const assert = require('node:assert/strict');
const LightGunOptical = require('../assets/js/light-gun-optical.js');

test('LightGunOptical registers targets and calculates optical hits', () => {
  const gun = new LightGunOptical(null, { maxAmmo: 6, audioFeedback: false });
  let hitDetected = false;

  gun.registerTarget({
    id: 'duck_1',
    x: 50,
    y: 50,
    width: 30,
    height: 30,
    onHit: () => { hitDetected = true; }
  });

  const res1 = gun.pullTrigger(60, 60, false);
  assert.equal(res1.hit, true);
  assert.equal(hitDetected, true);
  assert.equal(res1.ammo, 5);

  const resMiss = gun.pullTrigger(10, 10, false);
  assert.equal(resMiss.hit, false);
});

test('LightGunOptical detects off-screen shots to trigger reload', () => {
  const gun = new LightGunOptical(null, { maxAmmo: 6, audioFeedback: false });
  gun.ammo = 1;

  const reloadRes = gun.pullTrigger(-10, -10, true);
  assert.equal(reloadRes.action, 'reload');
  assert.equal(gun.ammo, 6);
});

test('LightGunOptical calibrates scale coordinates accurately', () => {
  const gun = new LightGunOptical(null, { audioFeedback: false });
  const cal = gun.calibrate({ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 110, y: 110 }, { x: 220, y: 220 });

  assert.equal(cal.calibrated, true);
  assert.equal(cal.offsetScaleX, 2.0);
  assert.equal(cal.offsetScaleY, 2.0);
});
