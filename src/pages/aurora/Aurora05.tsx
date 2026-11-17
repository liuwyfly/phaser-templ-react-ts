import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { Link } from 'react-router-dom';

// 从 aurora_02 的 backdrop-aurora 移植：WGSL -> GLSL ES 1.00
const AURORA_FRAGMENT = `
precision highp float;

uniform float uTime;
uniform float uAmount;
uniform float uSpeed;
uniform vec2  uResolution;
uniform vec3  uSkyTop;
uniform vec3  uSkyBottom;
uniform vec3  uColorA;
uniform vec3  uColorB;
varying vec2 outTexCoord;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = outTexCoord;       // Phaser: y=1 顶部, y=0 底部
    float ay = 1.0 - uv.y;       // AE:    y=0 顶部, y=1 底部

    // 1) 夜空渐变：对应 game.background.gradient(top, bottom, 1.3)
    float t = pow(clamp(ay, 0.0, 1.0), 1.3);
    vec3 sky = mix(uSkyTop, uSkyBottom, t);

    // 2) 三条极光渐变光带：对应 backdrop-aurora 的 3 次循环
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float wave = sin(uv.x * (4.0 + fi * 2.3)
                       + uTime * uSpeed * (0.35 + fi * 0.2)
                       + fi * 2.1) * (0.08 + 0.04 * fi);
        float band = 0.22 + fi * 0.15 + wave;
        float d = abs(ay - band);
        float glow = exp(-d * (26.0 - fi * 6.0)) * (0.8 - fi * 0.2);
        float sway = 0.5 + 0.5 * sin(uv.x * 3.0 - uTime * uSpeed * 0.5 + fi);
        acc += mix(uColorA, uColorB, sway) * glow;
    }

    float a = clamp(acc.g * 1.4, 0.0, 1.0) * uAmount;
    vec3 col = acc * uAmount + sky * (1.0 - a);   // 预乘 alpha 叠加

    // 3) 星星：沿用 Aurora.tsx 的格子 hash 做法
    vec2 suv = uv * uResolution / 4.0;
    vec2 cell = floor(suv);
    float h = hash(cell + floor(uTime * 0.2));
    float sd = length(suv - (cell + 0.5));
    float star = step(0.995, h) * (1.0 - smoothstep(0.0, 0.12, sd));
    star *= smoothstep(0.3, 0.9, uv.y) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 30.0));
    col += vec3(star) * 0.8;

    gl_FragColor = vec4(col, 1.0);
}
`;

// '#rrggbb' -> [r, g, b]，每个分量 0..1
const rgb = (hex: string): number[] =>
    [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

// 与 Play.ts / sky.ts 相同的“得分”规则，这里由 5 秒定时器代替点击星星
const AURORA_BASE = 0.85;          // 起始亮度，半亮
const AURORA_PER_STEP = 0.06;      // 每次触发增加的亮度
const MAX_AURORA = 1;
const START_SPEED = 0.8;
const CHANGE_EVERY_MS = 5000;      // 每 5 秒触发一次
const TWEEN_MS = 800;              // 与原 aurora.tween 的 duration: 0.8 一致
const CURTAIN_COLORS = ['#7a5cff', '#ff5cc8', '#7dffd4', '#5ce1ff', '#ffd166'];

class AuroraScene extends Phaser.Scene {
    private shader!: Phaser.GameObjects.Shader;

    private step = 0;
    private amount = AURORA_BASE;
    private speed = START_SPEED;
    private fromAmount = AURORA_BASE;
    private fromSpeed = START_SPEED;
    private toAmount = AURORA_BASE;
    private toSpeed = START_SPEED;
    private tweenElapsed = TWEEN_MS;

    constructor() {
        super('Aurora05Scene');
    }

    create() {
        const { width, height } = this.scale;
        this.shader = this.add.shader({
            name: 'Aurora05',
            fragmentSource: AURORA_FRAGMENT,
            initialUniforms: {
                uMainSampler: 0,
                uTime: 0,
                uResolution: [width, height],
                uAmount: AURORA_BASE,
                uSpeed: START_SPEED,
                uSkyTop: rgb('#020617'),
                uSkyBottom: rgb('#0a1838'),
                uColorA: rgb('#37ff9e'),
                uColorB: rgb(CURTAIN_COLORS[0])
            }
        }, width / 2, height / 2, width, height);

        // 代替 Play.ts 里的点击星星：每 5 秒走一次同样的 brighten 路径
        this.time.addEvent({ delay: CHANGE_EVERY_MS, loop: true, callback: () => this.brighten() });
    }

    private brighten(): void {
        this.step += 1;
        this.fromAmount = this.amount;
        this.fromSpeed = this.speed;
        this.toAmount = Math.min(MAX_AURORA, AURORA_BASE + this.step * AURORA_PER_STEP);
        this.toSpeed = START_SPEED + Math.min(this.step, 20) * 0.03;
        this.tweenElapsed = 0;

        // 原游戏里 setColor('b', ...) 是立即生效，不做补间
        this.shader.setUniform('uColorB', rgb(CURTAIN_COLORS[Math.floor(this.step / 4) % CURTAIN_COLORS.length]));
    }

    update(time: number, delta: number) {
        this.shader.setUniform('uTime', time / 1000);

        if (this.tweenElapsed < TWEEN_MS) {
            this.tweenElapsed = Math.min(TWEEN_MS, this.tweenElapsed + delta);
            const p = this.tweenElapsed / TWEEN_MS;
            // easeInOutQuad，对应 AE tween 的默认曲线
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            this.amount = this.fromAmount + (this.toAmount - this.fromAmount) * e;
            this.speed = this.fromSpeed + (this.toSpeed - this.fromSpeed) * e;
            this.shader.setUniform('uAmount', this.amount);
            this.shader.setUniform('uSpeed', this.speed);
        }
    }
}

function Aurora05() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL,   // Shader 依赖 WebGL
            width: 800,
            height: 600,
            parent: containerRef.current,
            scene: [AuroraScene]
        };

        const game = new Phaser.Game(config);
        return () => { game.destroy(true); };
    }, []);

    return (
        <div id="app">
            <h1>Aurora 05 Demo</h1>
            <p>从 Phaser AE 移植：夜空渐变 + 三条 shader 极光渐变光带 2</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    );
}

export default Aurora05;
