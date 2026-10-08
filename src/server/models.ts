// Google model IDs verified against official documentation. Override per role.
export function googleModels() {
  return {
    flash: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
    pro: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
    embeddings: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    tts: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts",
    image: process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1",
  };
}
