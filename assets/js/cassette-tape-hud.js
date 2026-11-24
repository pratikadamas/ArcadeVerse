/**
 * CassetteTapeHUD - Interactive Dual-Spool Retro Audio Cassette Tape Rewind & Fast-Forward Animation HUD
 * 
 * Simulates an authentic 1980s retro audio cassette with transparent center window,
 * dual rotating spools with accurate magnetic tape radius transfer calculation,
 * and tactile transport controls (Play, Pause, Fast-Forward, Rewind).
 */

class CassetteTapeHUD {
  constructor(options = {}) {
    this.totalTime = options.totalTime || 180; // Total tape length in seconds
    this.currentTime = options.currentTime || 0;
    this.isPlaying = false;
    this.speed = 1.0; // 1.0x (normal), 4.0x (fast forward), -4.0x (rewind)
    this.minSpoolRadius = 12;
    this.maxSpoolRadius = 38;

    this.spoolAngleLeft = 0;
    this.spoolAngleRight = 0;
  }

  play() {
    this.isPlaying = true;
    this.speed = 1.0;
  }

  pause() {
    this.isPlaying = false;
  }

  fastForward() {
    this.isPlaying = true;
    this.speed = 4.0;
  }

  rewind() {
    this.isPlaying = true;
    this.speed = -4.0;
  }

  update(deltaSec = 0.016) {
    if (!this.isPlaying) return;

    this.currentTime += deltaSec * this.speed;
    if (this.currentTime > this.totalTime) {
      this.currentTime = this.totalTime;
      this.pause();
    } else if (this.currentTime < 0) {
      this.currentTime = 0;
      this.pause();
    }

    // Angular rotation proportional to speed
    const rotSpeed = 3.5 * this.speed * deltaSec;
    this.spoolAngleLeft += rotSpeed;
    this.spoolAngleRight += rotSpeed;
  }

  getTapeRadii() {
    // Left spool shrinks as right spool expands
    const progress = Math.max(0, Math.min(1.0, this.currentTime / (this.totalTime || 1)));
    const leftRadius = this.maxSpoolRadius - progress * (this.maxSpoolRadius - this.minSpoolRadius);
    const rightRadius = this.minSpoolRadius + progress * (this.maxSpoolRadius - this.minSpoolRadius);

    return {
      progress: Number(progress.toFixed(3)),
      leftRadius: Number(leftRadius.toFixed(1)),
      rightRadius: Number(rightRadius.toFixed(1))
    };
  }

  render(ctx, x = 0, y = 0, width = 280, height = 160) {
    if (!ctx) return;
    this.update();

    const radii = this.getTapeRadii();
    ctx.save();
    ctx.translate(x, y);

    // Cassette shell body
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, width, height, 10) : ctx.rect(0, 0, width, height);
    ctx.fill();
    ctx.stroke();

    // Center label & transparent window
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(width * 0.15, height * 0.25, width * 0.7, height * 0.5);

    // Left Spool & magnetic tape cake
    const leftCenterX = width * 0.32;
    const centerY = height * 0.5;
    ctx.beginPath();
    ctx.arc(leftCenterX, centerY, radii.leftRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03'; // Dark brown magnetic tape
    ctx.fill();

    // Right Spool & magnetic tape cake
    const rightCenterX = width * 0.68;
    ctx.beginPath();
    ctx.arc(rightCenterX, centerY, radii.rightRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // Rotating spool cogs
    this.drawSpoolCog(ctx, leftCenterX, centerY, this.spoolAngleLeft);
    this.drawSpoolCog(ctx, rightCenterX, centerY, this.spoolAngleRight);

    ctx.restore();
  }

  drawSpoolCog(ctx, cx, cy, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, this.minSpoolRadius, 0, Math.PI * 2);
    ctx.fill();

    // Cog teeth notches
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 6; i++) {
      const toothAngle = (i / 6) * Math.PI * 2;
      ctx.fillRect(Math.cos(toothAngle) * 8 - 2, Math.sin(toothAngle) * 8 - 2, 4, 4);
    }
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CassetteTapeHUD };
}
