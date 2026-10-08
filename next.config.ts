import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
const config = (phase: string): NextConfig => ({
  poweredByHeader: false,
  // Keep a production build from replacing scripts served by a running dev server.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  outputFileTracingIncludes: { "/*": ["./prompts/nano_banana_prompt.md"] },
});
export default config;
