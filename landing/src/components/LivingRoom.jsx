import React from 'react';
import { FunkyLabel } from './ui/FunkyLabel';
import livingRoomImg from '../assets/living-room.png';

const LivingRoom = () => {
  return (
    <div className="w-full h-full max-md:h-auto bg-living relative overflow-hidden flex items-center justify-center max-md:py-16 max-md:px-4">
      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.04] select-none pointer-events-none z-0 max-md:hidden">
        03
      </div>

      <FunkyLabel xOffset={300} yOffset={250} className="bg-white/10 text-white max-md:hidden">AUTO LAYOUT</FunkyLabel>
      <FunkyLabel xOffset={-400} yOffset={-200} className="bg-black/20 text-white border-white/20 max-md:hidden">PREMIUM</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full max-md:h-auto max-md:gap-6">

        {/* Floating Typography above image */}
        <div className="absolute max-md:relative max-md:top-auto max-md:left-auto max-md:w-full z-30 pointer-events-none max-md:mb-4 max-md:px-4">
          <h2 className="text-4xl sm:text-6xl md:text-[140px] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl relative max-md:text-center">
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal">Luxury</div></div>
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:1px_white] md:[-webkit-text-stroke:3px_white] italic pl-24 max-md:pl-0">Living</div></div>
          </h2>
        </div>

        {/* Diagonal Image Container */}
        <div className="relative w-[85%] max-md:w-[92vw] max-md:aspect-[16/9] max-w-5xl aspect-[16/9] mt-10 max-md:mt-4">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[-3deg] max-md:rotate-0 group z-10 border border-white/20">
            <img
              src={livingRoomImg}
              alt="Living Room"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-orange-900/10 mix-blend-overlay"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute max-md:relative max-md:top-auto max-md:right-auto max-md:w-full max-md:rotate-0 max-md:mt-6 max-md:p-6 glass-card p-8 rounded-[30px] w-80 rotate-[4deg] z-20">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-3 h-3 rounded-full bg-orange-400 animate-pulse"></div>
              <h3 className="text-xl font-bold uppercase tracking-widest text-orange-200">Analyzed</h3>
            </div>
            <p className="text-white/70 font-medium text-sm">
              AI-driven furniture placement maximizing comfort and absolute aesthetic perfection.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LivingRoom;
