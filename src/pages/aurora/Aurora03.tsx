import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { Link } from 'react-router-dom';

class AuroraScene extends Phaser.Scene {
    private auroras: Phaser.GameObjects.Sprite[] = [];

    constructor() {
        super({ key: 'AuroraScene' });
    }

    preload() {
        // 动态创建两张不同色彩和形状的极光渐变纹理
        this.createAuroraTexture('auroraGreen', 0x00ffaa, 0x0033aa);
        this.createAuroraTexture('auroraPurple', 0xaa00ff, 0x0088ff);
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 1. 底层：深邃夜空渐变背景
        const bgGraphics = this.add.graphics();
        bgGraphics.fillGradientStyle(0x020514, 0x020514, 0x081026, 0x081026, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // 2. 星空粒子（增加夜空氛围）
        this.add.particles(0, 0, 'auroraGreen', {
            x: { min: 0, max: width },
            y: { min: 0, max: height * 0.6 },
            scale: { start: 0.01, end: 0.03 },
            alpha: { start: 0.2, end: 0.8 },
            lifespan: 3000,
            quantity: 1,
            frequency: 100,
            blendMode: Phaser.BlendModes.ADD
        });

        // 3. 极光层：创建多个半透明光带对象，并使用加法混合 (ADD)
        // 配置不同的光带属性（颜色纹理、位置、透明度、缩放、速度）
        const configs = [
            { key: 'auroraGreen',  x: width * 0.3, y: 150, alpha: 0.4, scaleX: 1.5, scaleY: 1.2, waveSpeed: 0.001 },
            { key: 'auroraPurple', x: width * 0.5, y: 180, alpha: 0.35, scaleX: 1.8, scaleY: 1.0, waveSpeed: 0.0015 },
            { key: 'auroraGreen',  x: width * 0.7, y: 130, alpha: 0.3, scaleX: 1.6, scaleY: 1.4, waveSpeed: 0.0012 }
        ];

        configs.forEach((cfg) => {
            const sprite = this.add.sprite(cfg.x, cfg.y, cfg.key);
            sprite.setBlendMode(Phaser.BlendModes.ADD); // 加法混合核心：重叠处发光
            sprite.setAlpha(cfg.alpha);
            sprite.setScale(cfg.scaleX, cfg.scaleY);

            // 记录动画参数
            sprite.setData('baseY', cfg.y);
            sprite.setData('baseAlpha', cfg.alpha);
            sprite.setData('waveSpeed', cfg.waveSpeed);
            sprite.setData('timer', Math.random() * 100);

            this.auroras.push(sprite);
        });

        // 4. 顶层：山脉剪影（压暗底部，凸显极光发光感）
        const mountainGraphics = this.add.graphics();
        mountainGraphics.fillStyle(0x030712, 1);
        mountainGraphics.beginPath();
        mountainGraphics.moveTo(0, height);
        mountainGraphics.lineTo(0, height - 120);
        mountainGraphics.lineTo(width * 0.25, height - 200);
        mountainGraphics.lineTo(width * 0.5, height - 130);
        mountainGraphics.lineTo(width * 0.75, height - 220);
        mountainGraphics.lineTo(width, height - 100);
        mountainGraphics.lineTo(width, height);
        mountainGraphics.closePath();
        mountainGraphics.fillPath();
    }

    update(_time: number, delta: number) {
        // 5. 让极光进行轻微的平移、上下波浪漂浮和呼吸伸缩
        this.auroras.forEach((aurora) => {
            const baseY = aurora.getData('baseY') as number;
            const baseAlpha = aurora.getData('baseAlpha') as number;
            const waveSpeed = aurora.getData('waveSpeed') as number;
            const timer = (aurora.getData('timer') as number) + delta * waveSpeed;
            aurora.setData('timer', timer);

            // X 轴缓缓平移
            aurora.x += Math.sin(timer * 0.5) * 0.3;

            // Y 轴上下波浪起伏
            aurora.y = baseY + Math.sin(timer) * 25;

            // 变形与呼吸感：微弱改变倾斜度与缩放
            aurora.rotation = Math.sin(timer * 0.7) * 0.05;
            aurora.scaleY = 1 + Math.sin(timer * 0.8) * 0.15;
            aurora.alpha = baseAlpha + Math.sin(timer * 0.5) * 0.1;
        });
    }

    // 辅助函数：程序化生成带有渐变和波浪感的极光纹理
    private createAuroraTexture(key: string, colorTop: number, colorBottom: number) {
        const textureWidth = 600;
        const textureHeight = 350;
        const canvas = this.textures.createCanvas(key, textureWidth, textureHeight);
        if (!canvas) {
            return;
        }
        const ctx = canvas.context;

        // 创建线性渐变（中间亮、上下边缘透明度低）
        const gradient = ctx.createLinearGradient(0, 0, 0, textureHeight);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.2, Phaser.Display.Color.IntegerToColor(colorTop).rgba);
        gradient.addColorStop(0.7, Phaser.Display.Color.IntegerToColor(colorBottom).rgba);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;

        // 绘制带有羽化边缘的不规则曲面光带形状
        ctx.beginPath();
        ctx.moveTo(0, 50);
        ctx.bezierCurveTo(textureWidth * 0.3, 0, textureWidth * 0.6, 120, textureWidth, 40);
        ctx.lineTo(textureWidth, textureHeight - 40);
        ctx.bezierCurveTo(textureWidth * 0.6, textureHeight, textureWidth * 0.3, textureHeight - 100, 0, textureHeight - 50);
        ctx.closePath();
        ctx.fill();

        canvas.refresh();
    }
}

function Aurora03() {
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
            scene: [AuroraScene]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div id="app">
            <h1>Aurora 03 Demo</h1>
            <p>Phaser 3 极光特效 - 多层叠加方案（Canvas 纹理 + 加法混合）</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    );
}

export default Aurora03;
