
export type ColorPalette = 'fireworks' | 'cyberpunk' | 'ocean' | 'inferno' | 'monochrome' | 'emerald';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
}

export interface SimulationConfig {
  G: number; // Gravitational constant
  friction: number; // Air resistance/damping
  particleCount: number;
  collisionElasticity: number;
  trailLength: number;
  showTrails: boolean;
  paused: boolean;
  mouseStrength: number; // Strength of the mouse attractor
  palette: ColorPalette; // New: Selected color palette
}

export interface AIInsight {
  title: string;
  content: string;
}
