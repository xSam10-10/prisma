import type { Profile } from '../core/profiles';

// Avatares ilustrados dos perfis (SVG, sem imagens externas): fundo em degradê
// na cor do perfil e um desenho em branco translúcido.

const ART: ((id: string) => React.ReactNode)[] = [
  // 0 · prisma (três "plays")
  () => (
    <g>
      <polygon points="24,30 24,74 60,52" fill="#fff" opacity="0.95" />
      <polygon points="36,30 36,74 72,52" fill="#fff" opacity="0.55" />
      <polygon points="48,30 48,74 84,52" fill="#fff" opacity="0.3" />
    </g>
  ),
  // 1 · lua e estrelas
  () => (
    <g fill="#fff">
      <path d="M62 24a26 26 0 1 0 14 46A22 22 0 0 1 62 24z" opacity="0.95" />
      <circle cx="30" cy="30" r="2.5" opacity="0.8" />
      <circle cx="24" cy="54" r="1.8" opacity="0.6" />
      <circle cx="42" cy="18" r="1.6" opacity="0.6" />
    </g>
  ),
  // 2 · montanhas
  () => (
    <g fill="#fff">
      <circle cx="70" cy="30" r="8" opacity="0.85" />
      <polygon points="8,82 38,40 58,66 68,54 92,82" opacity="0.9" />
      <polygon points="38,40 46,51 30,51" fill="#000" opacity="0.15" />
    </g>
  ),
  // 3 · ondas
  () => (
    <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round">
      <path d="M14 40c12-10 24 10 36 0s24 10 36 0" opacity="0.95" />
      <path d="M14 56c12-10 24 10 36 0s24 10 36 0" opacity="0.65" />
      <path d="M14 72c12-10 24 10 36 0s24 10 36 0" opacity="0.35" />
    </g>
  ),
  // 4 · planeta com órbita
  () => (
    <g>
      <circle cx="50" cy="50" r="18" fill="#fff" opacity="0.95" />
      <ellipse cx="50" cy="52" rx="36" ry="10" fill="none" stroke="#fff" strokeWidth="4" opacity="0.6" transform="rotate(-18 50 52)" />
      <circle cx="80" cy="26" r="3" fill="#fff" opacity="0.7" />
    </g>
  ),
  // 5 · raio
  () => <polygon points="56,12 26,56 46,56 40,88 74,40 54,40" fill="#fff" opacity="0.95" />,
  // 6 · rosto sorrindo
  () => (
    <g>
      <circle cx="36" cy="42" r="6" fill="#fff" />
      <circle cx="64" cy="42" r="6" fill="#fff" />
      <path d="M30 62c10 12 30 12 40 0" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  // 7 · claquete
  () => (
    <g fill="#fff">
      <rect x="20" y="42" width="60" height="36" rx="5" opacity="0.95" />
      <polygon points="20,30 76,20 80,34 24,44" opacity="0.7" />
      <polygon points="34,27 42,26 38,39 30,40" fill="#000" opacity="0.2" />
      <polygon points="52,24 60,23 56,36 48,37" fill="#000" opacity="0.2" />
    </g>
  ),
];

export const AVATAR_COUNT = ART.length;

function avatarIndex(p: Profile): number {
  if (typeof p.avatar === 'number') return ((p.avatar % ART.length) + ART.length) % ART.length;
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  return Math.abs(h) % ART.length;
}

export function ProfileAvatar({ profile, size }: { profile: Profile; size: number }) {
  const gid = 'av-' + profile.id;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={profile.color} />
          <stop offset="1" stopColor="#0B0B12" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id={gid + 'g'} cx="0.25" cy="0.15" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={profile.color} />
      <rect width="100" height="100" rx="24" fill={`url(#${gid})`} />
      <rect width="100" height="100" rx="24" fill={`url(#${gid}g)`} />
      {ART[avatarIndex(profile)](profile.id)}
    </svg>
  );
}
