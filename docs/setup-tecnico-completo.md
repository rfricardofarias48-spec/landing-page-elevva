# Elevva — Manual de Setup Completo

> Este documento é o guia único para quem vai configurar o Elevva do zero.
> Siga na ordem. Não pule etapas. Cada seção tem um checklist de verificação.

---

## PRÉ-REQUISITOS

Antes de começar, você precisa ter acesso a:

| Conta | Para quê | Onde criar |
|---|---|---|
| **Vercel** | Hospedagem do app | vercel.com |
| **Supabase** | Banco de dados | supabase.com |
| **Evolution API v2** | Instâncias WhatsApp | VPS própria |
| **Chatwoot** | Caixa de conversas | VPS própria |
| **Asaas** | Cobranças e assinaturas | asaas.com.br |
| **Google Cloud** | Login dos clientes (OAuth) | console.cloud.google.com |

---

## PASSO 1 — Configurar o Supabase

### 1.1 Criar projeto
1. Acesse supabase.com → New Project
2. Anote a **Project URL** e a **anon key** (Settings → API)
3. Anote também a **service_role key** (Settings → API → Service Role)

> ⚠️ A `service_role key` tem acesso total ao banco. Nunca expor no frontend.

### 1.2 Verificar tabelas
As tabelas `profiles`, `sales`, `chips_pool`, `jobs`, `candidates`, `interviews` devem existir.
Se não existirem, rode as migrations do projeto.

**Checklist:**
- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` anotados
- [ ] `SUPABASE_SERVICE_ROLE_KEY` anotado (nunca vai para o frontend)

---

## PASSO 2 — Configurar o Chatwoot

### 2.1 Criar conta administrator
1. Acesse seu Chatwoot
2. Crie (ou use) uma conta com papel **administrator**
3. Anote o ID da conta na URL: `.../app/accounts/**1**/...` → esse número é o `CHATWOOT_ACCOUNT_ID`

### 2.2 Obter o token de admin
1. Login como administrator
2. Clique no nome (canto inferior esquerdo) → **Profile Settings**
3. Role até **Access Token** → copie

> ⚠️ Esse token (`CHATWOOT_ADMIN_TOKEN`) é crítico. Sem ele o onboarding automático falha silenciosamente.

### 2.3 Configurar webhook Chatwoot → Elevva
1. Chatwoot → Settings → Integrations → **Webhooks** → Add new webhook
2. Preencha:
   - **URL**: `https://app.elevva.net.br/api/webhooks/chatwoot`
   - **Name**: Elevva
   - **Events**: marque `Conversation Status Changed` ✅ e `Message Created` ✅
3. Salve e copie o secret gerado

**Checklist:**
- [ ] `CHATWOOT_ACCOUNT_ID` anotado (número da URL)
- [ ] `CHATWOOT_ADMIN_TOKEN` anotado
- [ ] Webhook criado com os 2 eventos marcados

---

## PASSO 3 — Configurar a Evolution API

### 3.1 Obter o Global API Key
1. Acesse o painel da Evolution
2. Settings → Global API Key → copie

### 3.2 Configurar webhook Evolution → Elevva
Em cada instância (chip) que for usar:
1. Evolution → instância → Events → **Webhook**
2. Configure:
   - **URL**: `https://app.elevva.net.br/api/webhooks/evolution`
   - **Webhook by Events**: ✅ ON
   - **Webhook Base64**: ✅ ON ← **obrigatório** para áudio e arquivos
   - **Eventos**: marque `MESSAGES_UPSERT` ✅ e `CONNECTION_UPDATE` ✅
3. Salve

> ⚠️ `Webhook Base64 OFF` faz o agente não processar arquivos/áudios enviados pelos candidatos.

**Checklist:**
- [ ] `EVOLUTION_API_URL` anotado (URL da sua VPS Evolution)
- [ ] `EVOLUTION_API_KEY` anotado (Global API Key)
- [ ] Webhook configurado com Base64 ON em todas as instâncias

---

## PASSO 4 — Configurar o Asaas

### 4.1 Obter API Key
1. Asaas → Configurações → Integrações → API
2. Copie a chave de produção

### 4.2 Configurar webhook Asaas → Elevva
1. Asaas → Configurações → Notificações → Webhooks → Novo webhook
2. Preencha:
   - **URL**: `https://app.elevva.net.br/api/webhooks/asaas`
   - **Token de autenticação**: crie uma string aleatória segura (ex: `elevva_webhook_2026_xK9m`)
3. Salve

