/**
 * Asaas Service
 * Integração com a API do Asaas para:
 *  - Criar subcontas de vendedores (split automático)
 *  - Gerar links de pagamento com split configurado
 *  - Consultar pagamentos
 */

const ASAAS_URL = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '');
const ASAAS_KEY = process.env.ASAAS_API_KEY || '';

// Valores por plano em centavos (para referência interna)
export const PLAN_PRICES: Record<string, number> = {
  ESSENCIAL:         54900,   // R$ 549,00/mês
  ESSENCIAL_ANUAL:   527040,  // R$ 5.270,40/ano (20% off)
  PRO:               89900,   // R$ 899,00/mês
  PRO_ANUAL:         863040,  // R$ 8.630,40/ano (20% off)
  ENTERPRISE:        0,       // A consultar — gerado manualmente
};

export interface AsaasSubaccount {
  walletId: string;
  customerId: string;
}

export interface AsaasPaymentLink {
  id: string;
  url: string;
  name: string;
}

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  if (!ASAAS_KEY) {
    console.warn('[Asaas] ASAAS_API_KEY não configurada');
    return null;
  }

  try {
    const res = await fetch(`${ASAAS_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Asaas] ${method} ${path} → HTTP ${res.status}: ${text.substring(0, 300)}`);
      throw new Error(`Asaas API error ${res.status}: ${text.substring(0, 200)}`);
    }

    return res.json().catch(() => null);
  } catch (err) {
    console.error(`[Asaas] fetch error on ${method} ${path}:`, err);
    throw err;
  }
}

/**
 * Valida se um Wallet ID existe no Asaas buscando a conta pelo walletId.
 * Usado para verificar o Wallet ID informado pelo vendedor antes de salvar.
 */
