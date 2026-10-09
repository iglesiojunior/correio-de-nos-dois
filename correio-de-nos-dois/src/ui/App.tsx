/**
 * App dela: "Hoje" (qual envelope abrir e o leitor de QR) e "Envelopes" (grade para reler).
 * Toda regra vem do domínio e dos casos de uso; aqui só tem tela.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Container } from '../app/container'
import {
  DomainError,
  TooEarlyError,
  currentEnvelope,
  envelopeIds,
  opensAt,
  type EnvelopeId,
  type LetterContent,
} from '../domain'
import { OPEN_PATH, canScanInApp, parseEnvelopeLink, startQrScanner } from '../infrastructure'
import { Background } from './Background'
import { useInstall } from './install'
import { usePush } from './push'
import { phaseOf } from './phase'
import { Px } from './pixel'
import { VINE_TILE } from './pixel-data'

type Sheet =
  | null
  | { kind: 'scanner' }
  | { kind: 'opening'; id: EnvelopeId; paperKey: Uint8Array }
  | { kind: 'letter'; id: EnvelopeId; content: LetterContent }
  | { kind: 'early'; id: EnvelopeId; when: Date }
  | { kind: 'error'; title: string; text: string }

type Tab = 'hoje' | 'envelopes'

const fmtDay = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const fmtLong = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace('-feira', '')
const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}min`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min ${s % 60}s`
}

function errorSheet(e: unknown, id: EnvelopeId): Sheet {
  if (e instanceof TooEarlyError) return { kind: 'early', id, when: e.opensAt ?? new Date() }
  if (e instanceof DomainError) {
    if (e.name === 'EmptyEnvelopeError')
      return { kind: 'error', title: 'Essa carta ainda está sendo escrita', text: `O envelope ${id} ainda não chegou ao correio. Tente de novo mais tarde.` }
    if (e.name === 'WrongPaperKeyError')
      return { kind: 'error', title: 'Esse código não combina', text: 'O QR não é deste envelope. Confira o número na etiqueta.' }
    return { kind: 'error', title: 'Não deu para abrir', text: e.message }
  }
  console.error(e)
  return { kind: 'error', title: 'Sem conexão?', text: 'Não consegui falar com o correio agora. Confira a internet e tente de novo.' }
}

/** Lê o link do QR (quando ela abre pela câmera do celular) e tira a chave da barra de endereço. */
function sheetFromUrl(store: Container['store']): Sheet {
  if (!location.pathname.endsWith(OPEN_PATH) || !location.hash) return null
  try {
    const link = parseEnvelopeLink(location.hash)
    store.rememberKey(link.envelopeId, link.paperKey)
    history.replaceState(null, '', '/')
    return { kind: 'opening', id: link.envelopeId, paperKey: link.paperKey }
  } catch {
    history.replaceState(null, '', '/')
    return { kind: 'error', title: 'Código estranho', text: 'Esse QR não parece ser de um envelope do nosso correio.' }
  }
}

