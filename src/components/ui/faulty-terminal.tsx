"use client";

import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";

import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;

        float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
        intensity += ripple;
    }

    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);

        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }

    p = fract(p);
    p *= uDigitSize;

    float px5 = p.x * 5.0;
    float py5 = (1.0 - p.y) * 5.0;
    float x = fract(px5);
    float y = fract(py5);

    float i = floor(py5) - 2.0;
    float j = floor(px5) - 2.0;
    float n = i * i + j * j;
    float f = n * 0.0625;

    float isOn = step(0.1, intensity - f);
    float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){

    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;

    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);

    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

    vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }

    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(h.slice(0, 6), 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
};

interface Props {
  scale?: number;
  gridMul?: [number, number];
  digitSize?: number;
  timeScale?: number;
  pause?: boolean;
  scanlineIntensity?: number;
  glitchAmount?: number;
  flickerAmount?: number;
  noiseAmp?: number;
  chromaticAberration?: number;
  dither?: number | boolean;
  curvature?: number;
  tint?: string;
  mouseReact?: boolean;
  mouseStrength?: number;
  pageLoadAnimation?: boolean;
  brightness?: number;
  className?: string;
}

/**
 * A CRT terminal shader — drifting glyph cells, scanlines, barrel curvature.
 *
 * Opaque by design: it paints its own black, so it is a page background rather
 * than an overlay. Two effects rather than the registry's one — the shipped
 * version listed every prop as a dependency of the setup effect, and because
 * `gridMul` is an array literal it tore down and rebuilt the WebGL context on
 * every single render.
 */
export const FaultyTerminal = ({
  scale = 1,
  gridMul = [2, 1],
  digitSize = 1.5,
  timeScale = 0.3,
  pause = false,
  scanlineIntensity = 0.3,
  glitchAmount = 1,
  flickerAmount = 1,
  noiseAmp = 0,
  chromaticAberration = 0,
  dither = 0,
  curvature = 0.2,
  tint = "#ffffff",
  mouseReact = true,
  mouseStrength = 0.2,
  pageLoadAnimation = true,
  brightness = 1,
  className,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program | null>(null);
  const mounted = useMounted();

  // Read by the animation loop every frame. Held in a ref so changing any of
  // them retunes the running loop instead of restarting it.
  const live = useRef({ pause, timeScale, mouseReact, pageLoadAnimation });
  live.current = { pause, timeScale, mouseReact, pageLoadAnimation };

  useEffect(() => {
    const container = containerRef.current;
    if (!mounted || !container) return;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ),
        },
        uScale: { value: 1 },
        uGridMul: { value: new Float32Array([2, 1]) },
        uDigitSize: { value: 1.5 },
        uScanlineIntensity: { value: 0.3 },
        uGlitchAmount: { value: 1 },
        uFlickerAmount: { value: 1 },
        uNoiseAmp: { value: 0 },
        uChromaticAberration: { value: 0 },
        uDither: { value: 0 },
        uCurvature: { value: 0.2 },
        uTint: { value: new Color(1, 1, 1) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseStrength: { value: 0.2 },
        uUseMouse: { value: 1 },
        uPageLoadProgress: { value: 0 },
        uUsePageLoadAnimation: { value: 1 },
        uBrightness: { value: 1 },
      },
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      renderer.setSize(
        Math.max(1, container.offsetWidth),
        Math.max(1, container.offsetHeight),
      );
      program.uniforms.iResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / gl.canvas.height,
      );
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const mouse = { x: 0.5, y: 0.5 };
    const smoothed = { x: 0.5, y: 0.5 };

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left) / rect.width;
      mouse.y = 1 - (event.clientY - rect.top) / rect.height;
    };
    container.addEventListener("mousemove", onMouseMove);

    // Offsetting the clock means two of these on one page never march in
    // lockstep, which is what would give the illusion away.
    const timeOffset = Math.random() * 100;
    let frozenTime = 0;
    let loadStart = 0;
    let raf = 0;

    const update = (t: number) => {
      raf = requestAnimationFrame(update);
      const settings = live.current;

      if (settings.pause) {
        program.uniforms.iTime.value = frozenTime;
      } else {
        frozenTime = (t * 0.001 + timeOffset) * settings.timeScale;
        program.uniforms.iTime.value = frozenTime;
      }

      if (settings.pageLoadAnimation) {
        if (loadStart === 0) loadStart = t;
        program.uniforms.uPageLoadProgress.value = Math.min(
          (t - loadStart) / 2000,
          1,
        );
      }

      if (settings.mouseReact) {
        smoothed.x += (mouse.x - smoothed.x) * 0.08;
        smoothed.y += (mouse.y - smoothed.y) * 0.08;
        const uMouse = program.uniforms.uMouse.value as Float32Array;
        uMouse[0] = smoothed.x;
        uMouse[1] = smoothed.y;
      }

      renderer.render({ scene: mesh });
    };

    raf = requestAnimationFrame(update);
    container.appendChild(gl.canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      container.removeEventListener("mousemove", onMouseMove);
      programRef.current = null;
      gl.canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [mounted]);

  useEffect(() => {
    const program = programRef.current;
    if (!program) return;
    const u = program.uniforms;

    u.uScale.value = scale;
    (u.uGridMul.value as Float32Array).set(gridMul);
    u.uDigitSize.value = digitSize;
    u.uScanlineIntensity.value = scanlineIntensity;
    u.uGlitchAmount.value = glitchAmount;
    u.uFlickerAmount.value = flickerAmount;
    u.uNoiseAmp.value = noiseAmp;
    u.uChromaticAberration.value = chromaticAberration;
    u.uDither.value = typeof dither === "boolean" ? (dither ? 1 : 0) : dither;
    u.uCurvature.value = curvature;
    u.uMouseStrength.value = mouseStrength;
    u.uUseMouse.value = mouseReact ? 1 : 0;
    u.uUsePageLoadAnimation.value = pageLoadAnimation ? 1 : 0;
    if (!pageLoadAnimation) u.uPageLoadProgress.value = 1;
    u.uBrightness.value = brightness;
    (u.uTint.value as Color).set(...hexToRgb(tint));
  }, [
    mounted,
    scale,
    gridMul,
    digitSize,
    scanlineIntensity,
    glitchAmount,
    flickerAmount,
    noiseAmp,
    chromaticAberration,
    dither,
    curvature,
    tint,
    mouseReact,
    mouseStrength,
    pageLoadAnimation,
    brightness,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full w-full overflow-hidden [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full",
        className,
      )}
    />
  );
};
