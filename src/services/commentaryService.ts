
// Commentary service with Gemini API disabled - using static commentary
console.log("Commentary service using static text (Gemini API disabled)");

// Static commentary mappings for common game actions
const commentaryMap: { [key: string]: string } = {
  'plays': 'throws down',
  'wins': 'takes the round',
  'swaps': 'exchanges cards',
  'votes': 'casts their vote',
  'leads': 'starts the action',
  'sacrifices': 'plays low cards',
  'beats': 'dominates with',
  'goes out': 'wins the game',
  'deals': 'distributes cards',
  'shuffles': 'mixes the deck'
};

export const generateCommentary = async (action: string): Promise<string> => {
  // Always use static commentary - no API calls
  console.log("Generating static commentary for:", action);
  
  // Simple text enhancement for common game terms
  let commentary = action;
  
  // Apply basic commentary transformations
  Object.entries(commentaryMap).forEach(([key, replacement]) => {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    commentary = commentary.replace(regex, replacement);
  });
  
  // Add some excitement
  if (commentary.includes('wins') || commentary.includes('takes')) {
    commentary = `🎉 ${commentary}!`;
  } else if (commentary.includes('plays') || commentary.includes('throws')) {
    commentary = `⚡ ${commentary}`;
  } else if (commentary.includes('votes') || commentary.includes('decides')) {
    commentary = `🤔 ${commentary}`;
  }
  
  return commentary;
};
