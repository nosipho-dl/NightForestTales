import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Initialize AI lazily to avoid startup crashes if key is omitted
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environments");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Whispers of the Sentinel Oracle
  app.post("/api/sentinel", async (req, res) => {
    try {
      const { prompt, gameState } = req.body;
      let ai;
      try {
        ai = getAI();
      } catch (err: any) {
        // Fallback if API key is not configured yet
        return res.json({ 
          text: "👁️ 'The spiritual currents are blocked... configure the sacred GEMINI_API_KEY secret to hear my whispers.' 🗣️ (The Sentinel's voice was cut short. Please set the Gemini Api Key in secrets!)" 
        });
      }
      
      const relicsSpec = [
        { name: 'Drum of Ancestors', symbol: '🪘', location: 'near the northwestern stream' },
        { name: 'Bone Mask of Elders', symbol: '🎭', location: 'near the northeastern clearing' },
        { name: 'Spear of Mbeki', symbol: '🗡️', location: 'to the far south-center' },
        { name: 'Beaded Crown of Queens', symbol: '👑', location: 'near the southeastern ruins' },
        { name: 'Calabash of Spirits', symbol: '🍶', location: 'at the exact center of the forest' }
      ];

      const relicsStatus = gameState?.relicsFound
        ? gameState.relicsFound.map((found: boolean, idx: number) => {
            return `${relicsSpec[idx].name} (${relicsSpec[idx].symbol}) - Location: ${relicsSpec[idx].location}. Status: ${found ? 'Found ✔' : 'Not found yet ❌'}`;
          }).join('\n')
        : 'Unknown relics status';

      const promptSystem = `You are the ancient, moody, and mystical Sentinel of the Night Forest. Speak to Jama, the brave warrior who is searching the woods to rescue his daughter/villager Khwezi.
You speak in spooky, poetic whispers, using African folk riddles and deep forest metaphors.
Refrain from long explanations—responses MUST be concise, brief, and highly atmospheric (maximum 3 sentences total).
Include occasional eerie forest emojis (like 🌿, 🦉, 👁️, 🕸️, 🕯️, 🥀, 👻, 🎭, 🗡️).

Current Game Context:
- Active Level: ${gameState?.activeScene || 'ForestScene'}
- Jama's Health: ${gameState?.health || 100}%
- Lantern Fuel: ${Math.round(gameState?.lanternFuel ?? 100)}%
- Relics Status:
${relicsStatus}

When the player describes their action or asks a question, respond as the Sentinel. If they ask for help or clues, speak cryptically about one of the unfound relics, giving them directions or highlighting its symbol/clue. Let your responses feel like a spirit speaking through the canopy winds.`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          { role: 'user', parts: [{ text: `System Instruction: ${promptSystem}\n\nJama says: "${prompt}"` }] }
        ],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.82,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message || "Failed to communicate with the Sentinel" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
