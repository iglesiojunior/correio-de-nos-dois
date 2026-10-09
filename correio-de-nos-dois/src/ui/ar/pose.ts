/**
 * Pose da câmera a partir dos 4 cantos do QR (os "fiduciais" que já estão impressos).
 *
 * 1. Homografia H (DLT com 4 pontos) entre o quadrado do QR no papel e a imagem normalizada.
 * 2. Com câmera calibrada, H ~ [r1 r2 t] (Zhang): as duas primeiras colunas da rotação e a translação.
 *
 * Convenção OpenCV: câmera em x→direita, y→baixo, z→frente. O QR tem lado 1, centro na origem,
 * x para a direita e y para baixo no papel; z = x × y aponta para DENTRO do papel.
 *
 * Não temos a calibração do celular: assumimos o ponto principal no centro e um FOV horizontal
 * típico de câmera traseira. Erro no FOV só muda a profundidade aparente, a figura continua presa ao QR.
 */
export interface Point {
  readonly x: number
  readonly y: number
}

export interface Pose {
  /** Rotação 3x3, linha a linha. */
  readonly R: readonly number[]
  /** Translação em "lados de QR". */
  readonly t: readonly [number, number, number]
  /** Distância focal em pixels usada no cálculo. */
  readonly f: number
}

/** Cantos do QR no próprio papel, na ordem do BarcodeDetector: horário a partir do superior esquerdo. */
export const QR_MODEL: readonly Point[] = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
]

export const DEFAULT_HFOV_DEG = 65

/**
 * Focal em pixels a partir do FOV do lado MAIOR do quadro. Com o celular em pé o vídeo chega
 * girado (ex.: 720x1280) e o FOV de catálogo das câmeras é o do lado maior do sensor.
 */
export function focalFromFov(width: number, height = width, hfovDeg = DEFAULT_HFOV_DEG): number {
  return Math.max(width, height) / 2 / Math.tan(((hfovDeg * Math.PI) / 180) / 2)
}

/** Resolve A·x = b (8x8) por eliminação gaussiana com pivotamento parcial. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const k = M[r][c] / M[c][c]
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/** Homografia 3x3 (linha a linha, h33 = 1) que leva src[i] em dst[i]. */
export function homography(src: readonly Point[], dst: readonly Point[]): number[] | null {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solve(A, b)
  return h ? [...h, 1] : null
}

const norm = (v: number[]) => Math.hypot(v[0], v[1], v[2])
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Pose do QR em relação à câmera, a partir dos cantos em pixels de uma imagem width x height.
 * Devolve null para quadriláteros degenerados (QR de lado, cantos colineares).
 */
export function poseFromCorners(
  corners: readonly Point[],
  width: number,
  height: number,
  f = focalFromFov(width, height),
): Pose | null {
  if (corners.length !== 4) return null
  const cx = width / 2
  const cy = height / 2
  const normalized = corners.map((p) => ({ x: (p.x - cx) / f, y: (p.y - cy) / f }))
  const H = homography(QR_MODEL, normalized)
  if (!H) return null

  const h1 = [H[0], H[3], H[6]]
  const h2 = [H[1], H[4], H[7]]
  const h3 = [H[2], H[5], H[8]]
  let s = 2 / (norm(h1) + norm(h2))
  if (!Number.isFinite(s)) return null
  if (h3[2] * s < 0) s = -s // o QR está na frente da câmera: t.z > 0

  // H tem ruído, então r1 e r2 não saem ortonormais: Gram-Schmidt e r3 = r1 × r2
  const r1 = h1.map((v) => v * s)
  const r1n = r1.map((v) => v / norm(r1))
  const r2raw = h2.map((v) => v * s)
  const d = r1n[0] * r2raw[0] + r1n[1] * r2raw[1] + r1n[2] * r2raw[2]
  const r2o = r2raw.map((v, i) => v - d * r1n[i])
  const r2n = r2o.map((v) => v / norm(r2o))
  const r3 = cross(r1n, r2n)
  const t = h3.map((v) => v * s) as [number, number, number]

  return {
    R: [r1n[0], r2n[0], r3[0], r1n[1], r2n[1], r3[1], r1n[2], r2n[2], r3[2]],
    t,
    f,
  }
}

/** Projeta um ponto 3D do referencial do QR para pixels (útil para testes e depuração). */
export function project(pose: Pose, X: readonly [number, number, number], width: number, height: number): Point {
  const { R, t, f } = pose
  const x = R[0] * X[0] + R[1] * X[1] + R[2] * X[2] + t[0]
  const y = R[3] * X[0] + R[4] * X[1] + R[5] * X[2] + t[1]
  const z = R[6] * X[0] + R[7] * X[1] + R[8] * X[2] + t[2]
  return { x: (f * x) / z + width / 2, y: (f * y) / z + height / 2 }
}
