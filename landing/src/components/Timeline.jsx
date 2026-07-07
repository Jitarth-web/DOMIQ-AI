import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Upload, Cpu, Sofa, PaintBucket, Calculator, Box } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { icon: <Upload />, title: "Upload Blueprint" },
  { icon: <Cpu />, title: "AI Detection" },
  { icon: <Sofa />, title: "Furniture Generation" },
  { icon: <PaintBucket />, title: "Interior Design" },
  { icon: <Calculator />, title: "Cost Estimation" },
  { icon: <Box />, title: "3D Visualization" }
];

const Timeline = () => {
  const containerRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    gsap.fromTo(
      cardsRef.current,
      { y: 100, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.2,
        duration: 1,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        }
      }
    );
  }, []);

  return (
    <section ref={containerRef} className="py-32 px-8 bg-background relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">How It Works</h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            From a simple floor plan to a fully realized 3D home in minutes.
          </p>
        </div>

        <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-6 relative z-10">
          {steps.map((step, index) => (
            <div
              key={index}
              ref={el => cardsRef.current[index] = el}
              className="glass-card p-6 flex flex-col items-center justify-center w-full md:w-48 aspect-square group hover:bg-white/10 transition-colors duration-300 relative"
            >
              <div className="w-16 h-16 rounded-full bg-background/50 flex items-center justify-center mb-4 text-accent group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                {React.cloneElement(step.icon, { className: 'w-8 h-8' })}
              </div>
              <h3 className="font-medium text-center">{step.title}</h3>

              {/* Connector arrows (hidden on mobile, visible on desktop except last) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 text-white/20">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Timeline;
