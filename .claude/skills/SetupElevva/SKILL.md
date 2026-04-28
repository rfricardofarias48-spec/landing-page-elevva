---
name: SetupElevva
description: Guia de setup completo do Elevva — infraestrutura, variáveis de ambiente, onboarding automático e troubleshooting. Use este skill quando precisar configurar o Elevva do zero, diagnosticar falhas no onboarding de clientes, verificar variáveis de ambiente, ou guiar alguém pelo processo de setup.
---

Você é o especialista de infraestrutura do Elevva. Quando este skill for ativado, siga rigorosamente o manual abaixo para guiar o usuário pelo setup completo ou responder dúvidas específicas sobre qualquer etapa.

## Como usar este skill

- Se o usuário não especificou uma etapa, apresente o índice e pergunte onde quer começar ou continuar.
- Se especificou uma etapa (ex: "como configuro o Asaas?"), vá direto ao ponto.
- Se está diagnosticando uma falha, use a seção TROUBLESHOOTING.
- Sempre apresente o checklist de cada passo ao final da explicação.
- Quando o usuário confirmar que um passo está OK, avance para o próximo automaticamente.

---

# Elevva — Manual de Setup Completo

> Siga na ordem. Não pule etapas. Cada seção tem um checklist de verificação.

---

## PRÉ-REQUISITOS

Antes de começar, confirme que tem acesso a:

| Conta | Para quê | Onde criar |
|---|---|---|
| **Vercel** | Hospedagem do app | vercel.com |
| **Supabase** | Banco de dados | supabase.com |
| **Evolution API v2** | Instâncias WhatsApp | VPS própria |
| **Chatwoot** | Caixa de conversas | VPS própria |
| **Asaas** | Cobranças e assinaturas | asaas.com.br |
| **Google Cloud** | Login dos clientes (OAuth) | console.cloud.google.com |

---

## PASSO 1 — Supabase

### 1.1 Criar projeto
1. Acesse supabase.com → New Project
2. Anote a **Project URL** e a **anon key** (Settings → API)
3. Anote a **service_role key** (Settings → API → Service Role)

> ⚠️ A `service_role key` tem acesso total ao banco. Nunca expor no frontend.

### 1.2 Verificar tabelas
As tabelas `profiles`, `sales`, `chips_pool`, `jobs`, `candidates`, `interviews` devem existir.

**Checklist Passo 1:**
- [ ] `VITE_SUPABASE_URL` anotado
- [ ] `VITE_SUPABASE_ANON_KEY` anotado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` anotado

---

## PASSO 2 — Chatwoot

### 2.1 Criar conta administrator
1. Acesse seu Chatwoot
2. Crie (ou use) uma conta com papel **administrator**
3. Anote o ID da conta na URL: `.../app/accounts/**1**/...` → esse número é o `CHATWOOT_ACCOUNT_ID`

### 2.2 Obter o token de admin
1. Login como administrator → clique no nome (canto inferior esquerdo) → **Profile Settings**
2. Role até **Access Token** → copie

> ⚠️ Esse token (`CHATWOOT_ADMIN_TOKEN`) é crítico. Sem ele o onboarding automático falha silenciosamente na etapa 3.

### 2.3 Webhook Chatwoot → Elevva
1. Chatwoot → Settings → Integrations → **Webhooks** → Add new webhook
2. Preencha:
   - **URL**: `https://app.elevva.net.br/api/webhooks/chatwoot`
   - **Name**: Elevva
   - **Events**: `Conversation Status Changed` ✅ e `Message Created` ✅
3. Salve

**Checklist Passo 2:**
- [ ] `CHATWOOT_ACCOUNT_ID` anotado (número da URL)
- [ ] `CHATWOOT_ADMIN_TOKEN` anotado (Profile → Access Token)
- [ ] Webhook criado com os 2 eventos marcados

---

## PASSO 3 — Evolution API

### 3.1 Obter a Global API Key
1. Painel Evolution → Settings → Global API Key → copie

### 3.2 Webhook Evolution → Elevva
Em cada instância (chip) que for usar:
1. Evolution → instância → Events → **Webhook**
2. Configure:
   - **URL**: `https://app.elevva.net.br/api/webhooks/evolution`
   - **Webhook by Events**: ✅ ON
   - **Webhook Base64**: ✅ ON ← **obrigatório** para áudio e arquivos
   - **Eventos**: `MESSAGES_UPSERT` ✅ e `CONNECTION_UPDATE` ✅
3. Salve

> ⚠️ `Webhook Base64 OFF` → o agente não processa áudios/arquivos dos candidatos.

