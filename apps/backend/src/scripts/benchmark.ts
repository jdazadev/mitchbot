/**
 * Benchmarks de rendimiento — MitchBot v2
 *
 * 1. PDF OCR benchmark      (10 documentos)
 * 2. RAG search benchmark   (100 consultas)
 * 3. Tool execution benchmark (50 llamadas)
 * 4. WebSocket load test    (100 conexiones concurrentes)
 *
 * Algunos benchmarks degradan de forma controlada si no hay modelos de IA
 * disponibles (OpenRouter/embeddings); el reporte lo indica.
 *
 * Ejecutar: pnpm tsx src/scripts/benchmark.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { ObjectId } from 'mongodb';
import { io as ioClient } from 'socket.io-client';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, closeDatabase } from '../config/database';
import { initSocket } from '../websocket/socket';
import { authService } from '../services/auth.service';
import { getUsersCollection } from '../models/user.model';
import { ragService } from '../services/rag.service';
import { ocrService } from '../services/ocr.service';
import { toolService } from '../services/tool.service';
import { getOrdersCollection } from '../models/order.model';
import { logger } from '../utils/logger';

function stats(values: number[]) {
  if (values.length === 0) return { count: 0, avg: 0, min: 0, max: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    count: sorted.length,
    avg: +(sum / sorted.length).toFixed(2),
    min: +sorted[0].toFixed(2),
    max: +sorted[sorted.length - 1].toFixed(2),
    p95: +sorted[p95Index].toFixed(2),
  };
}

async function benchOcr() {
  const timings: number[] = [];
  let method = 'n/a';
  const buffer = Buffer.from('%PDF-1.4 benchmark');

  for (let i = 0; i < 10; i += 1) {
    const started = Date.now();
    const result = await ocrService.extractPdf(buffer);
    timings.push(Date.now() - started);
    method = result.method;
  }

  console.log(`\n📄 PDF OCR benchmark (10 docs) — método observado: ${method}`);
  console.table(stats(timings));
}

async function benchRag() {
  const timings: number[] = [];
  const projectId = new ObjectId().toString();
  let degraded = false;

  for (let i = 0; i < 100; i += 1) {
    const started = Date.now();
    const result = await ragService.search(`consulta de prueba ${i}`, 'knowledge_base_benchmark', 3, projectId);
    timings.push(Date.now() - started);
    if (Array.isArray(result) && result.length === 0) degraded = true;
  }

  console.log(`\n🔎 RAG search benchmark (100 consultas)${degraded ? ' — sin resultados (posiblemente sin embeddings disponibles)' : ''}`);
  console.table(stats(timings));
}

async function benchTools() {
  const timings: number[] = [];
  const projectId = new ObjectId().toString();
  const orderIds: ObjectId[] = [];

  for (let i = 0; i < 50; i += 1) {
    const started = Date.now();
    if (i % 5 === 0) {
      const result = await toolService.execute(
        { name: 'create_order', arguments: { items: [{ name: `bench-${i}`, quantity: 1, price: 5 }] } },
        { conversationId: new ObjectId().toString(), projectId, userMessage: 'bench' }
      );
      if (result.data?.orderId) orderIds.push(new ObjectId(result.data.orderId));
    } else {
      await toolService.execute(
        { name: 'get_business_hours', arguments: {} },
        { conversationId: new ObjectId().toString(), projectId, userMessage: 'bench' }
      );
    }
    timings.push(Date.now() - started);
  }

  if (orderIds.length) {
    await getOrdersCollection().deleteMany({ _id: { $in: orderIds } });
  }

  console.log('\n🛠️  Tool execution benchmark (50 llamadas)');
  console.table(stats(timings));
}

async function benchWebSocket() {
  const port = 3999;
  const server = http.createServer();
  initSocket(server);
  await new Promise<void>(resolve => server.listen(port, resolve));

  // Usuario temporal para autenticar la carga
  const userId = new ObjectId();
  const email = `bench-${Date.now()}@mitchbot.test`;
  await getUsersCollection().insertOne({
    _id: userId,
    name: 'Benchmark User',
    email,
    password: 'x',
    role: 'admin',
    status: 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const token = authService.generateToken({
    _id: userId,
    name: 'Benchmark User',
    email,
    password: 'x',
    role: 'admin',
    status: 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const CONCURRENCY = 100;
  const started = Date.now();
  let connected = 0;
  let failed = 0;

  const clients = await Promise.all(
    Array.from({ length: CONCURRENCY }).map(() => new Promise<any>(resolve => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        timeout: 8000,
      });
      client.on('connect', () => { connected += 1; resolve(client); });
      client.on('connect_error', () => { failed += 1; resolve(client); });
    }))
  );

  const elapsed = Date.now() - started;

  clients.forEach(client => client.disconnect());
  await getUsersCollection().deleteOne({ _id: userId });
  await new Promise<void>(resolve => server.close(() => resolve()));

  console.log('\n🌐 WebSocket load test (100 conexiones concurrentes)');
  console.log(`   Conectadas: ${connected}/100 — Fallidas: ${failed} — Tiempo total: ${elapsed}ms`);
  console.log(`   Tasa: ${(CONCURRENCY / (elapsed / 1000)).toFixed(1)} conexiones/s`);
}

async function main() {
  logger.info('\n📊 Benchmarks — MitchBot v2');
  logger.info('============================');
  await connectDatabase();

  try {
    await benchOcr();
    await benchRag();
    await benchTools();
    await benchWebSocket();
  } finally {
    await closeDatabase();
  }

  logger.info('\n✅ Benchmarks finalizados');
}

main().catch(error => {
  logger.error('❌ Error en benchmarks:', error);
  process.exit(1);
});
