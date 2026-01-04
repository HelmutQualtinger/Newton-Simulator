
import { GoogleGenAI, Type } from "@google/genai";
import { SimulationConfig } from "../types";

// Always use the process.env.API_KEY directly when initializing the GoogleGenAI client instance.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getPhysicsInsight(config: SimulationConfig): Promise<{ title: string; content: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user is running a Newtonian particle simulation with the following parameters:
      - Gravitational Constant (G): ${config.G}
      - Friction (Air resistance): ${config.friction}
      - Particle Count: ${config.particleCount}
      - Collision Elasticity: ${config.collisionElasticity}
      
      Provide a brief (max 2 sentences) physics insight about how these parameters affect the behavior of the system (e.g., chaos, stability, entropy). Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A short catchy title for the insight."
            },
            content: {
              type: Type.STRING,
              description: "The physics insight text."
            }
          },
          required: ["title", "content"]
        }
      }
    });

    // The .text property is a getter that returns the generated string.
    const text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini");
    }
    const result = JSON.parse(text);
    return result;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      title: "Newton's Insights",
      content: "Objects in motion tend to stay in motion unless acted upon by an external force."
    };
  }
}
