/**
 * Chatwoot Service
 * Handles communication with the shared Chatwoot instance.
 *
 * Architecture: one shared Chatwoot server, one account per client.
 * Per-client config (account_id, token, inbox_id) stored in profiles table.
 *
 * Evolution GO natively syncs WhatsApp → Chatwoot when configured per instance.
 * This service handles:
 *   1. Configuring Chatwoot integration on each Evolution GO instance
 *   2. Human takeover detection (Chatwoot → our server sets human_takeover flag)
 *   3. Routing human agent replies back to WhatsApp via Evolution GO
 */

const CHATWOOT_URL = (process.env.CHATWOOT_URL || '').replace(/\/$/, '');

interface ChatwootContact {
  id: number;
  name: string;
  phone_number?: string;
}

interface ChatwootConversation {
  id: number;
  status: string;
  meta?: {
    sender?: { phone_number?: string };
  };
}

interface ChatwootMessage {
  id: number;
  content: string;
  message_type: string;
}

async function chatwootRequest(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const baseUrl = CHATWOOT_URL;
  if (!baseUrl) {
    console.warn('[Chatwoot] CHATWOOT_URL not configured');
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Chatwoot] ${method} ${path} → HTTP ${res.status}: ${text.substring(0, 200)}`);
      return null;
    }

    return res.json().catch(() => null);
  } catch (err) {
    console.error(`[Chatwoot] fetch error on ${method} ${path}:`, err);
    return null;
  }
}

/**
 * Find or create a contact in Chatwoot by phone number.
 * Returns the contact ID, or null on failure.
 */
export async function findOrCreateContact(
  accountId: number,
  token: string,
  phone: string,
  name?: string,
): Promise<number | null> {
  // Normalize phone: ensure starts with +
  const normalized = phone.startsWith('+') ? phone : `+${phone}`;

  // Search by phone first
  const searchResult = await chatwootRequest(
    'GET',
    `/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(normalized)}&page=1`,
    token,
  ) as { payload?: ChatwootContact[] } | null;

  const found = searchResult?.payload?.find(c =>
    c.phone_number === normalized || c.phone_number === phone,
  );

  if (found) {
    console.log(`[Chatwoot] Contact found: id=${found.id}, name=${found.name}`);
    return found.id;
  }

  // Create contact
  const created = await chatwootRequest(
    'POST',
    `/api/v1/accounts/${accountId}/contacts`,
    token,
    {
      name: name || phone,
      phone_number: normalized,
    },
  ) as { id?: number } | null;

  if (created?.id) {
    console.log(`[Chatwoot] Contact created: id=${created.id}`);
    return created.id;
  }

  console.error(`[Chatwoot] Failed to find or create contact for phone: ${phone}`);
  return null;
}

/**
 * Find an existing open conversation for a contact+inbox,
 * or create a new one.
 * Returns conversation ID, or null on failure.
 */
export async function findOrCreateConversation(
  accountId: number,
  token: string,
  contactId: number,
  inboxId: number,
): Promise<number | null> {
  // Search open conversations for this contact
  const contactConvs = await chatwootRequest(
    'GET',
    `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
    token,
  ) as { payload?: ChatwootConversation[] } | null;

  const existing = contactConvs?.payload?.find(c =>
    c.status === 'open',
  );

  if (existing) {
    console.log(`[Chatwoot] Existing conversation found: id=${existing.id}`);
    return existing.id;
  }

  // Create new conversation
  const created = await chatwootRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations`,
    token,
    {
      inbox_id: inboxId,
      contact_id: contactId,
    },
  ) as { id?: number } | null;

  if (created?.id) {
    console.log(`[Chatwoot] Conversation created: id=${created.id}`);
    return created.id;
  }

  console.error(`[Chatwoot] Failed to find or create conversation for contact: ${contactId}`);
  return null;
}

/**
 * Post a message to a Chatwoot conversation.
 * messageType: 'incoming' = from candidate, 'outgoing' = from Bento (bot).
 * Bot messages are marked as private=false, type=outgoing, sender is the API user.
 */
export async function postMessage(
  accountId: number,
  token: string,
  conversationId: number,
  content: string,
  messageType: 'incoming' | 'outgoing',
): Promise<void> {
  const body: Record<string, unknown> = {
    content,
    message_type: messageType,
    private: false,
  };

  const result = await chatwootRequest(
    'POST',
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    token,
    body,
  ) as ChatwootMessage | null;

  if (result?.id) {
    console.log(`[Chatwoot] Message posted: id=${result.id}, type=${messageType}`);
  } else {
    console.warn(`[Chatwoot] Failed to post message to conversation ${conversationId}`);
  }
}

/**
 * Mirror an incoming or outgoing message to Chatwoot.
 * Finds/creates the contact and conversation automatically.
 * Stores the conversation ID in agent_conversations for future use.
 */
export async function mirrorMessage(
  accountId: number,
  token: string,
  inboxId: number,
  phone: string,
  content: string,
  direction: 'incoming' | 'outgoing',
  candidateName?: string,
  existingConversationId?: number,
): Promise<number | null> {
  try {
    let conversationId = existingConversationId || null;

    if (!conversationId) {
      const contactId = await findOrCreateContact(accountId, token, phone, candidateName);
      if (!contactId) return null;

      conversationId = await findOrCreateConversation(accountId, token, contactId, inboxId);
      if (!conversationId) return null;
    }

    await postMessage(accountId, token, conversationId, content, direction);
    return conversationId;
  } catch (err) {
    console.error('[Chatwoot] mirrorMessage error:', err);
    return null;
  }
}

/**
 * Cria uma conta Chatwoot nova para o cliente via /auth/sign_up.
 * Cada cliente recebe sua própria conta isolada (igual ao Agente Atendimento).
 * Retorna { accountId, accessToken, loginEmail, loginPassword } ou null se falhar.
 */
export async function platformSetupAccount(
  clientName: string,
  clientEmail: string,
): Promise<{ accountId: number; accessToken: string; loginEmail: string; loginPassword: string } | null> {
  const baseUrl = CHATWOOT_URL;
  if (!baseUrl) { console.warn('[Chatwoot] CHATWOOT_URL não configurado'); return null; }

  const password = `Elv${Math.random().toString(36).slice(2, 8)}@${Math.floor(10 + Math.random() * 90)}!`;

  try {
    const res = await fetch(`${baseUrl}/auth/sign_up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_name: clientName,
        email: clientEmail,
        name: clientName,
        password,
        password_confirmation: password,
      }),
    });

    const text = await res.text();
    let data: { data?: { access_token?: string; account_id?: number } } | null = null;
    try { data = JSON.parse(text); } catch { /* noop */ }

    if (res.ok && data?.data?.access_token && data?.data?.account_id) {
      const accountId = data.data.account_id;
      const accessToken = data.data.access_token;
      console.log(`[Chatwoot] Conta criada: account #${accountId} para ${clientEmail}`);
      return { accountId, accessToken, loginEmail: clientEmail, loginPassword: password };
    }

    // Email já cadastrado — tenta fazer login para obter o token
    if (res.status === 422 || text.includes('already') || text.includes('taken')) {
      console.warn(`[Chatwoot] Email já registrado (${clientEmail}) — tentando recuperar conta existente`);
      const loginRes = await fetch(`${baseUrl}/auth/sign_in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail, password }),
      });
      const loginData = await loginRes.json() as { data?: { access_token?: string; account_id?: number } } | null;
      if (loginRes.ok && loginData?.data?.access_token && loginData?.data?.account_id) {
        console.log(`[Chatwoot] Login recuperado: account #${loginData.data.account_id}`);
        return {
          accountId: loginData.data.account_id,
          accessToken: loginData.data.access_token,
          loginEmail: clientEmail,
          loginPassword: password,
        };
      }
    }

    console.error(`[Chatwoot] platformSetupAccount falhou: HTTP ${res.status}: ${text.substring(0, 200)}`);
    return null;
  } catch (err) {
    console.error('[Chatwoot] platformSetupAccount erro:', err);
    return null;
  }
}

