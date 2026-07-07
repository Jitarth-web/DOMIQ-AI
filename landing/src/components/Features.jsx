import React from 'react';
import { FunkyLabel } from './ui/FunkyLabel';
import gardenCarImg from '../assets/garden car.png';

const featureList = [
  "AI Detection",
  "Spatial Flow",
  "Lighting Sync",
  "Auto Layout"
];

const Features = () => {
  return (
    <div className="w-full h-full bg-features relative overflow-hidden flex items-center justify-center">
      {/* Huge Background Number */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[600px] font-black text-white/[0.03] select-none pointer-events-none z-0">
        07
      </div>

      <FunkyLabel xOffset={-300} yOffset={250} className="bg-purple-600/20 text-purple-400 border-purple-500/30">SYSTEM</FunkyLabel>
      <FunkyLabel xOffset={400} yOffset={-200} className="bg-white/10 text-white">4.0 TFLOPS</FunkyLabel>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center justify-center h-full">

        {/* Diagonal Image Container */}
        <div className="relative w-[85%] max-w-5xl aspect-[16/9] mt-10">
          <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] rotate-[3deg] group z-10 border border-white/20">
            <img
              src={gardenCarImg}
              alt="Engine Features"
              className="w-full h-[120%] object-cover -top-[10%] relative transition-transform duration-[2s] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-purple-900/10 mix-blend-overlay"></div>
          </div>

          {/* Overlapping Glass Card */}
          <div className="absolute -bottom-10 -right-5 glass-card p-8 rounded-[30px] w-96 rotate-[-3deg] z-20">
            <h3 className="text-3xl font-bold mb-4 text-purple-200">System Specs</h3>
            <div className="space-y-4">
              <p className="text-white/70 font-medium text-sm">
                Our proprietary engine runs real-time spatial calculations to build premium designs.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {featureList.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white/5 py-2 px-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Typography above image */}
        <div className="absolute top-[8%] left-[5%] z-30 pointer-events-none">
          <h2 className="text-[120px] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl">
            <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal">Engine</div></div>
            <div className="overflow-hidden pb-8 pt-4 -mt-4"><div className="animate-text-reveal text-transparent [-webkit-text-stroke:2px_white] italic pl-24">Features</div></div>
          </h2>
        </div>

      </div>
    </div>
  );
};

export default Features;
