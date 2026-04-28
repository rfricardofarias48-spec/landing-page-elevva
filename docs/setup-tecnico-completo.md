# Elevva — Setup Técnico Completo

> Guia interno de infraestrutura, variáveis de ambiente, integrações e troubleshooting.
> Atualizado com todos os problemas identificados e corrigidos em produção.

---

## 1. Infraestrutura

| Serviço | Função | URL de Referência |
|---|---|---|
| **Vercel** | Frontend (React/Vite) + Serverless (Express) | app.elevva.net.br |
| **Supabase** | Banco de dados PostgreSQL + Auth | dashboard.supabase.com |
| **Evolution API v2** | Instâncias WhatsApp (chips) | VPS própria |
| **Chatwoot** | Caixa de conversas para atendimento humano | VPS própria |
| **Asaas** | Pagamentos / assinaturas / webhooks | asaas.com |
| **Google Calendar** | Agendamento de entrevistas | console.cloud.google.com |

---

## 2. Variáveis de Ambiente (Vercel)

Acesse: **Vercel → projeto Elevva → Settings → Environment Variables**

### Supabase
```
VITE_SUPABASE_URL=https://<id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   ← obrigatório no servidor
```
> `VITE_` = disponível no frontend E no servidor.
> `SUPABASE_SERVICE_ROLE_KEY` = nunca expor no frontend, apenas servidor.

### Evolution API
```
EVOLUTION_API_URL=https://<sua-vps>/          ← URL da sua instância Evolution v2
EVOLUTION_API_KEY=<global apikey>              ← Settings → Global API Key
SUPPORT_EVOLUTION_INSTANCE=<instancia-suporte> ← instância que envia mensagens de boas-vindas
SUPPORT_EVOLUTION_KEY=<token-instancia-suporte>← token da instância de suporte
```
> ⚠️ Evolution v2 usa **camelCase** nos campos do body (ex: `accountId`, `signMsg`).
> ⚠️ Nunca usar snake_case — causa erro silencioso (request aceito mas não aplicado).

### Chatwoot
```
VITE_CHATWOOT_URL=https://<chatwoot-url>       ← URL pública do Chatwoot (frontend)
CHATWOOT_URL=https://<chatwoot-url>            ← mesma URL, para o servidor
CHATWOOT_ACCOUNT_ID=1                          ← ID da conta principal (veja na URL do Chatwoot)
CHATWOOT_ADMIN_TOKEN=<token-admin>             ← Profile → Access Token (conta administrator)
CHATWOOT_WEBHOOK_SECRET=<segredo>              ← opcional, valida webhooks do Chatwoot
```
> ⚠️ `CHATWOOT_ADMIN_TOKEN` é **crítico**. Sem ele, o onboarding (etapa 9) falha silenciosamente.
> ⚠️ `CHATWOOT_ACCOUNT_ID` deve ser o número que aparece na URL: `.../app/accounts/**1**/...`

### Asaas (Pagamentos)
```
ASAAS_API_KEY=<chave-api-asaas>               ← Asaas → Configurações → API
ASAAS_API_URL=https://api.asaas.com/v3        ← padrão produção
ASAAS_WEBHOOK_TOKEN=<token-webhook>           ← token para validar webhooks Asaas
```

### URLs e Segredos Internos
```
SERVER_URL=https://app.elevva.net.br          ← URL pública do app (webhooks Evolution apontam aqui)
BASE_URL=https://app.elevva.net.br            ← alias de SERVER_URL
APP_URL=https://app.elevva.net.br             ← usado em mensagens de boas-vindas
CRON_SECRET=<segredo>                         ← protege rotas de cron do Vercel
API_KEY=<chave-interna>                       ← autenticação de chamadas internas
ENTERPRISE_API_KEY=<chave-enterprise>         ← acesso a features enterprise
```

### OpenAI / Hermes
```
OPENAI_API_KEY=<chave-openai>
HERMES_SECRET=<segredo>                       ← autenticação entre server e serviço Hermes
```

