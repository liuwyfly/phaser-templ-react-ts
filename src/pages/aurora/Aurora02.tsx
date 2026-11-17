import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { Link } from 'react-router-dom';

// 1. 定义极光 Shader
const auroraShader = new Phaser.Display.BaseShader('AuroraShader', `
    precision mediump float;
    uniform float uTime;
    uniform vec2 uResolution;
    // 这里编写极光的数学波形和颜色混合算法...
    void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        // 模拟流动的绿色/紫色光带
        vec3 color = vec3(0.1, 0.8, 0.4) * sin(uv.x * 10.0 + uTime);
        gl_FragColor = vec4(color, 0.6);
    }
`);

// 2. 在 Scene 中使用
class GameScene extends Phaser.Scene {
    private shader!: Phaser.GameObjects.Shader;

    create() {
        // Phaser 4 中 BaseShader 需先注册到 Shader Cache，才能通过 key 创建 Shader 对象
        this.cache.shader.add('AuroraShader', auroraShader);

        this.shader = this.add.shader('AuroraShader', 400, 300, 800, 600);
        this.shader.setUniform('uResolution', [800, 600]);
    }

    update(time: number) {
        this.shader.setUniform('uTime', time * 0.001); // 让极光动起来
    }
}

function Aurora() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL,
            width: 800,
            height: 600,
            parent: containerRef.current,
            scene: [GameScene]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return (
        <div id="app">
            <h1>Aurora 02 Demo</h1>
            <p>基于 Phaser.Display.BaseShader + Shader Cache 的极光效果</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    )
}

export default Aurora
