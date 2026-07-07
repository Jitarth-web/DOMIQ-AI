import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { MagneticButton } from './ui/MagneticButton';
import { ArrowRight } from 'lucide-react';

const Navbar = () => {
  const logoRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    // Logo drawing animation on load
    gsap.fromTo(logoRef.current.querySelectorAll('path, rect, circle'),
      { strokeDasharray: 200, strokeDashoffset: 200, opacity: 0 },
      { strokeDashoffset: 0, opacity: 1, duration: 2, ease: "power3.inOut", stagger: 0.1 }
    );

    // Brand name letter-by-letter animation
    const chars = textRef.current.querySelectorAll('span');
    gsap.fromTo(chars,
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: "back.out(2)", delay: 0.5 }
    );
  }, []);

  const handleLogoHover = () => {
    gsap.to(logoRef.current, { rotation: 90, scale: 1.15, filter: "drop-shadow(0 0 8px rgba(96,165,250,0.8))", duration: 0.5, ease: "power2.out" });
  };
  const handleLogoLeave = () => {
    gsap.to(logoRef.current, { rotation: 0, scale: 1, filter: "drop-shadow(0 0 0px rgba(96,165,250,0))", duration: 0.5, ease: "power2.out" });
  };

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-6xl flex items-center justify-between px-6 py-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)]">

      {/* Brand & Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onMouseEnter={handleLogoHover}
        onMouseLeave={handleLogoLeave}
      >
        <svg ref={logoRef} width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform origin-center">
          {/* House Outline */}
          <path d="M10 55L50 20L90 55V85H10V55Z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
          {/* Circuit / Blueprint Node */}
          <circle cx="50" cy="55" r="8" stroke="#60a5fa" strokeWidth="3" />
          <path d="M50 47V35" stroke="#60a5fa" strokeWidth="3" />
          <path d="M42 55H30" stroke="#60a5fa" strokeWidth="3" />
          <path d="M58 55H70" stroke="#60a5fa" strokeWidth="3" />
        </svg>
        <div ref={textRef} className="flex items-center text-lg tracking-widest uppercase text-white drop-shadow-md">
          <div className="font-light mr-2 flex">
            {'DOMIQ'.split('').map((char, i) => <span key={i} className="inline-block">{char}</span>)}
          </div>
          <div className="font-black text-blue-400 flex">
            {'AI'.split('').map((char, i) => <span key={i} className="inline-block">{char}</span>)}
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <MagneticButton 
        id="cta-start-designing" 
        onClick={() => {
          if (window.router) {
            window.router.navigate('/login');
          } else if (window.auth) {
            window.auth.openModal('login');
          }
        }}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm tracking-widest uppercase shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.8)] hover:scale-105 transition-all duration-300 relative overflow-hidden group"
      >
        <span className="relative z-10 flex items-center gap-2">
          Start Designing
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
        </span>
        {/* Shine Animation */}
        <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 group-hover:animate-[shimmer_1s_forwards]"></div>
      </MagneticButton>

    </nav>
  );
};

export default Navbar;
