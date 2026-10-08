import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./prompts/nano_banana_prompt.md"] },
};
export default config;
