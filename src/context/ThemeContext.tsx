'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'midnight' | 'deepspace' | 'sunset' | 'arctic';
export type IntensityType = 'minimalist' | 'frosted' | 'immersive';

interface ThemeContextType {
  theme: ThemeType;
  intensity: IntensityType;
  setTheme: (t: ThemeType) => void;
  setIntensity: (i: IntensityType) => void;
  getAccentColor: () => string; // Returns hex/class color
  getAccentBg: () => string;    // Returns light bg class
  getAccentBorder: () => string; // Returns border accent class
  getGlassClass: () => string;  // Returns glass intensity layout class
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('lutheus-theme') as ThemeType) || 'midnight';
    }
    return 'midnight';
  });

  const [intensity, setIntensityState] = useState<IntensityType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('lutheus-intensity') as IntensityType) || 'frosted';
    }
    return 'frosted';
  });

  const setTheme = (t: ThemeType) => {
    setThemeState(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lutheus-theme', t);
    }
  };

  const setIntensity = (i: IntensityType) => {
    setIntensityState(i);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lutheus-intensity', i);
    }
  };

  // Sync theme to document body for external global CSS adjustments if needed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('theme-midnight', 'theme-deepspace', 'theme-sunset', 'theme-arctic');
      root.classList.add(`theme-${theme}`);

      // Update CSS root colors based on selected theme
      if (theme === 'midnight') {
        root.style.setProperty('--accent', '#5E5CE6');
        root.style.setProperty('--bg', '#050507');
      } else if (theme === 'deepspace') {
        root.style.setProperty('--accent', '#F5F5F7');
        root.style.setProperty('--bg', '#020202');
      } else if (theme === 'sunset') {
        root.style.setProperty('--accent', '#FF453A');
        root.style.setProperty('--bg', '#090505');
      } else if (theme === 'arctic') {
        root.style.setProperty('--accent', '#0DF5FF');
        root.style.setProperty('--bg', '#030608');
      }
    }
  }, [theme]);

  const getAccentColor = () => {
    switch (theme) {
      case 'midnight': return '#5E5CE6';
      case 'deepspace': return '#F5F5F7';
      case 'sunset': return '#FF453A';
      case 'arctic': return '#0DF5FF';
    }
  };

  const getAccentBg = () => {
    switch (theme) {
      case 'midnight': return 'bg-[#5E5CE6]/10 text-[#5E5CE6] border-[#5E5CE6]/25';
      case 'deepspace': return 'bg-white/10 text-white border-white/20';
      case 'sunset': return 'bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/25';
      case 'arctic': return 'bg-[#0DF5FF]/10 text-[#0DF5FF] border-[#0DF5FF]/25';
    }
  };

  const getAccentBorder = () => {
    switch (theme) {
      case 'midnight': return 'border-[#5E5CE6]/20 focus:border-[#5E5CE6]/40';
      case 'deepspace': return 'border-white/10 focus:border-white/30';
      case 'sunset': return 'border-[#FF453A]/20 focus:border-[#FF453A]/40';
      case 'arctic': return 'border-[#0DF5FF]/20 focus:border-[#0DF5FF]/40';
    }
  };

  const getGlassClass = () => {
    let base = 'border transition-all duration-300 ';
    
    // Border styles
    if (theme === 'deepspace') {
      base += 'border-white/[0.05] ';
    } else if (theme === 'sunset') {
      base += 'border-white/[0.04] ';
    } else if (theme === 'arctic') {
      base += 'border-white/[0.04] ';
    } else {
      base += 'border-white/[0.04] ';
    }

    // Intensity controls
    switch (intensity) {
      case 'minimalist':
        return base + 'bg-[#0E0E0F]';
      case 'frosted':
        return base + 'bg-black/40 backdrop-blur-md';
      case 'immersive':
        return base + 'bg-black/25 backdrop-blur-2xl shadow-[0_12px_40px_-5px_rgba(0,0,0,0.6)]';
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      intensity, 
      setTheme, 
      setIntensity,
      getAccentColor,
      getAccentBg,
      getAccentBorder,
      getGlassClass
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme dynamic state manager must be used within a ThemeProvider container');
  }
  return context;
}
