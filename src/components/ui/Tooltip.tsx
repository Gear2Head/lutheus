'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ children, content, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  const getAnimationProps = () => {
    switch (position) {
      case 'bottom':
        return { initial: { opacity: 0, scale: 0.95, y: -4 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: -4 } };
      case 'left':
        return { initial: { opacity: 0, scale: 0.95, x: 4 }, animate: { opacity: 1, scale: 1, x: 0 }, exit: { opacity: 0, scale: 0.95, x: 4 } };
      case 'right':
        return { initial: { opacity: 0, scale: 0.95, x: -4 }, animate: { opacity: 1, scale: 1, x: 0 }, exit: { opacity: 0, scale: 0.95, x: -4 } };
      case 'top':
      default:
        return { initial: { opacity: 0, scale: 0.95, y: 4 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 4 } };
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            {...getAnimationProps()}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`absolute z-60 pointer-events-none ${getPositionClasses()}`}
          >
            <div className="bg-[#0C0C0E]/95 border border-white/[0.08] px-2.5 py-1 text-[10px] font-bold text-white/90 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-md whitespace-nowrap tracking-wider font-sans uppercase">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
