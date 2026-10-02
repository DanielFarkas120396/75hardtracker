interface JourneySignProps {
  x: number
  y: number
  name: string
}

/** A wooden roadside sign naming the world that begins here. */
export function JourneySign({ x, y, name }: JourneySignProps) {
  const width = Math.max(64, name.length * 7.2 + 18)
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} aria-hidden="true">
      <rect x={-3} y={-26} width={6} height={26} fill="#5b3a1e" />
      <rect x={-width / 2} y={-48} width={width} height={24} rx={5} fill="#b07a47" stroke="#5b3a1e" strokeWidth={2.5} />
      <text y={-36} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="#2b1a0b">
        {name}
      </text>
    </g>
  )
}
