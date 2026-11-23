// PreToolUse hook: blocks shell commands that touch secret files.
// Permissions cover Read/Edit/Write tools; this covers `cat .env`, `cp .env`, `printenv` and similar.
// Exit 2 = block the tool call and show stderr to the agent.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = String(input?.tool_input?.command ?? '');

const touchesEnvFile = /(^|[\s'"=/<>|;&(])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"|;&)<>])/.test(command);
const touchesKeyFile = /\.(pem|key)(?=$|[\s'"|;&)<>])/.test(command);
const dumpsEnv = /(^|[\s;&|(])(printenv|env)(\s*$|\s*[|;&>])/.test(command);
const echoesSecret = /\$\{?(SUPABASE_SECRET_KEY|GEMINI_API_KEY|NAVER_CLIENT_SECRET)\b/.test(command);

if (touchesEnvFile || touchesKeyFile || dumpsEnv || echoesSecret) {
  console.error(
    'Blocked by .claude/hooks/block-secrets.mjs: this command reads secret files or values. ' +
      'Use .env.example for variable names, and ask the user to run commands that need real secrets.'
  );
  process.exit(2);
}
process.exit(0);
