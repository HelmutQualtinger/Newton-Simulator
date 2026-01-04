
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationConfig, AIInsight, ColorPalette } from './types';
import { PhysicsEngine } from './services/physicsEngine';
import { getPhysicsInsight } from './services/geminiService';

const App: React.FC = () => {
  const [config, setConfig] = useState<SimulationConfig>({
    G: 1.2,
    friction: 0.005,
    particleCount: 200,
    collisionElasticity: 0.7,
    trailLength: 35,
    showTrails: true,
    paused: false,
    mouseStrength: 15000,
    palette: 'fireworks',
  });

  const [insight, setInsight] = useState<AIInsight>({
    title: "Newtonian Dynamics",
    content: "Calculating mutual gravitational vectors between particles using standard CPU execution."
  });
  const [loadingInsight, setLoadingInsight] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const mousePos = useRef({ x: 0, y: 0 });
  const isMouseActive = useRef(false);

  // Initialize Engine
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new PhysicsEngine(config, window.innerWidth, window.innerHeight);
    }
  }, []);

  // Update Engine Config
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setConfig(config);
    }
  }, [config]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && engineRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        engineRef.current.updateDimensions(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // CPU Rendering Loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const engine = engineRef.current;

    if (canvas && ctx && engine) {
      if (config.showTrails) {
        // Create the persistent motion trail effect
        const trailOpacity = Math.max(0.015, 1 / (config.trailLength * 1.5 + 1));
        ctx.fillStyle = `rgba(2, 6, 23, ${trailOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      if (isMouseActive.current) {
        engine.applyAttractor(mousePos.current.x, mousePos.current.y, config.mouseStrength);
      }
      
      engine.step();

      const particles = engine.getParticles();
      ctx.globalCompositeOperation = 'lighter';
      
      for (const p of particles) {
        // Draw glow
        const glowSize = p.radius * 12;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        
        // Ensure color string is valid for CSS
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(0.3, p.color.replace('1.0)', '0.4)'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalCompositeOperation = 'source-over';
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [config.showTrails, config.trailLength, config.mouseStrength, config.paused]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current !== undefined) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handleFetchInsight = async () => {
    setLoadingInsight(true);
    const newInsight = await getPhysicsInsight(config);
    setInsight(newInsight);
    setLoadingInsight(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
    if (cursorRef.current) {
      cursorRef.current.style.left = `${e.clientX}px`;
      cursorRef.current.style.top = `${e.clientY}px`;
    }
  };

  const palettes: { id: ColorPalette; name: string; color: string }[] = [
    { id: 'fireworks', name: 'Fireworks', color: 'from-rose-500 via-yellow-400 to-emerald-400' },
    { id: 'cyberpunk', name: 'Cyberpunk', color: 'from-fuchsia-500 via-purple-600 to-cyan-400' },
    { id: 'ocean', name: 'Ocean', color: 'from-cyan-600 via-blue-500 to-indigo-400' },
    { id: 'inferno', name: 'Inferno', color: 'from-orange-600 via-red-500 to-yellow-400' },
    { id: 'emerald', name: 'Emerald', color: 'from-emerald-600 via-green-500 to-teal-400' },
    { id: 'monochrome', name: 'Mono', color: 'from-slate-400 via-slate-200 to-white' },
  ];

  return (
    <div className="relative w-full h-screen bg-[#020617] overflow-hidden font-sans text-slate-200">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => isMouseActive.current = true}
        onMouseLeave={() => isMouseActive.current = false}
        className="absolute inset-0 cursor-none"
      />

      <div 
        ref={cursorRef}
        className="pointer-events-none absolute w-32 h-32 rounded-full border-2 border-yellow-400/50 bg-yellow-400/10 flex items-center justify-center transition-opacity duration-300"
        style={{ transform: 'translate(-50%, -50%)', zIndex: 50 }}
      >
        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_15px_#facc15]" />
        <div className="absolute inset-0 rounded-full border border-dashed border-yellow-400/20 animate-spin" />
      </div>

      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-yellow-400 to-emerald-400 tracking-tighter">
            Newtonian Sparks
          </h1>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mt-1">
            Standard CPU Physics Engine • {config.particleCount} Bodies
          </p>
        </div>

        <div className="pointer-events-auto bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 max-w-sm shadow-2xl">
          <div className="flex items-center gap-2 mb-2 text-rose-400">
            <i className="fas fa-bolt text-sm"></i>
            <span className="font-bold uppercase tracking-widest text-[10px]">{insight.title}</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-300 italic">
            "{insight.content}"
          </p>
          <button 
            onClick={handleFetchInsight}
            disabled={loadingInsight}
            className="mt-4 w-full py-2 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 text-[10px] uppercase font-black tracking-widest rounded-lg transition-all"
          >
            {loadingInsight ? "Consulting Newton..." : "Analyze Dynamics"}
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 left-8 p-6 bg-slate-950/80 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl w-80 space-y-5 overflow-y-auto max-h-[80vh]">
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Color Signature</label>
          <div className="grid grid-cols-3 gap-2">
            {palettes.map((p) => (
              <button
                key={p.id}
                onClick={() => setConfig({ ...config, palette: p.id })}
                className={`p-2 rounded-lg border text-[9px] font-bold uppercase transition-all ${
                  config.palette === p.id ? 'border-white/40 bg-white/10 text-white' : 'border-white/5 bg-slate-900/50 text-slate-500'
                }`}
              >
                <div className={`w-full h-1 rounded-full mb-1 bg-gradient-to-r ${p.color}`} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mutual Gravity (G)</label>
            <span className="text-xs font-mono text-cyan-400">{config.G.toFixed(2)}</span>
          </div>
          <input 
            type="range" min="0" max="5" step="0.1" 
            value={config.G} 
            onChange={(e) => setConfig({...config, G: parseFloat(e.target.value)})}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attractor Strength</label>
            <span className="text-xs font-mono text-yellow-400">{Math.round(config.mouseStrength)}</span>
          </div>
          <input 
            type="range" min="-20000" max="50000" step="500" 
            value={config.mouseStrength} 
            onChange={(e) => setConfig({...config, mouseStrength: parseFloat(e.target.value)})}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Viscosity (Friction)</label>
            <span className="text-xs font-mono text-emerald-400">{(config.friction * 100).toFixed(1)}%</span>
          </div>
          <input 
            type="range" min="0" max="0.1" step="0.001" 
            value={config.friction} 
            onChange={(e) => setConfig({...config, friction: parseFloat(e.target.value)})}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Particle Count</label>
            <span className="text-xs font-mono text-rose-400">{config.particleCount}</span>
          </div>
          <input 
            type="range" min="10" max="500" step="1" 
            value={config.particleCount} 
            onChange={(e) => setConfig({...config, particleCount: parseInt(e.target.value)})}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trail Length</label>
            <span className="text-xs font-mono text-purple-400">{config.trailLength}</span>
          </div>
          <input 
            type="range" min="0" max="100" step="1" 
            value={config.trailLength} 
            onChange={(e) => setConfig({...config, trailLength: parseInt(e.target.value)})}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button 
            onClick={() => setConfig({...config, paused: !config.paused})}
            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${config.paused ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-600/20 text-amber-400 border border-amber-500/30'}`}
          >
            {config.paused ? 'Play' : 'Pause'}
          </button>
          <button 
            onClick={() => engineRef.current?.reset()}
            className="px-4 py-3 bg-slate-800 text-slate-400 rounded-xl border border-white/5 transition-colors"
          >
            <i className="fas fa-undo-alt"></i>
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 flex flex-col items-end pointer-events-none font-mono text-[9px] text-slate-600 uppercase tracking-widest">
        <div className="flex items-center gap-4 bg-slate-900/30 px-4 py-2 rounded-full border border-white/5">
            <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CPU Engine Active
            </span>
            <span>60.0 FPS</span>
        </div>
      </div>
    </div>
  );
};

export default App;
