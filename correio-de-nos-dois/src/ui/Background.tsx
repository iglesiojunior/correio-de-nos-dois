/** Fundo: cena 3D carregada sob demanda. Sem WebGL ou se der erro, fica o gramado em CSS. */
import { useEffect, useRef } from 'react'
import type { Phase, SceneHandle, SceneState } from './scene/scene3d'

interface Props {
  total: number
  today: number
  opened: number[]
  phase: Phase
}

export function Background({ total, today, opened, phase }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<SceneHandle | null>(null)
  const stateRef = useRef<SceneState>({ total, today, opened: new Set(opened), phase })
  const openedKey = opened.join(',')

  useEffect(() => {
    const next: SceneState = { total, today, opened: new Set(openedKey ? openedKey.split(',').map(Number) : []), phase }
    stateRef.current = next
    handleRef.current?.update(next)
  }, [total, today, openedKey, phase])

  useEffect(() => {
    let cancelled = false
    import('./scene/scene3d')
      .then(({ hasWebGL, mountScene }) => {
        if (cancelled || !canvasRef.current || !hasWebGL()) return
        handleRef.current = mountScene(canvasRef.current, stateRef.current)
      })
      .catch((e: unknown) => console.warn('Cena 3D indisponível', e))
    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
    }
  }, [])

  return <canvas ref={canvasRef} className="scene" aria-hidden="true" />
}
