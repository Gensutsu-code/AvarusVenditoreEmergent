import { useEffect, useRef } from 'react';
import axios from 'axios';

const EVENT = 'admin-data-changed';
let installed = false;

const install = () => {
  if (installed) return;
  installed = true;
  axios.interceptors.response.use((res) => {
    if ((res.config?.method || 'get').toLowerCase() !== 'get') window.dispatchEvent(new Event(EVENT));
    return res;
  });
};

// Re-runs fn on a timer, right after any saved change and when the browser tab becomes visible again
export const useLive = (fn, ms = 10000, enabled = true) => {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    install();
    let t;
    const run = () => { if (!document.hidden) ref.current(); };
    const onChange = () => { clearTimeout(t); t = setTimeout(run, 400); };
    const i = setInterval(run, ms);
    window.addEventListener(EVENT, onChange);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(i);
      clearTimeout(t);
      window.removeEventListener(EVENT, onChange);
      document.removeEventListener('visibilitychange', run);
    };
  }, [ms, enabled]);
};