### Google Calendar
```
GOOGLE_CALENDAR_ID=<calendar-id>              ← ID do calendário para agendamentos
```

---

## 3. Configuração Inicial do Chatwoot (Uma vez por instalação)

### 3.1 Instalar Chatwoot na VPS
- Deploy via Docker ou Easypanel
- Criar conta **administrator** (ex: rh@elevva.com.br)
- Anotar o ID da conta na URL: `.../app/accounts/**1**/...`

### 3.2 Obter CHATWOOT_ADMIN_TOKEN
1. Login com a conta administrator
2. Menu inferior esquerdo → clique no nome → **Profile Settings**
3. Role até **Access Token** → copiar
4. Colar na Vercel como `CHATWOOT_ADMIN_TOKEN`

### 3.3 Configurar Webhook do Chatwoot → Elevva
1. Chatwoot → Settings → Integrations → **Webhooks**
2. Criar webhook:
   - **URL**: `https://app.elevva.net.br/api/webhooks/chatwoot`
   - **Nome**: Elevva
   - **Eventos marcados**: `conversation_status_changed` ✅ e `message_created` ✅
3. O secret gerado pode ser salvo como `CHATWOOT_WEBHOOK_SECRET` na Vercel

---

## 4. Configuração Inicial da Evolution API (Uma vez por instalação)

### 4.1 Instalar Evolution API v2 na VPS
- Versão recomendada: v2.3.x ou superior
- Anotar o **Global API Key** em Settings

### 4.2 Configurar Webhook da Evolution → Elevva
1. Evolution Manager → instância → Events → Webhook
2. Configurar:
   - **URL**: `https://app.elevva.net.br/api/webhooks/evolution`
   - **Webhook by Events**: ON ✅
   - **Webhook Base64**: ON ✅ (⚠️ obrigatório para receber arquivos/áudio)
   - **Eventos**: `MESSAGES_UPSERT` ✅ e `CONNECTION_UPDATE` ✅

---

## 5. Fluxo Completo de Venda → Acesso Liberado

### 5.1 Visão Geral

```
Admin preenche "Venda Direta"
        ↓
POST /api/sales/direct-link
        ↓
Cria registro em sales (status: pending)
        ↓
Gera link Asaas (sem comissão, sem split)
        ↓
Admin envia link ao cliente
        ↓
Cliente paga via Asaas (PIX / cartão / boleto)
        ↓
Asaas dispara webhook → POST /api/webhooks/asaas
        ↓
Atualiza sales (status: paid)
        ↓
provisionClient() — 10 etapas
        ↓
Cliente recebe WhatsApp de boas-vindas
        ↓
Cliente loga com Google → acesso completo
```

---

### 5.2 Formulário "Venda Direta" (AdminDashboard)

**Campos:**

| Campo | Obrigatório | Descrição |
|---|---|---|
| Nome do Cliente | ✅ | Nome completo |
| E-mail Google | ✅ | Usado para criar conta no Supabase Auth — deve ser um Gmail |
| WhatsApp | ✅ | Número com DDD — recebe boas-vindas e é o contato do cliente |
| Plano | ✅ | ESSENCIAL / PRO / ENTERPRISE |
| Período | ✅ (exceto Enterprise) | Mensal ou Anual (20% de desconto) |
| Valor customizado | Só ENTERPRISE | Digitado manualmente pelo admin |

**Preços padrão (em centavos internamente):**

| Plano | Mensal | Anual |
|---|---|---|
| ESSENCIAL | R$ 549,00/mês | R$ 5.270,40/ano |
| PRO | R$ 899,00/mês | R$ 8.630,40/ano |
| ENTERPRISE | Customizado | Customizado |

---

### 5.3 Endpoint POST /api/sales/direct-link

1. Valida campos obrigatórios e plano
2. Cria registro em `sales`:
   - `status: 'pending'`
   - `commission_amount: 0` (sem comissão — venda direta)
   - `salesperson_id: null`
