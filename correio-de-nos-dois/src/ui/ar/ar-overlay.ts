/**
 * Camada de AR sobre o vídeo do leitor: uma figura flutuando na frente do QR, com um texto em cima.
 *
 * - padrão (carta sem figura): coração de voxels;
 * - carta lacrada: cadeado fechado, com a contagem regressiva no texto;
 * - abrindo (decifrando): envelope;
 * - figura da carta: a pixel art que o autor escolheu vira voxels; imagem maior vira um cartão.
 *
 * O canvas tem a MESMA resolução do vídeo e o mesmo `object-fit: cover` no CSS, então
 * pixel do detector = pixel do canvas, sem conversão de coordenadas.
 * Carregado sob demanda (divide o three.js com a cena de fundo); se falhar, o leitor segue sem AR.
 */
import * as THREE from 'three'
import type { ArFigure } from '../../domain'
import { poseFromCorners, type Point } from './pose'

export interface ArFrame {
  readonly corners: readonly Point[]
  readonly width: number
  readonly height: number
}

export type ArShow =
  | { readonly kind: 'heart' }
  | { readonly kind: 'lock' }
  | { readonly kind: 'envelope' }
  | { readonly kind: 'figure'; readonly figure: ArFigure }

export interface ArOverlay {
  /** Chame a cada detecção; null quando o QR some. */
  update(frame: ArFrame | null): void
  show(what: ArShow): void
  setLabel(text: string): void
  dispose(): void
}

// ---------- pixel art embutida (linha de cima primeiro; '.' = vazio) ----------

const PALETTE: Record<string, number> = {
  R: 0xd9434f, // rosa do app
  r: 0xf2788a, // brilho
  G: 0x9aa3ad, // aço da alça
  Y: 0xf2bf4b, // ouro
  y: 0xffe08a,
  D: 0x4e2d22, // contorno/buraco da fechadura
  P: 0xfbe6c8, // papel
  p: 0xc9a27a, // dobra do envelope
}

const BITMAPS = {
  heart: ['.RR.RR.', 'RrrRRRR', 'RrRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  lock: [
    '..GGGGG..',
    '.G.....G.',
    '.G.....G.',
    '.G.....G.',
    'YYYYYYYYY',
    'YyyyyyyyY',
    'YyYDDDYYY', // fechadura: cabeça redonda em cima, rasgo que alarga embaixo
    'YYYDDDYYY',
    'YYYYDYYYY',
    'YYYDDDYYY',
    'YYYYYYYYY',
  ],
  envelope: ['PPPPPPPPP', 'PpPPPPPpP', 'PPpPPPpPP', 'PPPpRpPPP', 'PPPPRPPPP', 'PPPPPPPPP', 'PPPPPPPPP'],
}

function bitmapToRgba(rows: readonly string[]): ArFigure & { kind: 'voxels' } {
  const width = rows[0].length
  const height = rows.length
  const rgba = new Uint8Array(width * height * 4)
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = PALETTE[ch]
      if (c === undefined) return
      rgba.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], (y * width + x) * 4)
    }),
  )
  return { kind: 'voxels', width, height, rgba }
}

// ---------- construção das figuras (no referencial do QR: x direita, y baixo, z para dentro) ----------

const FIGURE_SIZE = 0.8 // maior lado da figura, em "lados de QR"
const FLOAT = 0.55 // quanto a figura sai do papel em direção à câmera
const LOST_MS = 400 // some se o QR ficar esse tempo sem ser visto

function voxelMesh(fig: ArFigure & { kind: 'voxels' }): THREE.Object3D {
  const { width, height, rgba } = fig
  const size = FIGURE_SIZE / Math.max(width, height)
  const solid: number[] = []
  for (let i = 0; i < width * height; i++) if (rgba[i * 4 + 3] >= 128) solid.push(i)
  // InstancedMesh: 1 draw call mesmo com 1024 cubinhos
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshLambertMaterial(), solid.length)
  const m = new THREE.Matrix4()
  const color = new THREE.Color()
  solid.forEach((i, n) => {
    const x = i % width
    const y = Math.floor(i / width)
    m.makeTranslation((x - (width - 1) / 2) * size, (y - (height - 1) / 2) * size, 0)
    mesh.setMatrixAt(n, m)
    mesh.setColorAt(n, color.setRGB(rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255))
  })
  return mesh
}

function cardMesh(fig: ArFigure & { kind: 'card' }): THREE.Object3D {
  const group = new THREE.Group()
  createImageBitmap(new Blob([new Uint8Array(fig.data)], { type: fig.mime }))
    .then((bmp) => {
      // via canvas: CanvasTexture respeita flipY, ImageBitmap não
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      canvas.getContext('2d')!.drawImage(bmp, 0, 0)
      const aspect = bmp.width / bmp.height
      bmp.close()
      const [w, h] = aspect >= 1 ? [FIGURE_SIZE, FIGURE_SIZE / aspect] : [FIGURE_SIZE * aspect, FIGURE_SIZE]
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide }),
      )
      plane.rotation.x = Math.PI // y do papel aponta para baixo: vira para a imagem ficar em pé
      group.add(plane)
    })
    .catch((e: unknown) => console.warn('Imagem do AR inválida', e))
  return group
}

