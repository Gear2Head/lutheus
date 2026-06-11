export function getGlassClass(intensity: string = 'frosted', theme: string = 'deepspace') {
  let base = 'border transition-all duration-300 ';
  
  if (theme === 'deepspace') {
    base += 'border-white/[0.05] ';
  } else {
    base += 'border-white/[0.04] ';
  }

  switch (intensity) {
    case 'minimalist':
      return base + 'bg-[#0E0E0F]';
    case 'immersive':
      return base + 'bg-black/25 backdrop-blur-2xl shadow-[0_12px_40px_-5px_rgba(0,0,0,0.6)]';
    case 'frosted':
    default:
      return base + 'bg-black/40 backdrop-blur-md';
  }
}
