/**
 * Environment variable validation.
 * Called at server startup to fail fast on missing required config.
 */

const REQUIRED_VARS = [
  { name: "DATABASE_URL", hint: "SQLite connection string, e.g. file:./prisma/dev.db" },
  { name: "NEXTAUTH_SECRET", hint: "Random string for signing auth tokens. Generate with: openssl rand -base64 32" },
];

const OPTIONAL_VARS = [
  { name: "ANTHROPIC_API_KEY", warning: "AI agent features will be disabled" },
  { name: "GOOGLE_CLIENT_ID", warning: "Google OAuth sign-in will be unavailable" },
  { name: "GOOGLE_CLIENT_SECRET", warning: "Google OAuth sign-in will be unavailable" },
];

export function validateEnv() {
  console.log("\n--- Environment Check ---");

  const missing = [];
  for (const { name, hint } of REQUIRED_VARS) {
    if (!process.env[name]) {
      missing.push({ name, hint });
      console.error(`\u274C REQUIRED: ${name} is not set — ${hint}`);
    } else {
      console.log(`\u2705 ${name} is set`);
    }
  }

  for (const { name, warning } of OPTIONAL_VARS) {
    if (!process.env[name]) {
      console.log(`\u26A0 ${name} not set \u2014 ${warning}`);
    } else {
      console.log(`\u2705 ${name} is set`);
    }
  }

  console.log("--- End Environment Check ---\n");

  if (missing.length > 0) {
    console.error(`\nServer cannot start: ${missing.length} required environment variable(s) missing.`);
    console.error("Create a .env file or set them in your shell.\n");
    process.exit(1);
  }
}
