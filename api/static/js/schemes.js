// FINAT Standard Roll Winding Direction Schemes (1 to 8)
const FINAT_SCHEMES_DATA = [
  {
    id: 1,
    name: "Схема №1",
    short: "Головою вперед (Назовні)",
    rotation: 0,
    wound: "out",
    lead: "top",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <!-- Tape moving right -->
      <path d="M 40 10 L 75 10" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <!-- Arrow -->
      <polygon points="75,6 80,10 75,14" fill="#3b82f6"/>
      <!-- Label on tape -->
      <rect x="44" y="2" width="22" height="16" rx="2" fill="#3b82f6" fill-opacity="0.3" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="14" font-size="9" fill="#93c5fd" font-weight="bold" text-anchor="middle">A</text>
    </svg>`
  },
  {
    id: 2,
    name: "Схема №2",
    short: "Ногами вперед (Назовні)",
    rotation: 180,
    wound: "out",
    lead: "bottom",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <!-- Tape moving right -->
      <path d="M 40 10 L 75 10" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,6 80,10 75,14" fill="#3b82f6"/>
      <!-- Label on tape upside down -->
      <rect x="44" y="2" width="22" height="16" rx="2" fill="#3b82f6" fill-opacity="0.3" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="14" font-size="9" fill="#93c5fd" font-weight="bold" text-anchor="middle" transform="rotate(180 55 10)">A</text>
    </svg>`
  },
  {
    id: 3,
    name: "Схема №3",
    short: "Правим боком (Назовні)",
    rotation: 90,
    wound: "out",
    lead: "right",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <!-- Tape moving right -->
      <path d="M 40 10 L 75 10" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,6 80,10 75,14" fill="#3b82f6"/>
      <!-- Label on tape rotated 90 -->
      <rect x="44" y="2" width="22" height="16" rx="2" fill="#3b82f6" fill-opacity="0.3" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="13" font-size="9" fill="#93c5fd" font-weight="bold" text-anchor="middle" transform="rotate(90 55 10)">A</text>
    </svg>`
  },
  {
    id: 4,
    name: "Схема №4",
    short: "Лівим боком (Назовні)",
    rotation: 270,
    wound: "out",
    lead: "left",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <!-- Tape moving right -->
      <path d="M 40 10 L 75 10" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,6 80,10 75,14" fill="#3b82f6"/>
      <!-- Label on tape rotated 270 -->
      <rect x="44" y="2" width="22" height="16" rx="2" fill="#3b82f6" fill-opacity="0.3" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="13" font-size="9" fill="#93c5fd" font-weight="bold" text-anchor="middle" transform="rotate(270 55 10)">A</text>
    </svg>`
  },
  {
    id: 5,
    name: "Схема №5",
    short: "Головою вперед (Всередину)",
    rotation: 0,
    wound: "in",
    lead: "top",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#475569" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <!-- Tape unwinding from bottom/inside -->
      <path d="M 40 70 L 75 70" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,66 80,70 75,74" fill="#10b981"/>
      <rect x="44" y="62" width="22" height="16" rx="2" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
      <text x="55" y="74" font-size="9" fill="#a7f3d0" font-weight="bold" text-anchor="middle">A</text>
    </svg>`
  },
  {
    id: 6,
    name: "Схема №6",
    short: "Ногами вперед (Всередину)",
    rotation: 180,
    wound: "in",
    lead: "bottom",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#475569" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <path d="M 40 70 L 75 70" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,66 80,70 75,74" fill="#10b981"/>
      <rect x="44" y="62" width="22" height="16" rx="2" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
      <text x="55" y="74" font-size="9" fill="#a7f3d0" font-weight="bold" text-anchor="middle" transform="rotate(180 55 70)">A</text>
    </svg>`
  },
  {
    id: 7,
    name: "Схема №7",
    short: "Правим боком (Всередину)",
    rotation: 90,
    wound: "in",
    lead: "right",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#475569" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <path d="M 40 70 L 75 70" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,66 80,70 75,74" fill="#10b981"/>
      <rect x="44" y="62" width="22" height="16" rx="2" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
      <text x="55" y="73" font-size="9" fill="#a7f3d0" font-weight="bold" text-anchor="middle" transform="rotate(90 55 70)">A</text>
    </svg>`
  },
  {
    id: 8,
    name: "Схема №8",
    short: "Лівим боком (Всередину)",
    rotation: 270,
    wound: "in",
    lead: "left",
    iconSvg: `<svg viewBox="0 0 80 80" class="w-12 h-12">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#475569" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="40" cy="40" r="14" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <path d="M 40 70 L 75 70" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
      <polygon points="75,66 80,70 75,74" fill="#10b981"/>
      <rect x="44" y="62" width="22" height="16" rx="2" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
      <text x="55" y="73" font-size="9" fill="#a7f3d0" font-weight="bold" text-anchor="middle" transform="rotate(270 55 70)">A</text>
    </svg>`
  }
];
