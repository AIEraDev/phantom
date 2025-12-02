"use client";

import { ReactNode, useState } from "react";

interface Feature3DCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  accentColor: "cyan" | "magenta" | "lime";
  delay?: number;
}

export default function Feature3DCard({ icon, title, description, accentColor, delay = 0 }: Feature3DCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const accentClasses = {
    cyan: "bg-gradient-glow-cyan",
    magenta: "bg-gradient-glow-magenta",
    lime: "bg-gradient-glow-cyan", // Using cyan gradient for lime as well
  };

  return (
    <div
      className="glass-card p-8 rounded-xl transition-all duration-500 ease-page group cursor-pointer"
      style={{
        transformStyle: "preserve-3d",
        transform: isHovered ? "rotateY(5deg) rotateX(-5deg) translateZ(20px)" : "rotateY(0deg) rotateX(0deg) translateZ(0px)",
        animationDelay: `${delay}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`w-16 h-16 ${accentClasses[accentColor]} rounded-lg flex items-center justify-center mb-6 group-hover:animate-pulse-glow`} style={{ transform: "translateZ(30px)" }}>
        {icon}
      </div>
      <h3 className="text-2xl font-header font-bold text-text-primary mb-3" style={{ transform: "translateZ(20px)" }}>
        {title}
      </h3>
      <p className="text-text-secondary" style={{ transform: "translateZ(10px)" }}>
        {description}
      </p>
    </div>
  );
}
