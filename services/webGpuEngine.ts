
import { SimulationConfig, ColorPalette } from '../types';

const COMPUTE_SHADER = `
struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
  mass: f32,
  padding: f32,
  color: vec4<f32>,
};

struct SimParams {
  G: f32,
  friction: f32,
  mousePos: vec2<f32>,
  mouseStrength: f32,
  particleCount: u32,
  width: f32,
  height: f32,
  dt: f32,
  elasticity: f32,
};

@group(0) @binding(0) var<uniform> params : SimParams;
@group(0) @binding(1) var<storage, read_write> particles : array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let index = global_id.x;
  if (index >= params.particleCount) { return; }

  var p = particles[index];
  var totalForce = vec2<f32>(0.0, 0.0);
  let softening = 20.0;

  // Mutual Gravity (O(n^2) - but fast on GPU)
  for (var i = 0u; i < params.particleCount; i = i + 1u) {
    if (i == index) { continue; }
    let other = particles[i];
    let diff = other.pos - p.pos;
    let distSq = dot(diff, diff) + softening;
    let forceMag = (params.G * p.mass * other.mass) / distSq;
    totalForce += normalize(diff) * forceMag;
  }

  // Mouse Attractor
  let mouseDiff = params.mousePos - p.pos;
  let mouseDistSq = dot(mouseDiff, mouseDiff) + 100.0;
  let mouseForceMag = (params.mouseStrength * p.mass) / mouseDistSq;
  totalForce += normalize(mouseDiff) * mouseForceMag;

  // Apply Force (a = F/m)
  let accel = totalForce / p.mass;
  p.vel += accel * params.dt;
  
  // Friction
  p.vel *= (1.0 - params.friction);

  // Position update
  p.pos += p.vel;

  // Boundary Collisions
  let radius = sqrt(p.mass) * 0.5;
  if (p.pos.x < radius) {
    p.pos.x = radius;
    p.vel.x *= -params.elasticity;
  } else if (p.pos.x > params.width - radius) {
    p.pos.x = params.width - radius;
    p.vel.x *= -params.elasticity;
  }

  if (p.pos.y < radius) {
    p.pos.y = radius;
    p.vy *= -params.elasticity;
  } else if (p.pos.y > params.height - radius) {
    p.pos.y = params.height - radius;
    p.vy *= -params.elasticity;
  }

  particles[index] = p;
}
`;

const RENDER_SHADER = `
struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
  mass: f32,
  padding: f32,
  color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec4<f32>,
  @location(1) uv : vec2<f32>,
};

@group(0) @binding(0) var<storage, read> particles : array<Particle>;
@group(0) @binding(1) var<uniform> resolution : vec2<f32>;

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex : u32
) -> VertexOutput {
  let p = particles[instanceIndex];
  let radius = sqrt(p.mass) * 1.2 * 8.0; // Glow radius
  
  // Quad vertices
  var pos = array<vec2<f32>, 4>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0),
    vec2(-1.0, 1.0), vec2(1.0, 1.0)
  );
  let uv = pos[vertexIndex];
  
  let worldPos = p.pos + uv * radius;
  let ndcPos = (worldPos / resolution) * 2.0 - 1.0;
  
  var out: VertexOutput;
  out.position = vec4<f32>(ndcPos.x, -ndcPos.y, 0.0, 1.0);
  out.color = p.color;
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let dist = length(in.uv);
  if (dist > 1.0) { discard; }
  
  // High-intensity core + soft glow
  let glow = exp(-dist * 4.0);
  let core = exp(-dist * 15.0);
  
  let finalColor = (in.color * glow) + vec4<f32>(1.0, 1.0, 1.0, 1.0) * core;
  return vec4<f32>(finalColor.rgb, 1.0);
}
`;

export class WebGpuEngine {
  // Fix: Use any to bypass missing WebGPU types in environment
  private device: any = null;
  private context: any = null;
  private particleBuffer: any = null;
  private paramsBuffer: any = null;
  private computePipeline: any = null;
  private renderPipeline: any = null;
  private computeBindGroup: any = null;
  private renderBindGroup: any = null;

