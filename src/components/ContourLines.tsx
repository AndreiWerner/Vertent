// Linhas de contorno topográfico - o mesmo tipo de curva de nível que
// aparece em levantamentos de terreno. É o elemento assinatura do
// painel: usado com moderação (fundo do login e cabeçalho da sidebar),
// nunca como decoração espalhada pela interface.
export function ContourLines({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1">
        <path
          d="M40 260 C 90 200, 160 320, 220 250 S 340 180, 370 240"
          opacity="0.5"
        />
        <path
          d="M20 220 C 80 160, 150 280, 210 210 S 330 140, 380 200"
          opacity="0.4"
        />
        <path
          d="M0 180 C 70 120, 140 240, 200 170 S 320 100, 400 160"
          opacity="0.3"
        />
        <path
          d="M10 300 C 90 260, 170 360, 240 300 S 350 250, 390 290"
          opacity="0.25"
        />
        <path
          d="M-10 140 C 60 90, 130 200, 190 130 S 310 70, 400 120"
          opacity="0.18"
        />
      </g>
    </svg>
  );
}
