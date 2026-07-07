import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { value: 500, suffix: "+", label: "Projects" },
  { value: 98, suffix: "%", label: "Accuracy" },
  { value: 10, suffix: "k+", label: "Designs Generated" },
  { value: 5, prefix: "₹", suffix: "Cr+", label: "Construction Cost Estimated" },
];

const Statistics = () => {
  const containerRef = useRef(null);
  const countersRef = useRef([]);

  useEffect(() => {
    countersRef.current.forEach((counter, i) => {
      const target = stats[i].value;
      gsap.to(counter, {
        innerHTML: target,
        duration: 2,
        ease: "power2.out",
        snap: { innerHTML: 1 },
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
        }
      });
    });
  }, []);

  return (
    <section ref={containerRef} className="py-24 px-8 border-y border-white/10 bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
        {stats.map((stat, index) => (
          <div key={index} className="space-y-2">
            <h3 className="text-5xl md:text-6xl font-bold tracking-tight text-white flex justify-center">
              {stat.prefix && <span>{stat.prefix}</span>}
              <span ref={el => countersRef.current[index] = el}>0</span>
              {stat.suffix && <span className="text-accent">{stat.suffix}</span>}
            </h3>
            <p className="text-white/50 font-medium uppercase tracking-wider text-sm">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Statistics;
