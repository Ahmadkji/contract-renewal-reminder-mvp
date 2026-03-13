"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  Search,
  ArrowRight,
  Play,
  CheckCircle,
  AlertCircle,
  LayoutDashboard,
  Bell,
  Mail,
  Plus,
  MoreHorizontal,
  Menu,
  X,
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

// Custom hook for intersection observer scroll reveal
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// Dotted Background Component
function DottedBackground() {
  return <div className="dotted-background" aria-hidden="true" />;
}

// Navigation Bar Component with scroll-aware behavior
function NavigationBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Benefits", href: "#benefits" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
  ];

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
          {navLinks.map((link) => (
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
          {/* Search Icon (Desktop) */}
          <button
            className="hidden sm:flex w-9 h-9 items-center justify-center text-slate-400 hover:text-slate-100 transition-colors rounded-lg hover:bg-slate-800/50 focus-ring"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Sign In Button */}
          <button className="hidden sm:flex h-9 px-4 items-center text-sm text-slate-300 border border-slate-700 rounded-full hover:border-slate-600 hover:text-slate-100 transition-all duration-200 focus-ring">
            Sign In
          </button>

          {/* Get Started Button */}
          <Link href="/dashboard" className="hidden sm:flex h-9 px-4 items-center gap-2 text-sm font-medium bg-cyan-600 text-white rounded-full hover:bg-cyan-500 transition-all duration-200 btn-lift glow-cyan focus-ring">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>

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
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-2xl font-medium text-slate-300 hover:text-cyan-400 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <hr className="w-48 border-slate-800" />
            <button className="w-48 h-12 text-base text-slate-300 border border-slate-700 rounded-full hover:border-slate-600 transition-all focus-ring">
              Sign In
            </button>
            <Link href="/dashboard" className="w-48 h-12 text-base font-medium bg-cyan-600 text-white rounded-full hover:bg-cyan-500 transition-all flex items-center justify-center gap-2 focus-ring" onClick={() => setMobileMenuOpen(false)}>
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// Typing Effect Hook
function useTypingEffect(text: string, speed: number = 50, delay: number = 0) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const startTyping = setTimeout(() => {
      setIsTyping(true);
      let currentIndex = 0;

      const typeInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
          setIsComplete(true);

          // Fade out cursor after 3 seconds
          setTimeout(() => {
            setShowCursor(false);
          }, 3000);
        }
      }, speed);

      return () => clearInterval(typeInterval);
    }, delay);

    return () => clearTimeout(startTyping);
  }, [text, speed, delay]);

  return { displayedText, isTyping, isComplete, showCursor };
}

// Hero Section Component
function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  // Typing effect starts after hero fade-in completes (800ms for fade-up + 200ms stagger = ~1000ms total)
  const typingText = "renewal deadline";
  const { displayedText, isComplete, showCursor } = useTypingEffect(typingText, 50, 1200);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative z-10 pt-40 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-950/30 mb-8 ${
            isVisible ? "animate-fade-up stagger-1" : "stagger-hidden"
          }`}
        >
          <span className="text-xs font-medium uppercase tracking-wider text-cyan-400">
            v1.0 Now in Beta
          </span>
        </div>

        {/* Headline */}
        <h1
          className={`font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight mb-6 ${
            isVisible ? "animate-fade-up stagger-2" : "stagger-hidden"
          }`}
        >
          <span className="text-slate-100">Never miss a</span>
          <br />
          <span className="gradient-text">
            {displayedText}
            {/* Blinking cursor */}
            {showCursor && (
              <span
                className={`inline-block w-[3px] h-[0.9em] bg-cyan-400 ml-1 align-middle ${
                  isComplete ? "animate-cursor-fade" : "animate-cursor-blink"
                }`}
                style={{ marginBottom: "2px" }}
              />
            )}
          </span>
          <br />
          <span className="text-slate-100">again.</span>
        </h1>

        {/* Subheadline */}
        <p
          className={`font-body max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 ${
            isVisible ? "animate-fade-up stagger-3" : "stagger-hidden"
          }`}
        >
          The smart contract renewal tracker that keeps your business ahead of
          deadlines. Get timely reminders, visual countdowns, and seamless
          integrations.
        </p>

        {/* CTA Buttons */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${
            isVisible ? "animate-fade-up stagger-4" : "stagger-hidden"
          }`}
        >
          <Link href="/dashboard" className="w-full sm:w-auto h-12 px-8 text-base font-medium bg-cyan-600 text-white rounded-full hover:bg-cyan-500 transition-all duration-200 btn-lift glow-cyan flex items-center justify-center gap-2 focus-ring">
            Start Tracking Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <button className="w-full sm:w-auto h-12 px-8 text-base font-medium text-slate-300 border border-slate-700 rounded-full hover:border-slate-600 hover:text-slate-100 transition-all duration-200 btn-lift flex items-center justify-center gap-2 focus-ring">
            <Play className="w-5 h-5" />
            View Demo
          </button>
        </div>
      </div>
    </section>
  );
}

// Stats Card Component
interface StatsCardProps {
  icon: React.ReactNode;
  iconColor: string;
  metric: string;
  label: string;
  delay: string;
}

function StatsCard({ icon, iconColor, metric, label, delay }: StatsCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`group bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all duration-300 card-border-transition ${
        isVisible ? `animate-fade-up ${delay}` : "stagger-hidden"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconColor}`}
        >
          {icon}
        </div>
        <div>
          <div className="font-display text-3xl font-bold text-slate-100 mb-1 font-mono-data">
            {metric}
          </div>
          <div className="text-sm text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Stats Overview Section