**Checklist Passo 3:**
- [ ] `EVOLUTION_API_URL` anotado (URL da VPS Evolution)
- [ ] `EVOLUTION_API_KEY` anotado (Global API Key)
- [ ] Webhook configurado com Base64 ON

---

## PASSO 4 — Asaas

### 4.1 Obter API Key
Asaas → Configurações → Integrações → API → copie a chave de produção

### 4.2 Webhook Asaas → Elevva
1. Asaas → Configurações → Notificações → Webhooks → Novo webhook
2. Preencha:
   - **URL**: `https://app.elevva.net.br/api/webhooks/asaas`
   - **Token de autenticação**: crie uma string segura (ex: `elevva_prod_2026_xK9mZ3`)
3. Salve

> ⚠️ O token aqui e o `ASAAS_WEBHOOK_TOKEN` na Vercel devem ser **idênticos**.
> ⚠️ Se `ASAAS_WEBHOOK_TOKEN` não estiver na Vercel, o webhook é bloqueado por segurança — nenhum cliente será ativado.

**Checklist Passo 4:**
- [ ] `ASAAS_API_KEY` anotado
- [ ] `ASAAS_WEBHOOK_TOKEN` criado e anotado (mesmo valor aqui e na Vercel)

---

## PASSO 5 — Chips WhatsApp

Os chips são números WhatsApp pré-autenticados atribuídos automaticamente a cada novo cliente.

### 5.1 Autenticar o chip na Evolution
1. Crie uma instância na Evolution (ex: nome `Chip01`)
2. Escaneie o QR Code com o celular do chip
3. Aguarde ficar **verde (conectado)**

### 5.2 Cadastrar no banco
No Supabase → tabela `chips_pool` → Insert row:
```
phone_number: '5551999990000'   ← número com DDI+DDD, sem +
evolution_instance: 'Chip01'   ← nome exato da instância na Evolution
status: 'disponivel'
```

> ⚠️ Sem chip com `status = 'disponivel'`, o onboarding trava na etapa 6 — nenhum cliente recebe acesso.

**Checklist Passo 5:**
- [ ] Chip conectado na Evolution (status verde)
- [ ] Registro em `chips_pool` com `status = 'disponivel'`

---

## PASSO 6 — Variáveis na Vercel

Acesse: **vercel.com → projeto Elevva → Settings → Environment Variables**

Adicione todas abaixo. Após salvar → **Deployments → Redeploy**.

### Supabase
| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (só servidor) |

### Evolution API
| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL da VPS Evolution (com barra no final não) |
| `EVOLUTION_API_KEY` | Global API Key |
| `SUPPORT_EVOLUTION_INSTANCE` | Instância que envia WhatsApp de boas-vindas |
| `SUPPORT_EVOLUTION_KEY` | Token dessa instância (opcional) |

### Chatwoot
| Variável | Valor |
|---|---|
| `VITE_CHATWOOT_URL` | URL pública do Chatwoot |
| `CHATWOOT_URL` | Mesma URL (necessária no servidor) |
| `CHATWOOT_ACCOUNT_ID` | Número da conta (da URL) |
| `CHATWOOT_ADMIN_TOKEN` | Token do administrator |

### Asaas
| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | Chave de produção |
| `ASAAS_WEBHOOK_TOKEN` | Token criado no Passo 4.2 |

### Gerais
| Variável | Valor |
|---|---|
| `SERVER_URL` | `https://app.elevva.net.br` |
| `APP_URL` | `https://app.elevva.net.br` |
| `CRON_SECRET` | String aleatória (protege os crons) |
| `OPENAI_API_KEY` | Chave da OpenAI |

**Checklist Passo 6:**
- [ ] Todas as variáveis salvas
- [ ] Novo deploy realizado (status verde)
- [ ] `https://app.elevva.net.br/api/health` retorna `{"status":"ok"}`

---

## PASSO 7 — Teste End-to-End

Antes de vender para clientes reais, valide o fluxo completo:

### 7.1 Gerar link
Painel admin → **Vendas** → **Venda Direta** → preencha dados de teste → **Gerar Link de Pagamento**

### 7.2 Pagar
Abra o link → pague com PIX → aguarde até 1 minuto

### 7.3 Verificar no banco (Supabase)
- Tabela `sales`: `status = 'paid'` e `onboarding_status = 'concluido'` e `onboarding_step = 10`
- Tabela `profiles`: registro do cliente com `evolution_instance`, `chatwoot_inbox_id`, `status_automacao = true`

