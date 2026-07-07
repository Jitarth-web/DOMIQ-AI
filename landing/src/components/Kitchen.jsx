import React from 'react';
import { FunkyLabel } from './ui/FunkyLabel';
import kitchenImg from '../assets/kitchen.png';

const Kitchen = () => {
  return (
    <div className="w-full h-full bg-kitchen relative overflow-hidden flex items-center justify-center">
      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.04] select-none pointer-events-none z-0">
        05
      </div>

      <FunkyLabel xOffset={-250} yOffset={200} className="bg-white/10 text-white">LIVE DESIGN</FunkyLabel>
      <FunkyLabel xOffset={350} yOffset={-150} className="bg-black/20 text-green-300 border-green-500/30">FLOW STATE</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full">

        {/* Diagonal Image Container */}
        <div className="relative w-[85%] max-w-5xl aspect-[16/9] mt-10">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[-2deg] group z-10 border border-white/20">
            <img
              src={kitchenImg}
              alt="Kitchen"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-green-900/10 mix-blend-overlay"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute -top-12 -left-10 glass-card p-8 rounded-[30px] w-80 rotate-[3deg] z-20">
            <h3 className="text-3xl font-bold mb-3 text-green-200">Efficiency</h3>
            <p className="text-white/70 font-medium text-sm">
              Ergonomic spacing meets modern cabinetry. AI suggestions for ultimate culinary speed.
            </p>
          </div>
        </div>

        {/* Floating Typography above image */}
        <div className="absolute bottom-[5%] right-[5%] z-30 pointer-events-none text-right">
          <h2 className="text-[130px] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl">
            <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal">Smart</div></div>
            <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:3px_white] rotate-[2deg] my-2 pr-4">Kitchen</div></div>
          </h2>
        </div>

      </div>
    </div>
  );
};

export default Kitchen;