/**
 * Cria um inbox WhatsApp no Chatwoot para um usuário.
 * Requer CHATWOOT_ADMIN_TOKEN com permissão de administrador.
 */
export async function createInbox(
  accountId: number,
  adminToken: string,
  inboxName: string,
): Promise<number | null> {
  const result = await chatwootRequest(
    'POST',
    `/api/v1/accounts/${accountId}/inboxes`,
    adminToken,
    { name: inboxName, channel: { type: 'api', webhook_url: '' } },
  ) as { id?: number } | null;
  if (result?.id) { console.log(`[Chatwoot] Inbox criado: #${result.id} — ${inboxName}`); return result.id; }
  console.error('[Chatwoot] createInbox falhou');
  return null;
}

/**
 * Cria um agente no Chatwoot e retorna { agentId, accessToken }.
 * Requer CHATWOOT_ADMIN_TOKEN.
 */
export async function createAgentUser(
  accountId: number,
  adminToken: string,
  name: string,
  email: string,
): Promise<{ agentId: number; accessToken: string } | null> {
  const password = `Elv${Math.random().toString(36).slice(2, 8)}@${Math.floor(10 + Math.random() * 90)}`;
  const result = await chatwootRequest(
    'POST',
    `/api/v1/accounts/${accountId}/agents`,
    adminToken,
    { name, email, role: 'administrator', password },
  ) as { id?: number; access_token?: string } | null;
  if (result?.id) {
    console.log(`[Chatwoot] Agente criado: #${result.id} — ${email}`);
    return { agentId: result.id, accessToken: result.access_token || adminToken };
  }
  console.error('[Chatwoot] createAgentUser falhou');
  return null;
}

