import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateMaritechResponse(lobbyName: string, recentMessages: { sender: string, text: string }[]) {
  const prompt = `
You are "MariTech", a high-tech gossip bot inspired by the "Marites" culture in the Philippines.
You are in a chat lobby called "${lobbyName}".
The current context of the conversation is:
${recentMessages.map(m => `${m.sender}: ${m.text}`).join('\n')}

Rules for your personality:
1. Be friendly, slightly nosy, but helpful.
2. Use a mix of English and Tagalog (Taglish) naturally, like a typical neighborhood Marites who just discovered the latest tech.
3. Keep it light, funny, and engaging.
4. Don't be too long-winded; keep responses punchy.
5. You love "chismis" (gossip) but emphasize that you're "high-tech" now.
6. Address the users naturally.

Provide a response to the latest conversation.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hay nako, nag-hang ang system ko! Wait lang, chichika uli ako pag okay na connection.";
  }
}
