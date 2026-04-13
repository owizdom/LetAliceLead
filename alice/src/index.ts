import dotenv from 'dotenv';
dotenv.config();

import { createAgent } from './agent/createAgent';

const PORT = Number(process.env.PORT) || 3000;
const BANK_NAME = process.env.BANK_NAME || 'AgentCentralBank';

async function main() {
  try {
    await createAgent({
      port: PORT,
      bankName: BANK_NAME,
    });
  } catch (err) {
    console.error('Fatal error starting Agent Central Bank:', err);
    process.exit(1);
  }
}

main();
