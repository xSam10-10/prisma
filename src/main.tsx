import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installNavigation } from './ui/nav';
import './styles.css';

// Na TV LG, efeitos de vidro (blur) pesam: usa a versão "leve".
if (import.meta.env.MODE === 'webos' || /web0s|webos|netcast/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('lite');
}

installNavigation();
createRoot(document.getElementById('root')!).render(<App />);