3. Chama `generatePaymentLink` no Asaas:
   - `commissionPct: 0`
   - `walletId: ''` (sem split de pagamento)
   - `salespersonName: 'Elevva'`
   - `chargeType: 'RECURRENT'` (assinatura recorrente)
   - `billingType: 'UNDEFINED'` (aceita PIX, cartão ou boleto)
   - `externalReference: saleId` (UUID da venda — usado para rastrear no webhook)
4. Salva `asaas_link_url` no registro da venda
5. Retorna o link para o admin copiar e enviar ao cliente

---

### 5.4 Webhook Asaas → POST /api/webhooks/asaas

**Header obrigatório:** `asaas-access-token: ${ASAAS_WEBHOOK_TOKEN}`

**Eventos que disparam onboarding:**
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`

**Fluxo ao receber evento:**
1. Valida token do header
2. Extrai `payment.externalReference` (= saleId)
3. Verifica se já existe registro com esse `asaas_payment_id`:
   - **Já existe + onboarding concluído** → apenas atualiza data de renovação, retorna
   - **Já existe + pendente** → reutiliza saleId e tenta onboarding novamente
   - **Não existe** → cria novo registro `sales` com `status: 'paid'`
4. Atualiza `sales`: `status: 'paid'`, `paid_at: now`, `asaas_payment_id`
5. Chama `provisionClient(saleId)` — onboarding completo
6. Atualiza `profiles`: `subscription_status: 'active'`, `current_period_end`

> ⚠️ O webhook **deve** estar configurado no painel Asaas apontando para `https://app.elevva.net.br/api/webhooks/asaas`
> ⚠️ O token `ASAAS_WEBHOOK_TOKEN` deve ser o mesmo que está no painel Asaas → Configurações → Webhooks

---

### 5.5 Tabelas do Banco de Dados

**Tabela `sales`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Chave primária |
| `client_name` | text | Nome do cliente |
| `client_email` | text | Email Google |
| `client_phone` | text | WhatsApp |
| `plan` | text | ESSENCIAL / PRO / ENTERPRISE / *_ANUAL |
| `billing` | text | 'mensal' ou 'anual' |
| `amount` | numeric | Valor em reais |
| `commission_amount` | numeric | 0 para venda direta |
| `salesperson_id` | UUID | NULL para venda direta |
| `status` | text | pending → paid |
| `asaas_payment_id` | text | ID do pagamento no Asaas |
| `asaas_link_url` | text | URL do link de pagamento |
| `paid_at` | timestamp | Quando o pagamento foi confirmado |
| `onboarding_status` | text | aguardando → concluido / erro |
| `onboarding_step` | int | 0–10 (para retry) |
| `onboarding_context` | JSONB | Dados de cada etapa (para retry) |
| `client_user_id` | UUID | ID do usuário Supabase criado |

**Tabela `profiles` (após onboarding concluído):**

| Campo | Origem |
|---|---|
| `plan` | Normalizado (sem _ANUAL) |
| `job_limit` / `resume_limit` | ESSENCIAL: 5/150 · PRO: 15/500 · ENTERPRISE: 9999/9999 |
| `subscription_status` | 'active' |
| `chatwoot_inbox_id` | ID do inbox criado na etapa 3 |
| `chatwoot_user_token` | Token do agente criado na etapa 4 |
| `evolution_instance` / `instancia_evolution` | Chip alocado na etapa 6 |
| `whatsapp_number` / `telefone_agente` | Número do chip |
| `status_automacao` | true |
| `onboarded_at` | Timestamp de conclusão |

---

## 6. Onboarding Automático (10 Etapas)

Disparado quando um pagamento Asaas é confirmado. Cada etapa salva progresso em `sales.onboarding_context` para retry seguro.

