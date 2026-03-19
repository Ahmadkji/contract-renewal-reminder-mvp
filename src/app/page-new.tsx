"use client";

import Link from "next/link";
import {
  Play,
  Bell,
  Mail,
  Plus,
  DollarSign,
  Zap,
  Users,
  FileCheck,
  GitBranch,
  ShieldCheck,
  Eye,
  Settings,
  Coffee,
  ChevronDown,
  Quote,
  Star,
  Table,
  Minus,
  Check,
  MessageSquare,
  Calendar,
  Upload,
  Sparkles,
  TrendingUp,
  Shield,
  CalendarX,
  CalendarCheck,
  CreditCard,
  Grid3X3,
  BellRing,
  HardHat,
  Building2,
  Truck,
  Briefcase,
  Scale,
  Rocket,
  ShoppingCart,
  Twitter,
  Linkedin,
  Globe,
} from "lucide-react";

// Import extracted components
import { NavigationBar } from "@/components/landing/navigation-bar";
import { HeroSection } from "@/components/landing/hero-section";
import { StatsOverview } from "@/components/landing/stats-overview";
import { DottedBackground } from "@/components/landing/hooks";

// Simplified landing page with extracted components
export default function HomePage() {
  return (
    <>
      <DottedBackground />
      <NavigationBar />
      
      <main>
        <HeroSection />
        <StatsOverview />
        
        {/* Placeholder for other sections - these would be extracted similarly */}
        <section id="features" className="relative z-10 px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-slate-400 mb-12">
              Everything you need to manage contracts efficiently
            </p>
            {/* Features grid would go here */}
          </div>
        </section>

        <section id="benefits" className="relative z-10 px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold text-white mb-4">
              Key Benefits
            </h2>
            {/* Benefits content would go here */}
          </div>
        </section>

        <section id="how-it-works" className="relative z-10 px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold text-white mb-4">
              How It Works
            </h2>
            {/* How it works content would go here */}
          </div>
        </section>

        <section id="pricing" className="relative z-10 px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold text-white mb-4">
              Simple Pricing
            </h2>
            {/* Pricing content would go here */}
          </div>
        </section>

        <section id="testimonials" className="relative z-10 px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold text-white mb-4">
              What Our Users Say
            </h2>
            {/* Testimonials content would go here */}
          </div>
        </section>
      </main>
    </>
  );
}
