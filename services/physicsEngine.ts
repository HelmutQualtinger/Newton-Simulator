
import { SimulationConfig, Particle, ColorPalette } from '../types';

export class PhysicsEngine {
  private particles: Particle[] = [];
  private config: SimulationConfig;
  private width: number;
  private height: number;

  constructor(config: SimulationConfig, width: number, height: number) {
    this.config = config;
    this.width = width;
    this.height = height;
    this.init();
  }

  private generateColor(palette: ColorPalette): string {
    let hue = 0;
    let saturation = 100;
    let lightness = 50;

    switch (palette) {
      case 'fireworks':
        hue = Math.floor(Math.random() * 360);
        break;
      case 'cyberpunk':
        hue = Math.random() > 0.5 ? Math.floor(Math.random() * 40) + 280 : Math.floor(Math.random() * 40) + 180;
        break;
      case 'ocean':
        hue = Math.floor(Math.random() * 60) + 170;
        break;
      case 'inferno':
        hue = Math.floor(Math.random() * 50);
        break;
      case 'emerald':
        hue = Math.floor(Math.random() * 60) + 100;
        break;
      case 'monochrome':
        saturation = 0;
        lightness = Math.floor(Math.random() * 50) + 50;
        break;
    }

    return `hsla(${hue}, ${saturation}%, ${lightness}%, 1.0)`;
  }

  private init() {
    this.particles = [];
    for (let i = 0; i < this.config.particleCount; i++) {
      // Increased mass range to create distinct "heavy" bodies and "light" satellites
      const mass = Math.random() * Math.random() * 25 + 2; 
      this.particles.push({
        id: i,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 2, // Slower initial velocity to allow attraction to take hold
        vy: (Math.random() - 0.5) * 2,
        mass: mass,
        radius: Math.sqrt(mass) * 0.5, // Slightly larger radius for heavier particles to show their dominance
        color: this.generateColor(this.config.palette)
      });
    }
  }

  public refreshColors() {
    for (const p of this.particles) {
      p.color = this.generateColor(this.config.palette);
    }
  }

  public setConfig(config: SimulationConfig) {
    const prevCount = this.particles.length;
    const prevPalette = this.config.palette;
    this.config = config;
    
    if (prevCount !== config.particleCount) {
      this.init();
    } else if (prevPalette !== config.palette) {
      this.refreshColors();
    }
  }

  public updateDimensions(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public reset() {
    this.init();
  }

  public step() {
    if (this.config.paused) return;

    const n = this.particles.length;
    const G = this.config.G;
    const friction = 1 - this.config.friction;
    const elasticity = this.config.collisionElasticity;

    // Softening constant: reduced from 150 to 20 for much sharper attraction
    const softening = 20;

    for (let i = 0; i < n; i++) {
      const p1 = this.particles[i];
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const p2 = this.particles[j];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        // Newton's Law with softening for numerical stability
        const distSq = dx * dx + dy * dy + softening; 
        const dist = Math.sqrt(distSq);
        
        // Force magnitude: F = G * m1 * m2 / r^2
        const force = (G * p1.mass * p2.mass) / distSq;
        
        // Accumulate force components
        fx += (force * dx) / dist;
        fy += (force * dy) / dist;
      }

      // Update velocities (a = F / m)
      p1.vx += fx / p1.mass;
      p1.vy += fy / p1.mass;
    }

    for (const p of this.particles) {
      p.vx *= friction;
      p.vy *= friction;
      
      p.x += p.vx;
      p.y += p.vy;

      // Wrap-around or Bounce? Let's stick to Bounce for "Fireworks" containment feel
      if (p.x < p.radius) {
        p.x = p.radius;
        p.vx *= -elasticity;
      } else if (p.x > this.width - p.radius) {
        p.x = this.width - p.radius;
        p.vx *= -elasticity;
      }

      if (p.y < p.radius) {
        p.y = p.radius;
        p.vy *= -elasticity;
      } else if (p.y > this.height - p.radius) {
        p.y = this.height - p.radius;
        p.vy *= -elasticity;
      }
    }
  }

  public applyAttractor(x: number, y: number, strength: number) {
    if (this.config.paused) return;
    for (const p of this.particles) {
      const dx = x - p.x;
      const dy = y - p.y;
      const distSq = dx * dx + dy * dy + 100;
      const dist = Math.sqrt(distSq);
      const force = (strength * p.mass) / distSq; // Interaction between mouse and particle mass
      
      p.vx += (force * dx) / dist / p.mass;
      p.vy += (force * dy) / dist / p.mass;
    }
  }

  public getParticles() {
    return this.particles;
  }
}