function StatsOverview() {
  const stats = [
    {
      icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
      iconColor: "bg-emerald-500/20",
      metric: "24",
      label: "Active Contracts",
      delay: "card-stagger-1",
    },
    {
      icon: <AlertCircle className="w-6 h-6 text-amber-500" />,
      iconColor: "bg-amber-500/20",
      metric: "3",
      label: "Expiring Soon",
      delay: "card-stagger-2",
    },
    {
      icon: <LayoutDashboard className="w-6 h-6 text-cyan-500" />,
      iconColor: "bg-cyan-500/20",
      metric: "$12.4k",
      label: "Total Savings",
      delay: "card-stagger-3",
    },
  ];

  return (
    <section className="relative z-10 px-4 sm:px-6 lg:px-8 pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Contract Row Component
interface ContractRowProps {
  company: string;
  contract: string;
  date: string;
  status: "active" | "expiring";
  daysLeft: number;
}

function ContractRow({
  company,
  contract,
  date,
  status,
  daysLeft,
}: ContractRowProps) {
  const progressPercent = Math.min((daysLeft / 90) * 100, 100);

  return (
    <tr className="group hover:bg-slate-800/50 rounded-xl transition-colors duration-200">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-medium text-slate-300">
            {company.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-slate-100">{company}</div>
            <div className="text-sm text-slate-500">{contract}</div>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="font-mono-data text-sm text-slate-300">{date}</span>
      </td>
      <td className="py-4 px-4">
        <span
          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
            status === "active"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-amber-500/20 text-amber-400"
          }`}
        >
          {status === "active" ? "Active" : "Expiring"}
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono-data text-lg font-bold text-slate-100 w-12">
            {daysLeft}
          </span>
          <div className="flex-1 max-w-[100px]">
            <div
              className={`h-2 rounded-full ${
                status === "active" ? "bg-emerald-500/20" : "bg-amber-500/20"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  status === "active" ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <button className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors focus-ring">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// Dashboard Preview Section
function DashboardPreview() {
  const { ref, isVisible } = useScrollReveal();

  const contracts = [
    {
      company: "Acme Corp",
      contract: "Annual License",
      date: "Dec 15, 2024",
      status: "active" as const,
      daysLeft: 45,
    },
    {
      company: "TechStart Inc",
      contract: "Support Contract",
      date: "Dec 28, 2024",
      status: "expiring" as const,
      daysLeft: 32,
    },
    {
      company: "Global Systems",
      contract: "Enterprise Plan",
      date: "Jan 5, 2025",
      status: "active" as const,
      daysLeft: 66,
    },
    {
      company: "Startup Hub",
      contract: "Cloud Services",
      date: "Nov 30, 2024",
      status: "expiring" as const,
      daysLeft: 14,
    },
  ];

  return (
    <section ref={ref} className="relative z-10 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <div
          className={`bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-900/10 ${
            isVisible ? "animate-fade-up" : "stagger-hidden"
          }`}
        >
          {/* App Chrome */}
          <div className="h-12 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Overview</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500" />
          </div>

          {/* App Body Header */}
          <div className="p-6 sm:p-8 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-100">
              Contract Overview
            </h2>
            <button className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors btn-lift w-fit focus-ring">
              <Plus className="w-4 h-4" />
              Add Contract
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500 w-2/5">
                    Contract
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500 w-1/6">
                    Date
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500 w-1/6">
                    Status
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500 w-1/6">
                    Days Left
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500 w-auto">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract, index) => (
                  <ContractRow key={index} {...contract} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// Feature Card Component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`group relative bg-slate-900/30 border border-slate-800 rounded-2xl p-8 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden ${
        isVisible ? `animate-fade-up ${delay}` : "stagger-hidden"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>

        <h3 className="font-display text-xl font-bold text-slate-100 mb-3">
          {title}
        </h3>

        <p className="text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// Features Grid Section (Phase 1)
function FeaturesGrid() {
  const features = [
    {
      icon: <Bell className="w-6 h-6 text-cyan-500" />,
      title: "Smart Reminders",
      description:
        "Never let a contract slip through the cracks. Get intelligent reminders via email, Slack, or SMS at customizable intervals before your renewal deadlines.",
      delay: "card-stagger-1",
    },
    {
      icon: <Clock className="w-6 h-6 text-cyan-500" />,
      title: "Visual Countdown",
      description:
        "See your timeline at a glance. Our visual countdown dashboard shows exactly how many days remain until each contract renewal, with color-coded urgency levels.",
      delay: "card-stagger-2",
    },
    {
      icon: <Mail className="w-6 h-6 text-cyan-500" />,
      title: "Gmail Integration",
      description:
        "Seamlessly connect your inbox. Renewly scans your Gmail for contract-related emails and automatically extracts renewal dates and key terms.",
      delay: "card-stagger-3",
    },
  ];

  return (
    <section id="features" className="relative z-10 bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
            Everything you need to stay ahead
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Powerful features designed to make contract management effortless
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 1 - Problem/Solution Transition
// ============================================
function ProblemSolutionSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section ref={ref} className="relative z-10 bg-slate-900 py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text */}
          <div className={`lg:col-span-2 ${isVisible ? "slide-reveal-left visible" : "slide-reveal-left"}`}>
            <p className="text-xs font-medium uppercase tracking-widest text-rose-400 mb-4">
              THE COST OF FORGETTING
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Auto-renewals cost businesses $10,000+ every year
            </h2>
            <p className="font-body text-lg text-slate-400 leading-relaxed max-w-lg mb-8">
              Spreadsheets fail. Sticky notes get lost. Calendar reminders get dismissed. Without a dedicated system, contracts slip through the cracks.
            </p>
            <div className="flex items-baseline gap-4">
              <span className="font-display text-6xl sm:text-7xl font-bold text-rose-400">68%</span>
              <span className="text-sm text-slate-400 max-w-[200px]">of SaaS contracts auto-renew unnoticed</span>
            </div>
          </div>

          {/* Right Column - Visual Metaphor */}
          <div className={`lg:col-span-3 relative h-[400px] sm:h-[500px] ${isVisible ? "slide-reveal-right visible" : "slide-reveal-right"}`}>
            {/* Stacked missed notification cards */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Card 3 - Bottom */}
              <div
                className="missed-card absolute w-72 sm:w-80 p-6 rounded-xl rotate-[-2deg] translate-y-8 opacity-50"
                style={{ zIndex: 1 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-300">Contract Extended</div>
                    <div className="text-xs text-slate-500">Auto-renewed</div>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Your annual plan has been renewed for another year.</p>
              </div>

              {/* Card 2 - Middle */}
              <div
                className="missed-card absolute w-72 sm:w-80 p-6 rounded-xl rotate-[3deg] translate-y-[-8px] opacity-60"
                style={{ zIndex: 2 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-300">Payment Processed</div>
                    <div className="text-xs text-slate-500">$4,200.00 charged</div>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Your card was charged for the subscription renewal.</p>
              </div>

              {/* Card 1 - Top */}
              <div
                className="missed-card absolute w-72 sm:w-80 p-6 rounded-xl rotate-[-6deg] translate-y-[-24px] opacity-70"
                style={{ zIndex: 3 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-300">Renewal Tomorrow</div>
                    <div className="text-xs text-slate-500">Expires Dec 15</div>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Your enterprise license is set to auto-renew tomorrow.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 2 - Benefits Grid
// ============================================
interface BenefitCardProps {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}

function BenefitCard({ number, icon, title, description, delay }: BenefitCardProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`relative bg-slate-900/40 border border-slate-800 rounded-[20px] p-8 card-hover-lift benefit-card-hover ${
        isVisible ? `scroll-reveal visible ${delay}` : "scroll-reveal"
      }`}
    >
      {/* Number Badge */}
      <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
        <span className="text-sm font-bold text-cyan-400">{number}</span>
      </div>

      {/* Icon */}
      <div className="w-8 h-8 text-cyan-400 mb-5">{icon}</div>

      {/* Title */}
      <h3 className="font-display text-xl font-bold text-white mb-3">
        {title}
      </h3>

      {/* Description */}
      <p className="text-[15px] text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function BenefitsGridSection() {
  const benefits = [
    {
      number: "01",
      icon: <DollarSign className="w-8 h-8" />,
      title: "Stop Revenue Leakage",
      description: "Catch unwanted renewals before they charge your card. Full financial control.",
    },
    {
      number: "02",
      icon: <Zap className="w-8 h-8" />,
      title: "Zero Setup Friction",
      description: "Import from CSV or connect Google Calendar in 60 seconds. No IT required.",
    },
    {
      number: "03",
      icon: <Users className="w-8 h-8" />,
      title: "Team Alignment",
      description: "Shared dashboard means no more 'I thought you handled it' moments.",
    },
    {
      number: "04",
      icon: <FileCheck className="w-8 h-8" />,
      title: "Audit Ready",
      description: "Complete history of every contract decision. Compliance made simple.",
    },
    {
      number: "05",
      icon: <GitBranch className="w-8 h-8" />,
      title: "Smart Workflows",
      description: "Auto-assign renewals to owners based on contract type or value.",
    },
    {
      number: "06",
      icon: <ShieldCheck className="w-8 h-8" />,
      title: "Peace of Mind",
      description: "Sleep soundly knowing nothing expires without your knowledge.",
    },
  ];

  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="benefits" ref={ref} className="relative z-10 bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      {/* Dot pattern background */}
      <div className="absolute inset-0 dotted-background opacity-10" />

      <div className="max-w-[1200px] mx-auto relative">
        {/* Header */}
        <div className={`text-center mb-16 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Why teams choose Renewly
          </h2>
          <p className="text-lg text-slate-400">
            Purpose-built features that save time, money, and sanity
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <BenefitCard
              key={index}
              {...benefit}
              delay={`card-stagger-${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 3 - Feature Deep Dive
// ============================================
function FeatureDeepDiveSection() {
  return (
    <div className="relative z-10">
      {/* Block 1: Automated Reminders */}
      <AutomatedRemindersBlock />

      {/* Block 2: Visual Timeline */}
      <VisualTimelineBlock />

      {/* Block 3: Integration Ecosystem */}
      <IntegrationEcosystemBlock />
    </div>
  );
}

function AutomatedRemindersBlock() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section ref={ref} className="bg-slate-950 py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual - Left */}
          <div className={`relative ${isVisible ? "slide-reveal-left visible" : "slide-reveal-left"}`}>
            {/* Email Timeline */}
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-700" />

              {/* Email Cards */}
              <div className="space-y-6">
                {/* 30 days */}
                <div className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative z-10 shrink-0">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="email-timeline-card rounded-xl p-4 flex-1">
                    <div className="text-sm font-medium text-slate-300 mb-1">Renewal in 30 days</div>
                    <div className="text-xs text-slate-500">Your contract with Acme Corp expires soon</div>
                  </div>
                </div>

                {/* 14 days */}
                <div className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative z-10 shrink-0">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="email-timeline-card rounded-xl p-4 flex-1">
                    <div className="text-sm font-medium text-slate-300 mb-1">Renewal in 14 days</div>
                    <div className="text-xs text-slate-500">Time to review your options</div>
                  </div>
                </div>

                {/* 7 days - Active */}
                <div className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center relative z-10 shrink-0 animate-pulse-glow">
                    <Mail className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="email-timeline-card rounded-xl p-4 flex-1 border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                    <div className="text-sm font-medium text-cyan-300 mb-1">Renewal in 7 days</div>
                    <div className="text-xs text-slate-400">Final reminder - take action now</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text - Right */}
          <div className={`lg:pl-8 ${isVisible ? "slide-reveal-right visible" : "slide-reveal-right"}`} style={{ transitionDelay: "200ms" }}>
            <p className="text-xs font-medium uppercase tracking-widest text-cyan-400 mb-4">
              AUTOMATION
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-6">
              Set it once. Never worry again.
            </h2>
            <p className="font-body text-lg text-slate-400 leading-relaxed mb-8">
              Customize reminder schedules per contract. Escalate to Slack or SMS for critical renewals. Include negotiation playbooks in reminder emails.
            </p>

            {/* Checklist */}
            <div className="space-y-4">
              {[
                "Multi-channel delivery (Email, Slack, SMS)",
                "Customizable templates with variables",
                "Escalation chains for unassigned contracts",
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VisualTimelineBlock() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section ref={ref} className="bg-slate-900 py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text - Left */}
          <div className={`${isVisible ? "slide-reveal-left visible" : "slide-reveal-left"}`}>
            <p className="text-xs font-medium uppercase tracking-widest text-indigo-400 mb-4">
              VISIBILITY
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-6">
              See the future of your contracts
            </h2>
            <p className="font-body text-lg text-slate-400 leading-relaxed">
              Gantt-style timeline view shows all renewals across months. Spot busy periods. Plan negotiations in advance.
            </p>
          </div>

          {/* Visual - Right */}
          <div className={`${isVisible ? "slide-reveal-right visible" : "slide-reveal-right"}`} style={{ transitionDelay: "200ms" }}>
            {/* Horizontal Timeline */}
            <div className="relative">
              {/* Timeline nodes */}
              <div className="flex items-center justify-between relative">
                {/* Gradient line */}
                <div className="absolute top-6 left-6 right-6 h-0.5">
                  <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-slate-700 w-3/4" />
                </div>

                {/* Nodes */}
                {[
                  { label: "Draft", color: "bg-slate-600", active: false },
                  { label: "Active", color: "bg-emerald-500", active: false },
                  { label: "Expiring", color: "bg-cyan-500", active: true },
                  { label: "Renewed", color: "bg-slate-700", active: false },
                ].map((node, index) => (
                  <div key={index} className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-12 h-12 rounded-full ${node.color} flex items-center justify-center ${
                        node.active ? "animate-node-pulse" : ""
                      }`}
                    >
                      {index === 0 && <FileCheck className="w-5 h-5 text-white" />}
                      {index === 1 && <Check className="w-5 h-5 text-white" />}
                      {index === 2 && <AlertCircle className="w-5 h-5 text-white" />}
                      {index === 3 && <CheckCircle className="w-5 h-5 text-white" />}
                    </div>
                    <span className={`text-sm mt-3 ${node.active ? "text-cyan-400 font-medium" : "text-slate-500"}`}>
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationEcosystemBlock() {
  const { ref, isVisible } = useScrollReveal();

  const integrations = [
    { icon: <Mail className="w-5 h-5" />, label: "Gmail", angle: -72 },
    { icon: <Calendar className="w-5 h-5" />, label: "Calendar", angle: -36 },
    { icon: <MessageSquare className="w-5 h-5" />, label: "Slack", angle: 0 },
    { icon: <Zap className="w-5 h-5" />, label: "Zapier", angle: 36 },
    { icon: <DollarSign className="w-5 h-5" />, label: "QuickBooks", angle: 72 },
  ];

  return (
    <section ref={ref} className="bg-slate-950 py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual - Left */}
          <div className={`${isVisible ? "slide-reveal-left visible" : "slide-reveal-left"}`}>
            {/* Hub and Spoke Diagram */}
            <div className="relative w-full max-w-[400px] mx-auto aspect-square">
              {/* Connection lines */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                {integrations.map((integration, index) => {
                  const radians = (integration.angle * Math.PI) / 180;
                  const x2 = 200 + 130 * Math.cos(radians);
                  const y2 = 200 - 130 * Math.sin(radians);
                  return (
                    <line
                      key={index}
                      x1="200"
                      y1="200"
                      x2={x2}
                      y2={y2}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  );
                })}
              </svg>

              {/* Center Hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center animate-hub-pulse">
                <Clock className="w-8 h-8 text-cyan-400" />
              </div>

              {/* Integration Nodes */}
              {integrations.map((integration, index) => {
                const radians = (integration.angle * Math.PI) / 180;
                const x = 200 + 130 * Math.cos(radians);
                const y = 200 - 130 * Math.sin(radians);
                return (
                  <div
                    key={index}
                    className="absolute w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors cursor-pointer"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {integration.icon}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Text - Right */}
          <div className={`lg:pl-8 ${isVisible ? "slide-reveal-right visible" : "slide-reveal-right"}`} style={{ transitionDelay: "200ms" }}>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400 mb-4">
              CONNECTIVITY
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-6">
              Plays nice with your stack
            </h2>
            <p className="font-body text-lg text-slate-400 leading-relaxed">
              Two-way sync with Google Calendar. Auto-create renewal events. Push financial data to accounting software.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 4 - Social Proof Testimonials
// ============================================
interface TestimonialCardProps {
  quote: string;
  author: string;
  title: string;
  avatarGradient: string;
  featured?: boolean;
}

function TestimonialCard({ quote, author, title, avatarGradient, featured }: TestimonialCardProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`relative bg-slate-900/60 border border-slate-800 rounded-2xl ${
        featured ? "p-8" : "p-7"
      } card-hover-lift ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}
    >
      {/* Quote Icon */}
      <Quote className="absolute top-4 left-4 w-10 h-10 text-slate-800" />

      {/* Featured Stars */}
      {featured && (
        <div className="flex gap-1 mb-4 relative z-10">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
          ))}
        </div>
      )}

      {/* Quote Text */}
      <p className={`font-body text-slate-200 leading-relaxed relative z-10 ${featured ? "text-base" : "text-[15px]"}`}>
        "{quote}"
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 mt-5 relative z-10">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient}`} />
        <div>
          <div className="text-sm font-semibold text-white">{author}</div>
          <div className="text-xs text-slate-500">{title}</div>
        </div>
      </div>
    </div>
  );
}

function SocialProofSection() {
  const { ref, isVisible } = useScrollReveal();

  const testimonials = [
    {
      quote: "Saved us $40K in the first quarter by catching auto-renewals we didn't even know about. This paid for itself in week one.",
      author: "Sarah Chen",
      title: "Operations Lead, TechStart",
      avatarGradient: "from-rose-500 to-pink-500",
    },
    {
      quote: "Finally replaced our spreadsheet nightmare. The timeline view alone is worth the price - we can see exactly what's coming up and plan our budget accordingly. Game changer for our finance team.",
      author: "Marcus Johnson",
      title: "CFO, GrowthCo",
      avatarGradient: "from-cyan-500 to-blue-500",
      featured: true,
    },
    {
      quote: "Audit season used to take weeks. Now I export everything in one click. Our auditors were impressed.",
      author: "Elena Rodriguez",
      title: "Legal Ops, ScaleUp Inc",
      avatarGradient: "from-emerald-500 to-teal-500",
    },
  ];

  const trustLogos = ["Notion", "Linear", "Vercel", "Stripe", "Figma"];

  return (
    <section id="testimonials" ref={ref} className="relative z-10 py-24 sm:py-32 px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(to bottom, #0f172a, #020617)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Loved by operations teams
          </h2>
        </div>

        {/* Trust Bar */}
        <div className={`flex flex-wrap items-center justify-center gap-8 sm:gap-12 mb-16 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`} style={{ transitionDelay: "100ms" }}>
          {trustLogos.map((logo, index) => (
            <span
              key={index}
              className="trust-logo text-lg font-semibold text-slate-500 cursor-pointer"
            >
              {logo}
            </span>
          ))}
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} {...testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// The Connected Path - "Get Started in 3 Minutes"
// ============================================

// Step data with icons and colors
const CONNECTED_STEPS = [
  { 
    id: 1, 
    title: "Import", 
    description: "Upload CSV or connect calendar",
    icon: Upload,
    bgColor: "bg-indigo-500/10",
    bgColorActive: "bg-indigo-500/20",
    iconColor: "text-indigo-400",
  },
  { 
    id: 2, 
    title: "Review", 
    description: "AI detects dates & categorizes",
    icon: Sparkles,
    bgColor: "bg-violet-500/10",
    bgColorActive: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
  { 
    id: 3, 
    title: "Set Rules", 
    description: "Configure reminder schedules",
    icon: Bell,
    bgColor: "bg-amber-500/10",
    bgColorActive: "bg-amber-500/20",
    iconColor: "text-amber-400",
  },
  { 
    id: 4, 
    title: "Relax", 
    description: "Automated monitoring begins",
    icon: CheckCircle,
    bgColor: "bg-emerald-500/10",
    bgColorActive: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
] as const;

type StepState = "upcoming" | "active" | "complete";

// Icon Container Component
interface IconContainerProps {
  step: typeof CONNECTED_STEPS[number];
  state: StepState;
  isAnimating: boolean;
  iconAnimation: string;
}

function IconContainer({ step, state, isAnimating, iconAnimation }: IconContainerProps) {
  const Icon = step.icon;
  
  return (
    <div
      className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5 transition-all duration-300 ${
        state === "active" ? step.bgColorActive : step.bgColor
      } ${state === "active" ? "scale-110" : "scale-100"}`}
    >
      <Icon
        className={`w-6 h-6 transition-all duration-300 ${step.iconColor} ${
          state === "active" ? "animate-icon-pulse-active" : ""
        } ${iconAnimation}`}
      />
    </div>
  );
}

// Step Number Badge Component
interface StepBadgeProps {
  stepId: number;
  state: StepState;
}

function StepBadge({ stepId, state }: StepBadgeProps) {
  return (
    <div
      className={`absolute -top-3 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-950 transition-all duration-300 ${
        state === "active"
          ? "bg-cyan-500 text-slate-950"
          : state === "complete"
          ? "bg-emerald-500 text-slate-950"
          : "bg-slate-700 text-slate-400"
      }`}
    >
      {state === "complete" ? (
        <Check className="w-3 h-3" />
      ) : (
        stepId
      )}
    </div>
  );
}

// Step Card Component
interface StepCardProps {
  step: typeof CONNECTED_STEPS[number];
  state: StepState;
  isAnimating: boolean;
  iconAnimation: string;
  animationDelay: string;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function StepCard({ 
  step, 
  state, 
  isAnimating, 
  iconAnimation, 
  animationDelay,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: StepCardProps) {
  const cardClasses = `
    relative p-8 text-center rounded-2xl transition-all duration-300 connected-card-hover
    ${state === "active" 
      ? "bg-slate-800 border-2 border-cyan-500 shadow-[0_8px_30px_rgba(6,182,212,0.1)]" 
      : state === "complete"
      ? "bg-slate-900 border border-emerald-500/50"
      : "bg-slate-900 border border-slate-800"
    }
    ${state === "active" ? "animate-card-glow" : ""}
    ${isHovered ? "shadow-[0_10px_40px_rgba(0,0,0,0.3)]" : ""}
  `;

  return (
    <div
      className={`animate-connected-card ${animationDelay}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={cardClasses}>
        <StepBadge stepId={step.id} state={state} />
        <IconContainer 
          step={step} 
          state={state} 
          isAnimating={isAnimating}
          iconAnimation={iconAnimation}
        />
        <h3 className="font-display text-base font-bold text-slate-100 mb-2">
          {step.title}
        </h3>
        <p className={`text-sm transition-colors duration-300 ${
          state === "active" ? "text-slate-200" : "text-slate-400"
        } ${state === "active" ? "animate-text-pulse-active" : ""}`}>
          {step.description}
        </p>
      </div>
    </div>
  );
}

// Connector Line with Dots Component
interface ConnectorLineProps {
  progress: number;
  isComplete: boolean;
  cardPositions: number[];
}

function ConnectorLine({ progress, isComplete, cardPositions }: ConnectorLineProps) {
  return (
    <div className="relative h-[2px] bg-slate-800 mt-8 mb-4 mx-8 z-0 rounded-full">
      {/* Progress Fill */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
          isComplete ? "bg-emerald-500" : "bg-cyan-500"
        }`}
        style={{ width: `${progress}%` }}
      />
      
      {/* Step Dots */}
      {cardPositions.map((pos, index) => {
        const stepNum = index + 1;
        // Dot is complete when progress has passed its position
        // Dot is active when progress is within range of this dot
        const dotState = progress >= pos ? "complete" : progress >= pos - 25 ? "active" : "upcoming";
        
        return (
          <div
            key={stepNum}
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-300 ${
              dotState === "active"
                ? "bg-cyan-500 scale-150"
                : dotState === "complete"
                ? "bg-emerald-500"
                : "bg-slate-700"
            }`}
            style={{ left: `${pos}%`, transform: "translate(-50%, -50%)" }}
          />
        );
      })}
    </div>
  );
}

// Mobile Step Card Component
interface MobileStepCardProps {
  step: typeof CONNECTED_STEPS[number];
  state: StepState;
  iconAnimation: string;
  showConnector: boolean;
  connectorState: "empty" | "partial" | "full";
}

function MobileStepCard({ step, state, iconAnimation, showConnector, connectorState }: MobileStepCardProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Card */}
      <div
        className={`flex-1 p-5 rounded-xl transition-all duration-300 ${
          state === "active"
            ? "bg-slate-800 border-2 border-cyan-500"
            : state === "complete"
            ? "bg-slate-900 border border-emerald-500/50"
            : "bg-slate-900 border border-slate-800"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300 ${
              state === "active" ? step.bgColorActive : step.bgColor
            }`}
          >
            <step.icon className={`w-5 h-5 ${step.iconColor}`} />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-100">{step.title}</h3>
            <p className={`text-xs ${state === "active" ? "text-slate-200" : "text-slate-400"}`}>
              {step.description}
            </p>
          </div>
        </div>
      </div>
      
      {/* Vertical Connector (between rows) */}
      {showConnector && (
        <div className="w-[2px] h-10 relative">
          <div className="absolute inset-0 bg-slate-800" />
          <div
            className={`absolute top-0 left-0 w-full transition-all duration-500 ${
              connectorState === "full" ? "bg-emerald-500 h-full" : "bg-cyan-500"
            }`}
            style={{
              height: connectorState === "full" ? "100%" : connectorState === "partial" ? "50%" : "0%",
            }}
          />
        </div>
      )}
    </div>
  );
}

// Main Connected Path Section
function ConnectedPathSection() {
  const { ref, isVisible } = useScrollReveal();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [iconAnimations, setIconAnimations] = useState<Record<number, string>>({});
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Calculate progress positions for dots (0%, 33.33%, 66.66%, 100%)
  const cardPositions = [0, 33.33, 66.66, 100];

  // Clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  }, []);

  // Trigger specific icon animation
  const triggerIconAnimation = useCallback((stepId: number, animationClass: string) => {
    setIconAnimations(prev => ({ ...prev, [stepId]: animationClass }));
    const t = setTimeout(() => {
      setIconAnimations(prev => ({ ...prev, [stepId]: "" }));
    }, 1000);
    timeoutRefs.current.push(t);
  }, []);

  // Auto-play animation cycle (8 seconds)
  useEffect(() => {
    if (!isVisible || isPaused) return;

    const runCycle = () => {
      // Reset
      setCurrentStep(0);
      setProgress(0);
      setHasStarted(true);
      setIconAnimations({});

      // Step 1 Active (0-2s)
      const t1 = setTimeout(() => {
        setCurrentStep(1);
        setProgress(12.5);
        triggerIconAnimation(1, "");
      }, 300);

      // Step 1 Complete, Step 2 Active (2-4s)
      const t2 = setTimeout(() => {
        setCurrentStep(2);
        setProgress(37.5);
        triggerIconAnimation(2, "animate-sparkle-rotate");
      }, 2300);

      // Step 2 Complete, Step 3 Active (4-6s)
      const t3 = setTimeout(() => {
        setCurrentStep(3);
        setProgress(62.5);
        triggerIconAnimation(3, "animate-connected-bell");
      }, 4300);

      // Step 3 Complete, Step 4 Active (6-7s)
      const t4 = setTimeout(() => {
        setCurrentStep(4);
        setProgress(87.5);
        triggerIconAnimation(4, "");
      }, 6300);

      // All Complete (7-8s)
      const t5 = setTimeout(() => {
        setCurrentStep(5);
        setProgress(100);
      }, 7300);

      timeoutRefs.current = [t1, t2, t3, t4, t5];
    };

    runCycle();
    const loopInterval = setInterval(runCycle, 8000);
    animationRef.current = loopInterval;

    return () => {
      clearAllTimeouts();
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isVisible, isPaused, triggerIconAnimation, clearAllTimeouts]);

  // Get step state
  const getStepState = (stepId: number): StepState => {
    if (currentStep === 5) return "complete"; // All done
    if (stepId < currentStep) return "complete";
    if (stepId === currentStep) return "active";
    return "upcoming";
  };

  // Handle hover
  const handleMouseEnter = (stepId: number) => {
    setHoveredCard(stepId);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setHoveredCard(null);
    setIsPaused(false);
  };

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative z-10 bg-slate-950 py-28 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1000px] mx-auto relative">
        {/* Header */}
        <div
          className={`text-center mb-16 transition-all duration-500 ${
            hasStarted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-500 mb-3">
            SETUP
          </p>
          <h2 className="font-display text-[44px] font-bold text-slate-100 mb-4">
            Get started in 3 minutes
          </h2>
          <p className="text-base text-slate-400">
            Simple setup, instant value
          </p>
        </div>

        {/* Desktop: Connected Cards with Line */}
        <div
          className={`hidden sm:block transition-all duration-500 ${
            hasStarted ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Cards Row */}
          <div className="flex gap-6 relative z-10">
            {CONNECTED_STEPS.map((step, index) => (
              <div key={step.id} className="flex-1">
                <StepCard
                  step={step}
                  state={getStepState(step.id)}
                  isAnimating={currentStep === step.id}
                  iconAnimation={iconAnimations[step.id] || ""}
                  animationDelay={`animation-delay-${index * 100}ms`}
                  isHovered={hoveredCard === step.id}
                  onMouseEnter={() => handleMouseEnter(step.id)}
                  onMouseLeave={handleMouseLeave}
                />
              </div>
            ))}
          </div>

          {/* Connector Line with Dots */}
          <ConnectorLine
            progress={progress}
            isComplete={currentStep === 5}
            cardPositions={[12.5, 37.5, 62.5, 87.5]}
          />
        </div>

        {/* Mobile: 2x2 Grid with Connectors */}
        <div
          className={`sm:hidden transition-all duration-500 ${
            hasStarted ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="grid grid-cols-2 gap-4">
            {/* Row 1 */}
            {CONNECTED_STEPS.slice(0, 2).map((step) => (
              <div
                key={step.id}
                className={`p-5 rounded-xl text-center transition-all duration-300 ${
                  getStepState(step.id) === "active"
                    ? "bg-slate-800 border-2 border-cyan-500"
                    : getStepState(step.id) === "complete"
                    ? "bg-slate-900 border border-emerald-500/50"
                    : "bg-slate-900 border border-slate-800"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 transition-all duration-300 ${
                    getStepState(step.id) === "active" ? step.bgColorActive : step.bgColor
                  }`}
                >
                  <step.icon className={`w-5 h-5 ${step.iconColor}`} />
                </div>
                <h3 className="font-display text-sm font-bold text-slate-100">{step.title}</h3>
                <p className={`text-xs mt-1 ${getStepState(step.id) === "active" ? "text-slate-200" : "text-slate-400"}`}>
                  {step.description.split(" ")[0]}
                </p>
              </div>
            ))}
            
            {/* Horizontal Connector */}
            <div className="col-span-2 relative h-8">
              <div className="absolute left-1/4 right-1/4 top-1/2 h-[2px] bg-slate-800" />
              <div
                className={`absolute top-1/2 h-[2px] transition-all duration-500 ${
                  currentStep >= 3 ? "bg-emerald-500" : "bg-cyan-500"
                }`}
                style={{
                  left: "25%",
                  width: currentStep >= 3 ? "50%" : currentStep >= 2 ? "25%" : "0%",
                }}
              />
            </div>
            
            {/* Row 2 */}
            {CONNECTED_STEPS.slice(2, 4).map((step) => (
              <div
                key={step.id}
                className={`p-5 rounded-xl text-center transition-all duration-300 ${
                  getStepState(step.id) === "active"
                    ? "bg-slate-800 border-2 border-cyan-500"
                    : getStepState(step.id) === "complete"
                    ? "bg-slate-900 border border-emerald-500/50"
                    : "bg-slate-900 border border-slate-800"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 transition-all duration-300 ${
                    getStepState(step.id) === "active" ? step.bgColorActive : step.bgColor
                  }`}
                >
                  <step.icon className={`w-5 h-5 ${step.iconColor}`} />
                </div>
                <h3 className="font-display text-sm font-bold text-slate-100">{step.title}</h3>
                <p className={`text-xs mt-1 ${getStepState(step.id) === "active" ? "text-slate-200" : "text-slate-400"}`}>
                  {step.description.split(" ")[0]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 6 - Comparison
// ============================================
function ComparisonSection() {
  const { ref, isVisible } = useScrollReveal();

  const features = [
    { label: "Setup Time", spreadsheet: { icon: "x", text: "Hours" }, crm: { icon: "minus", text: "Weeks" }, renewly: { icon: "check", text: "Minutes" } },
    { label: "Renewal Focus", spreadsheet: { icon: "x", text: "Generic" }, crm: { icon: "minus", text: "Buried" }, renewly: { icon: "check", text: "Core feature" } },
    { label: "Reminder Automation", spreadsheet: { icon: "x", text: "None" }, crm: { icon: "minus", text: "Complex" }, renewly: { icon: "check", text: "Smart defaults" } },
    { label: "Contract Timeline", spreadsheet: { icon: "x", text: "None" }, crm: { icon: "minus", text: "Manual" }, renewly: { icon: "check", text: "Visual native" } },
    { label: "Price", spreadsheet: { icon: "check", text: "Free" }, crm: { icon: "x", text: "$$$" }, renewly: { icon: "check", text: "$" } },
    { label: "Learning Curve", spreadsheet: { icon: "x", text: "Steep" }, crm: { icon: "x", text: "Very steep" }, renewly: { icon: "check", text: "None" } },
  ];

  const getIcon = (icon: string) => {
    switch (icon) {
      case "check":
        return <Check className="w-5 h-5 text-emerald-400" />;
      case "x":
        return <X className="w-5 h-5 text-rose-400" />;
      case "minus":
        return <Minus className="w-5 h-5 text-amber-400" />;
      default:
        return null;
    }
  };

  const getTextColor = (icon: string) => {
    switch (icon) {
      case "check":
        return "text-emerald-400";
      case "x":
        return "text-rose-400";
      case "minus":
        return "text-amber-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <section ref={ref} className="relative z-10 bg-slate-900 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Why Renewly vs. the alternatives?
          </h2>
          <p className="text-lg text-slate-400">
            See how we stack up
          </p>
        </div>

        {/* Comparison Table */}
        <div className={`overflow-x-auto ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`} style={{ transitionDelay: "200ms" }}>
          <div className="min-w-[600px]">
            {/* Column Headers */}
            <div className="grid grid-cols-4 gap-4 pb-4 border-b border-slate-800">
              <div />
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Table className="w-4 h-4" />
                <span className="font-medium">Spreadsheets</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Users className="w-4 h-4" />
                <span className="font-medium">Generic CRM</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-cyan-400">
                <Zap className="w-4 h-4" />
                <span className="font-bold">Renewly</span>
              </div>
            </div>

            {/* Rows */}
            {features.map((feature, index) => (
              <div
                key={index}
                className={`grid grid-cols-4 gap-4 py-4 border-b border-slate-800/50 ${
                  isVisible ? "scroll-reveal visible" : "scroll-reveal"
                }`}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
              >
                <div className="text-slate-400 py-2">{feature.label}</div>
                <div className="flex items-center justify-center gap-2 py-2">
                  {getIcon(feature.spreadsheet.icon)}
                  <span className={`text-sm ${getTextColor(feature.spreadsheet.icon)}`}>
                    {feature.spreadsheet.text}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 py-2">
                  {getIcon(feature.crm.icon)}
                  <span className={`text-sm ${getTextColor(feature.crm.icon)}`}>
                    {feature.crm.text}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 py-2 bg-cyan-500/10 rounded-lg">
                  {getIcon(feature.renewly.icon)}
                  <span className={`text-sm font-medium ${getTextColor(feature.renewly.icon)}`}>
                    {feature.renewly.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 7 - FAQ Accordion
// ============================================
interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="border-b border-slate-800 py-6">
      <button
        onClick={onClick}
        className="flex items-center justify-between w-full text-left focus-ring rounded-lg"
      >
        <span className={`text-lg font-medium transition-colors ${isOpen ? "text-cyan-400" : "text-white hover:text-cyan-400"}`}>
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-96 pt-4" : "max-h-0"
        }`}
      >
        <p className="font-body text-slate-400 leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
}

function FAQSection() {
  const { ref, isVisible } = useScrollReveal();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Can I import from Excel?",
      answer: "Yes! Upload any CSV or Excel file and our AI will automatically detect renewal dates, contract names, and key terms. Most imports take less than 30 seconds.",
    },
    {
      question: "What if I have 500+ contracts?",
      answer: "Our Scale plan handles unlimited contracts with no performance impact. Enterprise customers manage portfolios of 10,000+ contracts with ease.",
    },
    {
      question: "Do you store my contract files?",
      answer: "No, we only store metadata (dates, names, values). Your actual contract files stay where they are. We integrate with your existing storage.",
    },
    {
      question: "Can I customize reminder timing?",
      answer: "Absolutely. Set custom schedules per contract or use our smart defaults (30, 14, 7, 3 days). Add escalation chains for critical renewals.",
    },
    {
      question: "Is there a free trial?",
      answer: "Yes, 14 days with full features. No credit card required. Import your contracts and see value immediately.",
    },
    {
      question: "What integrations do you support?",
      answer: "Gmail, Google Calendar, Slack, Microsoft Teams, Zapier, and QuickBooks. More integrations added monthly based on user requests.",
    },
  ];

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <section ref={ref} className="relative z-10 bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      {/* Dot pattern background */}
      <div className="absolute inset-0 dotted-background opacity-10" />

      <div className="max-w-[800px] mx-auto relative">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Questions? Answered.
          </h2>
          <p className="text-lg text-slate-400">
            Everything you need to know
          </p>
        </div>

        {/* FAQ Items */}
        <div className={`${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`} style={{ transitionDelay: "200ms" }}>
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => handleToggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 1 - Why Renewly (Logic Grid)
// ============================================

const IMPACT_CARDS = [
  {
    icon: TrendingUp,
    label: "ROI",
    metric: "10x",
    context: "Average return first year",
    miniProof: "Based on 2,000+ teams",
    cornerColor: "bg-cyan-500",
    iconColor: "text-cyan-400",
  },
  {
    icon: Clock,
    label: "TIME",
    metric: "5hrs",
    context: "Saved monthly vs spreadsheets",
    miniProof: "Replaced 12 tabs, 3 docs",
    cornerColor: "bg-emerald-500",
    iconColor: "text-emerald-400",
  },
  {
    icon: Shield,
    label: "RISK",
    metric: "Zero",
    context: "Missed renewals with alerts",
    miniProof: "Since using Renewly",
    cornerColor: "bg-amber-500",
    iconColor: "text-amber-400",
  },
  {
    icon: Zap,
    label: "SPEED",
    metric: "60sec",
    context: "Setup time, not days",
    miniProof: "Import → first alert",
    cornerColor: "bg-violet-500",
    iconColor: "text-violet-400",
  },
] as const;

function WhyRenewlySection() {
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-950 py-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1100px] mx-auto">
        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {IMPACT_CARDS.map((card, index) => (
            <div
              key={card.label}
              className={`relative bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-hidden impact-card-hover ${
                isVisible ? "animate-grid-reveal" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Corner Accent */}
              <div
                className={`absolute top-0 right-0 w-1 h-10 ${card.cornerColor} rounded-bl-sm ${
                  isVisible ? "animate-corner-strip" : "scale-y-0"
                }`}
                style={{ animationDelay: `${index * 100 + 200}ms` }}
              />

              {/* Row 1: Icon + Label */}
              <div className="flex items-center gap-2 mb-3">
                <card.icon className={`w-5 h-5 ${card.iconColor} ${isVisible ? "animate-icon-spring" : ""}`} 
                  style={{ animationDelay: `${index * 100 + 100}ms` }} />
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
              </div>

              {/* Row 2: Metric */}
              <div className={`text-[36px] font-bold text-slate-100 mb-1 transition-all duration-200 hover:text-cyan-400 hover:scale-105 ${
                isVisible ? "animate-number-count" : ""
              }`}
              style={{ animationDelay: `${index * 100 + 200}ms` }}>
                {card.metric}
              </div>

              {/* Row 3: Context */}
              <p className="text-[13px] text-slate-400">{card.context}</p>

              {/* Row 4: Mini Proof */}
              <p className={`text-[11px] text-slate-500 italic mt-2 ${
                isVisible ? "animate-mini-proof" : ""
              }`}
              style={{ animationDelay: `${index * 100 + 1500}ms` }}>
                {card.miniProof}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section - The Reddit Truth
// ============================================

const REDDIT_CARDS = [
  {
    id: 1,
    accentColor: "bg-rose-500",
    accentBorderColor: "hover:border-rose-500",
    quoteIconBg: "bg-rose-500/20",
    quoteIconColor: "text-rose-400",
    numberBadge: "£5k",
    numberColor: "text-rose-400",
    quote: "We missed the 60 day notice period and we got stuck for a year at just over £5k. My boss was PISSED. Felt like a real rookie mistake.",
    source: "r/smallbusiness",
    solutionBadge: "NOTICE PERIOD GUARD",
    solutionBadgeBg: "bg-cyan-500/10",
    solutionBadgeText: "text-cyan-400",
    solutionTitle: "We track cancellation windows",
    solutionDesc: "Not just renewals—every deadline matters",
    ctaText: "See how →",
    ctaColor: "text-cyan-400",
  },
  {
    id: 2,
    accentColor: "bg-amber-500",
    accentBorderColor: "hover:border-amber-500",
    quoteIconBg: "bg-amber-500/20",
    quoteIconColor: "text-amber-400",
    numberBadge: "Lost",
    numberColor: "text-amber-400",
    quote: "Spreadsheets, a nightmare and I never followed up. New subscriptions fell through the cracks and weren't recorded properly.",
    source: "r/ADHD",
    solutionBadge: "AUTO-PILOT TRACKING",
    solutionBadgeBg: "bg-emerald-500/10",
    solutionBadgeText: "text-emerald-400",
    solutionTitle: "Import once, monitor forever",
    solutionDesc: "No more cracked systems",
    ctaText: "End chaos →",
    ctaColor: "text-emerald-400",
  },
  {
    id: 3,
    accentColor: "bg-violet-500",
    accentBorderColor: "hover:border-violet-500",
    quoteIconBg: "bg-violet-500/20",
    quoteIconColor: "text-violet-400",
    numberBadge: "$$$",
    numberColor: "text-violet-400",
    quote: "We spend millions on SaaS but track renewal dates in...",
    source: "r/Startups",
    solutionBadge: "PROFESSIONAL GRADE",
    solutionBadgeBg: "bg-indigo-500/10",
    solutionBadgeText: "text-indigo-400",
    solutionTitle: "Built for teams with real budgets",
    solutionDesc: "Enterprise-grade, startup-simple",
    ctaText: "Upgrade →",
    ctaColor: "text-indigo-400",
  },
  {
    id: 4,
    accentColor: "bg-cyan-500",
    accentBorderColor: "hover:border-cyan-500",
    quoteIconBg: "bg-cyan-500/20",
    quoteIconColor: "text-cyan-400",
    numberBadge: "30/14/7",
    numberColor: "text-cyan-400",
    quote: "Customers complaining about 'surprise' renewal charges even though they agreed to auto-renewal when they signed up.",
    source: "r/SaaS",
    solutionBadge: "TRIPLE WARNING SYSTEM",
    solutionBadgeBg: "bg-cyan-500/10",
    solutionBadgeText: "text-cyan-400",
    solutionTitle: "30, 14, 7 days. Never surprised.",
    solutionDesc: "Proactive alerts, reactive-free",
    ctaText: "Get alerts →",
    ctaColor: "text-cyan-400",
  },
] as const;

function RedditTruthSection() {
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-950 py-24 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1000px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Eyebrow with Typewriter Effect */}
          <div
            className={`inline-block mb-4 ${isVisible ? "animate-typewriter" : "opacity-0"}`}
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-rose-500">
              FROM REDDIT, UNFILTERED
            </span>
          </div>

          {/* Headline */}
          <h2
            className={`font-display text-[40px] font-bold text-slate-100 mb-3 ${
              isVisible ? "animate-fade-up" : "opacity-0"
            }`}
            style={{ animationDelay: "800ms" }}
          >
            The pains we actually solve
          </h2>

          {/* Subheadline */}
          <p
            className={`text-base text-slate-400 ${
              isVisible ? "animate-fade-up" : "opacity-0"
            }`}
            style={{ animationDelay: "1000ms" }}
          >
            Real quotes. Real losses. Real solutions.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REDDIT_CARDS.map((card, index) => (
            <div
              key={card.id}
              className={`relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden reddit-card-hover ${card.accentBorderColor} ${
                isVisible ? "animate-reddit-card" : "opacity-0"
              } reddit-stagger-${index + 1}`}
            >
              {/* Left Accent Strip */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${card.accentColor} ${
                  isVisible ? "animate-accent-strip" : "scale-y-0"
                }`}
                style={{ animationDelay: `${600 + index * 150}ms` }}
              />

              <div className="p-5">
                {/* Top Row: Quote Icon + Number Badge */}
                <div className="flex items-center justify-between mb-3">
                  {/* Quote Icon */}
                  <div
                    className={`w-10 h-10 rounded-lg ${card.quoteIconBg} flex items-center justify-center ${
                      isVisible ? "animate-quote-icon" : "opacity-0"
                    }`}
                    style={{ animationDelay: `${700 + index * 150}ms` }}
                  >
                    <Quote className={`w-5 h-5 ${card.quoteIconColor}`} />
                  </div>

                  {/* Number Badge */}
                  <span
                    className={`text-sm font-bold ${card.numberColor} ${
                      isVisible ? "animate-number-badge" : "opacity-0"
                    }`}
                    style={{ animationDelay: `${800 + index * 150}ms` }}
                  >
                    {card.numberBadge}
                  </span>
                </div>

                {/* Quote Text */}
                <p
                  className={`text-[15px] text-slate-200 leading-relaxed mb-2 line-clamp-3 ${
                    isVisible ? "animate-fade-up" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${850 + index * 150}ms` }}
                >
                  &ldquo;{card.quote}&rdquo;
                </p>

                {/* Source */}
                <p
                  className={`text-xs text-slate-500 italic mb-3 ${
                    isVisible ? "animate-fade-up" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${900 + index * 150}ms` }}
                >
                  — {card.source}
                </p>

                {/* Divider */}
                <div className="h-px bg-slate-800 my-3" />

                {/* Solution Badge */}
                <div
                  className={`${
                    isVisible ? "animate-solution-badge" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${1000 + index * 150}ms` }}
                >
                  <span
                    className={`text-[10px] uppercase font-medium rounded px-2 py-1 ${card.solutionBadgeBg} ${card.solutionBadgeText}`}
                  >
                    {card.solutionBadge}
                  </span>
                </div>

                {/* Solution Title */}
                <h3
                  className={`text-base font-bold text-slate-100 mt-2 ${
                    isVisible ? "animate-fade-up" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${1050 + index * 150}ms` }}
                >
                  {card.solutionTitle}
                </h3>

                {/* Solution Description */}
                <p
                  className={`text-[13px] text-slate-400 mt-1 ${
                    isVisible ? "animate-fade-up" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${1100 + index * 150}ms` }}
                >
                  {card.solutionDesc}
                </p>

                {/* Mini CTA */}
                <button
                  className={`mt-3 text-xs font-medium ${card.ctaColor} hover:underline transition-all hover:translate-x-1 flex items-center gap-1`}
                >
                  {card.ctaText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA Row */}
        <div
          className={`mt-10 text-center ${
            isVisible ? "animate-cta-row" : "opacity-0"
          }`}
          style={{ animationDelay: "1500ms" }}
        >
          <p className="text-sm text-slate-400 mb-4">
            These are real Reddit posts. We built Renewly to fix them.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button className="px-5 py-3 bg-slate-800 text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-700 transition-all hover:-translate-y-0.5">
              Read more stories →
            </button>
            <button className="px-6 py-3 bg-cyan-600 text-slate-950 text-sm font-medium rounded-lg hover:bg-cyan-500 transition-all hover:-translate-y-0.5">
              Start free trial
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 2 - Who Uses It (Role Explorer)
// ============================================

const ROLES = [
  {
    id: "cfo",
    tab: "CFOs",
    role: "Finance Leaders",
    painHeadline: "Budgets blown by surprise renewals",
    painDesc: "Founders find $40K charges 6 months later. No visibility.",
    solutionTag: "SPEND CONTROL",
    solutionColor: "bg-emerald-500/20 text-emerald-400",
    benefit: "Never miss a renewal deadline again",
    bullets: ["Real-time budget tracking", "Multi-channel alerts", "Spend visibility"],
  },
  {
    id: "ops",
    tab: "Ops",
    role: "Operations",
    painHeadline: "Chaos in shared spreadsheets",
    painDesc: "Version conflicts. Deleted rows. 'I thought you handled it.'",
    solutionTag: "SINGLE SOURCE",
    solutionColor: "bg-violet-500/20 text-violet-400",
    benefit: "One source of truth for all contracts",
    bullets: ["No more version conflicts", "Ownership tracking", "Instant search"],
  },
  {
    id: "legal",
    tab: "Legal",
    role: "Legal Teams",
    painHeadline: "Audit trails that don't exist",
    painDesc: "Compliance asks for history. You have emails and hope.",
    solutionTag: "AUDIT READY",
    solutionColor: "bg-indigo-500/20 text-indigo-400",
    benefit: "Every decision logged. Instant export.",
    bullets: ["Full decision history", "One-click audit export", "Timestamped records"],
  },
  {
    id: "founders",
    tab: "Founders",
    role: "Startup CEOs",
    painHeadline: "Growth stalled by admin",
    painDesc: "Should build product. Instead chasing contract dates.",
    solutionTag: "15 MIN/WEEK",
    solutionColor: "bg-amber-500/20 text-amber-400",
    benefit: "Stop chasing. Start building.",
    bullets: ["Minimal weekly maintenance", "Auto-reminders", "Focus on growth"],
  },
  {
    id: "procurement",
    tab: "Procurement",
    role: "Buyers",
    painHeadline: "Vendors renew without approval",
    painDesc: "Auto-renewals slip through. Budgets miss by thousands.",
    solutionTag: "APPROVAL LOCK",
    solutionColor: "bg-rose-500/20 text-rose-400",
    benefit: "No more surprise auto-renewals",
    bullets: ["Pre-approval workflows", "Vendor tracking", "Budget protection"],
  },
] as const;

function WhoUsesItSection() {
  const { ref, isVisible } = useScrollReveal();
  const [activeRole, setActiveRole] = useState<string>("cfo");
  const currentRole = ROLES.find((r) => r.id === activeRole) || ROLES[0];

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-900 py-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1000px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="font-display text-[28px] font-bold text-slate-100 mb-2">
            Built for teams that manage money
          </h2>
          <p className="text-sm text-slate-400">
            Not just legal. Not just finance. Everyone with contracts.
          </p>
        </div>

        {/* Tab Bar */}
        <div
          className={`flex justify-center gap-2 mb-5 flex-wrap ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
        >
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`h-9 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                activeRole === role.id
                  ? "bg-cyan-500 text-slate-950 animate-tab-glow"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {role.tab}
            </button>
          ))}
        </div>

        {/* Content Card */}
        <div
          key={activeRole}
          className={`bg-slate-950 border border-slate-800 rounded-2xl p-7 animate-content-fade`}
        >
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Zone - Pain */}
            <div className="md:w-1/2">
              <h3 className="font-display text-xl font-bold text-slate-100 mb-2">
                {currentRole.role}
              </h3>
              <p className="text-base text-rose-300 mb-1">
                {currentRole.painHeadline}
              </p>
              <p className="text-sm text-slate-400">{currentRole.painDesc}</p>
            </div>

            {/* Right Zone - Solution */}
            <div className="md:w-1/2 md:border-l md:border-slate-800 md:pl-6">
              {/* Solution Tag */}
              <span
                className={`inline-block text-xs uppercase font-medium rounded px-3 py-1.5 mb-4 ${currentRole.solutionColor}`}
              >
                {currentRole.solutionTag}
              </span>

              {/* Benefit Statement */}
              <p className="text-lg font-medium text-slate-100 mb-4">
                {currentRole.benefit}
              </p>

              {/* Bullet Points */}
              <ul className="space-y-2">
                {currentRole.bullets.map((bullet, i) => (
                  <li
                    key={bullet}
                    className="flex items-center gap-2 text-sm text-slate-300"
                  >
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 3 - Pain to Solution Toggle
// ============================================

const PAIN_OPTIONS = [
  {
    id: "forget",
    text: "I forget renewal dates",
    icon: CalendarX,
    solutionIcon: CalendarCheck,
    headline: "Never miss a deadline",
    subtext: "Smart alerts at 30, 14, 7 days. Plus buffer for negotiation.",
    bullets: ["Calendar sync", "Email + Slack", "SMS backup"],
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    id: "auto-renew",
    text: "Auto-renewals surprise me",
    icon: CreditCard,
    solutionIcon: ShieldCheck,
    headline: "Control every dollar",
    subtext: "Cancel before charge. Full visibility into upcoming spend.",
    bullets: ["Pre-deadline alerts", "One-click cancel", "Spend tracking"],
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
  {
    id: "spreadsheets",
    text: "Spreadsheets are unmanageable",
    icon: Grid3X3,
    solutionIcon: LayoutDashboard,
    headline: "Ditch the chaos",
    subtext: "One source of truth. No version conflicts. No deleted rows.",
    bullets: ["Import in 60s", "Auto-categorize", "Team permissions"],
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    id: "team",
    text: "My team misses deadlines",
    icon: Users,
    solutionIcon: BellRing,
    headline: "Align everyone",
    subtext: "Shared dashboard. Assigned owners. No 'I thought you...'",
    bullets: ["Role assignments", "Slack alerts", "Status dashboard"],
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
] as const;

function PainToSolutionSection() {
  const { ref, isVisible } = useScrollReveal();
  const [activePain, setActivePain] = useState<string>("forget");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handlePainClick = (painId: string) => {
    if (painId !== activePain) {
      setIsTransitioning(true);
      setActivePain(painId);
      setTimeout(() => setIsTransitioning(false), 600);
    }
  };

  const currentPain = PAIN_OPTIONS.find((p) => p.id === activePain) || PAIN_OPTIONS[0];

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-950 py-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1000px] mx-auto">
        <div className="flex flex-col md:flex-row gap-10">
          {/* Left Column - Pain Selector */}
          <div className="md:w-[35%]">
            <p className="text-sm text-slate-500 uppercase mb-4">
              What&apos;s your headache?
            </p>
            <div className="space-y-2">
              {PAIN_OPTIONS.map((pain, index) => (
                <button
                  key={pain.id}
                  onClick={() => handlePainClick(pain.id)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all duration-200 ${
                    isVisible ? "animate-pain-slide" : "opacity-0"
                  } ${
                    activePain === pain.id
                      ? "bg-rose-500/10 border-l-[3px] border-rose-500 text-rose-400 font-medium"
                      : "bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <span className="flex items-center gap-3">
                    <pain.icon className="w-5 h-5" />
                    {pain.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column - Solution Preview */}
          <div className="md:w-[65%]">
            <div
              key={activePain}
              className={`bg-slate-900 border border-slate-800 rounded-2xl p-8 relative ${
                isTransitioning ? "animate-solution-fade" : ""
              }`}
            >
              {/* Icon Container */}
              <div
                className={`w-16 h-16 rounded-2xl ${currentPain.iconBg} flex items-center justify-center mb-5`}
              >
                <currentPain.solutionIcon
                  className={`w-8 h-8 ${currentPain.iconColor}`}
                />
              </div>

              {/* Content */}
              <h3 className="font-display text-2xl font-bold text-slate-100 mb-3">
                {currentPain.headline}
              </h3>
              <p className="text-base text-slate-400 mb-5 max-w-md">
                {currentPain.subtext}
              </p>

              {/* Bullets */}
              <div className="space-y-2 mb-6">
                {currentPain.bullets.map((bullet, i) => (
                  <div
                    key={bullet}
                    className="flex items-center gap-2 text-sm text-slate-300"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    {bullet}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button className="px-6 py-3 bg-cyan-600 text-slate-950 font-medium rounded-lg hover:bg-cyan-500 transition-all hover:brightness-110">
                Fix this now
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 5 - Industry Fit (Role Grid)
// ============================================

const INDUSTRIES = [
  {
    icon: HardHat,
    role: "Contractors",
    pain: "License renewals missed, jobs stalled",
    solution: "COMPLIANCE KEPT",
    solutionBg: "bg-amber-500/20",
    solutionText: "text-amber-400",
    borderColor: "hover:border-amber-500",
  },
  {
    icon: Building2,
    role: "B2B Services",
    pain: "Client contracts scattered, renewals forgotten",
    solution: "CLIENTS RETAINED",
    solutionBg: "bg-indigo-500/20",
    solutionText: "text-indigo-400",
    borderColor: "hover:border-indigo-500",
  },
  {
    icon: Truck,
    role: "Wholesalers",
    pain: "Supplier auto-renewals, margin erosion",
    solution: "COSTS CONTROLLED",
    solutionBg: "bg-rose-500/20",
    solutionText: "text-rose-400",
    borderColor: "hover:border-rose-500",
  },
  {
    icon: Briefcase,
    role: "CFOs",
    pain: "Budget overruns, surprise charges",
    solution: "SPEND VISIBLE",
    solutionBg: "bg-emerald-500/20",
    solutionText: "text-emerald-400",
    borderColor: "hover:border-emerald-500",
  },
  {
    icon: Users,
    role: "Operations",
    pain: "Team chaos, version conflicts",
    solution: "SYNC LOCKED",
    solutionBg: "bg-violet-500/20",
    solutionText: "text-violet-400",
    borderColor: "hover:border-violet-500",
  },
  {
    icon: Scale,
    role: "Legal",
    pain: "Audit gaps, no history trail",
    solution: "PROOF READY",
    solutionBg: "bg-cyan-500/20",
    solutionText: "text-cyan-400",
    borderColor: "hover:border-cyan-500",
  },
  {
    icon: Rocket,
    role: "Startups",
    pain: "Growth stalled by admin burden",
    solution: "SCALE SMOOTH",
    solutionBg: "bg-orange-500/20",
    solutionText: "text-orange-400",
    borderColor: "hover:border-orange-500",
  },
  {
    icon: ShoppingCart,
    role: "Procurement",
    pain: "Vendor blind spots, no approval flow",
    solution: "VENDORS MANAGED",
    solutionBg: "bg-teal-500/20",
    solutionText: "text-teal-400",
    borderColor: "hover:border-teal-500",
  },
] as const;

function IndustryFitSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-950 py-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[1000px] mx-auto">
        {/* Header */}
        <div
          className={`text-center mb-10 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-100 mb-3">
            Built for every team
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            From startups to enterprises, Renewly adapts to your workflow.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {INDUSTRIES.map((industry, index) => (
            <div
              key={industry.role}
              className={`bg-slate-900 border border-slate-800 rounded-xl p-4 role-card-hover ${industry.borderColor} ${
                isVisible ? "animate-grid-reveal" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 50 + 200}ms` }}
            >
              {/* Row 1: Icon + Role */}
              <div className="flex items-center gap-2 mb-2">
                <industry.icon className="w-[18px] h-[18px] text-slate-400" />
                <span className="text-[13px] font-bold text-slate-100">
                  {industry.role}
                </span>
              </div>

              {/* Row 2: Pain */}
              <p className="text-[12px] text-slate-500 mb-2 truncate">
                {industry.pain}
              </p>

              {/* Row 3: Solution Tag */}
              <span
                className={`text-[10px] uppercase font-medium rounded px-2 py-1 ${industry.solutionBg} ${industry.solutionText}`}
              >
                {industry.solution}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 6 - Simple Pricing
// ============================================

const PRICING_PLANS_NEW = [
  {
    id: "starter",
    name: "STARTER",
    nameColor: "text-slate-500",
    monthlyPrice: 0,
    annualPrice: 0,
    priceSize: "text-[40px]",
    tagline: "For individuals testing the water",
    features: [
      { text: "10 active contracts", checkColor: "text-emerald-400" },
      { text: "Email reminders", checkColor: "text-emerald-400" },
      { text: "CSV import", checkColor: "text-emerald-400" },
      { text: "Basic dashboard", checkColor: "text-emerald-400" },
    ],
    limitation: "No team sharing",
    ctaText: "Start Free",
    ctaStyle: "bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-slate-100",
    ctaHeight: "h-11",
    bg: "bg-slate-900",
    border: "border-slate-800",
    popular: false,
    valueProp: null,
  },
  {
    id: "pro",
    name: "PRO",
    nameColor: "text-cyan-400",
    monthlyPrice: 12,
    annualPrice: 9.6,
    priceSize: "text-[48px]",
    tagline: "For professionals who need control",
    features: [
      { text: "Unlimited contracts", checkColor: "text-cyan-400" },
      { text: "3 team members", checkColor: "text-cyan-400" },
      { text: "Slack alerts", checkColor: "text-cyan-400" },
      { text: "Google Calendar sync", checkColor: "text-cyan-400" },
      { text: "API access", checkColor: "text-cyan-400" },
    ],
    limitation: null,
    ctaText: "Start 14-Day Trial",
    ctaStyle: "bg-cyan-600 text-slate-950 hover:bg-cyan-500",
    ctaHeight: "h-12",
    bg: "bg-slate-800",
    border: "border-t-2 border-cyan-500",
    popular: true,
    valueProp: { text: "Saves 5hrs/month avg", bg: "bg-cyan-500/10", text_color: "text-cyan-400" },
  },
  {
    id: "power",
    name: "POWER",
    nameColor: "text-violet-400",
    monthlyPrice: 19,
    annualPrice: 15.2,
    priceSize: "text-[40px]",
    tagline: "For power users who want more",
    features: [
      { text: "Everything in Pro", checkColor: "text-violet-400" },
      { text: "Advanced analytics", checkColor: "text-violet-400" },
      { text: "Zapier integrations", checkColor: "text-violet-400" },
      { text: "Export to PDF/Excel", checkColor: "text-violet-400" },
      { text: "Priority email support", checkColor: "text-violet-400" },
    ],
    limitation: null,
    ctaText: "Start 14-Day Trial",
    ctaStyle: "bg-slate-800 border border-slate-700 text-slate-200 hover:border-violet-400 hover:text-violet-400",
    ctaHeight: "h-11",
    bg: "bg-slate-900",
    border: "border-slate-800",
    popular: false,
    valueProp: { text: "For serious solo users", bg: "bg-violet-500/10", text_color: "text-violet-400" },
  },
] as const;

const PRICING_FAQS = [
  { q: "Can I change plans?", a: "Anytime. Prorated." },
  { q: "What happens after trial?", a: "Choose plan or downgrade to Free." },
  { q: "Do you store contracts?", a: "No. Metadata only. You keep files." },
] as const;

function PricingSection() {
  const { ref, isVisible } = useScrollReveal();
  const [isAnnual, setIsAnnual] = useState(false);
  const [priceKey, setPriceKey] = useState(0);

  const handleToggle = () => {
    setIsAnnual(!isAnnual);
    setPriceKey((prev) => prev + 1);
  };

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-950 py-24 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2
            className={`font-display text-[36px] font-bold text-slate-100 mb-2 ${
              isVisible ? "animate-fade-up" : "opacity-0"
            }`}
          >
            Simple Pricing
          </h2>
          <p
            className={`text-sm text-slate-400 ${
              isVisible ? "animate-fade-up" : "opacity-0"
            }`}
            style={{ animationDelay: "100ms" }}
          >
            No setup fees. No hidden costs. Cancel anytime.
          </p>
        </div>

        {/* Annual Toggle */}
        <div
          className={`flex items-center justify-center gap-3 mb-8 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
          style={{ animationDelay: "200ms" }}
        >
          <span className={`text-sm font-medium ${!isAnnual ? "text-cyan-500" : "text-slate-500"}`}>
            Monthly
          </span>
          {/* Toggle */}
          <button
            onClick={handleToggle}
            className="relative w-12 h-6 bg-slate-800 rounded-full transition-colors"
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-slate-200 shadow transition-transform duration-200 ${
                isAnnual ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isAnnual ? "text-cyan-500" : "text-slate-500"}`}>
              Annual
            </span>
            {isAnnual && (
              <span className="text-[10px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded animate-save-badge">
                Save 20%
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards - Connected Horizontal Layout */}
        <div className="hidden md:flex gap-0">
          {PRICING_PLANS_NEW.map((plan, index) => (
            <div
              key={plan.id}
              className={`relative flex-1 ${plan.bg} ${plan.border} pricing-card-base ${
                plan.popular ? "pricing-card-popular" : ""
              } ${isVisible ? "animate-pricing-card" : "opacity-0"} pricing-stagger-${index + 1}`}
              style={{
                borderRadius:
                  index === 0
                    ? "16px 0 0 16px"
                    : index === 2
                    ? "0 16px 16px 0"
                    : "0",
              }}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 text-[10px] font-bold px-3 py-1 rounded-full animate-popular-badge">
                  MOST POPULAR
                </div>
              )}

              <div className="p-6">
                {/* Plan Name */}
                <p className={`text-[11px] uppercase tracking-wider ${plan.nameColor} mb-2`}>
                  {plan.name}
                </p>

                {/* Price */}
                <div key={priceKey} className="flex items-baseline gap-1 animate-price-flip">
                  <span className={`font-bold text-slate-100 ${plan.priceSize}`}>
                    {plan.monthlyPrice === 0 ? "$0" : `$${isAnnual ? plan.annualPrice : plan.monthlyPrice}`}
                  </span>
                  <span className="text-sm text-slate-400">/month</span>
                </div>

                {/* Tagline */}
                <p className="text-[13px] text-slate-400 mt-2 mb-4">{plan.tagline}</p>

                {/* Features */}
                <div className="space-y-1.5 mb-4">
                  {plan.features.map((feature, fIndex) => (
                    <div
                      key={feature.text}
                      className={`flex items-center gap-2 text-[13px] text-slate-300 ${
                        isVisible ? "animate-feature" : "opacity-0"
                      } feature-stagger-${fIndex + 1}`}
                    >
                      <Check className={`w-4 h-4 ${feature.checkColor}`} />
                      {feature.text}
                    </div>
                  ))}
                </div>

                {/* Limitation */}
                {plan.limitation && (
                  <p className="text-[12px] text-slate-500 mb-4 line-through">
                    {plan.limitation}
                  </p>
                )}

                {/* Value Prop */}
                {plan.valueProp && (
                  <div className={`text-[12px] ${plan.valueProp.text_color} ${plan.valueProp.bg} rounded px-2 py-1 mb-4`}>
                    {plan.valueProp.text}
                  </div>
                )}

                {/* CTA */}
                <button
                  className={`w-full ${plan.ctaHeight} rounded-lg text-sm font-medium transition-all pricing-cta-hover ${plan.ctaStyle}`}
                >
                  {plan.ctaText}
                  {plan.popular && <ArrowRight className="inline w-4 h-4 ml-2" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Vertical Stack */}
        <div className="md:hidden space-y-4">
          {PRICING_PLANS_NEW.map((plan, index) => (
            <div
              key={plan.id}
              className={`relative ${plan.bg} ${plan.border} rounded-2xl p-5 ${
                plan.popular ? "pricing-card-popular" : ""
              } ${isVisible ? "animate-pricing-card" : "opacity-0"} pricing-stagger-${index + 1}`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 text-[10px] font-bold px-3 py-1 rounded-full animate-popular-badge">
                  MOST POPULAR
                </div>
              )}

              {/* Plan Name */}
              <p className={`text-[11px] uppercase tracking-wider ${plan.nameColor} mb-2`}>
                {plan.name}
              </p>

              {/* Price */}
              <div key={priceKey} className="flex items-baseline gap-1 animate-price-flip">
                <span className={`font-bold text-slate-100 ${plan.priceSize}`}>
                  {plan.monthlyPrice === 0 ? "$0" : `$${isAnnual ? plan.annualPrice : plan.monthlyPrice}`}
                </span>
                <span className="text-sm text-slate-400">/month</span>
              </div>

              {/* Tagline */}
              <p className="text-[13px] text-slate-400 mt-1 mb-4">{plan.tagline}</p>

              {/* Features */}
              <div className="space-y-1 mb-4">
                {plan.features.map((feature) => (
                  <div
                    key={feature.text}
                    className="flex items-center gap-2 text-[13px] text-slate-300"
                  >
                    <Check className={`w-4 h-4 ${feature.checkColor}`} />
                    {feature.text}
                  </div>
                ))}
              </div>

              {/* Value Prop */}
              {plan.valueProp && (
                <div className={`text-[12px] ${plan.valueProp.text_color} ${plan.valueProp.bg} rounded px-2 py-1 mb-4`}>
                  {plan.valueProp.text}
                </div>
              )}

              {/* CTA */}
              <button
                className={`w-full ${plan.ctaHeight} rounded-lg text-sm font-medium transition-all ${plan.ctaStyle}`}
              >
                {plan.ctaText}
              </button>
            </div>
          ))}
        </div>

        {/* Comparison Row */}
        <div
          className={`mt-6 bg-slate-900 border border-slate-800 rounded-xl p-4 text-center ${
            isVisible ? "animate-comparison" : "opacity-0"
          }`}
          style={{ animationDelay: "700ms" }}
        >
          <button className="text-sm text-slate-300 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2 mx-auto">
            Compare all features
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* FAQ Micro-Section */}
        <div
          className={`border-t border-slate-800 mt-8 pt-6 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
          style={{ animationDelay: "900ms" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRICING_FAQS.map((faq, index) => (
              <div
                key={faq.q}
                className={`text-center ${
                  isVisible ? "animate-faq-item" : "opacity-0"
                } faq-stagger-${index + 1}`}
              >
                <p className="text-[13px] text-slate-300 mb-1">{faq.q}</p>
                <p className="text-[13px] text-slate-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 7 - Final CTA (Stripped Close)
// ============================================

function FinalCTASection() {
  const { ref, isVisible } = useScrollReveal();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
    }
  };

  return (
    <section
      ref={ref}
      className="relative z-10 bg-slate-950 py-24 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-[480px] mx-auto text-center">
        {/* Headline */}
        <h2
          className={`font-display text-[36px] font-bold text-slate-100 leading-tight mb-3 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
        >
          Ready to never miss a renewal?
        </h2>

        {/* Sub */}
        <p
          className={`text-sm text-slate-400 mb-8 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
          style={{ animationDelay: "250ms" }}
        >
          Join 2,000+ teams tracking contracts without stress.
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={`flex h-14 mb-5 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
          style={{ animationDelay: "400ms" }}
        >
          {!isSubmitted ? (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="work@company.com"
                className="flex-1 h-full px-5 bg-slate-800 text-slate-200 placeholder-slate-500 border border-slate-700 rounded-l-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
              />
              <button
                type="submit"
                className="w-[140px] h-full bg-cyan-600 text-slate-950 font-medium rounded-r-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full h-full bg-slate-800 rounded-xl flex items-center justify-center text-slate-200 animate-form-success">
              Check your email
            </div>
          )}
        </form>

        {/* Trust Line */}
        <div
          className={`flex items-center justify-center gap-4 text-xs text-slate-500 ${
            isVisible ? "animate-fade-up" : "opacity-0"
          }`}
          style={{ animationDelay: "500ms" }}
        >
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Free 14-day trial
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 3: Section 8 - Footer Conversion
// ============================================

function Footer() {
  const [email, setEmail] = useState("");
  const [isJoined, setIsJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsJoined(true);
    }
  };

  return (
    <footer className="relative z-10 bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1000px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left Column - Brand */}
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <div className="w-6 h-6 rounded bg-cyan-400 flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-950" />
            </div>
            <span className="font-display text-lg font-bold text-slate-100">
              Renewly
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Contract renewals, simplified.
          </p>
          {/* Social */}
          <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
            <Twitter className="w-5 h-5 text-slate-600 hover:text-slate-300 transition-colors cursor-pointer" />
            <Linkedin className="w-5 h-5 text-slate-600 hover:text-slate-300 transition-colors cursor-pointer" />
            <Globe className="w-5 h-5 text-slate-600 hover:text-slate-300 transition-colors cursor-pointer" />
          </div>
        </div>

        {/* Right Column - Newsletter */}
        <div className="text-center md:text-right">
          <h3 className="text-base font-bold text-slate-200 mb-1">
            Get renewal tips
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Monthly insights. No spam. Unsubscribe anytime.
          </p>
          <form onSubmit={handleJoin} className="flex">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-[200px] h-9 px-3 bg-slate-800 text-slate-200 text-sm placeholder-slate-500 border border-slate-700 rounded-l-lg focus:border-cyan-500 outline-none transition-all"
            />
            <button
              type="submit"
              className={`w-20 h-9 text-sm font-medium rounded-r-lg transition-all ${
                isJoined
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-cyan-600 text-slate-950 hover:bg-cyan-500"
              }`}
            >
              {isJoined ? "Joined!" : "Join"}
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// Phase 3: Section 9 - Floating Action Button
// ============================================

function FloatingActionButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:hidden z-50 animate-fab-slide">
      <Link href="/dashboard" className="w-full h-12 bg-cyan-600 text-slate-950 font-medium rounded-xl flex items-center justify-center gap-2 shadow-[0_-4px_20px_rgba(8,145,178,0.3)] animate-fab-pulse">
        Start Free Trial
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ============================================
// Phase 2: Section 8 - Final CTA (OLD - removed, using Phase 3 version)
// ============================================

// Main Page Component
export default function Home() {
  return (
    <main className="relative min-h-screen bg-slate-950">
      {/* Dotted Background */}
      <DottedBackground />

      {/* Navigation */}
      <NavigationBar />

      {/* Hero Section */}
      <HeroSection />

      {/* Stats Overview */}
      <StatsOverview />

      {/* Dashboard Preview */}
      <DashboardPreview />

      {/* Features Grid */}
      <FeaturesGrid />

      {/* Phase 2 Sections */}
      <ProblemSolutionSection />
      <BenefitsGridSection />
      <FeatureDeepDiveSection />
      <SocialProofSection />
      <ConnectedPathSection />

      {/* Phase 3 Sections */}
      <WhyRenewlySection />
      <RedditTruthSection />
      <WhoUsesItSection />
      <PainToSolutionSection />
      <IndustryFitSection />
      <PricingSection />

      {/* Comparison & FAQ */}
      <ComparisonSection />
      <FAQSection />

      {/* Final CTA */}
      <FinalCTASection />

      {/* Footer */}
      <Footer />

      {/* Floating Action Button (Mobile) */}
      <FloatingActionButton />
    </main>
  );
}
