"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Clock,
  Search,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANIMATION_DELAY_MS } from "@/lib/constants";

interface NavLink {
  label: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Benefits", href: "#benefits" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function NavigationBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const lastScrollY = useRef(0);

  // Initial animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), ANIMATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide/show on scroll direction
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }
      lastScrollY.current = currentScrollY;
      
      // Calculate scroll progress
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = (currentScrollY / docHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Active section detection
  useEffect(() => {
    const sections = [
      "features",
      "benefits",
      "how-it-works",
      "pricing",
      "testimonials",
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 h-16 glass border-b border-slate-800 z-50 transition-transform duration-300 ${
        isVisible ? "animate-slide-down" : "navbar-init"
      } ${isHidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      {/* Progress indicator */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500 nav-progress" style={{ width: `${scrollProgress}%` }} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Left Zone - Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-500" />
          </div>
          <span className="font-display text-lg font-bold text-slate-100">
            Renewly
          </span>
        </div>
        
        {/* Center Zone - Links (Desktop only) */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`text-sm transition-colors duration-200 ${
                activeSection === link.href.slice(1)
                  ? "text-cyan-400"
                  : "text-slate-400 hover:text-cyan-400"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>
        
        {/* Right Zone - Actions */}
        <div className="flex items-center gap-3">
          {/* Sign In Button (Desktop) */}
          <Button
            asChild
            variant="ghost"
            className="hidden md:flex text-slate-300 hover:text-slate-100 hover:bg-slate-800/50"
          >
            <Link href="/login">Sign In</Link>
          </Button>
          
          {/* Get Started Button (Desktop) */}
          <Button
            asChild
            className="hidden md:flex bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
          >
            <Link href="/signup">Get Started</Link>
          </Button>
          
          {/* Search Icon (Desktop) */}
          <button
            className="hidden sm:flex w-9 h-9 items-center justify-center text-slate-400 hover:text-slate-100 transition-colors rounded-lg hover:bg-slate-800/50 focus-ring"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          
          {/* Mobile Menu Button */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors rounded-lg hover:bg-slate-800/50 focus-ring"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu - Full Screen Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-slate-950/95 backdrop-blur-lg z-40">
          <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-2xl font-medium text-slate-300 hover:text-cyan-400 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            
            {/* Mobile Auth Buttons */}
            <div className="flex flex-col gap-4 w-full max-w-xs mt-4">
              <Button
                asChild
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
              >
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
