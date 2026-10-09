import { describe, expect, it } from 'vitest'
import { QR_MODEL, focalFromFov, homography, poseFromCorners, project, type Pose } from './pose'

const W = 1280
const H = 720

/** Rotação a partir de ângulos (rad) em x, depois y, depois z. */
function rotation(ax: number, ay: number, az: number): number[] {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)]
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx]
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1]
  const mul = (a: number[], b: number[]) =>
    Array.from({ length: 9 }, (_, i) => {
      const r = Math.floor(i / 3)
      const c = i % 3
      return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
    })
  return mul(Rz, mul(Ry, Rx))
}

function synthetic(ax: number, ay: number, az: number, t: [number, number, number]): Pose {
  return { R: rotation(ax, ay, az), t, f: focalFromFov(W) }
}

describe('homography', () => {
  it('leva os 4 pontos de origem nos de destino', () => {
    const dst = [
      { x: 10, y: 20 },
      { x: 300, y: 40 },
      { x: 280, y: 330 },
      { x: 30, y: 290 },
    ]
    const h = homography(QR_MODEL, dst)!
    QR_MODEL.forEach((p, i) => {
      const w = h[6] * p.x + h[7] * p.y + h[8]
      expect((h[0] * p.x + h[1] * p.y + h[2]) / w).toBeCloseTo(dst[i].x, 6)
      expect((h[3] * p.x + h[4] * p.y + h[5]) / w).toBeCloseTo(dst[i].y, 6)
    })
  })

  it('recusa pontos degenerados', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i, y: i }))
    expect(homography(QR_MODEL, line)).toBeNull()
  })
})

describe('poseFromCorners', () => {
  const cases: [string, Pose][] = [
    ['de frente', synthetic(0, 0, 0, [0, 0, 4])],
    ['inclinado na mesa', synthetic(-0.9, 0.2, 0.4, [0.3, -0.2, 5])],
    ['girado e de lado', synthetic(0.5, -0.6, 2.5, [-0.8, 0.5, 6])],
  ]

  it.each(cases)('recupera a pose (%s)', (_, truth) => {
    const corners = QR_MODEL.map((p) => project(truth, [p.x, p.y, 0], W, H))
    const pose = poseFromCorners(corners, W, H, truth.f)!
    pose.R.forEach((v, i) => expect(v).toBeCloseTo(truth.R[i], 5))
    pose.t.forEach((v, i) => expect(v).toBeCloseTo(truth.t[i], 5))
    // e um ponto FORA do papel (a figura flutuando) cai no mesmo pixel
    const above: [number, number, number] = [0.1, -0.2, -0.8]
    expect(project(pose, above, W, H).x).toBeCloseTo(project(truth, above, W, H).x, 3)
    expect(project(pose, above, W, H).y).toBeCloseTo(project(truth, above, W, H).y, 3)
  })

  it('rotação sai ortonormal mesmo com cantos ruidosos', () => {
    const truth = synthetic(-0.7, 0.3, 0.2, [0, 0, 5])
    const corners = QR_MODEL.map((p, i) => {
      const q = project(truth, [p.x, p.y, 0], W, H)
      return { x: q.x + [1.5, -2, 0.8, -1][i], y: q.y + [-1, 2, 1.2, -0.5][i] }
    })
    const { R, t } = poseFromCorners(corners, W, H, truth.f)!
    const col = (c: number) => [R[c], R[3 + c], R[6 + c]]
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    for (let a = 0; a < 3; a++) {
      expect(dot(col(a), col(a))).toBeCloseTo(1, 6)
      for (let b = a + 1; b < 3; b++) expect(dot(col(a), col(b))).toBeCloseTo(0, 6)
    }
    expect(t[2]).toBeGreaterThan(0)
  })
})
