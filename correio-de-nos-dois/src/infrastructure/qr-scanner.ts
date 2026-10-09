/**
 * Leitor de QR pela câmera traseira, usando o BarcodeDetector nativo do Chrome no Android.
 * Se o aparelho não tiver, o app pede para usar a câmera do próprio celular (o link abre o app).
 *
 * Rastreia continuamente: cada quadro devolve o texto e os 4 cantos do QR (para a AR),
 * ou null quando o QR sai de vista.
 */
export interface QrPoint {
  readonly x: number
  readonly y: number
}

export interface QrHit {
  readonly text: string
  /** Cantos em pixels do vídeo, horário a partir do superior esquerdo. Vazio se o aparelho não informar. */
  readonly corners: readonly QrPoint[]
  readonly width: number
  readonly height: number
}

interface DetectedBarcode {
  rawValue: string
  cornerPoints?: QrPoint[]
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike

function detectorCtor(): BarcodeDetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
}

export function canScanInApp(): boolean {
  return !!detectorCtor() && !!navigator.mediaDevices?.getUserMedia
}

/** Liga a câmera no <video> e chama onFrame a cada detecção. Devolve a função de parar. */
export async function startQrTracker(video: HTMLVideoElement, onFrame: (hit: QrHit | null) => void): Promise<() => void> {
  const Ctor = detectorCtor()
  if (!Ctor) throw new Error('Leitor de QR indisponível neste aparelho')
  const detector = new Ctor({ formats: ['qr_code'] })
  const stream = await navigator.mediaDevices.getUserMedia({
    // 720p: cantos mais precisos para a AR sem pesar o detector
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  await video.play()

  let stopped = false
  let raf = 0
  const stop = () => {
    stopped = true
    cancelAnimationFrame(raf)
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }
  // detecções encadeadas: a próxima só começa quando a anterior termina (o ritmo é o do detector)
  const tick = async () => {
    if (stopped) return
    try {
      const code = (await detector.detect(video)).find((c) => c.rawValue)
      if (!stopped) {
        onFrame(
          code
            ? {
                text: code.rawValue,
                corners: code.cornerPoints?.length === 4 ? code.cornerPoints : [],
                width: video.videoWidth,
                height: video.videoHeight,
              }
            : null,
        )
      }
    } catch {
      /* quadro ainda não pronto */
    }
    raf = requestAnimationFrame(tick)
  }
  tick()
  return stop
}
