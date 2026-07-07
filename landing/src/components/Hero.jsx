import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { MagneticButton } from './ui/MagneticButton';
import { ArrowRight } from 'lucide-react';
import { FunkyLabel } from './ui/FunkyLabel';
import homeVideo from '../assets/house.mp4';

const Hero = () => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;

      gsap.to(imageRef.current, { x: x * -1.5, y: y * -1.5, duration: 1, ease: "power2.out" });
      gsap.to(textRef.current, { x: x * 2, y: y * 2, duration: 1, ease: "power2.out" });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-hero relative overflow-hidden">
      <div className="absolute inset-0 bg-[#0A0A0A] z-0"></div>

      {/* Huge Background Number */}
      <div className="absolute -right-[10%] top-1/2 -translate-y-1/2 text-[400px] font-black text-white/[0.03] select-none pointer-events-none z-0">
        01
      </div>

      <FunkyLabel xOffset={50} yOffset={100}>AI READY</FunkyLabel>
      <FunkyLabel className="right-20 top-40 bg-blue-600/20 text-blue-300 border-blue-500/30">V. 2.4.0</FunkyLabel>

      {/* Background Video & Cinematic Gradient */}
      <div className="absolute top-[5%] left-[50%] w-[45%] h-[85%] rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-1">
        <video
          ref={imageRef}
          src={homeVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-[120%] h-[120%] -top-[10%] -left-[10%] object-cover opacity-80 scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        {/* Warm Sunlight Glow */}
        <div className="absolute -top-[20%] -right-[20%] w-[80%] h-[80%] bg-[#FF8A00] rounded-full blur-[150px] opacity-30 mix-blend-screen pointer-events-none"></div>
      </div>

      {/* Decorative Crosses */}
      <div className="absolute left-[10%] top-[20%] text-white/20 text-xs tracking-[1em]">+++</div>
      <div className="absolute left-[10%] bottom-[20%] text-white/20 text-xs tracking-[1em]">+++</div>

      <div ref={textRef} className="absolute left-[5%] top-[25%] z-10 w-[70%]">
        <h1 className="text-[140px] font-black leading-[0.85] tracking-tight uppercase">
          <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal">Design</div></div>
          <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal flex items-center gap-8">
            Your
            <div className="h-[2px] w-[200px] bg-white/30 hidden md:block"></div>
          </div></div>
          <div className="overflow-hidden flex items-baseline pb-8 pt-4 -mt-4">
            <div className="animate-text-reveal italic text-transparent [-webkit-text-stroke:2px_white] rotate-[-2deg] mr-8 pr-4">Dream</div>
            <div className="animate-text-reveal">Home</div>
          </div>
        </h1>

        <p className="text-2xl text-white/60 font-medium mt-12 max-w-xl pl-2 border-l-2 border-white/20 animate-fade-in-up" style={{ animationDelay: '1s', animationFillMode: 'both' }}>
          The world's most advanced AI architecture tool.
          Stop guessing. Start rendering in absolute perfection.
        </p>

        <div className="flex gap-6 mt-12 pl-2 animate-fade-in-up" style={{ animationDelay: '1.2s', animationFillMode: 'both' }}>
          <MagneticButton className="px-10 py-5 rounded-full bg-white text-black font-bold tracking-widest uppercase hover:scale-105 transition-all">
            <span className="flex items-center gap-3">
              Explore
              <ArrowRight className="w-5 h-5" />
            </span>
          </MagneticButton>
          <MagneticButton className="px-10 py-5 rounded-full bg-white/5 backdrop-blur-md text-white font-bold tracking-widest uppercase border border-white/20 hover:bg-white/10 transition-all">
            Showreel
          </MagneticButton>
        </div>
      </div>
    </div>
  );
};

export default Hero;
