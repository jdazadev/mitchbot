import { execFileSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { E2E } from './helpers/config';

const ROOT = path.resolve(__dirname, '../..');

interface ServiceCheck {
  name: string;
  host: string;
  port: number;
  hint: string;
}

const SERVICES: ServiceCheck[] = [
  {
    name: 'MongoDB',
    host: 'localhost',
    port: 27017,
    hint: 'docker compose up -d mongodb',
  },
  {
    name: 'Redis',
    host: 'localhost',
    port: 6379,
    hint: 'docker compose up -d redis',
  },
  {
    name: 'Qdrant',
    host: 'localhost',
    port: 6333,
    hint: 'docker compose up -d qdrant',
  },
];

function checkPort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function assertDockerServices() {
  const attempts = 10;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const results = await Promise.all(SERVICES.map((s) => checkPort(s.host, s.port)));
    const missing = SERVICES.filter((_, i) => !results[i]);
    if (missing.length === 0) return;

    if (attempt === attempts) {
      const list = missing.map((s) => `  - ${s.name} (puerto ${s.port}) → ${s.hint}`).join('\n');
      throw new Error(
        [
          '',
          '❌ Prerrequisitos e2e no disponibles: faltan servicios de infraestructura.',
          '',
          'Levanta los servicios Docker antes de ejecutar la suite:',
          '  docker compose up -d',
          '',
          'Servicios no detectados:',
          list,
          '',
        ].join('\n')
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

function runE2ESeed() {
  console.log('\n🌱 Ejecutando seed e2e...');
  execFileSync('pnpm', ['--filter', '@mitchbot/backend', 'seed:e2e'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_MONGODB_URI: E2E.mongoUri,
    },
  });
}

export default async function globalSetup() {
  fs.mkdirSync(E2E.authDir, { recursive: true });
  await assertDockerServices();
  runE2ESeed();
}
