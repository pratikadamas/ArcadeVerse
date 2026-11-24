
(() => {
    "use strict";

    const canvas = document.querySelector("#c"),
        ctx = canvas.getContext("2d"),
        W = 480,
        H = 680;
    const $ = id => document.getElementById(id),
        overlay = $("overlay"),
        keys = { left: false, right: false };

    let state = "ready",
        player,
        platforms,
        boosters,
        hazards,
        stars,
        camera = 0,
        highest = 0,
        elapsed = 0,
        last = 0,
        rocketCount = 0,
        best = 0;

    try {
        best = Number((window.ArcadeStorage ? window.ArcadeStorage.getItem("bestScore") : null) || localStorage.getItem("astroJumperBest")) || 0;
    } catch (e) {}

    const rand = (a, b) => a + Math.random() * (b - a),
        clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    function reset() {
        player = {
            x: W / 2 - 12,
            y: H - 125,
            w: 24,
            h: 30,
            vx: 0,
            vy: -8.5,
            rocket: 0
        };

        platforms = [];
        boosters = [];
        hazards = [];
        camera = 0;
        highest = player.y;
        elapsed = 0;
        rocketCount = 0;

        stars = Array.from({ length: 90 }, () => ({
            x: rand(0, W),
            y: rand(0, H),
            r: rand(.5, 1.8),
            a: rand(.2, .9)
        }));

        platforms.push(makePlatform(H - 75, "normal", W / 2 - 45));

        let y = H - 145;

        while (y > -H * 1.7) {
            addPlatform(y);
            y -= rand(68, 94);
        }

        hud();
        draw();
    }

    function makePlatform(y, type, x) {
        let w = type === "normal" ? rand(70, 98) : rand(62, 86);

        return {
            x: x === undefined ? rand(8, W - w - 8) : x,
            y,
            w,
            h: 12,
            type,
            vx: type === "moving"
                ? (Math.random() < .5 ? -1 : 1) * rand(1, 1.8)
                : 0,
            alive: true
        };
    }

    function addPlatform(y) {
        let r = Math.random(),
            type = r < .13
                ? "spring"
                : r < .28
                    ? "moving"
                    : r < .41 + Math.min(Math.abs(y) / 9000, .3)
                        ? "fragile"
                        : "normal";

        platforms.push(makePlatform(y, type));

        if (Math.random() < .095) {
            boosters.push({
                x: rand(22, W - 22),
                y: y - rand(30, 55),
                r: 10,
                alive: true,
                phase: rand(0, 6)
            });
        }

        if (Math.random() < .055) {
            hazards.push({
                x: rand(30, W - 30),
                y: y - rand(30, 75),
                r: rand(13, 18),
                phase: rand(0, 6)
            });
        }
    }

    function altitude() {
        return Math.max(0, Math.floor((H - 125 - highest) / 4));
    }

    function hud() {
        $("altitude").textContent = altitude() + " m";
        $("best").textContent = best + " m";
        $("rockets").textContent = rocketCount;
    }

    function start() {
        if (state === "paused") {
            state = "playing";
            overlay.classList.add("hide");
            last = performance.now();
            requestAnimationFrame(loop);
            return;
        }

        reset();
        state = "playing";
        overlay.classList.add("hide");
        last = performance.now();
        requestAnimationFrame(loop);
    }

    function pause() {
        if (state !== "playing") return;

        state = "paused";
        show("Paused", "Take a break, space jumper. Resume when ready.", "Resume");
    }

    function show(title, msg, button) {
        $("title").textContent = title;
        $("message").textContent = msg;
        $("start").textContent = button;
        overlay.classList.remove("hide");
    }

    function end() {
        if (state === "over") return;

        state = "over";

        let score = altitude();

        if (score > best) {
            best = score;

            try {
                if (window.ArcadeStorage) window.ArcadeStorage.setItem("bestScore", best); localStorage.setItem("astroJumperBest", best);
            } catch (e) {}
        }

        hud();

        show(
            "Mission Over",
            `You reached ${score} m. Best altitude: ${best} m. Ready for another climb?`,
            "Jump Again"
        );
    }

    function loop(now) {
        if (state !== "playing") return;

        let dt = clamp((now - last) / 16.67 || 1, .5, 2);
        last = now;
        elapsed += dt;

        update(dt);
        draw();

        if (state === "playing") requestAnimationFrame(loop);
    }

    function update(dt) {
        player.vx = (keys.right ? 4.4 : 0) - (keys.left ? 4.4 : 0);
        player.x += player.vx * dt;

        if (player.x + player.w < 0) player.x = W;
        if (player.x > W) player.x = -player.w;

        const prevBottom = player.y + player.h;

        player.vy += .34 * dt;

        if (player.rocket > 0) {
            player.rocket -= dt;
            player.vy = Math.min(player.vy, -13.5);
        }
        player.vy = Math.min(player.vy, 14);

        player.y += player.vy * dt;

        const currBottom = player.y + player.h;

        platforms.forEach(p => {
            if (!p.alive) return;

            if (p.type === "moving") {
                p.x += p.vx * dt;

                if (p.x < 4 || p.x + p.w > W - 4) p.vx *= -1;
            }

            if (
                player.vy > 0 &&
                prevBottom <= p.y + 6 &&
                currBottom >= p.y &&
                player.x + player.w > p.x &&
                player.x < p.x + p.w
            ) {
                player.y = p.y - player.h;
                player.vy = p.type === "spring" ? -14.5 : -9.2;

                if (p.type === "fragile") p.alive = false;
            }
        });

        boosters.forEach(b => {
            if (!b.alive) return;

            b.phase += .08 * dt;

            if (
                Math.hypot(
                    player.x + player.w / 2 - b.x,
                    player.y + player.h / 2 - b.y
                ) < b.r + 16
            ) {
                b.alive = false;
                player.rocket = 48;
                player.vy = -15.5;
                rocketCount++;
            }
        });

        hazards.forEach(h => {
            h.phase += .04 * dt;

            if (
                Math.hypot(
                    player.x + player.w / 2 - h.x,
                    player.y + player.h / 2 - h.y
                ) < h.r + 10
            ) {
                end();
            }
        });

        if (player.y < highest) highest = player.y;

        let target = Math.min(0, H * .42 - player.y);

        if (target < camera) {
            camera += (target - camera) * Math.min(.18 * dt, 1);
        }

        if (player.y + camera < H * .2) {
            camera = H * .2 - player.y;
        }

        let top = -camera - 120,
            highestPlatform = Math.min(...platforms.map(p => p.y));

        while (highestPlatform > top - 180) {
            highestPlatform -= rand(68, 94);
            addPlatform(highestPlatform);
        }

        platforms = platforms.filter(
            p => p.y + camera < H + 90 || (p.alive || p.y + camera > H + 30)
        );

        boosters = boosters.filter(b => b.y + camera < H + 60 && b.alive);
        hazards = hazards.filter(h => h.y + camera < H + 60);

        if (player.y + camera > H + 50) end();

        hud();
    }

    function round(x, y, w, h, r) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        let g = ctx.createLinearGradient(0, 0, 0, H);

        g.addColorStop(0, "#11183d");
        g.addColorStop(1, "#070b1d");

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        stars.forEach(s => {
            ctx.globalAlpha = s.a * (.7 + .3 * Math.sin(elapsed * .04 + s.x));
            ctx.fillStyle = "#d8f8ff";
            ctx.beginPath();
            ctx.arc(s.x, (s.y + elapsed * .22) % H, s.r, 0, 7);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#6582ff12";

        for (let x = 0; x < W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }

        platforms.forEach(p => {
            let y = p.y + camera;

            if (y < -30 || y > H + 30) return;

            ctx.save();

            let color = p.type === "spring"
                ? "#69ffb0"
                : p.type === "moving"
                    ? "#6af3ff"
                    : p.type === "fragile"
                        ? "#ff7bca"
                        : "#7889ff";

            ctx.shadowBlur = 14;
            ctx.shadowColor = color;
            ctx.fillStyle = color;

            round(p.x, y, p.w, p.h, 5);

            if (p.type === "spring") {
                ctx.strokeStyle = "#d5ffe8";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x + 10, y - 3);
                ctx.lineTo(p.x + 18, y - 9);
                ctx.lineTo(p.x + 26, y - 3);
                ctx.stroke();
            }

            if (p.type === "fragile") {
                ctx.strokeStyle = "#5a183e";
                ctx.beginPath();
                ctx.moveTo(p.x + p.w * .45, y);
                ctx.lineTo(p.x + p.w * .55, y + 5);
                ctx.lineTo(p.x + p.w * .5, y + 10);
                ctx.stroke();
            }

            ctx.restore();
        });

        boosters.forEach(b => {
            if (!b.alive) return;

            ctx.save();
            ctx.translate(b.x, b.y + camera);
            ctx.rotate(Math.sin(b.phase) * .15);
            ctx.shadowBlur = 18;
            ctx.shadowColor = "#ffb86b";
            ctx.fillStyle = "#ffb86b";
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(8, 7);
            ctx.lineTo(2, 5);
            ctx.lineTo(0, 12);
            ctx.lineTo(-2, 5);
            ctx.lineTo(-8, 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });

        hazards.forEach(h => {
            let y = h.y + camera;

            if (y < -30 || y > H + 30) return;

            ctx.save();
            ctx.translate(h.x, y);
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#a78bfa";

            let rg = ctx.createRadialGradient(-4, -4, 2, 0, 0, h.r + 5);

            rg.addColorStop(0, "#03040c");
            rg.addColorStop(.7, "#0a0c20");
            rg.addColorStop(1, "#a78bfa");

            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.arc(0, 0, h.r, 0, 7);
            ctx.fill();

            ctx.strokeStyle = "#be9effaa";
            ctx.beginPath();
            ctx.ellipse(0, 0, h.r + 5, h.r * .55, h.phase, 0, 7);
            ctx.stroke();

            ctx.restore();
        });

        let x = player.x + player.w / 2,
            y = player.y + camera + player.h / 2;

        ctx.save();
        ctx.translate(x, y);

        if (player.rocket > 0) {
            ctx.fillStyle = "#ffb86b";
            ctx.beginPath();
            ctx.moveTo(-5, 12);
            ctx.lineTo(0, 25 + Math.random() * 4);
            ctx.lineTo(5, 12);
            ctx.fill();
        }

        ctx.shadowBlur = 18;
        ctx.shadowColor = "#6af3ff";
        ctx.fillStyle = "#eafcff";

        round(-10, -13, 20, 25, 8);

        ctx.fillStyle = "#6af3ff";
        ctx.beginPath();
        ctx.ellipse(0, -5, 7, 6, 0, 0, 7);
        ctx.fill();

        ctx.fillStyle = "#8a8dff";
        ctx.fillRect(-13, 0, 4, 10);
        ctx.fillRect(9, 0, 4, 10);

        ctx.restore();
    }

    function key(e, down) {
        let k = e.key.toLowerCase();

        if (["arrowleft", "arrowright", " ", "a", "d"].includes(k)) {
            e.preventDefault();
        }

        if (k === "arrowleft" || k === "a") keys.left = down;
        if (k === "arrowright" || k === "d") keys.right = down;

        if (!down) return;

        if (k === " " && state === "playing") pause();
        else if (k === " " && state === "paused") start();
        else if (k === "enter" && (state === "ready" || state === "over")) start();
    }

    window.addEventListener("keydown", e => key(e, true));
    window.addEventListener("keyup", e => key(e, false));
    window.addEventListener("blur", () => keys.left = keys.right = false);

    function hold(id, dir) {
        let b = $(id);

        const on = e => {
            e.preventDefault();
            keys[dir] = true;
        };

        const off = e => {
            e.preventDefault();
            keys[dir] = false;
        };

        b.addEventListener("pointerdown", on);

        ["pointerup", "pointerleave", "pointercancel"].forEach(
            t => b.addEventListener(t, off)
        );
    }

    hold("left", "left");
    hold("right", "right");

    $("start").addEventListener("click", start);

    $("help").addEventListener("click", () => {
        if (state === "playing") {
            pause();
            return;
        }

        show(
            "How to Play",
            "Use ← / → or A / D to steer. Land on platforms to bounce upward. Green springs launch you higher; collect orange rocket boosters for a burst. Pink platforms break after landing. Avoid black holes. Space pauses the game. Your altitude is your score.",
            state === "paused"
                ? "Resume"
                : state === "over"
                    ? "Jump Again"
                    : "Start Jumping"
        );
    });

    reset();
})();
