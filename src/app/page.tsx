"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  Search,
  ArrowRight,
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
  ChevronDown,
  Table,
  Minus,
  Check,
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
  Quote,
} from "lucide-react";
import {
  ANIMATION_DELAY_MS,
  ANIMATION_DELAY_LONG_MS,
  ANIMATION_DELAY_VERY_LONG_MS,
  TRANSITION_DELAY_MS,
} from "@/lib/constants";
import { DEFAULT_MOBILE_BREAKPOINT, useIsMobile } from "@/hooks/use-mobile";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";
import { SITE_URL } from "@/lib/site-url";
import { FAQ_ITEMS, WORKFLOW_HIGHLIGHTS } from "@/components/landing/homepage-static-content";
import { BILLING_ENABLED } from "@/lib/billing/mode";

const HOMEPAGE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Doc Renewal",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      description:
        "Doc Renewal helps small teams track contracts and avoid missed renewal deadlines.",
    },
    {
      "@type": "WebSite",
      name: "Doc Renewal",
      url: SITE_URL,
    },
    {
      "@type": "SoftwareApplication",
      name: "Doc Renewal",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "A contract renewal tracker for small teams with reminders, deadline views, and renewal workflows.",
      featureList: [
        "Contract renewal tracking dashboard",
        "Renewal reminder emails",
        "Renewal status and due-date visibility",
      ],
    },
  ],
};

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
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), ANIMATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (mobileMenuOpen) {
        setIsHidden(false);
      } else {
        // Hide/show on scroll direction
        if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
          setIsHidden(true);
        } else {
          setIsHidden(false);
        }
      }

      // Hide/show on scroll direction
      lastScrollY.current = currentScrollY;

      // Calculate scroll progress
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (currentScrollY / docHeight) * 100 : 0;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${DEFAULT_MOBILE_BREAKPOINT}px)`);
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileMenuOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  // Active section detection
  useEffect(() => {
    const sections = [
      "features",
      "benefits",
      "how-it-works",
      ...(BILLING_ENABLED ? ["pricing"] : []),
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
    ...(BILLING_ENABLED ? [{ label: "Pricing", href: "#pricing" }] : []),
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
            Doc Renewal
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
          <Link
            href="/login"
            className="hidden sm:flex h-9 px-4 items-center text-sm text-slate-300 border border-slate-700 rounded-full hover:border-slate-600 hover:text-slate-100 transition-all duration-200 focus-ring"
          >
            Sign In
          </Link>
          
          {/* Get Started Button */}
          <Link
            href="/signup"
            className="hidden sm:flex h-9 px-4 items-center text-sm bg-cyan-500 text-white rounded-full hover:bg-cyan-600 transition-all duration-200 focus-ring"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors rounded-lg hover:bg-slate-800/50 focus-ring"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
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
      {mobileMenuOpen && isMobile && (
        <div
          id="landing-mobile-menu"
          className="md:hidden fixed inset-0 top-16 bg-black/65 backdrop-blur-md z-40 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
        >
          <div className="h-[calc(100vh-4rem)] overflow-y-auto px-4 py-5">
            <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/20 bg-slate-950/78 backdrop-blur-2xl shadow-[0_16px_60px_rgba(2,6,23,0.72)] p-4">
              <div className="space-y-2">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`min-h-[48px] w-full rounded-xl border px-4 py-3 text-base font-medium transition-all flex items-center ${
                      activeSection === link.href.slice(1)
                        ? "border-cyan-400/55 bg-cyan-400/16 text-cyan-100"
                        : "border-white/15 bg-slate-900/65 text-slate-100 hover:bg-slate-900/80 hover:border-white/25"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="my-4 h-px bg-white/15" />

              <div className="grid grid-cols-1 gap-3">
                <Link
                  href="/login"
                  className="w-full h-12 text-base text-white bg-slate-800/75 border border-white/30 rounded-xl hover:bg-slate-700/85 hover:border-white/40 transition-all focus-ring flex items-center justify-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="w-full h-12 text-base text-white font-semibold bg-cyan-500 rounded-xl border border-cyan-300/70 hover:bg-cyan-400 transition-all focus-ring flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(6,182,212,0.3)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// Hero Section Component - Golden Constellation
function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    type Node = {
      x: number;
      y: number;
      radius: number;
      alpha: number;
      pulse: number;
      speed: number;
      vx: number;
      vy: number;
      hue: number;
    };

    let width = 1;
    let height = 1;
    let nodes: Node[] = [];
    let isInView = true;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const createNodes = (count: number, w: number, h: number): Node[] =>
      Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 2.2 + 0.6,
        alpha: Math.random() * 0.7 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.018 + 0.008,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        hue: Math.random() * 20 + 38,
      }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nodeCount = width < 640 ? 55 : width < 1024 ? 75 : 90;
      nodes = createNodes(nodeCount, width, height);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance < 130) {
            context.beginPath();
            context.moveTo(nodes[i].x, nodes[i].y);
            context.lineTo(nodes[j].x, nodes[j].y);
            context.strokeStyle = `rgba(212, 168, 64, ${(1 - distance / 130) * 0.2})`;
            context.lineWidth = 0.6;
            context.stroke();
          }
        }
      }

      nodes.forEach((node) => {
        node.pulse += node.speed;
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0) node.x = width;
        if (node.x > width) node.x = 0;
        if (node.y < 0) node.y = height;
        if (node.y > height) node.y = 0;

        const glow = (Math.sin(node.pulse) + 1) / 2;
        const radius = node.radius * (0.8 + glow * 0.5);
        const gradient = context.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          radius * 5
        );

        gradient.addColorStop(0, `hsla(${node.hue}, 80%, 68%, ${node.alpha * 0.35})`);
        gradient.addColorStop(1, "transparent");

        context.beginPath();
        context.arc(node.x, node.y, radius * 5, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();

        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = `hsla(${node.hue}, 90%, 78%, ${node.alpha})`;
        context.fill();
      });
    };

    const stop = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    const loop = () => {
      draw();
      animationRef.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (animationRef.current === null && !mediaQuery.matches && isInView) {
        animationRef.current = requestAnimationFrame(loop);
      }
    };

    const renderBasedOnMotionPreference = () => {
      stop();
      draw();
      start();
    };

    resize();
    renderBasedOnMotionPreference();

    const handleResize = () => {
      resize();
      renderBasedOnMotionPreference();
    };

    const handleMotionChange = () => {
      renderBasedOnMotionPreference();
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isInView = entry.isIntersecting;
        if (isInView) {
          renderBasedOnMotionPreference();
        } else {
          stop();
        }
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(canvas);

    window.addEventListener("resize", handleResize, { passive: true });
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMotionChange);
    } else {
      mediaQuery.addListener(handleMotionChange);
    }

    return () => {
      stop();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleMotionChange);
      } else {
        mediaQuery.removeListener(handleMotionChange);
      }
    };
  }, []);

  return (
    <section
      id="contract-renewal-hero"
      aria-labelledby="hero-title"
      aria-describedby="hero-subtitle"
      className="relative z-10 flex min-h-[clamp(560px,82vh,860px)] items-center justify-center overflow-hidden bg-[#06060A] px-4 pt-16 sm:px-6 lg:px-8"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <header className="relative z-[2] mx-auto flex w-full max-w-[700px] flex-col items-center px-2 text-center sm:px-12">
        <div className="relative mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(212,168,64,0.4)]">
          <div className="h-5 w-5 rotate-45 border border-[rgba(212,168,64,0.6)]" />
          <div className="absolute h-16 w-16 rounded-full border border-[rgba(212,168,64,0.12)]" />
        </div>

        <div className="mb-5 text-[9px] uppercase tracking-[0.45em] text-[rgba(212,168,64,0.55)] sm:mb-7 sm:text-[10px] sm:tracking-[0.55em]">
            Doc Renewal · Contract Renewal Tracker
        </div>

        <h1
          id="hero-title"
          className="mb-5 text-[clamp(34px,9vw,86px)] font-light leading-[1.12] tracking-[0.03em] text-[#F0E8D0] sm:mb-6"
          style={{ fontFamily: "Cormorant Garamond, Cormorant, Georgia, serif" }}
        >
          Never miss a
          <br />
          <span className="italic text-[#D4A840]">contract renewal deadline</span>
          <br />
          again.
        </h1>

        <p
          id="hero-subtitle"
          className="max-w-[560px] text-[15px] leading-[1.65] text-[rgba(240,232,208,0.65)] sm:text-[17px] sm:leading-[1.8]"
        >
          Doc Renewal helps small teams track contracts, send reminder emails before
          due dates, and manage all renewals in one simple dashboard.
        </p>

      </header>
    </section>
  );
}

