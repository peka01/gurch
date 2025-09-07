
import { GoogleGenAI } from "@google/genai";

// Ensure the API key is set in your environment variables
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY for Gemini is not set. Avatar generation will be disabled.");
}

const ai = API_KEY && API_KEY.trim() !== '' ? new GoogleGenAI({ apiKey: API_KEY }) : null;

let isApiDisabled = false;
let disableUntil: number | null = null;

export const generateAvatar = async (prompt: string): Promise<string> => {
  if (!API_KEY || API_KEY.trim() === '' || isApiDisabled) {
    if (disableUntil && Date.now() > disableUntil) {
      isApiDisabled = false; // Re-enable after timeout
      disableUntil = null;
    } else {
      console.log("Avatar generation is disabled (no API key or recent error), using fallback avatar");
      return `https://picsum.photos/seed/${prompt.replace(/\s/g, '')}/100`;
    }
  }
  
  try {
    if (!ai) {
      throw new Error("AI service not initialized");
    }
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Avatar generation timeout')), 3000)
    );
    
    const avatarPromise = ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
    });

    const response = await Promise.race([avatarPromise, timeoutPromise]) as any;

    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (error) {
    console.warn("Avatar generation failed, using fallback:", error.message || error);
    
    // If it's a quota error, disable future requests for a while.
    if (error.message && typeof error.message === 'string' && error.message.includes('RESOURCE_EXHAUSTED')) {
      console.error("Quota exceeded. Disabling avatar generation for 1 hour.");
      isApiDisabled = true;
      disableUntil = Date.now() + 60 * 60 * 1000; // Disable for 1 hour
    }

    // Fallback to a placeholder image
    return `https://picsum.photos/seed/${prompt.replace(/\s/g, '')}/100`;
  }
};
