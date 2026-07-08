import React, { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { CustomCursor } from './components/ui/CustomCursor';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import BlueprintSection from './components/BlueprintSection';
import LivingRoom from './components/LivingRoom';
import Bedroom from './components/Bedroom';
import Kitchen from './components/Kitchen';
import Bathroom from './components/Bathroom';
import Features from './components/Features';
import CTA from './components/CTA';

gsap.registerPlugin(ScrollTrigger);

function App() {
  useEffect(() => {
    let lenis = null;
    let tickHandler = null;

    const landingPageEl = document.getElementById('landing-page');

    function startScrollAnimations() {
      if (lenis) return; // already active

      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
      });

      lenis.on('scroll', ScrollTrigger.update);

      tickHandler = (time) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(tickHandler);
      gsap.ticker.lagSmoothing(0);

      // Apply the exact Sheryians scroll effect using native sticky + GSAP scale down
      const cards = gsap.utils.toArray('.stacked-card');

      cards.forEach((card, i) => {
        if (i < cards.length - 1) {
          const nextCard = cards[i + 1];

          gsap.to(card, {
            scale: 0.97,
            filter: "blur(4px) brightness(0.8)",
            ease: "none",
            scrollTrigger: {
              trigger: nextCard,
              start: "top bottom",
              end: "top 20%",
              scrub: true,
              id: `card-scroll-${i}`
            }
          });

          gsap.fromTo(nextCard,
            { rotation: 1, opacity: 0 },
            {
              rotation: 0,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: nextCard,
                start: "top bottom",
                end: "top 50%",
                scrub: true,
                id: `card-entry-${i}`
              }
            }
          );
        }
      });
    }

    function stopScrollAnimations() {
      if (lenis) {
        lenis.destroy();
        lenis = null;
      }
      if (tickHandler) {
        gsap.ticker.remove(tickHandler);
        tickHandler = null;
      }
      // Kill only the landing page scroll triggers
      ScrollTrigger.getAll().forEach(t => {
        if (t.vars.id && (t.vars.id.startsWith('card-scroll-') || t.vars.id.startsWith('card-entry-'))) {
          t.kill();
        }
      });
    }

    // Check initial state
    if (landingPageEl && landingPageEl.classList.contains('active')) {
      startScrollAnimations();
    }

    // Monitor style/class changes on parent #landing-page
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isActive = landingPageEl.classList.contains('active');
          if (isActive) {
            startScrollAnimations();
          } else {
            stopScrollAnimations();
          }
        }
      });
    });

    if (landingPageEl) {
      observer.observe(landingPageEl, { attributes: true });
    }

    return () => {
      observer.disconnect();
      stopScrollAnimations();
    };
  }, []);

  return (
    <div className="bg-[#040404] text-white min-h-screen mesh-bg relative">
      <CustomCursor />
      <Navbar />

      {/* 
        Native sticky layout with dynamic top offsets creates the perfect cascading stack.
        The top offset increases by 30px for each subsequent card so the previous cards' top edges remain visible.
      */}
      <main className="relative w-full flex flex-col items-center pt-[100px] pb-[10vh]">
        {[
          <Hero />,
          <BlueprintSection />,
          <LivingRoom />,
          <Bedroom />,
          <Kitchen />,
          <Bathroom />,
          <Features />,
          <CTA />
        ].map((Component, i) => (
          <div
            key={i}
            className={`stacked-card sticky h-[92vh] max-md:h-auto max-md:min-h-[85vh] max-md:py-8 w-[98vw] rounded-[40px] md:rounded-[60px] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.6)] ${i !== 7 ? 'mb-[150px] max-md:mb-[60px]' : ''}`}
            style={{
              top: '100px',
              zIndex: i + 1,
              willChange: 'transform'
            }}
          >
            {Component}
          </div>
        ))}
      </main>

      <footer className="w-full text-center py-10 text-white/30 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-medium z-[100] relative bg-[#040404]">
        Made with love in India • All Rights Reserved &copy; 2026
      </footer>
    </div>
  );
}

export default App;
