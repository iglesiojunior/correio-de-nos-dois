/**
 * Painel admin (só no `npm run dev`): escrever, anexar foto e lacrar as cartas.
 * Rascunhos ficam em secrets/cartas/, cartas lacradas em public/letters/.
 */
import { useCallback, useEffect, useState } from 'react'
import { SIGNATURE } from '../config/trip'
import { adminApi, arPreviewUrl, compressPhoto, imageToArFigure, type EnvelopeStatus } from './api'

type Phase = 'vazia' | 'rascunho' | 'lacrada' | 'alterada'

function phaseOf(e: EnvelopeStatus): Phase {
  if (e.sealed && e.draftChangedAt !== null && e.draftChangedAt > e.sealed.at) return 'alterada'
  if (e.sealed) return 'lacrada'
  return e.hasText ? 'rascunho' : 'vazia'
}

const PHASE_LABEL: Record<Phase, string> = {
  vazia: 'vazia',
  rascunho: 'rascunho',
  lacrada: 'lacrada',
  alterada: 'mudou após lacrar',
}

// Teresina usa o mesmo fuso de Fortaleza (UTC-3, sem horário de verão)
const fmtDate = (iso: string | number) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/** Fora do componente: o lint do React Compiler não aceita Date.now() no corpo dele. */
const hasPassed = (iso: string) => new Date(iso).getTime() <= Date.now()

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`

export function Admin() {
  const [envelopes, setEnvelopes] = useState<EnvelopeStatus[]>([])
  const [selected, setSelected] = useState(0)
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'erro'; text: string } | null>(null)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [arVersion, setArVersion] = useState(0)
  const [arPreview, setArPreview] = useState<{ url: string; label: string } | null>(null)

  const current = envelopes.find((e) => e.id === selected)
  const dirty = text !== savedText

  const updateOne = (status: EnvelopeStatus) =>
    setEnvelopes((list) => list.map((e) => (e.id === status.id ? status : e)))

  const run = useCallback(async (label: string, task: () => Promise<string | void>) => {
    setBusy(label)
    setMessage(null)
    try {
      const ok = await task()
      if (ok) setMessage({ kind: 'ok', text: ok })
    } catch (e) {
      setMessage({ kind: 'erro', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    adminApi
      .envelopes()
      .then(setEnvelopes)
      .catch((e: Error) => setMessage({ kind: 'erro', text: e.message }))
  }, [])

  useEffect(() => {
    let alive = true
    adminApi
      .draft(selected)
      .then(({ text }) => {
        if (!alive) return
        setText(text)
        setSavedText(text)
      })
      .catch((e: Error) => setMessage({ kind: 'erro', text: e.message }))
    return () => {
      alive = false
    }
  }, [selected])

  // pré-visualização da figura de AR do envelope selecionado
  useEffect(() => {
    let alive = true
    let url: string | null = null
    adminApi
      .ar(selected)
      .then((fig) => {
        if (!alive) return
        url = fig && arPreviewUrl(fig)
        setArPreview(
          fig && url
            ? { url, label: fig.kind === 'voxels' ? `pixel art ${fig.width}x${fig.height} → voxels` : `cartão (${kb(fig.data.length)})` }
            : null,
        )
      })
      .catch((e: Error) => setMessage({ kind: 'erro', text: e.message }))
    return () => {
      alive = false
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [selected, arVersion])

  // não perder o texto ao fechar a aba sem salvar
  useEffect(() => {
    if (!dirty) return
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const select = (id: number) => {
    if (dirty && !confirm('O texto atual não foi salvo. Trocar de envelope mesmo assim?')) return
    setMessage(null)
    setSelected(id)
  }

  const save = async () => {
    updateOne(await adminApi.saveDraft(selected, text))
    setSavedText(text)
  }

  const onSave = () => run('Salvando', async () => {
    await save()
    return 'Rascunho salvo.'
  })

  const onSeal = () => {
    if (!current) return
    if (!text.trim()) return setMessage({ kind: 'erro', text: 'Escreva a carta antes de lacrar.' })
    if (hasPassed(current.opensAt) && !confirm('A data deste envelope já passou: a carta vai abrir assim que for publicada. Lacrar?')) return
    run('Lacrando (falando com a drand)', async () => {
      if (dirty) await save()
      updateOne(await adminApi.seal(selected))
      return `Envelope ${selected} lacrado. Falta publicar: commit + push de public/letters/.`
    })
  }

  const onPhoto = (file: File | undefined) => {
    if (!file) return
    run('Comprimindo a foto', async () => {
      const blob = await compressPhoto(file)
      updateOne(await adminApi.savePhoto(selected, blob))
      setPhotoVersion((v) => v + 1)
      return `Foto salva (${kb(blob.size)}).`
    })
  }

  const onRemovePhoto = () =>
    run('Removendo a foto', async () => {
      updateOne(await adminApi.deletePhoto(selected))
      return 'Foto removida.'
    })

  const onAr = (file: File | undefined) => {
    if (!file) return
    run('Preparando a figura', async () => {
      const fig = await imageToArFigure(file)
      updateOne(await adminApi.saveAr(selected, fig))
      setArVersion((v) => v + 1)
      return fig.kind === 'voxels'
        ? `Figura salva: ${fig.width}x${fig.height} cubinhos.`
        : `Imagem grande: vai aparecer como cartão (${kb(fig.data.length)}).`
    })
  }

  const onRemoveAr = () =>
    run('Removendo a figura', async () => {
      updateOne(await adminApi.deleteAr(selected))
      setArVersion((v) => v + 1)
      return 'Figura removida: vai aparecer o coração.'
    })

  const counts = envelopes.reduce<Record<Phase, number>>(
    (acc, e) => ({ ...acc, [phaseOf(e)]: acc[phaseOf(e)] + 1 }),
    { vazia: 0, rascunho: 0, lacrada: 0, alterada: 0 },
  )

  return (
    <div className="adm">
      <header className="adm-top">
        <h1>Correio · admin</h1>
        <p>
          {counts.lacrada} lacradas · {counts.rascunho} rascunhos · {counts.alterada} para relacrar · {counts.vazia} vazias
        </p>
      </header>

      <div className="adm-body">
        <nav className="adm-list" aria-label="Envelopes">
          {envelopes.map((e) => {
            const phase = phaseOf(e)
            return (
              <button
                key={e.id}
                className={`adm-env ${e.id === selected ? 'is-sel' : ''}`}
                onClick={() => select(e.id)}
              >
                <span className="adm-num">{e.id === 0 ? 'T' : e.id}</span>
                <span className="adm-date">{fmtDate(e.opensAt)}</span>
                <span className={`adm-tag tag-${phase}`}>{PHASE_LABEL[phase]}</span>
              </button>
            )
          })}
        </nav>

        {current && (
          <main className="adm-editor">
            <div className="adm-head">
              <h2>{selected === 0 ? 'Envelope 0 (teste)' : `Envelope ${selected}`}</h2>
              <span>abre {fmtDate(current.opensAt)}</span>
            </div>

            {phaseOf(current) === 'alterada' && (
              <p className="adm-warn">Você mudou o rascunho depois de lacrar. Lacre de novo para a versão nova valer.</p>
            )}

            <textarea
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              placeholder="Escreva a carta aqui…"
              spellCheck
            />
            <div className="adm-meta">
              <span>{text.trim().length} caracteres{dirty ? ' · não salvo' : ''}</span>
              <span>assinatura automática: “{SIGNATURE}”</span>
            </div>

            <section className="adm-photo">
              {current.photoBytes !== null ? (
                <>
                  <img src={adminApi.photoUrl(selected, photoVersion)} alt="Foto da carta" />
                  <div>
                    <p>Foto anexada ({kb(current.photoBytes)})</p>
                    <button onClick={onRemovePhoto} disabled={!!busy}>Remover foto</button>
                  </div>
                </>
              ) : (
                <label className="adm-file">
                  + anexar foto (é comprimida para até 600 KB)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(ev) => {
                      onPhoto(ev.target.files?.[0])
                      ev.target.value = ''
                    }}
                    disabled={!!busy}
                  />
                </label>
              )}
            </section>

            <section className="adm-ar">
              <p className="adm-ar-title">Figura em AR (aparece sobre o QR quando a carta abre)</p>
              <div className="adm-photo">
                {arPreview ? (
                  <img className="adm-ar-img" src={arPreview.url} alt="Figura de AR" />
                ) : (
                  <span className="adm-ar-default" aria-hidden="true">♥</span>
                )}
                <div>
                  <p>{arPreview ? arPreview.label : 'Sem figura: aparece o coração padrão.'}</p>
                  <label className="adm-file adm-file-inline">
                    {arPreview ? 'trocar' : '+ escolher imagem'}
                    <input
                      type="file"
                      accept="image/png,image/gif,image/webp,image/jpeg"
                      onChange={(ev) => {
                        onAr(ev.target.files?.[0])
                        ev.target.value = ''
                      }}
                      disabled={!!busy}
                    />
                  </label>
                  {arPreview && (
                    <button onClick={onRemoveAr} disabled={!!busy}>
                      Remover
                    </button>
                  )}
                  <p className="adm-hint">PNG até 32x32 com fundo transparente vira 3D de cubinhos. Maior que isso vira um cartão.</p>
                </div>
              </div>
            </section>

            <div className="adm-actions">
              <button onClick={onSave} disabled={!!busy || !dirty}>Salvar rascunho</button>
              <button className="adm-primary" onClick={onSeal} disabled={!!busy}>
                {current.sealed ? 'Lacrar de novo' : 'Lacrar'}
              </button>
            </div>

            {busy && <p className="adm-msg">{busy}…</p>}
            {message && <p className={`adm-msg msg-${message.kind}`}>{message.text}</p>}

            {current.sealed && (
              <p className="adm-sealed">
                Lacrada em {fmtDate(current.sealed.at)} · rodada drand {current.sealed.round}
              </p>
            )}
          </main>
        )}
      </div>

      <footer className="adm-foot">
        Para publicar o que foi lacrado: <code>git add public/letters &amp;&amp; git commit -m "cartas" &amp;&amp; git push</code>
      </footer>
    </div>
  )
}