export async function validateWalletId(walletId: string): Promise<{ valid: boolean; name?: string; email?: string }> {
  try {
    const data = await asaasRequest('GET', `/transfers/walletId/${walletId}`) as any;
    if (data?.name) {
      return { valid: true, name: data.name, email: data.email };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Gera um link de pagamento com split automático para o vendedor.
 *
 * Modelo correto (conforme documentação Asaas):
 *  - O vendedor tem conta própria no Asaas e fornece o Wallet ID da conta dele
 *  - A Elevva absorve 100% das taxas operacionais (não divide com o vendedor)
 *  - O split é feito por percentual: vendedor recebe commissionPct% do valor bruto
 */
export async function generatePaymentLink(params: {
  clientName: string;
  clientEmail: string;
  plan: string;
  amount: number;           // em reais (ex: 649.90)
  commissionPct: number;    // percentual (ex: 15) — 0 para venda direta
  walletId: string;         // Wallet ID da conta Asaas do vendedor — '' para venda direta
  salespersonName: string;
  saleId: string;           // ID interno da venda para rastreamento
  billing?: 'mensal' | 'anual'; // período de cobrança
}): Promise<AsaasPaymentLink> {
  const { clientName, plan, amount, commissionPct, walletId, salespersonName, saleId, billing } = params;

  const hasSplit = !!walletId && commissionPct > 0;
  const cycle = billing === 'anual' ? 'YEARLY' : 'MONTHLY';

  const body: Record<string, unknown> = {
    name: `Elevva ${plan} — ${clientName}`,
    description: `Plano ${plan} Elevva${salespersonName !== 'Elevva' ? ` — vendido por ${salespersonName}` : ''}`,
    value: amount,
    billingType: 'UNDEFINED',   // Aceita PIX, cartão, boleto
    chargeType: 'RECURRENT',    // Assinatura recorrente
    cycle,                      // MONTHLY ou YEARLY
    dueDateLimitDays: 3,        // Dias úteis para vencimento da cobrança (obrigatório Asaas)
    isAddNewPaymentEnabled: false,
    externalReference: saleId,
  };

  if (hasSplit) {
    body.split = [{ walletId, percentualValue: commissionPct, externalReference: `comissao_${saleId}` }];
    body.feeCharged = true;
  }

  const data = await asaasRequest('POST', '/paymentLinks', body) as any;

  if (!data?.id || !data?.url) {
    throw new Error(`Falha ao gerar link Asaas: ${JSON.stringify(data)}`);
  }

  return {
    id: data.id,
    url: data.url,
    name: data.name,
  };
}

/**
 * Busca os dados de um pagamento pelo ID.
 */
export async function getPayment(paymentId: string): Promise<Record<string, unknown> | null> {
  const data = await asaasRequest('GET', `/payments/${paymentId}`) as any;
  return data || null;
}

/**
 * Busca pagamentos pelo externalReference (= saleId interno).
 * Permite sincronizar o status real do Asaas com nossa tabela sales.
 */
export async function getPaymentsByExternalReference(saleId: string): Promise<any[]> {
  const data = await asaasRequest('GET', `/payments?externalReference=${encodeURIComponent(saleId)}&limit=10`) as any;
  return data?.data || [];
}

/**
 * Busca o saldo real da carteira de um vendedor.
 * Usa o access_token da subconta do vendedor (não o da conta principal).
 * Como não armazenamos o token da subconta, buscamos via API de transferências.
 */
export async function getWalletBalance(walletId: string): Promise<number | null> {
  // O Asaas não expõe saldo de subcontas diretamente via conta pai.
  // Retorna null — o saldo é consultado via painel Asaas do vendedor.
  // Deixamos aqui para futura expansão com token de subconta.
  return null;
}

/**
 * Lista todos os pagamentos da conta principal com filtros opcionais.
 * Útil para sincronização em lote.
 */
export async function listPayments(params?: {
  status?: string;   // PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED
  dateCreatedStart?: string;  // YYYY-MM-DD
  dateCreatedEnd?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: any[]; totalCount: number; hasMore: boolean }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.dateCreatedStart) qs.set('dateCreatedStart', params.dateCreatedStart);
  if (params?.dateCreatedEnd) qs.set('dateCreatedEnd', params.dateCreatedEnd);
  qs.set('limit', String(params?.limit || 50));
  qs.set('offset', String(params?.offset || 0));

  const data = await asaasRequest('GET', `/payments?${qs.toString()}`) as any;
  return {
    data: data?.data || [],
    totalCount: data?.totalCount || 0,
    hasMore: data?.hasMore || false,
  };
}

/**
 * Busca dados de uma subconta (conta filha) pelo walletId.
 * Retorna nome, email, status da conta no Asaas.
 */
export async function getSubaccountInfo(walletId: string): Promise<any | null> {
  try {
    const data = await asaasRequest('GET', `/accounts?walletId=${walletId}`) as any;
    if (data?.data?.length > 0) return data.data[0];
    return null;
  } catch {
    return null;
  }
}

/**
 * Sincroniza o status de um pagamento do Asaas para nossa tabela sales.
 * Retorna o status atualizado.
 */
export async function syncPaymentStatus(asaasPaymentId: string): Promise<{
  asaasStatus: string;
  confirmedAt: string | null;
  netValue: number | null;
} | null> {
  const payment = await asaasRequest('GET', `/payments/${asaasPaymentId}`) as any;
  if (!payment) return null;

  const CONFIRMED_STATUSES = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
  const isConfirmed = CONFIRMED_STATUSES.includes(payment.status);

  return {
    asaasStatus: payment.status,
    confirmedAt: isConfirmed ? (payment.confirmedDate || payment.paymentDate || null) : null,
    netValue: payment.netValue || null,
  };
}

/**
 * Valida a assinatura do webhook do Asaas.
 */
export function validateWebhookToken(headerToken: string | undefined): boolean {
  const expected = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
  if (!expected) {
    console.warn('[Asaas Webhook] ⚠️ ASAAS_WEBHOOK_TOKEN não configurado — rejeitando por segurança');
    return false;
  }
  const received = (headerToken || '').trim();
  if (received !== expected) {
    console.warn(`[Asaas Webhook] Token mismatch — received len=${received.length} first=${received.slice(0,4)} | expected len=${expected.length} first=${expected.slice(0,4)}`);
    return false;
  }
  return true;
}

/**
 * Busca o pagamento mais recente confirmado vinculado a uma assinatura Asaas.
 * Usado para descobrir o dueDate mais atual e calcular próxima renovação.
 */
export async function getLatestSubscriptionPayment(subscriptionId: string): Promise<any | null> {
  try {
    const data = await asaasRequest('GET', `/subscriptions/${subscriptionId}/payments?limit=12&offset=0`) as any;
    const payments: any[] = data?.data || [];
    const CONFIRMED = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const confirmed = payments
      .filter(p => CONFIRMED.includes(p.status))
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    return confirmed[0] || null;
  } catch {
    return null;
  }
}

/**
 * Busca um pagamento pelo ID.
 */
export async function getPaymentById(paymentId: string): Promise<any | null> {
  try {
    return await asaasRequest('GET', `/payments/${paymentId}`) as any;
  } catch {
    return null;
  }
}
