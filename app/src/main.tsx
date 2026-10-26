import { createRoot } from 'react-dom/client';
import './fonts';
import './overlay/overlay.css';

const root = createRoot(document.getElementById('root')!);

if (document.documentElement.classList.contains('overlay')) {
  // Inside OBS: just the chat, see-through
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  void import('./overlay/OverlayApp').then(({ OverlayApp }) => root.render(<OverlayApp />));
} else {
  void import('./control/App').then(({ App }) => root.render(<App />));
}
