import Anthropic from "@anthropic-ai/sdk";

// One place to build the model client. Settings are explicit so ambient ANTHROPIC_* variables
// (for example set by a developer tool in the shell) cannot silently replace the project's key.
// AI_BASE_URL is for an Anthropic-compatible gateway; leave it unset to use api.anthropic.com.
export function anthropic() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    authToken: null,
    baseURL: process.env.AI_BASE_URL || undefined,
    timeout: 20_000,
    maxRetries: 1,
  });
}
