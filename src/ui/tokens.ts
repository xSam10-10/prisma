// Cores do tema em JS (para estilos inline). A TV LG de 2017 (Chromium 38)
// não entende variáveis CSS (var(--x)); o tema escolhido troca este objeto
// (ver src/ui/themes.ts).
export const T: { bg: string; text: string; text2: string; primary: string; live: string; warn: string; radiusPanel: number; ambient: [string, string, string] } = {
  bg: '#0B0B12',
  text: '#F4F4F8',
  text2: '#A6A6B8',
  primary: '#3DD6C4',
  live: '#FF6B3D',
  warn: '#F5B83D',
  radiusPanel: 28,
  ambient: ['#7A2E9C', '#3DD6C4', '#FF6B3D'],
};
