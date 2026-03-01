import { useState, useEffect } from 'react';

export function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 700);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}
