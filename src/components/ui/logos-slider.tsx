import { InfiniteSlider } from './infinite-slider';
import { ProgressiveBlur } from './progressive-blur';

// Logos fictícios — SVG inline para evitar dependência de imagens externas
const logos = [
  {
    id: 'rh-group',
    label: 'RH Group',
    svg: (
      <svg viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <rect x="0" y="6" width="20" height="20" rx="5" fill="#0f172a"/>
        <text x="6" y="21" fontFamily="sans-serif" fontSize="13" fontWeight="800" fill="white">R</text>
        <text x="28" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#0f172a" letterSpacing="-0.5">RH Group</text>
      </svg>
    ),
  },
  {
    id: 'talentus',
    label: 'Talentus',
    svg: (
      <svg viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <circle cx="14" cy="16" r="10" fill="#65a30d"/>
        <text x="8" y="20" fontFamily="sans-serif" fontSize="13" fontWeight="900" fill="white">T</text>
        <text x="30" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#0f172a" letterSpacing="-0.3">Talentus</text>
      </svg>
    ),
  },
  {
    id: 'nexthire',
    label: 'NextHire',
    svg: (
      <svg viewBox="0 0 115 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <polygon points="14,4 26,16 14,28 2,16" fill="#1e293b"/>
        <text x="32" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#1e293b" letterSpacing="-0.4">NextHire</text>
      </svg>
    ),
  },
  {
    id: 'recrutech',
    label: 'RecruTech',
    svg: (
      <svg viewBox="0 0 125 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <rect x="0" y="4" width="24" height="24" rx="4" fill="none" stroke="#0f172a" strokeWidth="2.5"/>
        <text x="4" y="21" fontFamily="sans-serif" fontSize="12" fontWeight="900" fill="#0f172a">RT</text>
        <text x="30" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#0f172a" letterSpacing="-0.3">RecruTech</text>
      </svg>
    ),
  },
  {
    id: 'staffpro',
    label: 'StaffPro',
    svg: (
      <svg viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <path d="M4 16 Q14 4 24 16 Q14 28 4 16Z" fill="#65a30d"/>
        <text x="30" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#0f172a" letterSpacing="-0.3">StaffPro</text>
      </svg>
    ),
  },
  {
    id: 'humanflow',
    label: 'HumanFlow',
    svg: (
      <svg viewBox="0 0 125 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <circle cx="8" cy="16" r="6" fill="#334155"/>
        <circle cx="18" cy="16" r="6" fill="#334155" fillOpacity="0.4"/>
        <text x="30" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#334155" letterSpacing="-0.3">HumanFlow</text>
      </svg>
    ),
  },
  {
    id: 'vagaagil',
    label: 'Vaga Ágil',
    svg: (
      <svg viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <path d="M12 4L22 16L12 28L2 16Z" fill="none" stroke="#65a30d" strokeWidth="2.5" strokeLinejoin="round"/>
        <path d="M12 4L22 16L12 28L2 16Z" fill="#65a30d" fillOpacity="0.12"/>
        <text x="28" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#0f172a" letterSpacing="-0.3">Vaga Ágil</text>
      </svg>
    ),
  },
  {
    id: 'peoplehub',
    label: 'PeopleHub',
    svg: (
      <svg viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-auto">
        <rect x="0" y="8" width="16" height="16" rx="8" fill="#0ea5e9"/>
        <rect x="6" y="4" width="16" height="16" rx="8" fill="#0ea5e9" fillOpacity="0.35"/>
        <text x="26" y="22" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#0f172a" letterSpacing="-0.3">PeopleHub</text>
      </svg>
    ),
  },
];

export function LogosSlider() {
  return (
    <div className="relative h-[72px] w-full overflow-hidden">
      <InfiniteSlider
        className="flex h-full w-full items-center"
        duration={35}
        gap={64}
        durationOnHover={80}
      >
        {logos.map((logo) => (
          <div
            key={logo.id}
            className="flex w-36 items-center justify-center opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300"
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
