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
    private lastShaderWidth = 0;
    private lastShaderHeight = 0;

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
        this.syncShaderSize();

        // 代替 Play.ts 里的点击星星：每 5 秒走一次同样的 brighten 路径
        this.time.addEvent({ delay: CHANGE_EVERY_MS, loop: true, callback: () => this.brighten() });

        this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
        });
    }

    private onResize(): void {
        this.syncShaderSize();
    }

    private syncShaderSize(): void {
        if (!this.shader) return;
        const canvas = this.game.canvas;
        const width = canvas.width;
        const height = canvas.height;
        if (width === this.lastShaderWidth && height === this.lastShaderHeight) return;

        this.lastShaderWidth = width;
        this.lastShaderHeight = height;
        (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).resize(width, height);
        this.shader.setPosition(width / 2, height / 2);
        this.shader.setSize(width, height);
        // here is setOrigin and setUniform api doc
        // https://phaser.io/oss/docs/api-documentation/namespace/gameobjects-components-origin#setorigin
        this.shader.setOrigin(0.5, 0.5);
        this.shader.setUniform('uResolution', [width, height]);
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
        this.syncShaderSize();
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

function Aurora06() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const previousBodyBg = document.body.style.backgroundColor;
        const previousHtmlBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#020617';
        document.documentElement.style.backgroundColor = '#020617';

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL,   // Shader 依赖 WebGL
            parent: containerRef.current,
            scene: [AuroraScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.NO_CENTER,
                resizeInterval: 0,
                width: Math.max(window.innerWidth, 800),
                height: Math.max(window.innerHeight, 600),
                min: { width: 800, height: 600 }
            }
        };

        const game = new Phaser.Game(config);
        const stretchCanvas = () => {
            const canvas = game.canvas;
            if (!canvas) return;
            canvas.style.display = 'block';
            canvas.style.margin = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        };
        stretchCanvas();
        game.events.once(Phaser.Core.Events.READY, stretchCanvas);

        const resizeObserver = new ResizeObserver(() => {
            if (!game.isBooted) return;
            game.scale.getParentBounds();
            game.scale.refresh();
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            document.body.style.backgroundColor = previousBodyBg;
            document.documentElement.style.backgroundColor = previousHtmlBg;
            game.destroy(true);
        };
    }, []);

    return (
        <div id="app" style={{ position: 'fixed', top: 0, left: 0, display: 'block', width: '100vw', height: '100vh', minWidth: 800, minHeight: 600, overflow: 'auto', background: 'linear-gradient(#020617, #0a1838)', color: '#fff' }}>
            <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 1, pointerEvents: 'none' }}>
                <h1 style={{ margin: 0, fontSize: 20 }}>Aurora 06 Demo</h1>
                <p style={{ margin: '4px 0 0' }}>从 Phaser AE 移植：夜空渐变 + 三条 shader 极光渐变光带 2</p>
            </div>
            <div
                ref={containerRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', outline: '2px solid red', outlineOffset: '-2px', lineHeight: 0 }}
            />
            <Link to="/" style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 1, color: '#7dffd4' }}>
                Back to Game
            </Link>
        </div>
    );
}

export default Aurora06;
