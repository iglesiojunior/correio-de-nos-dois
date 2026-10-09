import type { Trip } from '../domain'

/**
 * Calendário real da viagem: 25 envelopes, um por dia, de 14/10 a 07/11/2026,
 * abrindo às 08:00 de Teresina. O envelope 0 é o de teste, entregue no sábado 10/10.
 *
 * As datas NÃO vão no QR: só o número do envelope. Dá para ajustar as datas aqui
 * até a carta daquele envelope ser lacrada (a fechadura usa a data do momento do lacre).
 */
export const TRIP: Trip = {
  firstDay: '2026-10-14',
  envelopeCount: 25,
  openingTime: '08:00',
  utcOffset: '-03:00',
  testEnvelopeOpensAt: '2026-10-10T00:00:00-03:00',
}

/** Endereço público do app. Vai impresso em TODOS os QR: não muda depois de imprimir. */
export const PUBLIC_ORIGIN = 'https://correio-de-nos-dois.vercel.app'

/** Assinatura no fim de cada carta. */
export const SIGNATURE = 'com amor, Iglésio'

/**
 * Seu WhatsApp para as respostas rápidas dela, só números com DDI e DDD (ex.: '5586999999999').
 * Vazio: os botões de resposta não aparecem.
 */
export const WHATSAPP_NUMBER = ''

/**
 * Chave pública VAPID das notificações push (gerada por `npm run push:keys`). Pública de propósito:
 * o navegador dela usa para aceitar só pushes assinados pela chave privada, que fica na Vercel.
 * Vazio: o convite de notificações não aparece.
 */
export const PUSH_PUBLIC_KEY = 'BDBXTUmSN6373pB137zJoX5isoPRg-lpMtqaxdqggfVSB_JgEfuINkhFEEHCpb1Eq48NdF1JLPqXPJ50AliDOig'