| Etapa | O que faz | Problemas conhecidos |
|---|---|---|
| **1** | Cria usuário no Supabase Auth | Email duplicado: ignora erro e continua |
| **2** | Cria/atualiza perfil em `profiles` | — |
| **3** | Cria inbox no Chatwoot (`type: api`) | Cria inbox "Nome — Elevva"; Evolution vai criar um segundo inbox "Nome" via autoCreate |
| **4** | Cria agente do cliente no Chatwoot | Gera senha aleatória; salva `chatwoot_user_id` e `chatwoot_user_token` |
| **5** | Vincula agente ao inbox | Usa `inbox_members` API |
| **6** | Busca chip disponível do pool | Falha se nenhum chip `status=disponivel` no `chips_pool` |
| **7** | Verifica/cria instância na Evolution | Chip já deve estar autenticado (QR escaneado previamente) |
| **8** | Configura webhook Evolution → Elevva | `webhook_base64: true` obrigatório |
| **9** | Configura Chatwoot na Evolution | Usa `POST /chatwoot/set/{instance}` com campos camelCase |
| **10** | Envia WhatsApp de boas-vindas | Usa `SUPPORT_EVOLUTION_INSTANCE` ou o chip do cliente |

### Etapa 9 — Detalhes Críticos

Body enviado para Evolution (`POST /chatwoot/set/{instance}`):
```json
{
  "enabled": true,
  "accountId": "1",
  "token": "<chatwoot_user_token sanitizado>",
  "url": "https://<chatwoot-url>",
  "signMsg": false,
  "reopenConversation": true,
  "conversationPending": false,
  "importContacts": true,
  "nameInbox": "Nome do Cliente — Elevva",
  "mergeBrazilContacts": true,
  "importMessages": false,
  "daysLimitImportMessages": 0,
  "autoCreate": true
}
```

> ⚠️ Token deve ser sanitizado antes de enviar: `.trim().replace(/[\r\n\t"']/g, '')`
> ⚠️ Apenas o endpoint `POST /chatwoot/set/{instance}` existe no Evolution v2
> ⚠️ `PUT` e outros métodos retornam 404 — não tentar

---

## 7. Problema: Dois Inboxes no Chatwoot

**Causa**: O onboarding cria inbox "Nome — Elevva" (etapa 3). A Evolution cria outro inbox "Nome" via `autoCreate: true` (etapa 9). Resultado: dois inboxes distintos.

**Sintoma**: O agente do cliente não vê as conversas porque está vinculado ao inbox errado.

**Solução**:
1. Chatwoot → Settings → Inboxes → inbox criado pelo Evolution ("Nome")
2. Aba **Collaborators** → adicionar o agente do cliente

**Solução definitiva no código**: Quando `chatwoot_inbox_id` está salvo no perfil, passá-lo explicitamente para a Evolution com `inboxId` e `autoCreate: false`, evitando a criação do inbox duplicado.

---

## 8. Configuração Chatwoot na Evolution — Valores Corretos

| Campo | Valor correto | Erro comum |
|---|---|---|
| `enabled` | `true` | — |
| `accountId` | `"1"` (string) | Passar como number `1` pode falhar |
| `token` | token sanitizado | Token com espaços/newlines → `Invalid character in header` |
| `url` | URL sem barra final | Trailing slash causa erro |
| `signMsg` | `false` | — |
| `reopenConversation` | `true` | — |
| `conversationPending` | `false` | Se `true`, conversas ficam na aba "Pending" e parecem sumidas |
| `autoCreate` | `true` apenas se sem inboxId | Se `false` e sem inboxId → sem inbox |
| `importMessages` | `false` | `true` importa histórico e gera spam de conversas |

---

## 9. Troubleshooting

### Chatwoot não aparece configurado na Evolution
1. Verificar `CHATWOOT_ADMIN_TOKEN` e `CHATWOOT_URL` na Vercel
2. Painel admin → usuário → Diagnosticar → ver resultado
3. Clicar **Reconfigurar no Evolution**

