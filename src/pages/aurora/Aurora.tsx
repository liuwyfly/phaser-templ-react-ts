import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { Link } from 'react-router-dom';

const AURORA_FRAGMENT = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 outTexCoord;

// 精度友好的 hash：不使用 sin，避免大参数在 mediump 下失真
float hash(vec2 p)
{
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float smoothNoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p)
{
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++)
    {
        v += a * smoothNoise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void main()
{
    vec2 uv = outTexCoord;
    float t = uTime * 0.3;

    vec3 skyTop = vec3(0.02, 0.03, 0.08);
    vec3 skyBottom = vec3(0.05, 0.08, 0.15);
    vec3 col = mix(skyBottom, skyTop, uv.y);

    float band = uv.y * 3.0 - 0.6;
    float wave = fbm(vec2(uv.x * 3.0 + t, band * 0.8 - t * 0.5));
    float curtain = exp(-abs(band - wave * 1.6) * 2.2);

    float band2 = uv.y * 4.5 - 1.4;
    float wave2 = fbm(vec2(uv.x * 2.0 - t * 1.3, band2 * 0.6 + t * 0.4));
    float curtain2 = exp(-abs(band2 - wave2 * 1.2) * 2.8);

    vec3 auroraGreen = vec3(0.1, 0.9, 0.45);
    vec3 auroraPurple = vec3(0.6, 0.2, 0.7);
    float mixFactor = clamp(uv.y * 1.5 + wave * 0.5, 0.0, 1.0);
    vec3 aurora = mix(auroraGreen, auroraPurple, mixFactor);

    col += aurora * curtain * 0.9;
    col += auroraGreen * curtain2 * 0.5;

    // 星星：以格子中心为圆心画圆点，而不是整格填充
    vec2 starUv = uv * uResolution / 4.0;
    vec2 cell = floor(starUv);
    float h = hash(cell + floor(uTime * 0.2));
    float d = length(starUv - (cell + 0.5));
    float star = step(0.995, h) * smoothstep(0.12, 0.0, d);
    star *= smoothstep(0.3, 0.9, uv.y) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 30.0));

    col += vec3(star) * 0.8;

    gl_FragColor = vec4(col, 1.0);
}
`;

class AuroraScene extends Phaser.Scene
{
    private aurora!: Phaser.GameObjects.Shader;

    constructor()
    {
        super('AuroraScene');
    }

    create()
    {
        const { width, height } = this.scale;

        this.aurora = this.add.shader({
            name: 'Aurora',
            fragmentSource: AURORA_FRAGMENT,
            initialUniforms: {
                uMainSampler: 0,
                uTime: 0,
                uResolution: [width, height]
            }
        }, width / 2, height / 2, width, height);
    }

    update(time: number)
    {
        this.aurora.setUniform('uTime', time / 1000);
    }
}

function Aurora()
{
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current)
        {
            return;
        }

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL, // Shader 依赖 WebGL
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
            <h1>Aurora Demo</h1>
            <p>极光效果（片元着色器 + fbm 噪声，无需外部资源）</p>
            <div ref={containerRef} />
            <Link to="/">Back to Game</Link>
        </div>
    )
}

export default Aurora
