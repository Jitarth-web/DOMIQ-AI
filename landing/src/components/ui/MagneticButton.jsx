import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

export const MagneticButton = ({ children, className = '', onClick, ...props }) => {
  const buttonRef = useRef(null);

  useEffect(() => {
    const button = buttonRef.current;
    
    const xTo = gsap.quickTo(button, "x", { duration: 1, ease: "elastic.out(1, 0.3)" });
    const yTo = gsap.quickTo(button, "y", { duration: 1, ease: "elastic.out(1, 0.3)" });

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = button.getBoundingClientRect();
      const x = (clientX - (left + width / 2)) * 0.3; // Strength of magnetic pull
      const y = (clientY - (top + height / 2)) * 0.3;
      xTo(x);
      yTo(y);
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
    };

    button.addEventListener("mousemove", handleMouseMove);
    button.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      button.removeEventListener("mousemove", handleMouseMove);
      button.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <button 
      ref={buttonRef} 
      className={`relative inline-flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105 active:scale-95 ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};
