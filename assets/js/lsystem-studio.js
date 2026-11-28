/**
 * Procedural 2D L-System Fractal Botanical & Growth Engine (#1572)
 * String-rewriting grammar expansion with strict safety caps,
 * stack-based 2D turtle graphics interpretation (F, +, -, [, ]),
 * and progressive branching growth.
 */

class LSystemEngine {
    static PRESETS = {
        fractalPlant: {
            axiom: 'X',
            rules: {
                'X': 'F+[[X]-X]-F[-FX]+X',
                'F': 'FF'
            },
            angle: 25,
            length: 4.5,
            iterations: 4
        },
        kochSnowflake: {
            axiom: 'F--F--F',
            rules: {
                'F': 'F+F--F+F'
            },
            angle: 60,
            length: 6,
            iterations: 3
        },
        dragonCurve: {
            axiom: 'FX',
            rules: {
                'X': 'X+YF+',
                'Y': '-FX-Y'
            },
            angle: 90,
            length: 8,
            iterations: 8
        }
    };

    static MAX_STRING_LENGTH = 100000; // Safety cap against memory exhaustion

    constructor(options = {}) {
        this.preset = options.preset || 'fractalPlant';
        const p = LSystemEngine.PRESETS[this.preset];

        this.axiom = p.axiom;
        this.rules = { ...p.rules };
        this.angle = p.angle;
        this.length = p.length;
        this.iterations = Math.min(p.iterations, 5); // Default safe bound
    }

    expandAxiom(axiom, rules, iterations) {
        let current = axiom;
        for (let it = 0; it < iterations; it++) {
            let next = '';
            for (let i = 0; i < current.length; i++) {
                const char = current[i];
                next += rules[char] !== undefined ? rules[char] : char;
                if (next.length > LSystemEngine.MAX_STRING_LENGTH) {
                    next = next.slice(0, LSystemEngine.MAX_STRING_LENGTH);
                    break;
                }
            }
            current = next;
        }
        return current;
    }

    getExpandedString() {
        return this.expandAxiom(this.axiom, this.rules, this.iterations);
    }

    interpret(expandedStr, startX = 300, startY = 460) {
        let x = startX;
        let y = startY;
        let angleDeg = -90; // Point up

        const radFactor = Math.PI / 180;
        const stack = [];
        const lines = [];

        for (let i = 0; i < expandedStr.length; i++) {
            const cmd = expandedStr[i];
            if (cmd === 'F') {
                const nx = x + Math.cos(angleDeg * radFactor) * this.length;
                const ny = y + Math.sin(angleDeg * radFactor) * this.length;
                lines.push({ x1: x, y1: y, x2: nx, y2: ny, depth: stack.length });
                x = nx;
                y = ny;
            } else if (cmd === '+') {
                angleDeg += this.angle;
            } else if (cmd === '-') {
                angleDeg -= this.angle;
            } else if (cmd === '[') {
                stack.push({ x, y, angleDeg });
            } else if (cmd === ']') {
                if (stack.length > 0) {
                    const saved = stack.pop();
                    x = saved.x;
                    y = saved.y;
                    angleDeg = saved.angleDeg;
                }
            }
        }

        return lines;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LSystemEngine };
}
