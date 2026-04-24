/**
 * Evolution API Service
 * Handles communication with Evolution GO (WhatsApp gateway).
 *
 * Evolution GO uses instance tokens for auth and flat endpoints (e.g. /send/text).
 * Instance tokens are resolved via EVOLUTION_INSTANCE_TOKENS env var:
 *   EVOLUTION_INSTANCE_TOKENS=InstanceA:token1,InstanceB:token2
 */

import crypto from 'crypto';

const BASE_URL = (process.env.EVOLUTION_API_URL || 'https://api.elevva.net.br').replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY || '';

// Parse instance tokens: "BentoSDR:token1,OtherInstance:token2"
const INSTANCE_TOKENS: Record<string, string> = {};
(process.env.EVOLUTION_INSTANCE_TOKENS || '').split(',').forEach(pair => {
  const [name, token] = pair.split(':');
  if (name && token) INSTANCE_TOKENS[name.trim()] = token.trim();
});

/** Get the API key for an instance (instance token if available, else global key) */
function getApiKey(instance: string): string {
  return INSTANCE_TOKENS[instance] || API_KEY;
}

export interface ListRow {
  title: string;
  description?: string;
  rowId: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

/** Strip @s.whatsapp.net suffix and leading + from a JID/phone */
export function cleanPhone(rawJid: string): string {
  return rawJid.replace(/@.*$/, '').replace(/^\+/, '');
}

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate a human-like typing delay based on message length.
 * ~45 chars/sec average typing speed + random variance + initial reaction time.
 */
function humanDelay(text: string): number {
  const reactionMs = 800 + Math.random() * 1200;        // 0.8–2s to "read and start typing"
  const typingMs   = (text.length / 45) * 1000;         // ~45 chars/sec
  const variance   = (Math.random() - 0.5) * 0.4 * typingMs; // ±20% variance
  const total      = reactionMs + typingMs + variance;
  return Math.min(Math.max(total, 1200), 8000);          // clamp 1.2s – 8s
}

/** Send WhatsApp typing presence indicator (best-effort, won't throw) */
async function sendTypingPresence(instance: string, jid: string, durationMs: number, apiKey: string): Promise<void> {
  const phone = cleanPhone(jid);
  const endpoints = [
    `/chat/sendPresence/${instance}`,
    `/chat/whatsappPresence/${instance}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: phone, options: { delay: durationMs, presence: 'composing' } }),
      });
      if (res.ok) return;
    } catch { /* ignore */ }
  }
}

async function post(path: string, body: Record<string, unknown>, apiKey?: string): Promise<{ ok: boolean; data: unknown }> {
  const key = apiKey || API_KEY;
  const fullUrl = `${BASE_URL}${path}`;
  try {
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[Evolution] POST ${fullUrl} → HTTP ${res.status}: ${text.substring(0, 200)}`);
      return { ok: false, data: null };
    }
    try { return { ok: true, data: JSON.parse(text) }; } catch { return { ok: true, data: null }; }
  } catch (err) {
    console.error(`[Evolution] fetch error on ${fullUrl}:`, err);
    return { ok: false, data: null };
  }
}

/** Send a plain text message with human-like typing simulation.
 *  Sends a "composing" presence, waits proportionally to text length, then sends.
 *  Returns true if the message was accepted by the API, false otherwise. */
export async function sendText(instance: string, jid: string, text: string, tokenOverride?: string): Promise<boolean> {
  const phone  = cleanPhone(jid);
  const apiKey = tokenOverride || getApiKey(instance);
  const delay  = humanDelay(text);

  console.log(`[Evolution] sendText → instance: ${instance}, phone: ${phone}, delay: ${Math.round(delay)}ms, text length: ${text.length}`);

  // Fire typing presence and wait concurrently — if presence fails, delay still runs
  await Promise.all([
    sendTypingPresence(instance, jid, delay, apiKey),
    sleep(delay),
  ]);

  // Evolution API v2.3.x: body usa { number, text } diretamente
  const { ok } = await post(`/message/sendText/${instance}`, { number: phone, text }, apiKey);
  return ok;
}

/** Send an interactive list message (renders as a tappable menu on WhatsApp) */
export async function sendList(
  instance: string,
  jid: string,
  title: string,
  description: string,
  buttonText: string,
  sections: ListSection[],
  tokenOverride?: string,
): Promise<void> {
  const listText = `${title}\n\n${description}\n\n${sections.map(s => s.rows.map(r => `• ${r.title}`).join('\n')).join('\n')}`;
  await post(`/message/sendText/${instance}`, {
    number: cleanPhone(jid),
    text: listText,
  }, tokenOverride || getApiKey(instance));
}

/** Sanitize fileName fields deep inside a message object to prevent API failures with special chars */
function sanitizeMessageFileNames(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMessageFileNames);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'fileName' && typeof v === 'string') {
      result[k] = v
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    } else {
      result[k] = sanitizeMessageFileNames(v);
    }
  }
  return result;
}

// ── WhatsApp media decryption (AES-256-CBC + HKDF-SHA256) ──
// O WhatsApp CDN armazena mídia criptografada. O webhook envia URL + mediaKey.
// Precisamos: 1) baixar bytes criptografados, 2) derivar chaves via HKDF, 3) decriptar.
const MEDIA_HKDF_INFO: Record<string, string> = {
  document: 'WhatsApp Document Keys',
  image: 'WhatsApp Image Keys',
  video: 'WhatsApp Video Keys',
  audio: 'WhatsApp Audio Keys',
  sticker: 'WhatsApp Image Keys',
};

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  let result = Buffer.alloc(0);
  let t = Buffer.alloc(0);
  for (let i = 1; result.length < length; i++) {
    t = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([t, info, Buffer.from([i])]))
      .digest();
    result = Buffer.concat([result, t]);
  }
  return result.subarray(0, length);
}

