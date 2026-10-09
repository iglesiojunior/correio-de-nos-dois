/**
 * Leitor de QR pela câmera traseira, usando o BarcodeDetector nativo do Chrome no Android.
 * Se o aparelho não tiver, o app pede para usar a câmera do próprio celular (o link abre o app).
 */
interface DetectedBarcode {
  rawValue: string
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

/** Liga a câmera no <video> e chama onCode com o texto do primeiro QR lido. Devolve a função de parar. */
export async function startQrScanner(video: HTMLVideoElement, onCode: (text: string) => void): Promise<() => void> {
  const Ctor = detectorCtor()
  if (!Ctor) throw new Error('Leitor de QR indisponível neste aparelho')
  const detector = new Ctor({ formats: ['qr_code'] })
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  await video.play()

  let stopped = false
  let timer = 0
  const stop = () => {
    stopped = true
    window.clearTimeout(timer)
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }
  const tick = async () => {
    if (stopped) return
    try {
      const codes = await detector.detect(video)
      if (codes[0]?.rawValue) {
        stop()
        onCode(codes[0].rawValue)
        return
      }
    } catch {
      /* quadro ainda não pronto */
    }
    timer = window.setTimeout(tick, 200)
  }
  tick()
  return stop
}
