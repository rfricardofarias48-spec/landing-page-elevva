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
  ESSENCIAL:  64990,  // R$ 649,90
  PRO:        99990,  // R$ 999,90
  ENTERPRISE: 0,      // A consultar — gerado manualmente
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
 * Cria uma subconta (conta filha) no Asaas para um vendedor.
 * O vendedor não precisa ter conta no Asaas — a subconta é criada programaticamente.
 * Retorna o walletId que será usado no split dos pagamentos.
 */
export async function createSubaccount(params: {
  name: string;
  email: string;
  cpfCnpj: string;       // CPF ou CNPJ do vendedor (obrigatório pelo Asaas)
  phone?: string;
  mobilePhone?: string;
  companyType?: string;  // MEI | LIMITED | INDIVIDUAL | ASSOCIATION
}): Promise<AsaasSubaccount> {
  const data = await asaasRequest('POST', '/accounts', {
    name: params.name,
    email: params.email,
    cpfCnpj: params.cpfCnpj.replace(/\D/g, ''),
    phone: params.phone,
    mobilePhone: params.mobilePhone || params.phone,
    companyType: params.companyType || 'MEI',
  }) as any;

  if (!data?.walletId) {
    throw new Error(`Falha ao criar subconta Asaas: ${JSON.stringify(data)}`);
  }

  return {
    walletId: data.walletId,
    customerId: data.id,
  };
}

/**
 * Gera um link de pagamento com split automático para o vendedor.
 * O Asaas divide o valor automaticamente:
 *   - Conta principal (Elevva): (100 - commissionPct)%
 *   - Carteira do vendedor: commissionPct%
 */
export async function generatePaymentLink(params: {
  clientName: string;
  clientEmail: string;
  plan: string;
  amount: number;           // em reais (ex: 649.90)
  commissionPct: number;    // percentual (ex: 15)
  walletId: string;         // ID da carteira do vendedor no Asaas
  salespersonName: string;
  saleId: string;           // ID interno da venda para rastreamento
}): Promise<AsaasPaymentLink> {
  const { clientName, plan, amount, commissionPct, walletId, salespersonName, saleId } = params;

  // Calcular percentual da Elevva (o Asaas paga o split para o walletId especificado)
  const elevvaPercent = parseFloat((100 - commissionPct).toFixed(2));

  const data = await asaasRequest('POST', '/paymentLinks', {
    name: `Elevva ${plan} — ${clientName}`,
    description: `Plano ${plan} Elevva — vendido por ${salespersonName}`,
    value: amount,
    billingType: 'UNDEFINED',   // Aceita PIX, cartão, boleto
    chargeType: 'DETACHED',     // Cobrança avulsa (não recorrente)
    isAddNewPaymentEnabled: false,
    maxInstallmentCount: 1,
    // Split: a Elevva fica com elevvaPercent%, o vendedor com commissionPct%
    split: [
      {
        walletId: walletId,
        percentualValue: commissionPct,
      },
    ],
    // Metadata para rastreamento no webhook
    externalReference: saleId,
  }) as any;

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
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || '';
  if (!expected) return true;
  return headerToken === expected;
}
