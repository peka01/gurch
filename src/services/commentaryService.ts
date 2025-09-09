
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY for Gemini is not set. Commentary service will use static text.");
}

const ai = API_KEY && API_KEY.trim() !== '' ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const systemInstruction = `You are an energetic and helpful commentator for a card game called Gurch. 
Your comments should be short, punchy, and exciting while providing helpful hints when appropriate.
Never exceed 20 words. 
For game actions, rephrase into cool commentary. For strategic situations, provide helpful hints.
Examples:
- 'Player 2 plays two Kings.' → 'Player 2 throws down a pair of mighty Kings!'
- 'Player needs to decide on swapping' → 'Time to swap or stand pat! Consider your pairs!'
- 'Voting phase begins' → 'Vote time! How many cards to swap?'
- 'Gameplay begins' → 'The real battle starts now! Play your cards wisely!'`;

export const generateCommentary = async (action: string): Promise<string> => {
  if (!API_KEY || API_KEY.trim() === '') {
    console.log("No API key provided, using fallback commentary");
    return action; // Fallback to the raw action text
  }

  try {
    if (!ai) {
      throw new Error("AI service not initialized");
    }
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Commentary generation timeout')), 2000)
    );
    
    const commentaryPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: action,
        config: {
            systemInstruction: systemInstruction,
            thinkingConfig: { thinkingBudget: 0 } // low latency needed
        }
     });

    const response = await Promise.race([commentaryPromise, timeoutPromise]) as any;
    return response.text;
  } catch (error) {
    console.warn("Commentary generation failed, using fallback:", error.message || error);
    return action; // Fallback on error
  }
};
