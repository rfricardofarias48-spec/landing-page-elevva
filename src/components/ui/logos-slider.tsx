import { InfiniteSlider } from './infinite-slider';
import { ProgressiveBlur } from './progressive-blur';

const logos = [
  {
    id: 'horizonte',
    svg: (
      <svg viewBox="0 0 148 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f97316"/>
            <stop offset="100%" stopColor="#ea580c"/>
          </linearGradient>
        </defs>
        <polygon points="14,4 26,28 2,28" fill="url(#hg)"/>
        <polygon points="14,10 22,28 6,28" fill="white" fillOpacity="0.2"/>
        <text x="33" y="24" fontFamily="'Arial Black',sans-serif" fontSize="13.5" fontWeight="900" fill="#1c1917" letterSpacing="-0.4">Horizonte</text>
        <text x="33" y="34" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#a8a29e" letterSpacing="2">CONSTRUÇÕES</text>
      </svg>
    ),
  },
  {
    id: 'logisbr',
    svg: (
      <svg viewBox="0 0 130 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563eb"/>
            <stop offset="100%" stopColor="#1d4ed8"/>
          </linearGradient>
        </defs>
        <rect x="0" y="6" width="26" height="24" rx="5" fill="url(#lg)"/>
        <path d="M5 18 L14 12 L21 18 L14 24 Z" fill="white" opacity="0.9"/>
        <path d="M14 12 L21 18" stroke="white" strokeWidth="1.5" opacity="0.4"/>
        <text x="33" y="22" fontFamily="'Arial Black',sans-serif" fontSize="15" fontWeight="900" fill="#1e3a8a" letterSpacing="-0.8">LogisBR</text>
        <text x="33" y="32" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#93c5fd" letterSpacing="2.5">LOGÍSTICA</text>
      </svg>
    ),
  },
  {
    id: 'vidamais',
    svg: (
      <svg viewBox="0 0 130 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <circle cx="15" cy="18" r="13" fill="#dcfce7"/>
        <rect x="11" y="11" width="8" height="14" rx="2" fill="#16a34a"/>
        <rect x="8" y="14" width="14" height="8" rx="2" fill="#16a34a"/>
        <text x="34" y="22" fontFamily="'Arial Black',sans-serif" fontSize="14.5" fontWeight="900" fill="#14532d" letterSpacing="-0.5">Vida<tspan fill="#16a34a">+</tspan></text>
        <text x="34" y="32" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#86efac" letterSpacing="2">SAÚDE</text>
      </svg>
    ),
  },
  {
    id: 'techmind',
    svg: (
      <svg viewBox="0 0 130 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#4f46e5"/>
          </linearGradient>
        </defs>
        <rect x="2" y="4" width="26" height="26" rx="8" fill="url(#tg)"/>
        <circle cx="15" cy="14" r="4" fill="white" opacity="0.9"/>
        <path d="M9 24 Q15 18 21 24" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.9"/>
        <text x="34" y="22" fontFamily="'Arial Black',sans-serif" fontSize="14.5" fontWeight="900" fill="#4c1d95" letterSpacing="-0.5">TechMind</text>
        <text x="34" y="32" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#a78bfa" letterSpacing="1.5">SOLUÇÕES</text>
      </svg>
    ),
  },
  {
    id: 'atacadao-sul',
    svg: (
      <svg viewBox="0 0 148 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dc2626"/>
            <stop offset="100%" stopColor="#b91c1c"/>
          </linearGradient>
        </defs>
        <rect x="0" y="4" width="28" height="28" rx="6" fill="url(#ag)"/>
        <text x="5" y="24" fontFamily="'Arial Black',sans-serif" fontSize="17" fontWeight="900" fill="white">A</text>
        <text x="34" y="21" fontFamily="'Arial Black',sans-serif" fontSize="13.5" fontWeight="900" fill="#991b1b" letterSpacing="-0.3">AtacadãoSul</text>
        <text x="34" y="31" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#fca5a5" letterSpacing="1.5">ATACADO E VAREJO</text>
      </svg>
    ),
  },
  {
    id: 'metalmax',
    svg: (
      <svg viewBox="0 0 130 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#334155"/>
            <stop offset="100%" stopColor="#0f172a"/>
          </linearGradient>
        </defs>
        <polygon points="14,2 26,9 26,23 14,30 2,23 2,9" fill="url(#mg)"/>
        <polygon points="14,8 21,12 21,20 14,24 7,20 7,12" fill="none" stroke="#94a3b8" strokeWidth="1.2"/>
        <text x="33" y="22" fontFamily="'Arial Black',sans-serif" fontSize="14.5" fontWeight="900" fill="#0f172a" letterSpacing="-0.5">Metalmax</text>
        <text x="33" y="32" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#64748b" letterSpacing="2">INDÚSTRIA</text>
      </svg>
    ),
  },
  {
    id: 'greenpack',
    svg: (
      <svg viewBox="0 0 130 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="gpg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#059669"/>
            <stop offset="100%" stopColor="#047857"/>
          </linearGradient>
        </defs>
        <rect x="1" y="5" width="26" height="26" rx="13" fill="url(#gpg)"/>
        <path d="M8 18 Q14 8 20 18" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M14 18 L14 26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <text x="33" y="21" fontFamily="'Arial Black',sans-serif" fontSize="14.5" fontWeight="900" fill="#064e3b" letterSpacing="-0.5">GreenPack</text>
        <text x="33" y="31" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#6ee7b7" letterSpacing="1.5">EMBALAGENS</text>
      </svg>
    ),
  },
  {
    id: 'multiserv',
    svg: (
      <svg viewBox="0 0 130 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="msvg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0891b2"/>
            <stop offset="100%" stopColor="#0e7490"/>
          </linearGradient>
        </defs>
        <rect x="1" y="5" width="12" height="12" rx="3" fill="url(#msvg)"/>
        <rect x="15" y="5" width="12" height="12" rx="3" fill="url(#msvg)" fillOpacity="0.6"/>
        <rect x="1" y="19" width="12" height="12" rx="3" fill="url(#msvg)" fillOpacity="0.6"/>
        <rect x="15" y="19" width="12" height="12" rx="3" fill="url(#msvg)" fillOpacity="0.3"/>
        <text x="33" y="21" fontFamily="'Arial Black',sans-serif" fontSize="14" fontWeight="900" fill="#164e63" letterSpacing="-0.5">MultiServ</text>
        <text x="33" y="31" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#67e8f9" letterSpacing="1.5">SERVIÇOS</text>
      </svg>
    ),
  },
  {
    id: 'primecare',
    svg: (
      <svg viewBox="0 0 128 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="pcg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#db2777"/>
            <stop offset="100%" stopColor="#be185d"/>
          </linearGradient>
        </defs>
        <path d="M14 6 C14 6 2 10 2 18 C2 24 8 30 14 30 C20 30 26 24 26 18 C26 10 14 6 14 6Z" fill="url(#pcg)"/>
        <path d="M14 12 C14 12 8 15 8 19 C8 22 11 25 14 25 C17 25 20 22 20 19 C20 15 14 12 14 12Z" fill="white" fillOpacity="0.25"/>
        <text x="32" y="21" fontFamily="'Arial Black',sans-serif" fontSize="14" fontWeight="900" fill="#831843" letterSpacing="-0.5">PrimeCare</text>
        <text x="32" y="31" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#f9a8d4" letterSpacing="1.5">HOSPITALAR</text>
      </svg>
    ),
  },
  {
    id: 'sullog',
    svg: (
      <svg viewBox="0 0 118 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
        <defs>
          <linearGradient id="slg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d97706"/>
            <stop offset="100%" stopColor="#b45309"/>
          </linearGradient>
        </defs>
        <rect x="0" y="5" width="28" height="26" rx="5" fill="url(#slg)"/>
        <path d="M6 20 L13 13 L20 20 L13 27 Z" fill="white" opacity="0.9"/>
        <text x="34" y="21" fontFamily="'Arial Black',sans-serif" fontSize="14.5" fontWeight="900" fill="#78350f" letterSpacing="-0.5">SulLog</text>
        <text x="34" y="31" fontFamily="sans-serif" fontSize="7.5" fontWeight="600" fill="#fcd34d" letterSpacing="2">TRANSPORTE</text>
      </svg>
    ),
  },
];

export function LogosSlider() {
  return (
    <div className="relative h-[80px] w-full overflow-hidden">
      <InfiniteSlider
        className="flex h-full w-full items-center"
        duration={40}
        gap={72}
        durationOnHover={100}
      >
        {logos.map((logo) => (
          <div
            key={logo.id}
            className="flex items-center justify-center opacity-60 hover:opacity-100 transition-all duration-400 grayscale hover:grayscale-0"
          >
            {logo.svg}
          </div>
        ))}
      </InfiniteSlider>

      <ProgressiveBlur
        className="pointer-events-none absolute top-0 left-0 h-full w-[160px]"
        direction="left"
        blurIntensity={0.8}
      />
      <ProgressiveBlur
        className="pointer-events-none absolute top-0 right-0 h-full w-[160px]"
        direction="right"
        blurIntensity={0.8}
      />
    </div>
  );
}
