import React from 'react';
import { Sparkles } from 'lucide-react';

export interface RoulettePrizeItem {
  id: string;
  label: string;
  type: 'discount' | 'item' | 'try_again';
  value: number;
  probability: number;
  productId?: string;
}

interface RouletteWheelProps {
  prizes: RoulettePrizeItem[];
  rotation: number;
  isSpinning: boolean;
  onSpinClick?: () => void;
  disabled?: boolean;
}

const SLICE_PALETTE = [
  { bg: '#F59E0B', bgEnd: '#D97706', text: '#FFFFFF' }, // Amber
  { bg: '#2563EB', bgEnd: '#1D4ED8', text: '#FFFFFF' }, // Royal Blue
  { bg: '#10B981', bgEnd: '#059669', text: '#FFFFFF' }, // Emerald
  { bg: '#EC4899', bgEnd: '#DB2777', text: '#FFFFFF' }, // Pink
  { bg: '#7C3AED', bgEnd: '#6D28D9', text: '#FFFFFF' }, // Violet
  { bg: '#EF4444', bgEnd: '#DC2626', text: '#FFFFFF' }, // Red
  { bg: '#0D9488', bgEnd: '#0F766E', text: '#FFFFFF' }, // Teal
  { bg: '#EA580C', bgEnd: '#C2410C', text: '#FFFFFF' }, // Orange
];

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function createSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  prizes,
  rotation,
  isSpinning,
  onSpinClick,
  disabled = false,
}) => {
  const safePrizes: RoulettePrizeItem[] =
    prizes && prizes.length > 0
      ? prizes
      : [
          { id: '1', label: '5% de Desconto', type: 'discount', value: 5, probability: 30 },
          { id: '2', label: '10% de Desconto', type: 'discount', value: 10, probability: 10 },
          { id: '3', label: 'Tente Novamente', type: 'try_again', value: 0, probability: 50 },
          { id: '4', label: 'Brinde Especial!', type: 'try_again', value: 0, probability: 10 },
        ];

  const count = safePrizes.length;
  const sliceAngle = 360 / count;
  const studCount = Math.max(12, count * 2);

  return (
    <div className="relative w-[290px] h-[290px] sm:w-[310px] sm:h-[310px] mx-auto my-2 flex items-center justify-center select-none">
      {/* Glow de fundo sutil */}
      <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-amber-500/25 via-orange-500/15 to-yellow-400/25 blur-xl pointer-events-none" />

      {/* Ponteiro Superior 3D Moderno */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-40 pointer-events-none filter drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)]">
        <svg width="38" height="44" viewBox="0 0 38 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M19 42L4 14C2.5 11 4.6 7 8 7H30C33.4 7 35.5 11 34 14L19 42Z"
            fill="url(#pointerGrad)"
            stroke="#FFFBEB"
            strokeWidth="2.5"
          />
          <circle cx="19" cy="14" r="4.5" fill="#FFFBEB" />
          <defs>
            <linearGradient id="pointerGrad" x1="19" y1="5" x2="19" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F59E0B" />
              <stop offset="0.5" stopColor="#EA580C" />
              <stop offset="1" stopColor="#B45309" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Aro Externo (Bezel Escuro com Pinos Iluminados) */}
      <div className="w-full h-full rounded-full p-[12px] bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 shadow-[0_16px_40px_rgba(15,23,42,0.35),inset_0_2px_4px_rgba(255,255,255,0.2)] border-[3px] border-amber-400/90 relative flex items-center justify-center">
        {/* Pinos decorativos no aro */}
        {Array.from({ length: studCount }).map((_, i) => {
          const deg = (i * 360) / studCount;
          const isEven = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                transform: `rotate(${deg}deg) translateY(-139px)`,
              }}
              className="absolute top-1/2 left-1/2 -mt-1 -ml-1 w-2 h-2 rounded-full pointer-events-none sm:hidden"
            >
              <div
                className={`w-full h-full rounded-full ${
                  isEven
                    ? 'bg-amber-300 shadow-[0_0_6px_#FCD34D]'
                    : 'bg-white/90 shadow-[0_0_4px_#FFFFFF]'
                } ${isSpinning ? 'animate-pulse' : ''}`}
              />
            </div>
          );
        })}
        {Array.from({ length: studCount }).map((_, i) => {
          const deg = (i * 360) / studCount;
          const isEven = i % 2 === 0;
          return (
            <div
              key={`sm-${i}`}
              style={{
                transform: `rotate(${deg}deg) translateY(-149px)`,
              }}
              className="hidden sm:block absolute top-1/2 left-1/2 -mt-1 -ml-1 w-2 h-2 rounded-full pointer-events-none"
            >
              <div
                className={`w-full h-full rounded-full ${
                  isEven
                    ? 'bg-amber-300 shadow-[0_0_6px_#FCD34D]'
                    : 'bg-white/90 shadow-[0_0_4px_#FFFFFF]'
                } ${isSpinning ? 'animate-pulse' : ''}`}
              />
            </div>
          );
        })}

        {/* Disco Giratório da Roleta */}
        <div
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? 'transform 5000ms cubic-bezier(0.12, 0.82, 0.12, 1)'
              : 'none',
          }}
          className="w-full h-full rounded-full relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.35)] ring-2 ring-amber-300/80"
        >
          {/* Fatias em SVG com gradientes e divisórias nítidas */}
          <svg
            viewBox="0 0 300 300"
            className="w-full h-full block"
          >
            <defs>
              {safePrizes.map((p, idx) => {
                const palette = SLICE_PALETTE[idx % SLICE_PALETTE.length];
                const midAngle = idx * sliceAngle + sliceAngle / 2;
                const outerPt = polarToCartesian(150, 150, 150, midAngle);
                return (
                  <linearGradient
                    key={`grad-${p.id}-${idx}`}
                    id={`sliceGrad-${idx}`}
                    x1="150"
                    y1="150"
                    x2={outerPt.x}
                    y2={outerPt.y}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={palette.bgEnd} />
                    <stop offset="100%" stopColor={palette.bg} />
                  </linearGradient>
                );
              })}
            </defs>

            {safePrizes.map((p, idx) => {
              const startAngle = idx * sliceAngle;
              const endAngle = (idx + 1) * sliceAngle;
              const d = createSlicePath(150, 150, 150, startAngle, endAngle);
              return (
                <path
                  key={`slice-${p.id}-${idx}`}
                  d={d}
                  fill={`url(#sliceGrad-${idx})`}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1.75"
                />
              );
            })}

            {/* Anel interno de acabamento */}
            <circle
              cx="150"
              cy="150"
              r="146"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="3"
            />
          </svg>

          {/* Rótulos Radiais com Quebra de Linha Automática (até 3 linhas) */}
          {safePrizes.map((p, idx) => {
            const midAngle = idx * sliceAngle + sliceAngle / 2;
            const isLeftHalf = midAngle > 180 && midAngle < 360;
            // Ajusta tamanho da fonte dinamicamente conforme tamanho do texto e quantidade de fatias
            const labelLength = (p.label || '').length;
            const fontSize =
              count >= 9
                ? '9.5px'
                : labelLength > 22
                ? '10px'
                : labelLength > 14
                ? '11px'
                : '12px';

            return (
              <div
                key={`label-${p.id}-${idx}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '132px',
                  height: '48px',
                  marginTop: '-24px',
                  transformOrigin: '0% 50%',
                  transform: `rotate(${midAngle - 90}deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingLeft: '36px',
                  paddingRight: '10px',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    transform: isLeftHalf ? 'rotate(180deg)' : 'none',
                    fontSize,
                    lineHeight: '1.15',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textShadow: '0 1px 3px rgba(0,0,0,0.65), 0 0 1px rgba(0,0,0,0.85)',
                    textAlign: isLeftHalf ? 'left' : 'right',
                    width: '100%',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    whiteSpace: 'normal',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Botão / Pino Central 3D */}
        <button
          type="button"
          disabled={disabled || isSpinning}
          onClick={onSpinClick}
          title="Girar Roleta"
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-orange-600 p-1 shadow-[0_6px_16px_rgba(0,0,0,0.45)] z-30 flex items-center justify-center transition-transform active:scale-95 hover:scale-105 disabled:hover:scale-100 cursor-pointer"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-white via-amber-50 to-amber-100 border-2 border-amber-400 flex items-center justify-center shadow-inner">
            <Sparkles size={18} className={`text-amber-600 ${isSpinning ? 'animate-spin' : ''}`} />
          </div>
        </button>
      </div>
    </div>
  );
};

export default RouletteWheel;