function decryptWhatsAppMedia(encrypted: Buffer, mediaKeyB64: string, mediaType: string): Buffer {
  const mediaKey = Buffer.from(mediaKeyB64, 'base64');
  const infoStr = MEDIA_HKDF_INFO[mediaType] || MEDIA_HKDF_INFO.document;

  // HKDF-Extract (salt = 32 zero bytes)
  const salt = Buffer.alloc(32);
  const prk = crypto.createHmac('sha256', salt).update(mediaKey).digest();

  // HKDF-Expand → 112 bytes: [iv:16][cipherKey:32][macKey:32][refKey:32]
  const expanded = hkdfExpand(prk, Buffer.from(infoStr), 112);
  const iv = expanded.subarray(0, 16);
  const cipherKey = expanded.subarray(16, 48);

  // Remove MAC (últimos 10 bytes)
  const fileData = encrypted.subarray(0, encrypted.length - 10);

  // Decriptar AES-256-CBC
  const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
  return Buffer.concat([decipher.update(fileData), decipher.final()]);
}

/**
 * Download a media file and return its base64 content.
 * Estratégias em ordem:
 *   1. Base64 embutido no webhook (webhook_base64=true)
 *   2. Download do CDN + descriptografia com mediaKey
 *   3. API endpoints do Evolution (fallback)
 */
export async function downloadMediaBase64(
  instance: string,
  messageData: { key: Record<string, unknown>; message: Record<string, unknown> },
  tokenOverride?: string,
): Promise<{ base64: string; mimetype: string } | null> {
  const key = tokenOverride || getApiKey(instance);
  const msg = messageData.message || {};
  const docMsg = (msg.documentMessage || msg.DocumentMessage || msg.documentWithCaptionMessage) as Record<string, unknown> | undefined;
  const mimetype = String(docMsg?.mimetype || docMsg?.Mimetype || 'application/pdf');

  // ── Estratégia 1: Download do WhatsApp CDN + descriptografia ──
  const mediaUrl = String(docMsg?.URL || docMsg?.mediaUrl || docMsg?.url || '');
  const mediaKeyB64 = String(docMsg?.mediaKey || docMsg?.MediaKey || '');

  if (mediaUrl && mediaUrl.startsWith('http') && mediaKeyB64) {
    try {
      console.log(`[Evolution] Downloading from WhatsApp CDN: ${mediaUrl.substring(0, 80)}...`);
      const res = await fetch(mediaUrl);
      if (res.ok) {
        const encryptedBuffer = Buffer.from(await res.arrayBuffer());
        console.log(`[Evolution] CDN download OK, encrypted size: ${encryptedBuffer.length}`);

        const decrypted = decryptWhatsAppMedia(encryptedBuffer, mediaKeyB64, 'document');
        const b64 = decrypted.toString('base64');
        console.log(`[Evolution] Decrypted successfully, PDF size: ${decrypted.length}`);
        return { base64: b64, mimetype };
      } else {
        console.log(`[Evolution] CDN download failed: HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[Evolution] CDN download/decrypt error:', err);
    }
  }

  // ── Estratégia 2: API endpoints do Evolution (fallback) ──
  const sanitizedData = sanitizeMessageFileNames(messageData) as typeof messageData;
  const endpoints = [
    `/chat/getBase64FromMediaMessage/${instance}`,
    `/chat/getBase64FromMediaMessage`,
  ];

  for (const endpoint of endpoints) {
    const result = await post(endpoint, {
      message: sanitizedData,
      convertToMp4: false,
    }, key);

    const data = result.data as { base64?: string; mimetype?: string } | null;
    if (data?.base64) {
      console.log(`[Evolution] Media downloaded via ${endpoint}`);
      return { base64: data.base64, mimetype: data.mimetype || 'application/pdf' };
    }
  }

  console.error(`[Evolution] All media download attempts failed for instance: ${instance}. docMsg keys: ${docMsg ? Object.keys(docMsg).join(',') : 'none'}`);
  return null;
}

/**
 * Configura o webhook da instância Evolution GO para incluir base64 em media messages.
 * Sem isso, documentos enviados pelo WhatsApp não chegam com conteúdo no payload.
 */
export async function configureWebhookBase64(
  instance: string,
  webhookUrl: string,
  tokenOverride?: string,
): Promise<boolean> {
  const key = tokenOverride || getApiKey(instance);
  // Evolution API v2.3.x: body deve ser { webhook: { ... } }
  const body = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhook_base64: true,
      webhook_by_events: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    },
  };

  const paths = [`/webhook/set/${instance}`, `/webhook/${instance}`, `/webhook/set`, `/instance/webhook/${instance}`];
  const methods = ['PUT', 'POST'];

  for (const method of methods) {
    for (const path of paths) {
      try {
        const res = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', apikey: key },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          console.log(`[Evolution] webhook_base64 enabled via ${method} ${path}`);
          return true;
        }
        const text = await res.text();
        console.log(`[Evolution] ${method} ${path} → ${res.status}: ${text.substring(0, 200)}`);
      } catch (err) {
        console.log(`[Evolution] ${method} ${path} failed:`, err);
      }
    }
  }

  console.error(`[Evolution] Failed to enable webhook_base64 for instance: ${instance}`);
  return false;
}
