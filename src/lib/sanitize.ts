export function sanitizeText(s: string, max=220){
  let t = (s || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/[\x00-\x1f]/g, '');
  if (t.length>max) {t = t.slice(0, max);}
  return t;
}

let lastAt = 0;
export function rateLimit(minMs=1200){
  const now = Date.now();
  if (now - lastAt < minMs) {return false;}
  lastAt = now; return true;
}



