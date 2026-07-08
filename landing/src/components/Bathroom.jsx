import React from 'react';
import { FunkyLabel } from './ui/FunkyLabel';
import bathroomImg from '../assets/bathroom.png';

const Bathroom = () => {
  return (
    <div className="w-full h-full max-md:h-auto bg-bathroom relative overflow-hidden flex items-center justify-center max-md:py-16 max-md:px-4">
      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.03] select-none pointer-events-none z-0 max-md:hidden">
        06
      </div>

      <FunkyLabel xOffset={-200} yOffset={200} className="bg-purple-900/40 text-purple-200 max-md:hidden">RELAX</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full max-md:h-auto max-md:gap-6">

        {/* Floating Typography above image */}
        <div className="absolute max-md:relative max-md:top-auto max-md:left-auto max-md:w-full z-30 pointer-events-none max-md:mb-4 max-md:px-4">
          <h2 className="text-4xl sm:text-6xl md:text-[130px] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl max-md:text-center">
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:1px_white] md:[-webkit-text-stroke:2px_white] pr-4 max-md:pr-0">Spa</div></div>
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal">Experience</div></div>
          </h2>
        </div>

        {/* Diagonal Image Container */}
        <div className="relative w-[80%] max-md:w-[92vw] max-md:aspect-[16/9] max-w-5xl aspect-[21/9] mt-20 max-md:mt-4">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[-4deg] max-md:rotate-0 group z-10 border border-white/20">
            <img
              src={bathroomImg}
              alt="Bathroom"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-purple-900/20 mix-blend-overlay"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute max-md:relative max-md:bottom-auto max-md:right-auto max-md:w-full max-md:rotate-0 max-md:mt-6 max-md:p-6 glass-card p-10 rounded-[40px] w-96 max-md:w-full rotate-[2deg] z-20">
            <h3 className="text-4xl font-bold mb-4">Tranquility</h3>
            <p className="text-white/70 font-medium">
              Intelligent material selection and elegant plumbing layouts mapped by AI.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Bathroom;
