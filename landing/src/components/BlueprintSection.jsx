import React from 'react';
import { FunkyLabel } from './ui/FunkyLabel';
import blueprintImg from '../assets/blueprint.png';

const BlueprintSection = () => {
  return (
    <div className="w-full h-full max-md:h-auto bg-blueprint relative overflow-hidden flex items-center justify-center max-md:py-16 max-md:px-4">
      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.02] select-none pointer-events-none z-0 max-md:hidden">
        02
      </div>

      <FunkyLabel xOffset={-300} yOffset={250} className="bg-blue-600/20 text-blue-400 border-blue-500/30 max-md:hidden">SCANNING</FunkyLabel>
      <FunkyLabel xOffset={400} yOffset={-200} className="bg-purple-600/20 text-purple-400 border-purple-500/30 max-md:hidden">GENERATED</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full max-md:h-auto max-md:gap-6">

        {/* Floating Typography above image */}
        <div className="absolute max-md:relative max-md:top-auto max-md:left-auto max-md:w-full z-30 pointer-events-none max-md:mb-4 max-md:px-4">
          <h2 className="text-4xl sm:text-6xl md:text-[130px] font-black leading-[0.8] tracking-tighter drop-shadow-2xl max-md:text-center">
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:1px_white] md:[-webkit-text-stroke:2px_white] uppercase">Precision</div></div>
            <div className="overflow-hidden pb-2 md:pb-8 pt-2 md:pt-4 -mt-2 md:-mt-4"><div className="animate-text-reveal italic pl-16 max-md:pl-0 text-blue-200 uppercase">Mapping</div></div>
          </h2>
        </div>

        {/* Diagonal Image Container */}
        <div className="relative w-[85%] max-md:w-[92vw] max-md:aspect-[16/9] max-w-5xl aspect-[16/9] mt-10 max-md:mt-4">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[3deg] max-md:rotate-0 group z-10 border border-white/20">
            <img
              src={blueprintImg}
              alt="Blueprint"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            {/* Scanning Line overlay */}
            <div className="absolute top-0 left-0 w-full h-[4px] bg-blue-500/50 shadow-[0_0_20px_#3b82f6] animate-[scan_4s_ease-in-out_infinite_alternate] z-20 mix-blend-screen"></div>
            <div className="absolute inset-0 bg-blue-900/30 mix-blend-overlay"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute max-md:relative max-md:bottom-auto max-md:left-auto max-md:w-full max-md:rotate-0 max-md:mt-6 max-md:p-6 glass-card p-8 rounded-[30px] w-80 rotate-[-2deg] z-20">
            <h3 className="text-3xl font-bold mb-3 text-blue-300">Spatial Math</h3>
            <p className="text-white/70 font-medium text-sm">
              Instantly turn your 2D plans into a fully structured 3D environment using advanced spatial algorithms.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BlueprintSection;
