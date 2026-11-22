// Animated nature backdrop: sky, sun, drifting clouds, rolling hills, birds and falling leaves.
const seg = 'C150 110 300 110 450 170 S750 250 900 170 S1100 120 1200 190'
const Hills = ({ cls, y, h }) => (
  <svg className={'hills ' + cls} viewBox="0 0 2400 300" preserveAspectRatio="none" style={{ height: h }} aria-hidden="true">
    <g transform={`translate(0 ${y})`}>
      <path d={`M0 190 ${seg} L1200 300 L0 300 Z`} />
      <path d={`M0 190 ${seg} L1200 300 L0 300 Z`} transform="translate(1200 0)" />
    </g>
  </svg>
)
const Cloud = ({ top, size, dur, delay }) => (
  <svg className="cloud" viewBox="0 0 120 50" style={{ top, width: size, animationDuration: dur + 's', animationDelay: delay + 's' }} aria-hidden="true">
    <ellipse cx="35" cy="32" rx="26" ry="14" /><ellipse cx="62" cy="24" rx="24" ry="17" /><ellipse cx="88" cy="33" rx="24" ry="13" />
  </svg>
)
const Bird = ({ top, dur, delay }) => (
  <svg className="bird" viewBox="0 0 30 12" style={{ top, animationDuration: dur + 's', animationDelay: delay + 's' }} aria-hidden="true">
    <path d="M1 8 Q8 0 15 7 Q22 0 29 8" fill="none" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const leaves = [8, 22, 37, 51, 66, 80, 93]

export default function Scene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="sun" />
      <Cloud top="8%" size="180px" dur={110} delay={-30} />
      <Cloud top="20%" size="120px" dur={150} delay={-90} />
      <Cloud top="4%" size="90px" dur={190} delay={-140} />
      <Bird top="14%" dur={46} delay={-10} />
      <Bird top="26%" dur={62} delay={-35} />
      <Hills cls="far" y={0} h="46vh" />
      <Hills cls="mid" y={30} h="38vh" />
      <Hills cls="near" y={60} h="30vh" />
      {leaves.map((x, i) => <i key={x} className="leaf" style={{ left: x + '%', animationDuration: 14 + (i % 4) * 4 + 's', animationDelay: -i * 3 + 's' }} />)}
    </div>
  )
}
