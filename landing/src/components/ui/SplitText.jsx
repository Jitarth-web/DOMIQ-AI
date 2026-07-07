import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export const SplitText = ({ children, className = '', delay = 0 }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const chars = containerRef.current.querySelectorAll('.split-char');
    
    // Set initial state
    gsap.set(chars, { y: 80, opacity: 0 });
    
    // Animate
    gsap.to(chars, {
      y: 0,
      opacity: 1,
      duration: 1,
      stagger: 0.03,
      ease: 'power4.out',
      delay: delay,
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 85%",
      }
    });
  }, [delay]);

  // Handle strings or nested elements by mapping
  const renderContent = () => {
    if (typeof children === 'string') {
      return children.split(/(\s+)/).map((word, i) => (
        <span key={i} className="inline-block whitespace-pre">
          {word.split('').map((char, j) => (
            <span key={j} className="split-char inline-block">{char}</span>
          ))}
        </span>
      ));
    }
    return children;
  };

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {renderContent()}
    </div>
  );
};
