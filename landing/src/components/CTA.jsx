import React from 'react';
import { MagneticButton } from './ui/MagneticButton';
import { ArrowRight } from 'lucide-react';
import { FunkyLabel } from './ui/FunkyLabel';
import endPageImg from '../assets/end page.png';

const CTA = () => {
  return (
    <div className="w-full h-full max-md:h-auto relative overflow-hidden flex items-center justify-center max-md:py-16 max-md:px-4">
      {/* Dark Mesh Gradient for CTA */}
      <div className="absolute inset-0 bg-[#040404]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(79,70,229,0.4),transparent_50%),radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.4),transparent_50%)] animate-[pulse_6s_ease-in-out_infinite] mix-blend-screen pointer-events-none"></div>
      
      {/* Animated Noise overlay */}
      <div className="noise-overlay opacity-30"></div>

      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.03] select-none pointer-events-none z-0 max-md:hidden">
        08
      </div>

      <FunkyLabel xOffset={300} yOffset={250} className="bg-white/10 max-md:hidden">BUILD 2026</FunkyLabel>
      <FunkyLabel xOffset={-400} yOffset={-200} className="bg-white/10 max-md:hidden">JOIN NOW</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full max-md:h-auto max-md:gap-6">

        {/* Floating Typography above image */}
        <div className="absolute max-md:relative max-md:top-auto max-md:left-auto max-md:w-full z-30 pointer-events-none max-md:mb-4 max-md:px-4">
          <h2 className="text-4xl sm:text-6xl md:text-[130px] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl max-md:text-center">
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal">Start</div></div>
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:1px_white] md:[-webkit-text-stroke:3px_white] italic pl-24 max-md:pl-0">Building</div></div>
          </h2>
        </div>

        {/* Diagonal Image Container */}
        <div className="relative w-[85%] max-md:w-[92vw] max-md:aspect-[16/9] max-w-5xl aspect-[16/9] mt-10 max-md:mt-4">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[-3deg] max-md:rotate-0 group z-10 border border-white/20">
            <img
              src={endPageImg}
              alt="Start Building"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-pink-900/10 mix-blend-overlay"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute max-md:relative max-md:bottom-auto max-md:left-auto max-md:w-full max-md:rotate-0 max-md:mt-6 max-md:p-6 glass-card p-8 rounded-[30px] w-80 rotate-[3deg] z-20">
            <h3 className="text-3xl font-bold mb-3 text-pink-200">Ready?</h3>
            <p className="text-white/70 font-medium text-sm">
              Start rendering in absolute perfection. The future of architecture is in your hands.
            </p>
          </div>

          {/* Overlapping Let's Go Button */}
          <div className="absolute max-md:relative max-md:bottom-auto max-md:right-auto max-md:w-full max-md:mt-4 max-md:flex max-md:justify-center max-md:rotate-0 -bottom-10 -right-5 z-20 rotate-[-2deg]">
            <MagneticButton 
              id="cta-lets-go" 
              onClick={() => {
                if (window.router) {
                  window.router.navigate('/login');
                } else if (window.auth) {
                  window.auth.openModal('login');
                }
              }}
              className="group relative overflow-hidden rounded-full bg-white text-black px-8 py-4 md:px-16 md:py-7 text-sm md:text-xl font-bold tracking-widest uppercase shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-110 transition-all duration-500 cursor-none"
            >
              <span className="relative z-10 flex items-center gap-2 md:gap-4">
                Let's Go
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-3 transition-transform duration-300" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-0"></div>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap flex items-center gap-2 md:gap-4">
                Let's Go
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6 translate-x-3" />
              </span>
            </MagneticButton>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CTA;