> ⚠️ O token que você colocar aqui DEVE ser o mesmo que será configurado na Vercel como `ASAAS_WEBHOOK_TOKEN`.
> ⚠️ Se `ASAAS_WEBHOOK_TOKEN` não estiver configurado na Vercel, o webhook será **bloqueado por segurança**.

**Checklist:**
- [ ] `ASAAS_API_KEY` anotado
- [ ] `ASAAS_WEBHOOK_TOKEN` criado e anotado (mesmo valor aqui e na Vercel)

---

## PASSO 5 — Preparar os Chips (WhatsApp)

Os chips são números WhatsApp que serão atribuídos automaticamente a cada novo cliente.

### 5.1 Pré-autenticar o chip na Evolution
1. Crie uma instância na Evolution com o nome do chip (ex: `Farilog`)
2. Escaneie o QR Code com o celular do chip
3. Aguarde a instância ficar verde (conectada)

### 5.2 Cadastrar no banco
Insira um registro em `chips_pool`:

```sql
INSERT INTO chips_pool (phone_number, evolution_instance, status)
VALUES ('5551999990000', 'Farilog', 'disponivel');
```

> ⚠️ Se não houver nenhum chip com `status = 'disponivel'`, o onboarding para no passo 6 e o cliente não recebe acesso.

**Checklist:**
- [ ] Chip autenticado na Evolution (status verde/conectado)
- [ ] Chip cadastrado em `chips_pool` com `status = 'disponivel'`

---

## PASSO 6 — Configurar Variáveis na Vercel

Acesse: **vercel.com → projeto Elevva → Settings → Environment Variables**

Adicione todas as variáveis abaixo. Após salvar, **faça um novo deploy** (Deployments → Redeploy).

### Supabase
| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (só servidor) |

### Evolution API
| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL da sua VPS Evolution (ex: `https://evolution.seudominio.com`) |
| `EVOLUTION_API_KEY` | Global API Key da Evolution |
| `SUPPORT_EVOLUTION_INSTANCE` | Nome da instância que envia a mensagem de boas-vindas |
| `SUPPORT_EVOLUTION_KEY` | Token dessa instância (opcional, usa EVOLUTION_API_KEY se omitido) |

### Chatwoot
| Variável | Valor |
|---|---|
| `VITE_CHATWOOT_URL` | URL do Chatwoot (ex: `https://chatwoot.seudominio.com`) |
| `CHATWOOT_URL` | Mesma URL (necessária no servidor) |
| `CHATWOOT_ACCOUNT_ID` | Número da conta (da URL) |
| `CHATWOOT_ADMIN_TOKEN` | Token do administrator |

### Asaas
| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | Chave de produção do Asaas |
| `ASAAS_WEBHOOK_TOKEN` | O token que você criou no passo 4.2 |

### URLs e Segredos
| Variável | Valor |
|---|---|
| `SERVER_URL` | `https://app.elevva.net.br` |
| `APP_URL` | `https://app.elevva.net.br` |
| `CRON_SECRET` | String aleatória para proteger os crons |
| `OPENAI_API_KEY` | Chave da OpenAI para análise de currículos |

**Checklist:**
- [ ] Todas as variáveis salvas na Vercel
- [ ] Novo deploy realizado com sucesso (status verde)
- [ ] Acesse `https://app.elevva.net.br/api/health` → deve retornar `{"status":"ok"}`

---

## PASSO 7 — Verificar uma Venda Completa (Teste)

Antes de abrir para clientes reais, faça um teste completo:

### 7.1 Gerar link de pagamento
1. Painel admin → aba **Vendas** → **Venda Direta**
2. Preencha com dados reais de teste
3. Clique **Gerar Link de Pagamento**
4. O link Asaas deve aparecer

### 7.2 Simular pagamento
1. Abra o link gerado
2. Pague com PIX (pode usar valor real ou o modo sandbox do Asaas)
3. Asaas deve disparar o webhook em até 1 minuto

### 7.3 Verificar o onboarding
No Supabase → tabela `sales`:
- `status` deve virar `paid`
- `onboarding_status` deve virar `concluido`
- `onboarding_step` deve ser `10`

No Supabase → tabela `profiles`:
- Registro do cliente deve existir com `evolution_instance`, `chatwoot_inbox_id` e `status_automacao = true`

### 7.4 Verificar Chatwoot
1. Chatwoot → Settings → Inboxes → deve existir inbox `[Nome do cliente] — Elevva`
2. Inbox → Collaborators → o agente do cliente deve estar listado

### 7.5 Verificar acesso do cliente
1. Cliente tenta logar em `https://app.elevva.net.br` com Google usando o email cadastrado
2. Deve entrar normalmente com o plano ativo

