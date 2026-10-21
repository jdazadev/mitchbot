import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, getDefaultPersonality } from '../../src/services/prompt-builder.service';

test('buildSystemPrompt aplica el idioma del agente', () => {
  const es = buildSystemPrompt(getDefaultPersonality());
  const en = buildSystemPrompt({ ...getDefaultPersonality(), language: 'en' });
  assert.match(es, /Responde siempre en español/);
  assert.match(en, /Always respond in English/);
});

test('un idioma obsoleto cae a español', () => {
  const prompt = buildSystemPrompt({ ...getDefaultPersonality(), language: 'pt' as any });
  assert.match(prompt, /Responde siempre en español/);
});

test('solo se usan los tres primeros rasgos', () => {
  const prompt = buildSystemPrompt({ ...getDefaultPersonality(), traits: ['formal', 'directo', 'alegre', 'sarcástico'] });
  assert.match(prompt, /formal y profesional, directo y sin rodeos, alegre y positivo\./);
  assert.doesNotMatch(prompt, /sarcasmo/);
});

test('el asesor de respaldo sustituye al mensaje fallback', () => {
  const personality = getDefaultPersonality();
  const withAdvisor = buildSystemPrompt(personality, { enableFallbackAdvisor: true });
  const withMessage = buildSystemPrompt(personality);
  assert.match(withAdvisor, /contactar con un asesor/);
  assert.doesNotMatch(withAdvisor, /responde exactamente/);
  assert.match(withMessage, new RegExp(`responde exactamente: "${personality.fallbackMessage}"`));
});

test('las palabras clave de despedida se listan sin vacíos', () => {
  const prompt = buildSystemPrompt(getDefaultPersonality(), { enableGoodbyeMessage: true, goodbyeKeywords: ['adiós', ' ', 'chao'] });
  assert.match(prompt, /Palabras clave: adiós, chao\./);
});
