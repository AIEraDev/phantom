"use client";

import React, { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  velocityX: number;
}

interface TypingParticlesProps {
  enabled?: boolean;
  color?: string;
}

export default function TypingParticles({ enabled = true, color = "#00ffff" }: TypingParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let particleId = 0;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only create particles for actual typing (not special keys)
      if (e.key.length === 1) {
        const newParticle: Particle = {
          id: particleId++,
          x: Math.random() * 20 - 10, // Random x offset between -10 and 10
          y: 0,
          color,
          velocityX: Math.random() * 30 - 15, // Random horizontal velocity
        };

        setParticles((prev) => [...prev, newParticle]);

        // Remove particle after animation completes
        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
        }, 500);
      }
    };

    window.addEventListener("keypress", handleKeyPress);

    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [enabled, color]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full animate-particle"
          style={
            {
              left: "50%",
              top: "50%",
              backgroundColor: particle.color,
              "--x": `${particle.velocityX}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
