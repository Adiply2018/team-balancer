import React, { useEffect, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface FireworkProps {
  color?: string;
  x?: number;
  y?: number;
}

interface FireworkInstance {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface FireworksDisplayProps {
  trigger?: boolean;
}

const Firework: React.FC<FireworkProps> = ({
  color = "#ff0000",
  x = 0,
  y = 0,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleCount = 30;

  useEffect(() => {
    const newParticles: Particle[] = Array.from(
      { length: particleCount },
      (_, i) => {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = 4 + Math.random() * 2;
        return {
          x: 0,
          y: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
        };
      },
    );
    setParticles(newParticles);

    const timer = setInterval(() => {
      setParticles((prevParticles) =>
        prevParticles
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.1, // gravity
            alpha: p.alpha - 0.015,
          }))
          .filter((p) => p.alpha > 0),
      );
    }, 16);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="absolute"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            backgroundColor: color,
            transform: `translate(${p.x}px, ${p.y}px)`,
            opacity: p.alpha,
          }}
        />
      ))}
    </div>
  );
};

export const FireworksDisplay: React.FC<FireworksDisplayProps> = ({
  trigger = false,
}) => {
  const [fireworks, setFireworks] = useState<FireworkInstance[]>([]);
  const colors: string[] = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
  ];

  useEffect(() => {
    if (trigger) {
      const newFireworks: FireworkInstance[] = Array.from(
        { length: 5 },
        (_, i) => ({
          id: Date.now() + i,
          x: 100 + Math.random() * 300,
          y: 100 + Math.random() * 200,
          color: colors[Math.floor(Math.random() * colors.length)],
        }),
      );

      setFireworks((prev) => [...prev, ...newFireworks]);

      // Remove fireworks after animation
      setTimeout(() => {
        setFireworks((prev) => prev.filter((f) => f.id !== newFireworks[0].id));
      }, 2000);
    }
  }, [trigger]);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {fireworks.map((fw) => (
        <Firework key={fw.id} x={fw.x} y={fw.y} color={fw.color} />
      ))}
    </div>
  );
};
