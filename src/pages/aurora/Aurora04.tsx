import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { Link } from 'react-router-dom';

interface AuroraWave {
    x: number;
    baseY: number;
    speed: number;
    amplitude: number;
    wavelength: number;
    color: number[];
}

class AuroraParticleScene extends Phaser.Scene {
    private auroraWaveData: AuroraWave[] = [];
    private emitters: { instance: Phaser.GameObjects.Particles.ParticleEmitter; wave: AuroraWave }[] = [];

    constructor() {
        super({ key: 'AuroraParticleScene' });
    }

    preload() {
        // 1. 动态生成用于粒子的发光圆点纹理
        this.createGlowParticleTexture('particleGlow');
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 2. 背景：深邃极夜渐变
        const bgGraphics = this.add.graphics();
        bgGraphics.fillGradientStyle(0x010411, 0x010411, 0x08152c, 0x08152c, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // 3. 构建多组极光粒子发射器
        // 定义极光流动的正弦波运动控制对象
        this.auroraWaveData = [
            { x: 0, baseY: 180, speed: 0.0012, amplitude: 60, wavelength: 0.005, color: [0x00ffaa, 0x0088ff] }, // 青绿-天蓝
            { x: 0, baseY: 220, speed: 0.0009, amplitude: 80, wavelength: 0.004, color: [0x9900ff, 0x00ffff] }, // 紫色-青蓝
            { x: 0, baseY: 150, speed: 0.0015, amplitude: 50, wavelength: 0.006, color: [0x00ff88, 0x3366ff] }  // 碧绿-深蓝
        ];

        this.emitters = [];

        this.auroraWaveData.forEach((wave) => {
            // 创建粒子发射器
            const emitter = this.add.particles(0, 0, 'particleGlow', {
                lifespan: { min: 2500, max: 4000 },
                // 粒子向上和向侧面微弱飘散，模拟发光气体升腾
                speedY: { min: -40, max: -10 },
                speedX: { min: -10, max: 20 },
                // 缩放：从较小逐渐放大再消失
                scale: { start: 0.8, end: 2.5 },
                // 透明度：淡入淡出（0 -> 0.4 -> 0）
                alpha: { start: 0, end: 0.35, ease: 'Sine.easeInOut' },
                // 颜色渐变：从绿色/紫色过渡到深蓝
                tint: wave.color,
                // 混合模式：加法混合，重叠部分发高亮光
                blendMode: Phaser.BlendModes.ADD,
                // 发射频率
                frequency: 25,
                quantity: 2
            });

            this.emitters.push({ instance: emitter, wave: wave });
        });

        // 4. 背景静止微光星空
        this.add.particles(0, 0, 'particleGlow', {
            x: { min: 0, max: width },
            y: { min: 0, max: height * 0.5 },
            scale: { min: 0.1, max: 0.3 },
            alpha: { start: 0.1, end: 0.6 },
            lifespan: { min: 2000, max: 5000 },
            frequency: 150,
            blendMode: Phaser.BlendModes.ADD
        });

        // 5. 顶层剪影：雪山与松树（增强场景空间感与对比度）
        this.createForegroundSilhouette(width, height);
    }

    update(time: number, delta: number) {
        const width = this.cameras.main.width;

        // 6. 动态更新发射器的位置，使其沿正弦曲线横向扫掠，形成流动的极光光幕
        this.emitters.forEach((item) => {
            const emitter = item.instance;
            const wave = item.wave;

            wave.x += delta * 0.15;
            if (wave.x > width + 100) wave.x = -100;

            // 根据时间与位置计算波动 Y 轴
            const currentX = (time * 0.05) % (width + 200) - 100;
            const waveY = wave.baseY + Math.sin(time * wave.speed + currentX * wave.wavelength) * wave.amplitude;

            // 移动发射源点，粒子将在移动轨迹上持续释放并留痕
            emitter.setPosition(currentX, waveY);
        });
    }

    // 辅助方法：使用 Canvas 绘制带径向渐变的圆点（发光粒子）
    private createGlowParticleTexture(key: string) {
        const size = 64;
        const canvas = this.textures.createCanvas(key, size, size);
        if (!canvas) {
            return;
        }
        const ctx = canvas.context;
        const center = size / 2;

        // 创建从中心向外扩散的模糊渐变圆
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
    }

    // 辅助方法：绘制前景剪影
    private createForegroundSilhouette(width: number, height: number) {
        const g = this.add.graphics();
        g.fillStyle(0x020710, 1);

        // 远山
        g.beginPath();
        g.moveTo(0, height);
        g.lineTo(0, height - 150);
        g.lineTo(width * 0.3, height - 260);
        g.lineTo(width * 0.6, height - 160);
        g.lineTo(width * 0.85, height - 240);
        g.lineTo(width, height - 130);
        g.lineTo(width, height);
        g.closePath();
        g.fillPath();

        // 树木剪影
        g.fillStyle(0x010308, 1);
        for (let i = 0; i < width; i += 30) {
            const treeHeight = 40 + Math.random() * 50;
            const treeY = height - 80 + Math.random() * 20;
            g.fillTriangle(i, treeY, i + 15, treeY - treeHeight, i + 30, treeY);
        }
    }
}

function Aurora() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            parent: containerRef.current,
            scene: [AuroraParticleScene]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div id="app">
            <h1>Aurora 04 Demo</h1>
            <p>Phaser 3 极光特效 - 粒子系统方案</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    );
}

export default Aurora;
