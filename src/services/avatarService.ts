
// Avatar service with Gemini API disabled - using fallback images only
console.log("Avatar generation using fallback images (Gemini API disabled)");

export const generateAvatar = async (prompt: string): Promise<string> => {
  // Always use fallback avatar images from picsum.photos
  console.log("Generating fallback avatar for prompt:", prompt);
  return `https://picsum.photos/seed/${prompt.replace(/\s/g, '')}/100`;
};
