"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: Particle[] = [];
    const colors = ["#ff4400", "#0088ff", "#ffaa00"];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = () => {
      if (particles.length > 60) return;
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(Math.random() * 1.5 + 0.5),
        size: Math.random() * 3 + 1,
        color,
        alpha: Math.random() * 0.4 + 0.1,
        life: 0,
        maxLife: Math.random() * 300 + 200,
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (Math.random() < 0.3) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = Math.max(0, p.alpha * (1 - p.life / p.maxLife));

        if (p.life > p.maxLife || p.y < -10) {
          particles.splice(i, 1);
          continue;
        }

        // Draw pixel-style square particle
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(
          Math.round(p.x / 2) * 2,
          Math.round(p.y / 2) * 2,
          p.size * 2,
          p.size * 2
        );
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