function HeroInfoCardsSection() {
  return (
    <section className="relative z-10 px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-5 text-left md:grid-cols-2">
          <article className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all duration-300 card-border-transition">
            <h2 className="mb-1 text-base font-semibold text-slate-100">
              Who this is for
            </h2>
            <p className="text-[13px] leading-5 text-slate-400">
              Small teams managing vendor renewals, software contracts, and recurring agreements.
              {" "}
              <Link href="/signup" className="text-cyan-300 underline underline-offset-4">
                Create your account
              </Link>
              {" "}
              to start tracking contracts today.
            </p>
          </article>

          <article className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all duration-300 card-border-transition">
            <h2 className="mb-1 text-base font-semibold text-slate-100">
              How it works
            </h2>
            <p className="text-[13px] leading-5 text-slate-400">
              Add each contract, set reminder dates, and monitor upcoming renewals in one dashboard.
              {" "}
              <a href="#how-it-works" className="text-cyan-300 underline underline-offset-4">
                See the workflow
              </a>
              {" "}
              and planning steps.
            </p>
          </article>
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
    const timer = setTimeout(() => setIsVisible(true), ANIMATION_DELAY_LONG_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`group bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all duration-300 card-border-transition ${
        isVisible ? `animate-fade-up ${delay}` : "stagger-hidden"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}
        >
          {icon}
        </div>
        <div>
          <div className="font-display text-lg font-semibold text-slate-100 mb-0.5 font-mono-data leading-5">
            {metric}
          </div>
          <div className="text-[13px] leading-5 text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Stats Overview Section
function StatsOverview() {
  const stats = [
    {
      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      iconColor: "bg-emerald-500/20",
      metric: "Track",
      label: "Contract status in one dashboard",
      delay: "card-stagger-1",
    },
    {
      icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
      iconColor: "bg-amber-500/20",
      metric: "Alert",
      label: "Configurable reminder schedules",
      delay: "card-stagger-2",
    },
    {
      icon: <LayoutDashboard className="w-5 h-5 text-cyan-500" />,
      iconColor: "bg-cyan-500/20",
      metric: "Review",
      label: "Billing and export controls",
      delay: "card-stagger-3",
    },
  ];

  return (
    <section className="relative z-10 px-4 sm:px-6 lg:px-8 pb-8 sm:pb-10 lg:pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

function _ContractRow({
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

// Dashboard Preview Section - Honest Product Shot with Float Animation
function DashboardPreview() {
  const contracts = [
    {
      company: "AWS Support",
      contract: "Business Plan",
      date: "Dec 15, 2024",
      status: "active" as const,
      daysLeft: 45,
    },
    {
      company: "Notion Team",
      contract: "Enterprise",
      date: "Dec 28, 2024",
      status: "expiring" as const,
      daysLeft: 32,
    },
    {
      company: "Figma Pro",
      contract: "Annual License",
      date: "Jan 5, 2025",
      status: "active" as const,
      daysLeft: 66,
    },
  ];

  return (
    <section className="relative z-10 px-4 sm:px-6 lg:px-8 pt-6 pb-14 sm:pb-16 lg:pb-20 hidden md:block">
      <div className="max-w-5xl mx-auto">
        <div className="animate-dashboard-float">
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            {/* App Chrome */}
            <div className="h-10 bg-[#050505] border-b border-white/[0.06] flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span>Dashboard</span>
                <span className="text-white/20">/</span>
                <span>Contracts</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500" />
            </div>

            {/* App Body */}
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-medium text-lg">Contracts</h3>
                <button className="h-9 px-4 text-sm font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Contract
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="py-3 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-[40%]">
                        Contract
                      </th>
                      <th className="py-3 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-[20%]">
                        End Date
                      </th>
                      <th className="py-3 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-[15%]">
                        Status
                      </th>
                      <th className="py-3 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-[15%]">
                        Days Left
                      </th>
                      <th className="py-3 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-[10%]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((contract, index) => (
                      <tr key={index} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm font-medium text-white/60">
                              {contract.company.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white/90">{contract.company}</div>
                              <div className="text-xs text-white/40">{contract.contract}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-white/60">{contract.date}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${
                            contract.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                          }`}>
                            {contract.status === "active" ? "Active" : "Expiring"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-white/90 w-8">{contract.daysLeft}</span>
                            <div className="flex-1 max-w-[80px]">
                              <div className={`h-1.5 rounded-full ${
                                contract.status === "active" ? "bg-emerald-500/20" : "bg-amber-500/20"
                              }`}>
                                <div className={`h-full rounded-full ${
                                  contract.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                                }`} style={{ width: `${Math.min((contract.daysLeft / 90) * 100, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <button className="w-8 h-8 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
    const timer = setTimeout(() => setIsVisible(true), ANIMATION_DELAY_VERY_LONG_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`group relative bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden ${
        isVisible ? `animate-fade-up ${delay}` : "stagger-hidden"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>

        <h3 className="font-display text-base font-semibold text-slate-100 mb-2">
          {title}
        </h3>

        <p className="text-[13px] leading-5 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

// Features Grid Section (Phase 1)
function FeaturesGrid() {
  const features = [
    {
      icon: <Bell className="w-5 h-5 text-cyan-500" />,
      title: "Smart Reminders",
      description:
        "Schedule reminders at practical intervals before renewal dates and keep stakeholders informed by email.",
      delay: "card-stagger-1",
    },
    {
      icon: <Clock className="w-5 h-5 text-cyan-500" />,
      title: "Visual Countdown",
      description:
        "See days left, status, and renewal urgency in one focused dashboard view.",
      delay: "card-stagger-2",
    },
    {
      icon: <Mail className="w-5 h-5 text-cyan-500" />,
      title: "Contract Details Hub",
      description:
        "Store core contract details, reminder schedules, and notes in one place for consistent follow-through.",
      delay: "card-stagger-3",
    },
  ];

  return (
    <section
      id="features"
      className="relative z-10 bg-slate-950 pt-8 sm:pt-10 lg:pt-12 pb-14 sm:pb-16 lg:pb-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
            Everything you need to stay ahead
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Powerful features designed to make contract management effortless
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
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
      title: "Fast Setup",
      description: "Add contracts with a guided form and start tracking renewals immediately.",
    },
    {
      number: "03",
      icon: <Users className="w-8 h-8" />,
      title: "Clear Visibility",
      description: "Track statuses and renewal dates in one place instead of scattered spreadsheets.",
    },
    {
      number: "04",
      icon: <FileCheck className="w-8 h-8" />,
      title: "Exportable Data",
      description: "Export contract data to CSV when premium export access is enabled.",
    },
    {
      number: "05",
      icon: <GitBranch className="w-8 h-8" />,
      title: "Flexible Reminder Rules",
      description: "Choose reminder offsets (for example 60, 30, 14, 7, 3, and 1 day) per contract.",
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
    <section id="benefits" ref={ref} className="relative z-10 bg-slate-950 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      {/* Dot pattern background */}
      <div className="absolute inset-0 dotted-background opacity-10" />

      <div className="max-w-[1200px] mx-auto relative">
        {/* Header */}
        <div className={`text-center mb-16 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            Why teams choose Doc Renewal
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
              Configure reminder schedules per contract and send renewal notifications by email before deadlines.
            </p>

            {/* Checklist */}
            <div className="space-y-4">
              {[
                "Email reminders with configurable schedules",
                "Additional notification recipients supported",
                "Unlimited reminder emails included",
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
              Monitor contract status and days-left indicators so renewal deadlines are visible before they become urgent.
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
    { icon: <FileCheck className="w-5 h-5" />, label: "Contracts", angle: -72 },
    { icon: <Bell className="w-5 h-5" />, label: "Reminders", angle: -36 },
    { icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard", angle: 0 },
    { icon: <CreditCard className="w-5 h-5" />, label: "Billing", angle: 36 },
    { icon: <Table className="w-5 h-5" />, label: "CSV Export", angle: 72 },
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
              WORKFLOW
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-6">
              Keep renewal work in one system
            </h2>
            <p className="font-body text-lg text-slate-400 leading-relaxed">
              Capture contract details, configure reminders, monitor status, and manage billing from a single product surface.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Phase 2: Section 4 - Workflow Highlights
// ============================================
interface HighlightCardProps {
  title: string;
  description: string;
  tag: string;
  featured?: boolean;
}

function HighlightCard({ title, description, tag, featured }: HighlightCardProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`relative bg-slate-900/60 border border-slate-800 rounded-2xl ${
        featured ? "p-8" : "p-7"
      } card-hover-lift ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}
    >
      {/* Highlight Icon */}
      <CheckCircle className="absolute top-4 left-4 w-10 h-10 text-slate-800" />

      {/* Title */}
      <p className={`font-body text-slate-200 leading-relaxed relative z-10 ${featured ? "text-base" : "text-[15px]"}`}>
        {title}
      </p>

      {/* Description */}
      <p className="text-sm text-slate-400 mt-3 relative z-10">
        {description}
      </p>

      {/* Tag */}
      <div className="flex items-center gap-3 mt-5 relative z-10">
        <span className="text-xs font-medium uppercase tracking-wider text-cyan-400">{tag}</span>
      </div>
    </div>
  );
}

function WorkflowHighlightsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="workflow-highlights" ref={ref} className="relative z-10 py-20 sm:py-32 px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(to bottom, #0f172a, #020617)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            Workflow highlights
          </h2>
          <p className="text-slate-400 text-lg">
            Clear tracking, configurable reminders, and straightforward billing controls.
          </p>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {WORKFLOW_HIGHLIGHTS.map((highlight, index) => (
            <HighlightCard key={index} {...highlight} />
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
    title: "Add", 
    description: "Create a contract record",
    icon: Upload,
    bgColor: "bg-indigo-500/10",
    bgColorActive: "bg-indigo-500/20",
    iconColor: "text-indigo-400",
  },
  { 
    id: 2, 
    title: "Schedule", 
    description: "Choose reminder intervals",
    icon: Sparkles,
    bgColor: "bg-violet-500/10",
    bgColorActive: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
  { 
    id: 3, 
    title: "Track", 
    description: "Monitor status and days left",
    icon: Bell,
    bgColor: "bg-amber-500/10",
    bgColorActive: "bg-amber-500/20",
    iconColor: "text-amber-400",
  },
  { 
    id: 4, 
    title: "Act", 
    description: "Update, renew, or export",
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

function IconContainer({ step, state, isAnimating: _isAnimating, iconAnimation }: IconContainerProps) {
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

function _MobileStepCard({ step, state, iconAnimation: _iconAnimation, showConnector, connectorState }: MobileStepCardProps) {
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
  const _cardPositions = [0, 33.33, 66.66, 100];

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
      className="relative z-10 bg-slate-950 py-20 sm:py-28 px-4 sm:px-6 lg:px-8"
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
          <h2 className="font-display text-3xl sm:text-[44px] font-bold text-slate-100 mb-4">
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
    { label: "Renewal date visibility", spreadsheet: { icon: "minus", text: "Varies" }, crm: { icon: "minus", text: "Varies" }, docRenewal: { icon: "check", text: "Included" } },
    { label: "Contract status tracking", spreadsheet: { icon: "minus", text: "Manual" }, crm: { icon: "minus", text: "Generic" }, docRenewal: { icon: "check", text: "Focused" } },
    { label: "Reminder scheduling", spreadsheet: { icon: "x", text: "Limited" }, crm: { icon: "minus", text: "Depends" }, docRenewal: { icon: "check", text: "Included" } },
    { label: "Email reminders", spreadsheet: { icon: "x", text: "External setup" }, crm: { icon: "minus", text: "Depends" }, docRenewal: { icon: "check", text: "5 free emails" } },
    { label: "CSV export", spreadsheet: { icon: "check", text: "Native" }, crm: { icon: "minus", text: "Depends" }, docRenewal: { icon: "check", text: "Premium" } },
    { label: "Billing controls", spreadsheet: { icon: "x", text: "N/A" }, crm: { icon: "minus", text: "Varies" }, docRenewal: { icon: "check", text: "Included" } },
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
    <section ref={ref} className="relative z-10 bg-slate-900 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? "scroll-reveal visible" : "scroll-reveal"}`}>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            Where Doc Renewal is focused
          </h2>
          <p className="text-lg text-slate-400">
            A feature-level view of renewal tracking coverage
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
                <span className="font-bold">Doc Renewal</span>
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
                  {getIcon(feature.docRenewal.icon)}
                  <span className={`text-sm font-medium ${getTextColor(feature.docRenewal.icon)}`}>
                    {feature.docRenewal.text}
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
          {FAQ_ITEMS.map((faq, index) => (
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
// Phase 3: Section 1 - Why Doc Renewal (Logic Grid)
// ============================================

const IMPACT_CARDS = [
  {
    icon: TrendingUp,
    label: "VISIBILITY",
    metric: "Clear",
    context: "Renewal dates and statuses in one dashboard",
    miniProof: "Focused contract tracking",
    cornerColor: "bg-cyan-500",
    iconColor: "text-cyan-400",
  },
  {
    icon: Clock,
    label: "PACE",
    metric: "Fast",
    context: "Create and update contracts without spreadsheet overhead",
    miniProof: "Form-based contract workflow",
    cornerColor: "bg-emerald-500",
    iconColor: "text-emerald-400",
  },
  {
    icon: Shield,
    label: "CONTROL",
    metric: "Proactive",
    context: "Configurable reminders before important renewal deadlines",
    miniProof: "Email reminder scheduling",
    cornerColor: "bg-amber-500",
    iconColor: "text-amber-400",
  },
  {
    icon: Zap,
    label: "BILLING",
    metric: "Simple",
    context: "Free, monthly, and yearly plans with clear feature gates",
    miniProof: "Billing portal and entitlements",
    cornerColor: "bg-violet-500",
    iconColor: "text-violet-400",
  },
] as const;

function WhyDocRenewalSection() {
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
// Phase 3: Section - Common Renewal Pains
// ============================================

const REDDIT_CARDS = [
  {
    id: 1,
    accentColor: "bg-rose-500",
    accentBorderColor: "hover:border-rose-500",
    quoteIconBg: "bg-rose-500/20",
    quoteIconColor: "text-rose-400",
    numberBadge: "30/60 days",
    numberColor: "text-rose-400",
    quote:
      "A cancellation request was rejected and the contract was auto-renewed for another 12 months due to notice-window dispute.",
    source: "r/legaladvice · Automatic renewal / contract dispute (Feb 2025)",
    sourceUrl:
      "https://www.reddit.com/r/legaladvice/comments/1iyaw0j/automatic_renewal_contract_dispute/",
    solutionBadge: "NOTICE PERIOD GUARD",
    solutionBadgeBg: "bg-cyan-500/10",
    solutionBadgeText: "text-cyan-400",
    solutionTitle: "Our MVP tracks contract renewal and cancellation deadlines",
    solutionDesc:
      "Use one contract renewal tracker to monitor end dates and notice periods before they roll over.",
    ctaText: "Track notice windows →",
    ctaColor: "text-cyan-400",
  },
  {
    id: 2,
    accentColor: "bg-amber-500",
    accentBorderColor: "hover:border-amber-500",
    quoteIconBg: "bg-amber-500/20",
    quoteIconColor: "text-amber-400",
    numberBadge: "89 days",
    numberColor: "text-amber-400",
    quote:
      "Even after notice was reportedly sent, teams still struggled with auto-renewal disputes and renewal deadlines.",
    source:
      "r/salesforce · 89 days notice but auto-renewal dispute (Jan 2026)",
    sourceUrl:
      "https://www.reddit.com/r/salesforce/comments/1ql248u/despite_89_days_notice_salesforce_is_refusing_to/",
    solutionBadge: "AUTO-PILOT TRACKING",
    solutionBadgeBg: "bg-emerald-500/10",
    solutionBadgeText: "text-emerald-400",
    solutionTitle: "Our MVP gives one renewal timeline for each contract",
    solutionDesc:
      "Centralized renewal deadline tracking helps teams act earlier and avoid last-minute vendor lock-ins.",
    ctaText: "See renewal timeline →",
    ctaColor: "text-emerald-400",
  },
  {
    id: 3,
    accentColor: "bg-violet-500",
    accentBorderColor: "hover:border-violet-500",
    quoteIconBg: "bg-violet-500/20",
    quoteIconColor: "text-violet-400",
    numberBadge: "Manual",
    numberColor: "text-violet-400",
    quote:
      "Admins described using Outlook, spreadsheets, and scripts because renewal tracking stayed manual and fragmented.",
    source: "r/sysadmin · Methods for tracking license renewals (Feb 2024)",
    sourceUrl:
      "https://www.reddit.com/r/sysadmin/comments/1agr6jm/methods_for_tracking_license_renewals/",
    solutionBadge: "PROFESSIONAL GRADE",
    solutionBadgeBg: "bg-indigo-500/10",
    solutionBadgeText: "text-indigo-400",
    solutionTitle: "Our MVP replaces spreadsheets with one contract dashboard",
    solutionDesc:
      "Store renewal terms, due dates, and reminders in one place instead of scattered tools.",
    ctaText: "Replace spreadsheets →",
    ctaColor: "text-indigo-400",
  },
  {
    id: 4,
    accentColor: "bg-cyan-500",
    accentBorderColor: "hover:border-cyan-500",
    quoteIconBg: "bg-cyan-500/20",
    quoteIconColor: "text-cyan-400",
    numberBadge: "At scale",
    numberColor: "text-cyan-400",
    quote:
      "IT managers called spreadsheets the worst option at scale for renewal tracking and reminder follow-up.",
    source: "r/ITManagers · Renewal tracking software thread (Mar 2026)",
    sourceUrl:
      "https://www.reddit.com/r/ITManagers/comments/1mzzhw4/renewal_tracking_software/",
    solutionBadge: "TRIPLE WARNING SYSTEM",
    solutionBadgeBg: "bg-cyan-500/10",
    solutionBadgeText: "text-cyan-400",
    solutionTitle: "Our MVP sends proactive contract reminder alerts",
    solutionDesc:
      "Set reminder offsets (for example 60/30/14/7 days) so teams have time to review and negotiate.",
    ctaText: "Set reminder alerts →",
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
              REDDIT-VERIFIED RENEWAL PAINS
            </span>
          </div>

          {/* Headline */}
          <h2
            className={`font-display text-[40px] font-bold text-slate-100 mb-3 ${
              isVisible ? "animate-fade-up" : "opacity-0"
            }`}
            style={{ animationDelay: "800ms" }}
          >
            Real contract renewal pain points from Reddit
          </h2>

          {/* Subheadline */}
          <p
            className={`text-base text-slate-400 ${
              isVisible ? "animate-fade-up" : "opacity-0"
            }`}
            style={{ animationDelay: "1000ms" }}
          >
            These discussions show why teams need contract renewal tracking,
            reminder alerts, and a single renewal dashboard.
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
                  —{" "}
                  <a
                    href={card.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2 hover:text-slate-300"
                  >
                    {card.source}
                  </a>
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
                <Link
                  href="/signup"
                  className={`mt-3 inline-flex text-xs font-medium ${card.ctaColor} hover:underline transition-all hover:translate-x-1 items-center gap-1`}
                >
                  {card.ctaText}
                </Link>
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
            Doc Renewal is built to reduce renewal surprises and manual follow-up work.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button className="px-5 py-3 bg-slate-800 text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-700 transition-all hover:-translate-y-0.5">
              Read more stories →
            </button>
            <button className="px-6 py-3 bg-cyan-600 text-slate-950 text-sm font-medium rounded-lg hover:bg-cyan-500 transition-all hover:-translate-y-0.5">
              Start free
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
    painDesc: "Surprise charges show up late because renewals are not tracked consistently.",
    solutionTag: "SPEND CONTROL",
    solutionColor: "bg-emerald-500/20 text-emerald-400",
    benefit: "Never miss a renewal deadline again",
    bullets: ["Contract value fields", "Days-left status", "Renewal-date visibility"],
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
    painHeadline: "Contract details are hard to retrieve",
    painDesc: "Key dates and renewal terms are scattered across inboxes and notes.",
    solutionTag: "AUDIT READY",
    solutionColor: "bg-indigo-500/20 text-indigo-400",
    benefit: "Structured contract records with export support",
    bullets: ["Consistent contract fields", "CSV export on premium", "Shared dashboard visibility"],
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
    solutionTag: "RENEWAL CONTROL",
    solutionColor: "bg-rose-500/20 text-rose-400",
    benefit: "No more surprise auto-renewals",
    bullets: ["Renewal reminders", "Vendor details", "Date visibility"],
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
                {currentRole.bullets.map((bullet, _i) => (
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
    subtext: "Set reminder offsets and receive email alerts before renewal deadlines.",
    bullets: ["Configurable day offsets", "Email reminders", "Days-left dashboard"],
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    id: "auto-renew",
    text: "Auto-renewals surprise me",
    icon: CreditCard,
    solutionIcon: ShieldCheck,
    headline: "Control every dollar",
    subtext: "Get visibility before renewal dates so you can make decisions before charges hit.",
    bullets: ["Pre-deadline alerts", "Value tracking fields", "Status visibility"],
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
    bullets: ["Guided contract form", "Search and filters", "Contract detail view"],
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
    bullets: ["Shared dashboard", "Email notifications", "Status dashboard"],
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
      setTimeout(() => setIsTransitioning(false), TRANSITION_DELAY_MS);
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
    pain: "Contract terms and dates hard to retrieve",
    solution: "DETAILS CENTRALIZED",
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
            From startups to enterprises, Doc Renewal adapts to your workflow.
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
    id: "free",
    name: "FREE",
    nameColor: "text-slate-500",
    monthlyPrice: 0,
    annualPrice: 0,
    priceSize: "text-[40px]",
    tagline: "For getting started",
    features: [
      { text: "Up to 5 contracts", checkColor: "text-emerald-400" },
      { text: "Contract dashboard", checkColor: "text-emerald-400" },
      { text: "Search and filtering", checkColor: "text-emerald-400" },
      { text: "Contract detail views", checkColor: "text-emerald-400" },
      { text: "5 reminder emails", checkColor: "text-emerald-400" },
    ],
    limitation: "CSV export and additional reminder recipients",
    ctaText: "Start Free",
    ctaHref: "/signup",
    ctaStyle: "bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-slate-100",
    ctaHeight: "h-11",
    bg: "bg-slate-900",
    border: "border-slate-800",
    popular: false,
    valueProp: null,
  },
  {
    id: "monthly",
    name: "MONTHLY",
    nameColor: "text-cyan-400",
    monthlyPrice: 19,
    annualPrice: 19,
    priceSize: "text-[48px]",
    tagline: "Premium access billed monthly",
    features: [
      { text: "Unlimited contracts", checkColor: "text-cyan-400" },
      { text: "Email reminders", checkColor: "text-cyan-400" },
      { text: "CSV export", checkColor: "text-cyan-400" },
      { text: "Billing portal access", checkColor: "text-cyan-400" },
      { text: "Live pricing in dashboard", checkColor: "text-cyan-400" },
    ],
    limitation: null,
    ctaText: "Choose Monthly",
    ctaHref: "/login?redirect=%2Fdashboard%2Fbilling",
    ctaStyle: "bg-cyan-600 text-slate-950 hover:bg-cyan-500",
    ctaHeight: "h-12",
    bg: "bg-slate-800",
    border: "border-t-2 border-cyan-500",
    popular: false,
    valueProp: null,
  },
  {
    id: "yearly",
    name: "YEARLY",
    nameColor: "text-violet-400",
    monthlyPrice: 19,
    annualPrice: 15.83,
    priceSize: "text-[40px]",
    tagline: "Premium access billed annually ($190/year)",
    features: [
      { text: "Unlimited contracts", checkColor: "text-violet-400" },
      { text: "Email reminders", checkColor: "text-violet-400" },
      { text: "CSV export", checkColor: "text-violet-400" },
      { text: "Billing portal access", checkColor: "text-violet-400" },
      { text: "Equivalent to $15.83/month", checkColor: "text-violet-400" },
    ],
    limitation: null,
    ctaText: "Choose Yearly",
    ctaHref: "/login?redirect=%2Fdashboard%2Fbilling",
    ctaStyle: "bg-slate-800 border border-slate-700 text-slate-200 hover:border-violet-400 hover:text-violet-400",
    ctaHeight: "h-11",
    bg: "bg-slate-900",
    border: "border-slate-800",
    popular: true,
    valueProp: { text: "Save 17% vs monthly billing", bg: "bg-violet-500/10", text_color: "text-violet-400" },
  },
] as const;

const PRICING_FAQS = [
  { q: "Can I change plans?", a: "Yes. You can switch in billing settings." },
  { q: "What unlocks on paid plans?", a: "Unlimited reminder emails, additional reminder recipients, and CSV export." },
  { q: "Is there a free option?", a: "Yes. Free plan includes up to 5 contracts and 5 reminder emails." },
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
                Save 17%
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
                <Link
                  href={plan.ctaHref}
                  className={`w-full ${plan.ctaHeight} rounded-lg text-sm font-medium transition-all pricing-cta-hover ${plan.ctaStyle} flex items-center justify-center`}
                >
                  {plan.ctaText}
                  {plan.popular && <ArrowRight className="inline w-4 h-4 ml-2" />}
                </Link>
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
              <Link
                href={plan.ctaHref}
                className={`w-full ${plan.ctaHeight} rounded-lg text-sm font-medium transition-all ${plan.ctaStyle} flex items-center justify-center`}
              >
                {plan.ctaText}
              </Link>
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
          <Link
            href="/login?redirect=%2Fdashboard%2Fbilling"
            className="group text-sm text-slate-300 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            Compare all features
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
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
          Start free with unlimited reminders, additional recipients, and exports included.
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
            Unlimited access included
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            No credit card required
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
              Doc Renewal
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Contract renewals, simplified.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-slate-400">
            <Link href="/privacy" className="hover:text-cyan-300 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-600">|</span>
            <Link href="/terms" className="hover:text-cyan-300 transition-colors">
              Terms of Service
            </Link>
            <span className="text-slate-600">|</span>
            <Link href="/refund-policy" className="hover:text-cyan-300 transition-colors">
              Refund Policy
            </Link>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Support:{" "}
            <a href={SUPPORT_MAILTO} className="text-cyan-300 hover:text-cyan-200 transition-colors">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Payments are processed by Creem as merchant of record.
          </p>
          {/* Social */}
          <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
            <Twitter className="w-5 h-5 text-slate-600" />
            <Linkedin className="w-5 h-5 text-slate-600" />
            <Globe className="w-5 h-5 text-slate-600" />
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
      <Link href="/signup" className="w-full h-12 bg-cyan-600 text-slate-950 font-medium rounded-xl flex items-center justify-center gap-2 shadow-[0_-4px_20px_rgba(8,145,178,0.3)] animate-fab-pulse">
        Start Free
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(HOMEPAGE_STRUCTURED_DATA),
        }}
      />

      {/* Dotted Background */}
      <DottedBackground />

      {/* Navigation */}
      <NavigationBar />

      {/* Hero Section */}
      <HeroSection />

      {/* Hero Info Cards */}
      <HeroInfoCardsSection />

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
      <WorkflowHighlightsSection />
      <ConnectedPathSection />

      {/* Phase 3 Sections */}
      <WhyDocRenewalSection />
      <RedditTruthSection />
      <WhoUsesItSection />
      <PainToSolutionSection />
      <IndustryFitSection />
      {BILLING_ENABLED ? <PricingSection /> : null}

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