  private config: SimulationConfig;
  private width: number = 0;
  private height: number = 0;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  async init(canvas: HTMLCanvasElement) {
    // Fix: Access WebGPU via any casting to avoid Navigator type errors
    const adapter = await (navigator as any).gpu?.requestAdapter();
    if (!adapter) throw new Error("WebGPU not supported");
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext("webgpu") as any;

    const presentationFormat = (navigator as any).gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: "premultiplied",
    });

    this.width = canvas.width;
    this.height = canvas.height;

    await this.setupPipelines();
    this.setupBuffers();
  }

  private setupBuffers() {
    if (!this.device) return;

    // Fix: Use window reference for GPUBufferUsage constants
    const GPUBufferUsage = (window as any).GPUBufferUsage;

    // Particle size: pos(8) + vel(8) + mass(4) + padding(4) + color(16) = 40 bytes
    // Aligned to 16 bytes for storage buffer = 48 bytes
    const particleCount = 1000; // Increased capacity for WebGPU
    const bufferSize = particleCount * 48;
    
    this.particleBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
    });

    this.paramsBuffer = this.device.createBuffer({
      size: 64, // Enough for SimParams
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Initial data
    const initialData = new Float32Array(particleCount * 12);
    for (let i = 0; i < particleCount; i++) {
      const offset = i * 12;
      initialData[offset] = Math.random() * this.width;     // pos x
      initialData[offset + 1] = Math.random() * this.height; // pos y
      initialData[offset + 2] = (Math.random() - 0.5) * 2;  // vel x
      initialData[offset + 3] = (Math.random() - 0.5) * 2;  // vel y
      const mass = Math.random() * Math.random() * 25 + 2;
      initialData[offset + 4] = mass;                       // mass
      initialData[offset + 5] = 0;                          // padding

      const color = this.generateColor(this.config.palette);
      initialData[offset + 8] = color[0];
      initialData[offset + 9] = color[1];
      initialData[offset + 10] = color[2];
      initialData[offset + 11] = color[3];
    }
    this.device.queue.writeBuffer(this.particleBuffer, 0, initialData);

    this.createBindGroups();
  }

  private generateColor(palette: ColorPalette): number[] {
    let h = 0, s = 100, l = 50;
    switch (palette) {
      case 'fireworks': h = Math.random() * 360; break;
      case 'cyberpunk': h = Math.random() > 0.5 ? Math.random() * 40 + 280 : Math.random() * 40 + 180; break;
      case 'ocean': h = Math.random() * 60 + 170; break;
      case 'inferno': h = Math.random() * 50; break;
      case 'emerald': h = Math.random() * 60 + 100; break;
      case 'monochrome': s = 0; l = Math.random() * 50 + 50; break;
    }
    return this.hslToRgb(h / 360, s / 100, l / 100);
  }

  private hslToRgb(h: number, s: number, l: number): number[] {
    let r, g, b;
    if (s === 0) { r = g = b = l; } 
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1/3); g = hue2rgb(h); b = hue2rgb(h - 1/3);
    }
    return [r, g, b, 1.0];
  }

  private async setupPipelines() {
    if (!this.device) return;

    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: this.device.createShaderModule({ code: COMPUTE_SHADER }),
        entryPoint: "main",
      },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: this.device.createShaderModule({ code: RENDER_SHADER }),
        entryPoint: "vs_main",
      },
      fragment: {
        module: this.device.createShaderModule({ code: RENDER_SHADER }),
        entryPoint: "fs_main",
        targets: [{
          format: (navigator as any).gpu.getPreferredCanvasFormat(),
          blend: {
            color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
            alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
          }
        }],
      },
      primitive: { topology: "triangle-strip" },
    });
  }

  private createBindGroups() {
    if (!this.device || !this.computePipeline || !this.renderPipeline || !this.particleBuffer || !this.paramsBuffer) return;

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer, offset: 32, size: 8 } },
      ],
    });
  }

  public setConfig(config: SimulationConfig) {
    const oldPalette = this.config.palette;
    const oldCnt = this.config.particleCount;
    this.config = config;
    if (oldPalette !== config.palette || oldCnt !== config.particleCount) {
        this.setupBuffers(); // Re-init particles on palette/count change
    }
  }

  public render(mouse: { x: number, y: number, active: boolean }) {
    if (!this.device || !this.context || !this.computePipeline || !this.renderPipeline || !this.computeBindGroup || !this.renderBindGroup) return;

    // Update Uniforms
    const params = new Float32Array(16);
    params[0] = this.config.G;
    params[1] = this.config.friction;
    params[2] = mouse.x;
    params[3] = mouse.y;
    params[4] = mouse.active ? this.config.mouseStrength : 0;
    params[5] = this.config.particleCount;
    params[6] = this.width;
    params[7] = this.height;
    params[8] = 0.5; // dt
    params[9] = this.config.collisionElasticity;

    this.device.queue.writeBuffer(this.paramsBuffer!, 0, params);

    const commandEncoder = this.device.createCommandEncoder();

    // 1. Compute Pass
    if (!this.config.paused) {
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, this.computeBindGroup);
      const workgroups = Math.ceil(this.config.particleCount / 64);
      computePass.dispatchWorkgroups(workgroups);
      computePass.end();
    }

    // 2. Render Pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        // Trail effect via clearing with previous data or just clearing
        // WebGPU makes real trails harder without post-processing, 
        // but additive blending on a black background looks fantastic.
        clearValue: { r: 0.01, g: 0.02, b: 0.09, a: 1.0 }, 
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.draw(4, this.config.particleCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
