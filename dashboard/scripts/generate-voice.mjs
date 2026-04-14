#!/usr/bin/env node
/**
 * Pre-generate Alice's voice lines as MP3s using ElevenLabs.
 *
 * Why pre-generate:
 *  - Keeps the API key out of the browser.
 *  - Zero runtime cost / latency / quota usage during the demo.
 *  - ElevenLabs voices sound natural enough to not feel robotic.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/generate-voice.mjs
 *   # or with the key in .env.local: npm run voice
 *
 * Output: dashboard/public/voice/<category>-<idx>.mp3 + an index.json manifest.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/voice");

// Load .env.local manually (msedge-tts path didn't wire dotenv)
const envLocal = resolve(ROOT, ".env.local");
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "Xb7hH8MSUJpSbSDYk0k2"; // Alice (British female)

if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY in dashboard/.env.local");
  process.exit(1);
}

const LINES = {
  greeting: [
    "Alice online. Let's see what's moving.",
    "Back in the chair. Watching the book.",
    "Hi. I am Alice. I run the credit desk.",
  ],
  rescore_agent: [
    "Rescoring now.",
    "Pulling fresh numbers.",
    "Calling the seven.",
    "Fresh score coming in.",
    "Getting new data.",
    "Let me check the creditworthiness.",
  ],
  adjust_rate: [
    "Rate adjusted.",
    "Repricing now.",
    "Bumping the rate.",
    "Dialing the APR.",
    "Rate change logged.",
  ],
  pause_lending: [
    "Pausing lending.",
    "Closing the book.",
    "Holding up on new loans.",
    "No more loans right now.",
  ],
  resume_lending: [
    "We are back.",
    "Books are open.",
    "Lending resumed.",
    "Credit lines reopened.",
  ],
  note: [
    "Noting that.",
    "Just an observation.",
    "Logging a thought.",
    "Worth remembering.",
  ],
  wait: [
    "Quiet tick.",
    "Just watching.",
    "All calm.",
    "Nothing to do.",
    "Vibes only.",
    "Still here, still watching.",
    "Book looks healthy.",
  ],
};

mkdirSync(OUT_DIR, { recursive: true });

const client = new ElevenLabsClient({ apiKey: API_KEY });

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

const manifest = {};
let totalChars = 0;
let generated = 0;

for (const [cat, lines] of Object.entries(LINES)) {
  manifest[cat] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const filename = `${cat}-${String(i).padStart(2, "0")}.mp3`;
    const outPath = resolve(OUT_DIR, filename);
    manifest[cat].push(filename);

    if (existsSync(outPath)) {
      console.log(`skip   ${filename}  (already exists)`);
      continue;
    }

    process.stdout.write(`gen    ${filename}  "${text}" ... `);
    try {
      const audio = await client.textToSpeech.convert(VOICE_ID, {
        text,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        voiceSettings: {
          stability: 0.55,
          similarityBoost: 0.8,
          style: 0.3,
          useSpeakerBoost: true,
        },
      });
      const buf = await streamToBuffer(audio);
      writeFileSync(outPath, buf);
      totalChars += text.length;
      generated++;
      console.log(`ok  (${buf.length} bytes)`);
    } catch (err) {
      console.error(`FAIL  ${err?.message || err}`);
    }
  }
}

writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(
  `\nDone. Generated ${generated} new clip(s), ${totalChars} characters used. ` +
    `Quota is 10,000/mo on the free tier.`
);
