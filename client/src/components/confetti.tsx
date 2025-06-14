import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  opacity: number;
}

interface ConfettiProps {
  isActive: boolean;
  onComplete?: () => void;
  duration?: number;
  particleCount?: number;
}

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
];

export default function Confetti({ 
  isActive, 
  onComplete, 
  duration = 3000, 
  particleCount = 50 
}: ConfettiProps) {
  const [particles, setParticles] = useState<ConfettiPiece[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isActive && !isAnimating) {
      setIsAnimating(true);
      
      // Create initial particles
      const newParticles: ConfettiPiece[] = [];
      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: -10,
          vx: (Math.random() - 0.5) * 10,
          vy: Math.random() * 3 + 2,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          opacity: 1
        });
      }
      setParticles(newParticles);

      // Animation loop
      const animationStart = Date.now();
      const animate = () => {
        const elapsed = Date.now() - animationStart;
        const progress = elapsed / duration;

        if (progress >= 1) {
          setParticles([]);
          setIsAnimating(false);
          onComplete?.();
          return;
        }

        setParticles(prev => 
          prev.map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            rotation: particle.rotation + particle.rotationSpeed,
            opacity: Math.max(0, 1 - progress),
            vy: particle.vy + 0.3 // gravity
          })).filter(particle => 
            particle.y < window.innerHeight + 50 && 
            particle.opacity > 0
          )
        );

        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  }, [isActive, isAnimating, duration, particleCount, onComplete]);

  if (!isAnimating || particles.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            transform: `rotate(${particle.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transition: 'none'
          }}
        />
      ))}
    </div>
  );
}

// Success confetti component with preset configuration
export function SuccessConfetti({ 
  isActive, 
  onComplete 
}: { 
  isActive: boolean; 
  onComplete?: () => void; 
}) {
  return (
    <Confetti
      isActive={isActive}
      onComplete={onComplete}
      duration={4000}
      particleCount={80}
    />
  );
}

// Modal confetti component that works within dialog bounds
export function ModalConfetti({ 
  isActive, 
  onComplete 
}: { 
  isActive: boolean; 
  onComplete?: () => void; 
}) {
  const [particles, setParticles] = useState<ConfettiPiece[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isActive && !isAnimating) {
      setIsAnimating(true);
      
      // Create initial particles within modal bounds (400px width approx)
      const newParticles: ConfettiPiece[] = [];
      for (let i = 0; i < 40; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 400, // Modal width
          y: -10,
          vx: (Math.random() - 0.5) * 6,
          vy: Math.random() * 2 + 1,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          opacity: 1
        });
      }
      setParticles(newParticles);

      // Animate particles
      const animationInterval = setInterval(() => {
        setParticles(currentParticles => 
          currentParticles.map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.vy + 0.1, // gravity
            rotation: particle.rotation + particle.rotationSpeed,
            opacity: Math.max(0, particle.opacity - 0.02)
          })).filter(particle => particle.y < 600 && particle.opacity > 0) // Modal height bounds
        );
      }, 16);

      // Clean up after duration
      setTimeout(() => {
        clearInterval(animationInterval);
        setParticles([]);
        setIsAnimating(false);
        onComplete?.();
      }, 3000);

      return () => clearInterval(animationInterval);
    }
  }, [isActive, isAnimating, onComplete]);

  if (!isAnimating || particles.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            transform: `rotate(${particle.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transition: 'none'
          }}
        />
      ))}
    </div>
  );
}