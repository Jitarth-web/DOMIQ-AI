import React from 'react';
import { FunkyLabel } from './ui/FunkyLabel';
import bedroomImg from '../assets/bedroom.png';

const Bedroom = () => {
  return (
    <div className="w-full h-full bg-bedroom relative overflow-hidden flex items-center justify-center">
      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.03] select-none pointer-events-none z-0">
        04
      </div>

      <FunkyLabel xOffset={0} yOffset={250} className="bg-white/10 text-white left-10">SMART SPACE</FunkyLabel>
      <FunkyLabel xOffset={100} yOffset={-300} className="bg-black/20 text-white right-20">98% SYNC</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full">

        {/* Diagonal Image Container */}
        <div className="relative w-[85%] max-w-5xl aspect-[16/9] mt-10">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[4deg] group z-10 border border-white/20">
            <img
              src={bedroomImg}
              alt="Bedroom"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay group-hover:opacity-0 transition-opacity duration-1000"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute -bottom-10 -right-5 glass-card p-8 rounded-[30px] w-96 rotate-[-3deg] z-20">
            <h3 className="text-3xl font-bold mb-3 text-blue-200">Sleep Habits</h3>
            <p className="text-white/70 font-medium text-sm">
              Tailored bedrooms designed around dynamic mood lighting and personal architectural style.
            </p>
          </div>
        </div>

        {/* Floating Typography above image */}
        <div className="absolute top-[8%] right-[5%] z-30 pointer-events-none text-right">
          <h2 className="text-[130px] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl">
            <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:2px_white] italic pr-4">Perfect</div></div>
            <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal pr-12">Bedroom</div></div>
          </h2>
        </div>

      </div>
    </div>
  );
};

export default Bedroom;
