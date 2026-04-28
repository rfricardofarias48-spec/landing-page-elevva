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

## 5. Onboarding Automático (10 Etapas)

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

## 6. Problema: Dois Inboxes no Chatwoot

**Causa**: O onboarding cria inbox "Nome — Elevva" (etapa 3). A Evolution cria outro inbox "Nome" via `autoCreate: true` (etapa 9). Resultado: dois inboxes distintos.

**Sintoma**: O agente do cliente não vê as conversas porque está vinculado ao inbox errado.

**Solução**:
1. Chatwoot → Settings → Inboxes → inbox criado pelo Evolution ("Nome")
2. Aba **Collaborators** → adicionar o agente do cliente

**Solução definitiva no código**: Quando `chatwoot_inbox_id` está salvo no perfil, passá-lo explicitamente para a Evolution com `inboxId` e `autoCreate: false`, evitando a criação do inbox duplicado.

---

## 7. Configuração Chatwoot na Evolution — Valores Corretos

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

## 8. Troubleshooting

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

## 9. Webhook Asaas → Elevva

- **URL**: `https://app.elevva.net.br/api/webhooks/asaas`
- **Token**: configurar `ASAAS_WEBHOOK_TOKEN` na Vercel e no painel Asaas
- **Eventos relevantes**: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `SUBSCRIPTION_RENEWED`

Quando um pagamento é confirmado:
1. Asaas chama o webhook com o ID do pagamento
2. Elevva busca a venda (`sales`) pelo `asaas_payment_id`
3. Dispara `provisionClient()` — onboarding das 10 etapas

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

## 11. Checklist Pós-Deploy

- [ ] Todas as variáveis de ambiente configuradas na Vercel
- [ ] Vercel → Deployments → último deploy com status ✅
- [ ] Chatwoot: webhook configurado apontando para o app
- [ ] Evolution: webhook configurado com `webhook_base64: true`
- [ ] Pelo menos 1 chip disponível em `chips_pool`
- [ ] Asaas: webhook configurado com o token correto
- [ ] Painel admin → usuário de teste → **Diagnosticar** → todos os campos ✅
- [ ] Painel admin → usuário de teste → **Reconfigurar no Evolution** → ✅
- [ ] Chatwoot: inbox do cliente tem o agente como Collaborator
- [ ] Teste end-to-end: enviar WhatsApp → mensagem aparece no Chatwoot

---

*Documento gerado em 2026-04-27 com base nos problemas identificados e corrigidos em produção.*
