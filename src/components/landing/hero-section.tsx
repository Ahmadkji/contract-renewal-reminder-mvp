"use client";

import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth";

export function HeroSection() {
  const { openAuth } = useAuth();
  return (
    <section className="relative z-10 pt-32 sm:pt-40 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center">
        {/* Eyebrow */}
        <div className="animate-hero-eyebrow">
          <span className="text-[13px] font-medium uppercase tracking-[0.15em] text-slate-400">
            Contract Renewal Tracking
          </span>
        </div>
        
        {/* Headline - Staggered Word Reveal */}
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-[70px] leading-[1.05] tracking-[-0.03em] mt-6 mb-8">
          {/* Line 1: NEVER MISS A */}
          <span className="block">
            <span className="inline-block animate-hero-word hero-word-1 text-slate-400">NEVER</span>{" "}
            <span className="inline-block animate-hero-word hero-word-2 text-slate-400">MISS</span>{" "}
            <span className="inline-block animate-hero-word hero-word-3 text-slate-400">A</span>
          </span>
          {/* Line 2: CONTRACT RENEWAL with underline */}
          <span className="block mt-2">
            <span className="inline-block animate-hero-word hero-word-4 text-white">CONTRACT</span>{" "}
            <span className="inline-block animate-hero-word hero-word-5 text-white relative">
              RENEWAL
              {/* Underline that draws left-to-right */}
              <span className="absolute left-0 bottom-0 h-[3px] bg-white w-0 animate-underline-draw" />
            </span>
          </span>
        </h1>
        
        {/* Subheadline */}
        <p className="animate-hero-subheadline max-w-xl mx-auto text-lg sm:text-[20px] text-slate-400 font-normal leading-[1.5] mb-10">
          Automated tracking, timely reminders, zero missed deadlines
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
          {/* Primary CTA - Start Free */}
          <button
            onClick={() => openAuth('signup')}
            className="animate-hero-cta-primary group w-full sm:w-auto h-12 px-7 text-[14px] font-medium bg-white text-black rounded-md hover:bg-slate-200 transition-all duration-200 flex items-center justify-center gap-2 focus-ring"
          >
            Start Free
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          {/* Secondary CTA - See How It Works */}
          <button 
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="animate-hero-cta-secondary w-full sm:w-auto h-12 px-7 text-[14px] font-medium text-white border border-white/20 rounded-md hover:bg-white/8 hover:border-white/40 transition-all duration-200 flex items-center justify-center focus-ring"
          >
            See How It Works
          </button>
        </div>
        
        {/* Honest Microcopy */}
        <p className="animate-hero-microcopy text-[13px] text-slate-500">
          No credit card required • 14-day trial • Cancel anytime
        </p>
      </div>
    </section>
  );
}
