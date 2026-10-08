import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { Link } from 'react-router-dom';

const MODE7_FRAGMENT = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uCameraPos;
uniform float uAngle;
uniform float uHorizon;
uniform float uFov;

varying vec2 outTexCoord;

void main() {
    // 归一化屏幕坐标 (-1 到 1)，y 轴向上
    vec2 p = outTexCoord * 2.0 - 1.0;

    // 地平线以上绘制天空
    if (p.y > uHorizon) {
        gl_FragColor = vec4(0.2, 0.5, 0.9, 1.0);
        return;
    }

    // 计算透视 Z 轴深度（越靠下 Z 越小，即离镜头越近）
    float z = uFov / (uHorizon - p.y);

    float rx = p.x * z;
    float ry = z;

    // 屏幕前方 (0,1) 需映射到世界前进方向 (sinA, cosA)，与 update() 中的位移保持一致
    float sinA = sin(uAngle);
    float cosA = cos(uAngle);
    vec2 worldPos;
    worldPos.x = rx * cosA + ry * sinA + uCameraPos.x;
    worldPos.y = -rx * sinA + ry * cosA + uCameraPos.y;

    vec2 uv = fract(worldPos);
    gl_FragColor = texture2D(uMainSampler, uv);
}
`;

class MainScene extends Phaser.Scene
{
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private car!: Phaser.GameObjects.Sprite;
    private mode7!: Phaser.GameObjects.Shader;
    private speed = 0;
    private worldPos = { x: 0.5, y: 0.5 };
    private carAngle = 0;

    constructor()
    {
        super('MainScene');
    }

    create()
    {
        // --- 1. 动态生成赛道贴图 ('track') ---
        const gTrack = this.make.graphics({ x: 0, y: 0 }, false);
        gTrack.fillStyle(0x2e8b57);
        gTrack.fillRect(0, 0, 256, 256);

        gTrack.fillStyle(0x555555);
        gTrack.fillRect(32, 0, 192, 256);

        gTrack.fillStyle(0x666666);
        for (let y = 0; y < 256; y += 32)
        {
            for (let x = 32; x < 224; x += 32)
            {
                if ((x + y) % 64 === 0)
                {
                    gTrack.fillRect(x, y, 32, 32);
                }
            }
        }

        for (let y = 0; y < 256; y += 32)
        {
            gTrack.fillStyle((y / 32) % 2 === 0 ? 0xff0000 : 0xffffff);
            gTrack.fillRect(24, y, 8, 32);
            gTrack.fillRect(224, y, 8, 32);
        }

        gTrack.generateTexture('track', 256, 256);
        gTrack.destroy();

        // --- 2. 动态生成赛车贴图 ('car') ---
        const gCar = this.make.graphics({ x: 0, y: 0 }, false);
        gCar.fillStyle(0xe74c3c);
        gCar.fillRect(10, 0, 20, 50);

        gCar.fillStyle(0x34495e);
        gCar.fillRect(13, 12, 14, 15);

        gCar.fillStyle(0x111111);
        gCar.fillRect(4, 5, 6, 12);
        gCar.fillRect(30, 5, 6, 12);
        gCar.fillRect(4, 32, 6, 12);
        gCar.fillRect(30, 32, 6, 12);

        gCar.generateTexture('car', 40, 50);
        gCar.destroy();

        // 3. 全屏 Mode7 Shader：track 纹理绑定到纹理单元 0
        this.mode7 = this.add.shader({
            name: 'Mode7',
            fragmentSource: MODE7_FRAGMENT,
            initialUniforms: {
                uMainSampler: 0,
                uCameraPos: [this.worldPos.x, this.worldPos.y],
                uAngle: this.carAngle,
                uHorizon: 0.0,
                uFov: 0.25
            }
        }, 400, 300, 800, 600, ['track']);

        // 4. 玩家赛车（屏幕中下方的 2D 覆盖层）
        this.car = this.add.sprite(400, 500, 'car');

        if (this.input.keyboard)
        {
            this.cursors = this.input.keyboard.createCursorKeys();
        }
    }

    update()
    {
        if (!this.cursors)
        {
            return;
        }

        if (this.cursors.left.isDown) this.carAngle -= 0.03;
        if (this.cursors.right.isDown) this.carAngle += 0.03;

        if (this.cursors.up.isDown)
        {
            this.speed = Math.min(this.speed + 0.001, 0.01);
        }
        else if (this.cursors.down.isDown)
        {
            this.speed = Math.max(this.speed - 0.001, -0.003);
        }
        else
        {
            this.speed *= 0.95;
        }

        this.worldPos.x += Math.sin(this.carAngle) * this.speed;
        this.worldPos.y += Math.cos(this.carAngle) * this.speed;

        // 同步参数到 Shader
        this.mode7.setUniform('uAngle', this.carAngle);
        this.mode7.setUniform('uCameraPos', [this.worldPos.x, this.worldPos.y]);

        // 车 sprite 跟随转向（纯视觉反馈）
        this.car.setRotation(this.carAngle);
    }
}

function Demo02()
{
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current)
        {
            return;
        }

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL, // Mode 7 必须依赖 WebGL
            width: 800,
            height: 600,
            parent: containerRef.current,
            scene: [MainScene]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div id="app">
            <h1>Mode 7 Demo 02</h1>
            <p>方向键：↑ 加速，↓ 倒车，← → 转向</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    )
}

export default Demo02