function buildFigure(what: ArShow): { object: THREE.Object3D; motion: 'spin' | 'wobble' } {
  switch (what.kind) {
    case 'heart':
      return { object: voxelMesh(bitmapToRgba(BITMAPS.heart)), motion: 'spin' }
    case 'lock':
      return { object: voxelMesh(bitmapToRgba(BITMAPS.lock)), motion: 'wobble' }
    case 'envelope':
      return { object: voxelMesh(bitmapToRgba(BITMAPS.envelope)), motion: 'spin' }
    case 'figure':
      return what.figure.kind === 'voxels'
        ? { object: voxelMesh(what.figure), motion: 'spin' }
        : { object: cardMesh(what.figure), motion: 'wobble' }
  }
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    mesh.geometry?.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    mats.forEach((m) => {
      ;(m as THREE.MeshBasicMaterial).map?.dispose()
      m.dispose()
    })
  })
}

function labelSprite(): { sprite: THREE.Sprite; draw: (text: string) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  const draw = (text: string) => {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // texto curto ("7") grande; contagem ("2d 04h 13min") encolhe para caber
    let size = 76
    ctx.font = `600 ${size}px "Pixelify Sans", monospace`
    while (size > 30 && ctx.measureText(text).width > canvas.width - 40) {
      size -= 4
      ctx.font = `600 ${size}px "Pixelify Sans", monospace`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 14
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#4e2d22'
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
    ctx.fillStyle = '#fff4e0'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    texture.needsUpdate = true
  }
  return { sprite, draw }
}

const easeOutBack = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2)

export function mountArOverlay(canvas: HTMLCanvasElement): ArOverlay {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100)
  scene.add(new THREE.AmbientLight(0xffffff, 0.65))
  const sun = new THREE.DirectionalLight(0xffffff, 0.7)
  sun.position.set(0.4, 1, 1)
  scene.add(sun)

  // âncora no referencial do QR (x direita, y baixo, z para dentro do papel)
  const anchor = new THREE.Group()
  anchor.matrixAutoUpdate = false
  anchor.visible = false
  scene.add(anchor)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshBasicMaterial({ color: 0x2e1e18, transparent: true, opacity: 0.35, depthWrite: false }),
  )
  shadow.position.z = -0.01
  anchor.add(shadow)

  const spinner = new THREE.Group()
  spinner.position.z = -FLOAT
  anchor.add(spinner)
  let figure: THREE.Object3D | null = null
  let motion: 'spin' | 'wobble' = 'spin'
  let poppedAt = 0

  const label = labelSprite()
  label.sprite.position.set(0, -0.62, -FLOAT)
  anchor.add(label.sprite)

  function show(what: ArShow) {
    if (figure) {
      spinner.remove(figure)
      disposeTree(figure)
    }
    const built = buildFigure(what)
    figure = built.object
    motion = built.motion
    spinner.add(figure)
    poppedAt = performance.now() // cada figura nova entra com o "pop"
  }
  show({ kind: 'heart' })

  // pose suavizada: o detector treme alguns pixels e roda a ~15-30 Hz, o desenho a 60 Hz
  const target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  const current = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  const scratch = new THREE.Matrix4()
  const scale = new THREE.Vector3()
  let hasPose = false
  let lastSeen = 0
  let size = { w: 0, h: 0 }

  function resize(w: number, h: number, f: number) {
    if (w !== size.w || h !== size.h) {
      size = { w, h }
      renderer.setSize(w, h, false) // false: o CSS (object-fit) decide o tamanho na tela
    }
    camera.aspect = w / h
    camera.fov = (2 * Math.atan(h / 2 / f) * 180) / Math.PI
    camera.updateProjectionMatrix()
  }

  function update(frame: ArFrame | null) {
    if (!frame || frame.corners.length !== 4 || !frame.width) return
    const pose = poseFromCorners(frame.corners, frame.width, frame.height)
    if (!pose) return
    resize(frame.width, frame.height, pose.f)
    const { R, t } = pose
    // OpenCV (y baixo, z frente) → three.js (y cima, z para trás): inverte as linhas y e z
    scratch.set(R[0], R[1], R[2], t[0], -R[3], -R[4], -R[5], -t[1], -R[6], -R[7], -R[8], -t[2], 0, 0, 0, 1)
    scratch.decompose(target.pos, target.quat, scale)
    if (!hasPose) {
      current.pos.copy(target.pos)
      current.quat.copy(target.quat)
      hasPose = true
    }
    const now = performance.now()
    if (now - lastSeen > LOST_MS) poppedAt = now // QR voltou à vista: pop de novo
    lastSeen = now
  }

  let raf = 0
  const clock = new THREE.Clock()
  function loop() {
    raf = requestAnimationFrame(loop)
    const now = performance.now()
    anchor.visible = hasPose && now - lastSeen < LOST_MS
    if (!anchor.visible) {
      renderer.clear()
      return
    }
    current.pos.lerp(target.pos, 0.35)
    current.quat.slerp(target.quat, 0.35)
    anchor.matrix.compose(current.pos, current.quat, scale.set(1, 1, 1))

    const t = clock.getElapsedTime()
    const pop = easeOutBack(Math.min(1, (now - poppedAt) / 500))
    spinner.scale.setScalar(pop)
    label.sprite.scale.set(1.6 * pop, 0.4 * pop, 1)
    // gira como moeda; cadeado e cartão só balançam para dar para ler/ver de frente
    spinner.rotation.y = motion === 'spin' ? t * 2.2 : Math.sin(t * 1.6) * 0.45
    spinner.position.z = -FLOAT - Math.sin(t * 3) * 0.06
    renderer.render(scene, camera)
  }
  loop()

  return {
    update,
    show,
    setLabel: (text) => {
      label.draw(text)
      // a fonte pixel pode chegar depois: redesenha quando carregar
      document.fonts?.load('600 72px "Pixelify Sans"').then(() => label.draw(text), () => {})
    },
    dispose() {
      cancelAnimationFrame(raf)
      if (figure) disposeTree(figure)
      renderer.dispose()
    },
  }
}
