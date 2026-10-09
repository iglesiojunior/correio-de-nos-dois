/** Erros do domínio. A UI decide como mostrar cada um. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** A fechadura do tempo ainda não abriu. */
export class TooEarlyError extends DomainError {
  readonly opensAt?: Date
  constructor(opensAt?: Date) {
    super(opensAt ? `Só abre em ${opensAt.toISOString()}` : 'Ainda não é a hora')
    this.opensAt = opensAt
  }
}

/** O envelope existe, mas a carta ainda não foi lacrada e publicada. */
export class EmptyEnvelopeError extends DomainError {
  readonly envelopeId: number
  constructor(envelopeId: number) {
    super(`O envelope ${envelopeId} ainda não tem carta`)
    this.envelopeId = envelopeId
  }
}

/** O número não pertence à viagem. */
export class UnknownEnvelopeError extends DomainError {
  readonly envelopeId: number
  constructor(envelopeId: number) {
    super(`O envelope ${envelopeId} não existe`)
    this.envelopeId = envelopeId
  }
}

/** A chave do papel não abre esta carta (QR de outro envelope ou adulterado). */
export class WrongPaperKeyError extends DomainError {
  constructor() {
    super('A chave do papel não corresponde a esta carta')
  }
}

/** Formato de carta lacrada ou de QR que esta versão do app não conhece. */
export class UnsupportedFormatError extends DomainError {
  constructor(what: string) {
    super(`Formato não suportado: ${what}`)
  }
}
