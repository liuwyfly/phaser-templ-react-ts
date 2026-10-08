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

    // 地平线以上绘制天空颜色
    if (p.y > uHorizon) {
        gl_FragColor = vec4(0.5, 0.7, 1.0, 1.0);
        return;
    }

    // 计算透视深度 Z（越靠下 Z 越小，即离镜头越近）
    float z = uFov / (uHorizon - p.y);

    // 当前像素在地面平面上的偏移
    float rx = p.x * z;
    float ry = z;

    // 结合玩家旋转角度进行旋转变换
    // 屏幕前方 (0,1) 需映射到世界前进方向 (sinA, cosA)，与 update() 中的位移保持一致
    float sinA = sin(uAngle);
    float cosA = cos(uAngle);
    vec2 worldPos;
    worldPos.x = rx * cosA + ry * sinA + uCameraPos.x;
    worldPos.y = -rx * sinA + ry * cosA + uCameraPos.y;

    // 使用 fract 取模实现平铺采样，映射回 0.0 - 1.0 纹理坐标
    vec2 uv = fract(worldPos);

    gl_FragColor = texture2D(uMainSampler, uv);
}
`;

class Mode7Scene extends Phaser.Scene
{
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private car!: Phaser.GameObjects.Sprite;
    private mode7!: Phaser.GameObjects.Shader;
    private speed = 0;
    private worldPos = { x: 0.5, y: 0.5 };
    private carAngle = 0;

    constructor()
    {
        super('Mode7Scene');
    }

    create()
    {
        // 程序化生成可平铺的棋盘格赛道纹理（无需外部资源）
        const track = this.textures.createCanvas('track', 128, 128);

        if (track)
        {
            const ctx = track.getContext();
            const cell = 32;

            for (let y = 0; y < 4; y++)
            {
                for (let x = 0; x < 4; x++)
                {
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#3a7d44' : '#2e6336';
                    ctx.fillRect(x * cell, y * cell, cell, cell);
                }
            }

            ctx.strokeStyle = '#e6e6e6';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 128, 128);

            track.refresh();
        }

        // 程序化生成赛车纹理
        const carGraphics = this.make.graphics({ x: 0, y: 0 }, false);
        carGraphics.fillStyle(0xd62828, 1);
        carGraphics.fillRect(0, 0, 24, 40);
        carGraphics.fillStyle(0xf6f6f6, 1);
        carGraphics.fillRect(4, 6, 16, 10);
        carGraphics.generateTexture('car', 24, 40);
        carGraphics.destroy();

        // 全屏 Mode7 Shader：track 纹理绑定到纹理单元 0
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

        // 玩家赛车（屏幕中下方的 2D 覆盖层）
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

        // 控制转向
        if (this.cursors.left.isDown) this.carAngle -= 0.03;
        if (this.cursors.right.isDown) this.carAngle += 0.03;

        // 控制油门与刹车
        if (this.cursors.up.isDown)
        {
            this.speed = Math.min(this.speed + 0.0005, 0.005);
        }
        else
        {
            this.speed *= 0.95; // 自然减速
        }

        // 根据角度和速度更新世界坐标
        this.worldPos.x += Math.sin(this.carAngle) * this.speed;
        this.worldPos.y += Math.cos(this.carAngle) * this.speed;

        // 同步参数到 Shader
        this.mode7.setUniform('uAngle', this.carAngle);
        this.mode7.setUniform('uCameraPos', [this.worldPos.x, this.worldPos.y]);

        // 车 sprite 跟随转向（纯视觉反馈）
        this.car.setRotation(this.carAngle);
    }
}

function Demo()
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
            scene: [Mode7Scene]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div id="app">
            <h1>Mode 7 Demo</h1>
            <p>方向键：↑ 加速，← → 转向</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    )
}

export default Demo
