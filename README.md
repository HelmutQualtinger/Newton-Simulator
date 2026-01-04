# Newtonian Particle Sim

A high-performance interactive physics simulation of 200+ particles interacting via **Newton's Law of Universal Gravitation**, featuring AI-powered physics insights.

## 🚀 Features

- **N-Body Simulation**: Every particle interacts with every other particle using real Newtonian physics ($F = G \frac{m_1 m_2}{r^2}$).
- **Interactive Attractor**: Use your mouse to create a high-mass gravity well that bends the paths of particles.
- **Dynamic Controls**: Real-time adjustment of Gravity (G), Viscosity (Friction), Trail Length, and Attractor Strength.
- **AI Insights**: Integrated with Google Gemini to provide contextual physics explanations based on your current simulation parameters.
- **Visual Aesthetics**: Neon-glow particles with persistent motion trails and a sleek, dark-mode dashboard.

## 🛠️ Tech Stack

- **React 19**
- **TypeScript**
- **Canvas API** (Optimized 2D Rendering)
- **Tailwind CSS**
- **Google Gemini API** (@google/genai)

## 📦 How to Upload to GitHub

1. Create a new repository on [GitHub](https://github.com/new).
2. Download these project files to your local machine.
3. Use the **"Upload files"** button on GitHub to add them to your repository, or use the Git CLI:

```bash
git init
git add .
git commit -m "Initial commit: Newtonian Particle Simulation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/your-repo-name.git
git push -u origin main
```

## 🧠 AI Integration
This project uses the `gemini-3-flash-preview` model to analyze simulation states and provide educational insights.

---
*Developed with Newtonian Dynamics & AI.*