### "Invalid character in header content [Authorization]"
- Token do Chatwoot copiado com espaços ou quebra de linha
- Solução: o código já sanitiza automaticamente via `.trim().replace(/[\r\n\t"']/g, '')`
- Se o problema persistir, re-salvar o token manualmente nas configurações do usuário

### Conversas chegam ao Chatwoot mas agente não vê
- O agente não está vinculado ao inbox onde as mensagens chegam
- Solução: Chatwoot → Settings → Inboxes → inbox correto → Collaborators → adicionar agente

### Conversas na aba "Pending" em vez de "Open"
- `conversationPending: true` na Evolution
- Solução: clicar **Reconfigurar no Evolution** (o código envia `false`)

### Usuário mostrado como DESATIVADO mesmo pagando
- `isGhost` no AdminDashboard verificava apenas `evolution_instance`
- Agora verifica: tem instância Evolution OU (`plan` é pago E `subscription_status = 'active'`)

### Botão "Sincronizar" não restaurava o plano
- `sync-profile` não atualizava o campo `plan`
- Agora normaliza e atualiza `plan` + `subscription_status: 'active'`

### Mensagem de agendamento com preview de link (ícone Meet)
- Evolution API: adicionar `linkPreview: false` no body de `sendText`

---

## 10. Chips Pool (WhatsApp)

Os chips são números WhatsApp pré-autenticados na Evolution, armazenados em `chips_pool`:

```sql
chips_pool (
  id, phone_number, evolution_instance,
  status: 'disponivel' | 'em_uso' | 'bloqueado',
  assigned_to, assigned_at, assigned_sale_id
)
```

- Antes de onboardar um cliente, é preciso ter pelo menos 1 chip com `status = 'disponivel'`
- O chip deve estar com QR escaneado e **conectado** na Evolution
- Após o onboarding, o chip fica `status = 'em_uso'` vinculado ao cliente

---

## 11. Checklist de Setup Completo

**Infraestrutura:**
- [ ] Vercel: todas as variáveis de ambiente configuradas (ver seção 2)
- [ ] Vercel → Deployments → último deploy com status ✅

**Chatwoot:**
- [ ] Conta administrator criada, `CHATWOOT_ADMIN_TOKEN` copiado para Vercel
- [ ] `CHATWOOT_ACCOUNT_ID` copiado da URL para Vercel
- [ ] Webhook criado: `https://app.elevva.net.br/api/webhooks/chatwoot` com eventos `conversation_status_changed` e `message_created`

**Evolution API:**
- [ ] `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` configurados na Vercel
- [ ] Webhook padrão: `https://app.elevva.net.br/api/webhooks/evolution` com `webhook_base64: true`

**Asaas:**
- [ ] `ASAAS_API_KEY` configurado na Vercel
- [ ] Webhook criado no Asaas: `https://app.elevva.net.br/api/webhooks/asaas`
- [ ] `ASAAS_WEBHOOK_TOKEN` igual nos dois lugares (Vercel e Asaas)

**Chips:**
- [ ] Pelo menos 1 chip com QR escaneado e status **conectado** na Evolution
- [ ] Chip cadastrado em `chips_pool` com `status = 'disponivel'`

**Fluxo de venda:**
- [ ] Admin cria venda direta → link de pagamento gerado com sucesso
- [ ] Pagamento confirmado → webhook Asaas recebido → `sales.status = 'paid'`
- [ ] Onboarding 10 etapas concluído → `onboarding_status = 'concluido'`
- [ ] Cliente recebe WhatsApp de boas-vindas
- [ ] Cliente loga com Google → acesso funcional

**Chatwoot por cliente:**
- [ ] Painel admin → usuário → **Diagnosticar** → todos ✅
- [ ] Inbox do cliente tem agente como **Collaborator**
- [ ] Teste: enviar WhatsApp → conversa aparece no Chatwoot

---

*Documento gerado em 2026-04-27 com base nos problemas identificados e corrigidos em produção.*
