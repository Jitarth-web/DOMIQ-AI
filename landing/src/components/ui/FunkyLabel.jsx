import React, { useRef } from 'react';
import { gsap } from 'gsap';

export const FunkyLabel = ({ children, className = '', xOffset = 0, yOffset = 0 }) => {
  const labelRef = useRef(null);

  const handleMouseEnter = () => {
    gsap.to(labelRef.current, { rotation: (Math.random() - 0.5) * 20, scale: 1.1, duration: 0.4, ease: "back.out(2)" });
  };

  const handleMouseLeave = () => {
    gsap.to(labelRef.current, { rotation: 0, scale: 1, duration: 0.4, ease: "power2.out" });
  };

  return (
    <div 
      ref={labelRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`absolute z-50 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold tracking-widest text-white uppercase shadow-lg cursor-pointer ${className}`}
      style={{ transform: `translate(${xOffset}px, ${yOffset}px)` }}
    >
      {children}
    </div>
  );
};
