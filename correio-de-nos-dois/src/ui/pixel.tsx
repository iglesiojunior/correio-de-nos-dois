/** Ícones em pixel art (desenhos originais) desenhados como SVG nítido. */
import type { CSSProperties, ReactElement } from 'react'
import { ICONS, PAL, type IconName } from './pixel-data'

export function Px({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  const map = ICONS[name]
  const w = Math.max(...map.map((r) => r.length))
  const rects: ReactElement[] = []
  map.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (PAL[c]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={PAL[c]} />)
    }),
  )
  return (
    <svg className={`px ${className ?? ''}`} style={style} viewBox={`0 0 ${w} ${map.length}`} aria-hidden="true">
      {rects}
    </svg>
  )
}
