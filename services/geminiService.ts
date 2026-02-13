
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getHeistCommentary(event: 'START' | 'COLLECT_TURBO' | 'LEVEL_UP' | 'POLICE_CHASE' | 'GAMEOVER') {
  try {
    const prompt = `
      You are DJ Nitro, the host of the Underground Radio in a getaway driver video game.
      The game is a Pac-Man clone where a car collects cash and avoids police.
      Generate a very short, cool, one-sentence radio shoutout for the event: ${event}.
      Style: High-energy, street, slightly illegal vibes.
      Language: Spanish.
      Keep it under 15 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "¡Dale gas, piloto!";
  } catch (error) {
    console.error("Gemini failed to commentate:", error);
    return "¡Cuidado con la madera!";
  }
}