export function App({ container }: { container: Container }) {
  const { trip, clock, store, openEnvelope } = container
  const [now, setNow] = useState(() => clock.now())
  const [records, setRecords] = useState(() => store.all())
  const [tab, setTab] = useState<Tab>('hoje')
  const [sheet, setSheet] = useState<Sheet>(() => sheetFromUrl(store))

  useEffect(() => {
    const t = window.setInterval(() => setNow(clock.now()), 1000)
    return () => window.clearInterval(t)
  }, [clock])

  // abrir um envelope (vindo do QR, do leitor ou da grade)
  const opening = sheet?.kind === 'opening' ? sheet : null
  useEffect(() => {
    if (!opening) return
    let cancelled = false
    openEnvelope(opening.id, opening.paperKey)
      .then((content) => {
        if (cancelled) return
        store.markOpened(opening.id, clock.now())
        setRecords(store.all())
        setSheet({ kind: 'letter', id: opening.id, content })
      })
      .catch((e: unknown) => {
        if (!cancelled) setSheet(errorSheet(e, opening.id))
      })
    return () => {
      cancelled = true
    }
  }, [opening, openEnvelope, store, clock])

  const ids = useMemo(() => envelopeIds(trip), [trip])
  const todayId = currentEnvelope(trip, now)
  const testDone = !!records.get(0)?.openedAt
  const featured: EnvelopeId = todayId ?? (testDone ? 1 : 0)
  const featuredOpen = opensAt(trip, featured)
  const featuredDone = !!records.get(featured)?.openedAt
  const featuredLocked = now < featuredOpen

  const openedIds = [...records].filter(([, r]) => r.openedAt).map(([id]) => id)

  function openById(id: EnvelopeId) {
    const when = opensAt(trip, id)
    if (clock.now() < when) return setSheet({ kind: 'early', id, when })
    const rec = records.get(id)
    if (!rec) {
      return setSheet({
        kind: 'error',
        title: `Envelope ${id}`,
        text: 'Escaneia o código colado nele para abrir. Depois disso, ele fica guardado aqui para reler.',
      })
    }
    setSheet({ kind: 'opening', id, paperKey: rec.paperKey })
  }

  const banner =
    todayId === null
      ? (() => {
          const d = Math.max(1, Math.ceil((opensAt(trip, 1).getTime() - now.getTime()) / 86400000))
          return d === 1 ? 'a viagem começa amanhã' : `faltam ${d} dias`
        })()
      : now >= opensAt(trip, trip.envelopeCount)
        ? 'último envelope ♥ até já'
        : `dia ${todayId} de ${trip.envelopeCount}`

  return (
    <>
      <Background total={trip.envelopeCount} today={featured} opened={openedIds} phase={phaseOf(now)} />
      <div className="wrap">
        <header className="logo">
          <h1>
            Correio
            <br />
            de Nós Dois
          </h1>
          <span className="banner">
            <Px name="cal" />
            {banner}
          </span>
        </header>

        <div className="frame" style={{ backgroundImage: VINE_TILE }}>
          <Px name="corner" className="corner tl" />
          <Px name="corner" className="corner tr" />
          <Px name="corner" className="corner bl" />
          <Px name="corner" className="corner br" />
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={tab === 'hoje'} onClick={() => setTab('hoje')}>
              <Px name="envOpen" />
              Hoje
            </button>
            <button className="tab" role="tab" aria-selected={tab === 'envelopes'} onClick={() => setTab('envelopes')}>
              <Px name="env" />
              Envelopes
            </button>
          </div>

          <div className="inner">
            {tab === 'hoje' && (
              <>
                <section className="today">
                  <div className={`big-env ${featuredDone ? 'done' : ''}`}>
                    <Px name="envBig" />
                    <b>{featured}</b>
                  </div>
                  {featured === 0 && !testDone && (
                    <>
                      <h2>Comece pelo envelope 0</h2>
                      <p className="soft">É o de teste. Abre já, para ver como tudo funciona antes da viagem.</p>
                    </>
                  )}
                  {featured !== 0 && featuredLocked && (
                    <>
                      <h2>O envelope {featured} abre {fmtLong(featuredOpen)}, às {fmtTime(featuredOpen)}</h2>
                      <p className="countdown">faltam {countdown(featuredOpen.getTime() - now.getTime())}</p>
                    </>
                  )}
                  {featured !== 0 && !featuredLocked && !featuredDone && (
                    <>
                      <h2>Hoje é o envelope {featured}</h2>
                      <p className="soft">Pega ele na sua mala, abre com carinho e escaneia o código colado nele.</p>
                    </>
                  )}
                  {featuredDone && (
                    <>
                      <h2>Envelope {featured} aberto ♥</h2>
                      <p className="soft">
                        {featured < trip.envelopeCount
                          ? `O ${featured + 1} abre ${fmtLong(opensAt(trip, featured + 1))}, às ${fmtTime(opensAt(trip, featured + 1))}.`
                          : 'Esse era o último. Agora falta pouco para a gente se ver.'}
                      </p>
                      <button className="btn wood-b" onClick={() => openById(featured)}>
                        <Px name="envOpen" />
                        Reler a carta
                      </button>
                    </>
                  )}
                  {canScanInApp() ? (
                    <button className="btn" onClick={() => setSheet({ kind: 'scanner' })}>
                      <Px name="camera" />
                      Escanear envelope
                    </button>
                  ) : (
                    <p className="parch msg">
                      <Px name="camera" />
                      Aponte a câmera do celular para o código do envelope e toque no link que aparecer.
                    </p>
                  )}
                </section>
                <section>
                  <p className="steps-title">Como funciona</p>
                  <ol className="steps">
                    <li><span className="n">1</span><span>Cada envelope da sua mala tem um número e um código colado.</span></li>
                    <li><span className="n">2</span><span>Todo dia às 08:00 um envelope novo é liberado. Os outros esperam o dia deles.</span></li>
                    <li><span className="n">3</span><span>Você escaneia o código e a carta aparece aqui. Depois dá para reler quando quiser.</span></li>
                  </ol>
                </section>
                <PushCard />
                <InstallCard />
              </>
            )}

            {tab === 'envelopes' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p>Toque num envelope que você já abriu para reler a carta.</p>
                <div className="grid">
                  {ids.map((id) => {
                    const when = opensAt(trip, id)
                    const done = !!records.get(id)?.openedAt
                    const locked = now < when
                    const isToday = id === featured && !done && !locked
                    const cls = done ? 'opened' : isToday ? 'today' : locked ? 'later' : ''
                    return (
                      <button key={id} className={`cell ${cls}`} onClick={() => openById(id)} aria-label={`Envelope ${id}, ${fmtDay(when)}`}>
                        <Px name={done ? 'envOpen' : 'env'} />
                        <b>{id}</b>
                        <small>{id === 0 ? 'teste' : fmtDay(when)}</small>
                        {done && <span className="st"><Px name="check" /></span>}
                        {locked && <span className="st"><Px name="lock" /></span>}
                      </button>
                    )
                  })}
                </div>
                <div className="legend">
                  <span><i style={{ background: '#e4f2d4' }} />já aberto</span>
                  <span><i style={{ background: 'var(--gold)' }} />de hoje</span>
                  <span><i style={{ background: 'var(--parch-hi)' }} />ainda não é o dia</span>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {sheet && <SheetView sheet={sheet} container={container} onClose={() => setSheet(null)} onSheet={setSheet} />}
    </>
  )
}

function SheetView({
  sheet,
  container,
  onClose,
  onSheet,
}: {
  sheet: Exclude<Sheet, null>
  container: Container
  onClose: () => void
  onSheet: (s: Sheet) => void
}) {
  const title =
    sheet.kind === 'scanner' ? 'Escanear envelope'
      : sheet.kind === 'error' ? sheet.title
        : `Envelope ${sheet.id}`
  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && sheet.kind !== 'opening' && onClose()}>
      <div className="box" role="dialog" aria-label={title}>
        <div className="sheet-h">
          <b>{title}</b>
          <button className="x" onClick={onClose} aria-label="Fechar">
            <Px name="x" />
          </button>
        </div>
        {sheet.kind === 'scanner' && <Scanner container={container} onSheet={onSheet} />}
        {sheet.kind === 'opening' && (
          <div className="loading">
            <Px name="env" />
            <span>Abrindo o envelope…</span>
          </div>
        )}
        {sheet.kind === 'letter' && <Letter id={sheet.id} content={sheet.content} container={container} />}
        {sheet.kind === 'early' && (
          <div className="parch msg">
            <Px name="hourglass" />
            <div>
              <b>Calma, ainda não é o dia!</b>
              <p className="soft">
                O envelope {sheet.id} abre {fmtLong(sheet.when)}, às {fmtTime(sheet.when)}. Guarda ele de volta na mala.
              </p>
            </div>
          </div>
        )}
        {sheet.kind === 'error' && (
          <div className="parch msg">
            <Px name="pen" />
            <p>{sheet.text}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Convite para ligar o aviso das 08:00. Some onde push não existe (ex.: dev sem service worker). */
function PushCard() {
  const { state, enable } = usePush()
  if (state === 'checking' || state === 'unsupported') return null
  return (
    <section className="parch install">
      <p className="steps-title">Aviso de carta nova</p>
      {(state === 'off' || state === 'busy' || state === 'error') && (
        <>
          <p className="soft">Quer que o celular avise às 08:00, quando o envelope do dia liberar?</p>
          <button className="btn" onClick={() => void enable()} disabled={state === 'busy'}>
            <Px name="bell" />
            {state === 'busy' ? 'Ligando…' : 'Me avisar às 08:00'}
          </button>
          {state === 'error' && <p className="soft">Não deu certo agora. Confira a internet e tente de novo.</p>}
        </>
      )}
      {state === 'on' && (
        <p className="soft">
          <Px name="check" /> Avisos ligados: às 08:00 de cada dia de envelope.
        </p>
      )}
      {state === 'denied' && (
        <p className="soft">
          As notificações estão bloqueadas. No Chrome, toque no cadeado ao lado do endereço, depois em
          <b> Permissões → Notificações</b>, e libere.
        </p>
      )}
      {state === 'needs-install' && (
        <p className="soft">No iPhone, os avisos só funcionam com o app instalado na tela inicial (veja abaixo).</p>
      )}
    </section>
  )
}

/** Convite para pôr o app na tela inicial. Some quando já está instalado. */
function InstallCard() {
  const state = useInstall()
  if (state.kind === 'installed') return null
  return (
    <section className="parch install">
      <p className="steps-title">Deixe na tela inicial</p>
      {state.kind === 'prompt' && (
        <>
          <p className="soft">Instale o Correio como um app: abre direto, em tela cheia, sem procurar o link.</p>
          <button className="btn" onClick={() => void state.install()}>
            <Px name="envOpen" />
            Instalar o app
          </button>
        </>
      )}
      {state.kind === 'ios' && (
        <p className="soft">No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
      )}
      {state.kind === 'manual' && (
        <p className="soft">
          No Chrome, toque no menu <b>⋮</b> e depois em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
        </p>
      )}
    </section>
  )
}

function Scanner({ container, onSheet }: { container: Container; onSheet: (s: Sheet) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    if (!videoRef.current) return
    startQrScanner(videoRef.current, (text) => {
      try {
        const link = parseEnvelopeLink(text)
        container.store.rememberKey(link.envelopeId, link.paperKey)
        onSheet({ kind: 'opening', id: link.envelopeId, paperKey: link.paperKey })
      } catch {
        onSheet({ kind: 'error', title: 'Código estranho', text: 'Esse QR não parece ser de um envelope do nosso correio.' })
      }
    })
      .then((s) => {
        if (cancelled) s()
        else stop = s
      })
      .catch(() => setProblem('Não consegui usar a câmera. Permita o acesso ou use a câmera do celular apontando para o código.'))
    return () => {
      cancelled = true
      stop?.()
    }
  }, [container, onSheet])

  return (
    <>
      <div className="viewfinder">
        <video ref={videoRef} muted playsInline />
      </div>
      <p className="soft" style={{ textAlign: 'center' }}>
        {problem ?? 'Aponte para o código colado no envelope.'}
      </p>
    </>
  )
}

function Letter({ id, content, container }: { id: EnvelopeId; content: LetterContent; container: Container }) {
  const photoUrl = useMemo(
    () =>
      content.photo
        ? URL.createObjectURL(new Blob([new Uint8Array(content.photo.data)], { type: content.photo.mime }))
        : null,
    [content.photo],
  )
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    },
    [photoUrl],
  )

  const replies: [string, 'heart' | 'chat' | 'bell'][] = [
    [`Abri o envelope ${id} ♥`, 'heart'],
    ['Que saudade de você', 'chat'],
    ['Me liga quando puder?', 'bell'],
  ]
  return (
    <>
      <div className="letter">
        <div className="meta">
          <span>envelope {id}</span>
          <span>{id === 0 ? 'teste' : fmtDay(opensAt(container.trip, id))}</span>
        </div>
        <div className="body">{content.text}</div>
        {photoUrl && (
          <div className="photo">
            <img src={photoUrl} alt="Foto da carta" />
          </div>
        )}
        <div className="sign">{container.signature}</div>
      </div>
      {container.whatsapp && (
        <>
          <p className="soft">Responder pelo WhatsApp:</p>
          <div className="replies">
            {replies.map(([text, icon]) => (
              <a
                key={text}
                className="small-btn"
                href={`https://wa.me/${container.whatsapp}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Px name={icon} />
                {text}
              </a>
            ))}
          </div>
        </>
      )}
    </>
  )
}
