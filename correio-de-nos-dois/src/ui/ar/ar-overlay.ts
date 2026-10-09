/**
 * Camada de AR sobre o vídeo do leitor: um coração de voxels (pixel art em 3D) flutuando
 * na frente do QR, girando como uma moeda, com o número do envelope em cima.
 *
 * O canvas tem a MESMA resolução do vídeo e o mesmo `object-fit: cover` no CSS, então
 * pixel do detector = pixel do canvas, sem conversão de coordenadas.
 * Carregado sob demanda (divide o three.js com a cena de fundo); se falhar, o leitor segue sem AR.
 */
import * as THREE from 'three'
import { poseFromCorners, type Point } from './pose'

export interface ArFrame {
  readonly corners: readonly Point[]
  readonly width: number
  readonly height: number
}

export interface ArOverlay {
  /** Chame a cada detecção; null quando o QR some. */
  update(frame: ArFrame | null): void
  setLabel(text: string): void
  dispose(): void
}

// coração 7x6 (linha de cima primeiro)
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
const VOXEL = 0.11 // em "lados de QR": o coração fica com ~3/4 da largura do código
const FLOAT = 0.55 // quanto o coração sai do papel em direção à câmera
const LOST_MS = 400 // some se o QR ficar esse tempo sem ser visto

function buildHeart(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL)
  const red = new THREE.MeshLambertMaterial({ color: 0xd9434f })
  const light = new THREE.MeshLambertMaterial({ color: 0xf2788a })
  HEART.forEach((row, r) =>
    [...row].forEach((c, col) => {
      if (c !== 'X') return
      // brilho em cima à esquerda, como nos ícones do app
      const shine = (r === 1 && (col === 1 || col === 2)) || (r === 2 && col === 1)
      const m = new THREE.Mesh(geo, shine ? light : red)
      m.position.set((col - 3) * VOXEL, (r - 2.5) * VOXEL, 0)
      group.add(m)
    }),
  )
  return group
}

function labelSprite(): { sprite: THREE.Sprite; draw: (text: string) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  sprite.scale.set(0.8, 0.4, 1)
  const draw = (text: string) => {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = '600 72px "Pixelify Sans", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 14
    ctx.strokeStyle = '#4e2d22'
    ctx.strokeText(text, 128, 64)
    ctx.fillStyle = '#fff4e0'
    ctx.fillText(text, 128, 64)
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
  spinner.add(buildHeart())
  anchor.add(spinner)

  const label = labelSprite()
  label.sprite.position.set(0, -0.62, -FLOAT)
  anchor.add(label.sprite)

  // pose suavizada: o detector treme alguns pixels e roda a ~15-30 Hz, o desenho a 60 Hz
  const target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  const current = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  const scratch = new THREE.Matrix4()
  const unit = new THREE.Vector3()
  let hasPose = false
  let lastSeen = 0
  let shownAt = 0
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
    scratch.decompose(target.pos, target.quat, unit)
    if (!hasPose) {
      current.pos.copy(target.pos)
      current.quat.copy(target.quat)
      hasPose = true
    }
    const now = performance.now()
    if (!anchor.visible) shownAt = now
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
    anchor.matrix.compose(current.pos, current.quat, unit.set(1, 1, 1))

    const t = clock.getElapsedTime()
    const pop = easeOutBack(Math.min(1, (now - shownAt) / 500))
    spinner.scale.setScalar(pop)
    label.sprite.scale.set(0.8 * pop, 0.4 * pop, 1)
    spinner.rotation.y = t * 2.2 // gira como moeda em torno do eixo "vertical" do papel
    spinner.position.z = -FLOAT - Math.sin(t * 3) * 0.06
    renderer.render(scene, camera)
  }
  loop()

  return {
    update,
    setLabel: (text) => {
      label.draw(text)
      // a fonte pixel pode chegar depois: redesenha quando carregar
      document.fonts?.load('600 72px "Pixelify Sans"').then(() => label.draw(text), () => {})
    },
    dispose() {
      cancelAnimationFrame(raf)
      renderer.dispose()
    },
  }
}