**Checklist:**
- [ ] Link de pagamento gerado com sucesso
- [ ] Pagamento confirmado → webhook recebido
- [ ] `onboarding_status = 'concluido'` no banco
- [ ] Inbox criado no Chatwoot com agente vinculado
- [ ] Cliente recebeu WhatsApp de boas-vindas
- [ ] Cliente consegue logar no app

---

## COMO FUNCIONA O ONBOARDING (10 ETAPAS)

Após o pagamento ser confirmado pelo Asaas, o sistema executa automaticamente:

| # | O que acontece | Falha se... |
|---|---|---|
| 1 | Cria (ou localiza) usuário no Supabase Auth | Supabase fora do ar |
| 2 | Cria perfil com limites do plano | Erro no banco |
| 3 | Cria inbox no Chatwoot (`[Nome] — Elevva`) | `CHATWOOT_ADMIN_TOKEN` inválido ou ausente |
| 4 | Cria agente do cliente no Chatwoot | Email já existe mas não é idempotente (tratado com fallback) |
| 5 | Vincula agente ao inbox | Erro na API Chatwoot |
| 6 | Aloca chip do pool | **Nenhum chip disponível** ← causa mais comum de falha |
| 7 | Verifica/cria instância na Evolution | `EVOLUTION_API_URL` errado |
| 8 | Configura webhook Evolution → Elevva | `SERVER_URL` não definido |
| 9 | Integra Evolution com Chatwoot | Token inválido ou malformado |
| 10 | Envia WhatsApp de boas-vindas | Chip desconectado |

### Retry automático
Se qualquer etapa falhar, o contexto é salvo. O botão **"Reprocessar Onboarding"** no painel admin retoma do ponto de falha sem repetir etapas já concluídas.

### Verificar falha
Painel admin → aba Vendas → clique na venda → coluna `onboarding_status`:
- `concluido` ✅ — tudo OK
- `em_progresso` ⏳ — ainda rodando (aguarde)
- `erro` ❌ — falhou; verifique os logs da Vercel e use o botão Reprocessar

---

## TROUBLESHOOTING

### Onboarding ficou em `erro`
1. Vercel → projeto → Deployments → último deploy → **Functions** → ver logs
2. Procure por `[Onboarding]` para ver em qual etapa parou
3. Corrija a causa (chip sem disponibilidade, token errado, etc.)
4. Painel admin → venda → **Reprocessar Onboarding**

### Webhook Asaas não chegou
1. Confirme que `ASAAS_WEBHOOK_TOKEN` está configurado na Vercel E no painel Asaas (mesmo valor)
2. Asaas → Configurações → Notificações → Webhooks → ver log de envios
3. Se falhou, clique em **Reenviar** no Asaas
4. Se o problema persistir, use o botão **Reprocessar Onboarding** no painel admin

### Conversas não aparecem no Chatwoot
1. Painel admin → usuário → **Diagnosticar** → verifique se todos os campos estão ✅
2. Clique **Reconfigurar no Evolution**
3. Chatwoot → Settings → Inboxes → inbox do cliente → Collaborators → adicionar o agente

### Usuário não consegue logar
- O login é exclusivamente por **Google** com o email cadastrado na venda
- Se o cliente usa Gmail diferente do cadastrado, é preciso atualizar o email no Supabase Auth

### Chip desconectado (cliente sem agente funcionando)
1. Evolution → instância do cliente → reconectar (novo QR Code se necessário)
2. Após reconectar, o webhook volta a funcionar automaticamente

---

## CONFIGURAÇÃO CHATWOOT NA EVOLUTION — VALORES CORRETOS

| Campo | Valor correto | Erro comum |
|---|---|---|
| `accountId` | `"1"` (string) | Enviar como número inteiro pode falhar |
| `token` | Token sanitizado (sem espaços) | Copiar com quebra de linha → `Invalid header` |
| `conversationPending` | `false` | Se `true`, conversas ficam em aba "Pending" invisível |
| `autoCreate` | `true` se sem inboxId | Sem isso e sem inboxId → sem inbox criado |
| `importMessages` | `false` | `true` importa histórico e gera spam de conversas |
| Endpoint | `POST /chatwoot/set/{instance}` | Evolution v2 só aceita esse — PUT e outros retornam 404 |
| Campos do body | camelCase | snake_case é ignorado silenciosamente no Evolution v2 |

---

*Atualizado em 2026-04-27. Todos os problemas encontrados em produção estão documentados e corrigidos.*
