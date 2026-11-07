// Cores do tema em JS (para estilos inline). A TV LG de 2017 (Chromium 38)
// não entende variáveis CSS (var(--x)), então os valores ficam fixos aqui;
// os temas (passo 5) vão trocar este objeto.
export const T = {
  bg: '#0B0B12',
  text: '#F4F4F8',
  text2: '#A6A6B8',
  primary: '#3DD6C4',
  live: '#FF6B3D',
  warn: '#F5B83D',
  radiusPanel: 28,
} as const;