### 7.4 Verificar no Chatwoot
- Settings → Inboxes → existe inbox `[Nome] — Elevva`
- Inbox → Collaborators → agente do cliente listado

### 7.5 Verificar acesso
Cliente loga em `https://app.elevva.net.br` com Google → plano ativo

**Checklist Passo 7:**
- [ ] Link gerado com sucesso
- [ ] Pagamento confirmado → webhook chegou
- [ ] `onboarding_status = 'concluido'` no banco
- [ ] Inbox no Chatwoot com agente vinculado
- [ ] Cliente recebeu WhatsApp de boas-vindas
- [ ] Cliente consegue logar no app

---

## COMO FUNCIONA O ONBOARDING (10 ETAPAS AUTOMÁTICAS)

Após pagamento confirmado pelo Asaas, o sistema executa automaticamente:

| # | O que acontece | Falha se... |
|---|---|---|
| 1 | Cria ou localiza usuário no Supabase Auth | Supabase fora do ar |
| 2 | Cria perfil com limites do plano | Erro no banco |
| 3 | Cria inbox no Chatwoot (`[Nome] — Elevva`) | `CHATWOOT_ADMIN_TOKEN` inválido ou ausente |
| 4 | Cria agente do cliente no Chatwoot | Erro na API Chatwoot (email já existe: tratado com fallback) |
| 5 | Vincula agente ao inbox | Erro na API Chatwoot |
| 6 | Aloca chip do pool | **Nenhum chip disponível** ← causa mais comum |
| 7 | Verifica/cria instância na Evolution | `EVOLUTION_API_URL` errado |
| 8 | Configura webhook Evolution → Elevva | `SERVER_URL` não definido |
| 9 | Integra Evolution com Chatwoot | Token malformado (espaços, newlines) |
| 10 | Envia WhatsApp de boas-vindas | Chip desconectado |

**Limites por plano:**
| Plano | Vagas | Currículos |
|---|---|---|
| ESSENCIAL | 5 | 150 |
| PRO | 15 | 500 |
| ENTERPRISE | Ilimitado | Ilimitado |

**Se falhar:** Painel admin → venda → botão **Reprocessar Onboarding** retoma do ponto de falha.

**Verificar status:** Tabela `sales` → coluna `onboarding_status`:
- `concluido` ✅
- `em_progresso` ⏳ aguarde
- `erro` ❌ veja logs da Vercel → corrija → Reprocessar

---

## TROUBLESHOOTING

### Onboarding travou em `erro`
1. Vercel → Deployments → último deploy → **Functions** → procure `[Onboarding]` nos logs
2. Identifique a etapa que falhou
3. Corrija a causa (chip disponível? token correto? Chatwoot acessível?)
4. Painel admin → venda → **Reprocessar Onboarding**

### Webhook Asaas não chegou
1. Confirme que `ASAAS_WEBHOOK_TOKEN` está igual na Vercel e no Asaas
2. Asaas → Configurações → Webhooks → ver log → clicar **Reenviar**
3. Se persistir: painel admin → venda → **Reprocessar Onboarding**

### Conversas não aparecem no Chatwoot
1. Painel admin → usuário → **Diagnosticar** → verifique se todos os campos ✅
2. Clique **Reconfigurar no Evolution**
3. Chatwoot → Inboxes → inbox do cliente → **Collaborators** → adicionar o agente

### Cliente não consegue logar
- Login é exclusivamente por **Google** com o email cadastrado na venda
- Email diferente do cadastrado → atualizar no Supabase Auth

### Chip desconectado
1. Evolution → instância do cliente → reconectar (novo QR se necessário)
2. Após reconectar, o agente volta a funcionar automaticamente

### `CHATWOOT_ADMIN_TOKEN` inválido
- Gera erro silencioso nas etapas 3, 4, 5 do onboarding
- Para testar: painel admin → usuário → **Diagnosticar** → `chatwoot_token_test`

---

## REFERÊNCIA RÁPIDA — CHATWOOT NA EVOLUTION

| Campo | Valor correto | Erro comum |
|---|---|---|
| `accountId` | `"1"` (string) | Enviar como inteiro pode falhar |
| `token` | Sem espaços ou newlines | Copiar com quebra de linha → `Invalid header` |
| `conversationPending` | `false` | `true` → conversas somem na aba "Pending" |
| `autoCreate` | `true` se sem inboxId | `false` sem inboxId → sem inbox |
| `importMessages` | `false` | `true` → importa histórico, gera spam |
| Endpoint | `POST /chatwoot/set/{instance}` | PUT e outros → 404 no Evolution v2 |
| Campos do body | camelCase | snake_case é ignorado silenciosamente |
