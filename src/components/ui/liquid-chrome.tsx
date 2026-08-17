"use client";

import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

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
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform vec3 uBaseColor;
uniform float uAmplitude;
uniform float uFrequencyX;
uniform float uFrequencyY;
uniform vec2 uMouse;
uniform float uInteractive;
varying vec2 vUv;

vec4 renderImage(vec2 uvCoord) {
    vec2 fragCoord = uvCoord * uResolution.xy;
    vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

    for (float i = 1.0; i < 10.0; i++){
        uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159 * uInteractive);
        uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159 * uInteractive);
    }

    vec2 diff = (uvCoord - uMouse);
    float dist = length(diff);
    float falloff = exp(-dist * 20.0);
    float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
    uv += (diff / (dist + 0.0001)) * ripple * falloff * uInteractive;

    vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
    return vec4(color, 1.0);
}

void main() {
    vec4 col = vec4(0.0);
    for (int i = -1; i <= 1; i++){
        for (int j = -1; j <= 1; j++){
            vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
            col += renderImage(vUv + offset);
        }
    }
    gl_FragColor = col / 9.0;
}
`;

interface Props {
  /** Linear RGB, 0–1. The shader divides it by a sine, so it is the floor the
   *  highlights bloom out of rather than the colour you will actually see. */
  baseColor?: [number, number, number];
  speed?: number;
  amplitude?: number;
  frequencyX?: number;
  frequencyY?: number;
  interactive?: boolean;
  className?: string;
}

/**
 * Molten metal — a folded wave field divided by a sine, so the creases blow
 * out to white the way a polished surface does.
 *
 * Opaque, so this is a page background rather than an overlay. Rebuilt from
 * the registry's single mega-effect: that version listed every prop as a
 * dependency, and since `baseColor` is an array literal it tore down and
 * recreated the WebGL context on every render. Setup runs once here and the
 * props are pushed onto uniforms separately.
 */
export const LiquidChrome = ({
  baseColor = [0.1, 0.1, 0.1],
  speed = 0.2,
  amplitude = 0.3,
  frequencyX = 3,
  frequencyY = 3,
  interactive = true,
  className,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program | null>(null);
  const mounted = useMounted();

  // The loop reads this every frame, so changing the speed retunes the running
  // animation instead of restarting it.
  const live = useRef({ speed, interactive });
  live.current = { speed, interactive };

  useEffect(() => {
    const container = containerRef.current;
    if (!mounted || !container) return;

    const renderer = new Renderer({
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([1, 1, 1]) },
        uBaseColor: { value: new Float32Array([0.1, 0.1, 0.1]) },
        uAmplitude: { value: 0.3 },
        uFrequencyX: { value: 3 },
        uFrequencyY: { value: 3 },
        uMouse: { value: new Float32Array([0, 0]) },
        uInteractive: { value: 1 },
      },
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    // ResizeObserver, not a window resize listener: this sits inside a pane
    // that changes width when the sidebar collapses, with no window event.
    const resize = () => {
      renderer.setSize(
        Math.max(1, container.offsetWidth),
        Math.max(1, container.offsetHeight),
      );
      const res = program.uniforms.uResolution.value as Float32Array;
      res[0] = gl.canvas.width;
      res[1] = gl.canvas.height;
      res[2] = gl.canvas.width / gl.canvas.height;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const setMouse = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const uMouse = program.uniforms.uMouse.value as Float32Array;
      uMouse[0] = (clientX - rect.left) / rect.width;
      uMouse[1] = 1 - (clientY - rect.top) / rect.height;
    };

    const onMouseMove = (event: MouseEvent) =>
      live.current.interactive && setMouse(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch && live.current.interactive)
        setMouse(touch.clientX, touch.clientY);
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("touchmove", onTouchMove);

    let raf = 0;
    let onScreen = true;
    let pageVisible = !document.hidden;

    const update = (t: number) => {
      raf = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.001 * live.current.speed;
      renderer.render({ scene: mesh });
    };

    // This shader supersamples nine times per pixel over a nine-iteration
    // wave loop. Off-screen or on a background tab it is pure heat.
    const start = () => {
      if (onScreen && pageVisible && raf === 0)
        raf = requestAnimationFrame(update);
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    container.appendChild(canvas);
    start();

    return () => {
      stop();
      observer.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("touchmove", onTouchMove);
      programRef.current = null;
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [mounted]);

  useEffect(() => {
    const program = programRef.current;
    if (!program) return;

    (program.uniforms.uBaseColor.value as Float32Array).set(baseColor);
    program.uniforms.uAmplitude.value = amplitude;
    program.uniforms.uFrequencyX.value = frequencyX;
    program.uniforms.uFrequencyY.value = frequencyY;
    program.uniforms.uInteractive.value = interactive ? 1 : 0;
  }, [mounted, baseColor, amplitude, frequencyX, frequencyY, interactive]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full overflow-hidden", className)}
    />
  );
};