/**
 * Atribui um agente a um inbox no Chatwoot.
 */
export async function assignAgentToInbox(
  accountId: number,
  adminToken: string,
  inboxId: number,
  agentId: number,
): Promise<boolean> {
  const result = await chatwootRequest(
    'POST',
    `/api/v1/accounts/${accountId}/inbox_members`,
    adminToken,
    { inbox_id: inboxId, user_ids: [agentId] },
  );
  const ok = result !== null;
  if (ok) console.log(`[Chatwoot] Agente #${agentId} atribuído ao inbox #${inboxId}`);
  return ok;
}

/**
 * Cria webhook no Chatwoot para receber eventos da conta.
 * 422 "already taken" é tratado como sucesso (idempotente).
 */
export async function createChatwootWebhook(
  accountId: number,
  token: string,
  webhookUrl: string,
): Promise<boolean> {
  if (!CHATWOOT_URL || !token) return false;
  try {
    const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${accountId}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api_access_token': token },
      body: JSON.stringify({ webhook: { url: webhookUrl, subscriptions: ['conversation_status_changed', 'message_created'] } }),
    });
    const text = await res.text();
    if (res.ok) { console.log(`[Chatwoot] Webhook criado para account #${accountId}`); return true; }
    if (res.status === 422 && text.includes('already been taken')) {
      console.log(`[Chatwoot] Webhook já existia para account #${accountId} — OK`);
      return true;
    }
    console.error(`[Chatwoot] createWebhook HTTP ${res.status}: ${text.substring(0, 200)}`);
    return false;
  } catch (err) {
    console.error('[Chatwoot] createWebhook error:', err);
    return false;
  }
}

/**
 * Configure the Chatwoot integration on an Evolution GO instance.
 * This tells Evolution GO to sync WhatsApp messages to Chatwoot automatically.
 * Called when admin saves the agent config.
 */
export async function configureChatwootOnEvolution(
  instance: string,
  evolutionToken: string,
  chatwootAccountId: number,
  chatwootToken: string,
  chatwootInboxId: number,
  inboxName?: string,
): Promise<boolean> {
  const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const chatwootUrl = CHATWOOT_URL;
  // Fallback to global API key when the caller passes an empty token (existing instances without saved token)
  const evoApiKey = evolutionToken || process.env.EVOLUTION_API_KEY || '';

  if (!EVOLUTION_URL || !chatwootUrl) {
    console.warn('[Chatwoot] EVOLUTION_API_URL or CHATWOOT_URL not configured');
    return false;
  }

  // Sanitize token — remove whitespace/newlines that cause "Invalid character in header" on Evolution side
  const cleanToken = chatwootToken.trim().replace(/[\r\n\t"']/g, '');

  // Evolution API v2 uses camelCase body fields
  // When inboxId is known, pass it explicitly so Evolution uses the correct inbox
  // instead of creating a duplicate via autoCreate
  const body: Record<string, unknown> = {
    enabled: true,
    accountId: String(chatwootAccountId),
    token: cleanToken,
    url: chatwootUrl,
    signMsg: false,
    reopenConversation: true,
    conversationPending: false,
    mergeBrazilContacts: true,
    importContacts: false,
    importMessages: false,
    daysLimitImportMessages: 0,
    autoCreate: chatwootInboxId ? false : true,
  };
  if (chatwootInboxId) body.inboxId = String(chatwootInboxId);
  if (inboxName) body.nameInbox = inboxName;

  // Evolution API v2: POST /chatwoot/set/{instance} (único endpoint válido)
  const paths = [`/chatwoot/set/${instance}`];

  for (const path of paths) {
    for (const method of ['POST']) {
      try {
        const res = await fetch(`${EVOLUTION_URL}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            apikey: evoApiKey,
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          console.log(`[Chatwoot] Evolution v2 configured via ${method} ${path}`);
          return true;
        }
        const text = await res.text();
        console.log(`[Chatwoot] ${method} ${path} → ${res.status}: ${text.substring(0, 200)}`);
      } catch (err) {
        console.log(`[Chatwoot] ${method} ${path} failed:`, err);
      }
    }
  }

  console.error(`[Chatwoot] Failed to configure Evolution v2 instance: ${instance}`);
  return false;
}
