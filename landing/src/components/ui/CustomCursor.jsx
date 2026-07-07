import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';

export const CustomCursor = () => {
  const cursorRef = useRef(null);
  const dotRef = useRef(null);
  const [text, setText] = useState('');

  useEffect(() => {
    const cursor = cursorRef.current;
    const dot = dotRef.current;
    if (!cursor || !dot) return;
    
    // QuickTo for high performance cursor tracking
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.2, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.2, ease: "power3" });
    const xDot = gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3" });

    const moveCursor = (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      xDot(e.clientX);
      yDot(e.clientY);
    };

    window.addEventListener('mousemove', moveCursor);

    // Add global hover listeners for cursor morphing
    const handleMouseOver = (e) => {
      const target = e.target;
      if (!target) return;
      
      if (target.closest('button') || target.closest('a')) {
        gsap.to(cursor, { scale: 2.5, backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.5)', duration: 0.3 });
        setText('GO');
      } else if (target.closest('img')) {
        gsap.to(cursor, { scale: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.8)', duration: 0.3 });
        setText('VIEW');
      } else if (target.closest('.glass-card')) {
        gsap.to(cursor, { scale: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.4)', duration: 0.3 });
        setText('EXPLORE');
      } else {
        gsap.to(cursor, { scale: 1, backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)', duration: 0.3 });
        setText('');
      }
    };

    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  const cursorStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '48px',
    height: '48px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 9999999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'translate(-50%, -50%)',
    transition: 'background-color 0.3s, border-color 0.3s, transform 0.3s',
  };

  const dotStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '8px',
    height: '8px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 10000000,
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 10px #fff',
  };

  const textStyle = {
    fontSize: '8px',
    fontWeight: 'bold',
    letterSpacing: '0.15em',
    color: '#ffffff',
    position: 'absolute',
  };

  return createPortal(
    <>
      <div ref={cursorRef} style={cursorStyle}>
        <span style={textStyle}>{text}</span>
      </div>
      <div ref={dotRef} style={dotStyle}></div>
    </>,
    document.body
  );
};
