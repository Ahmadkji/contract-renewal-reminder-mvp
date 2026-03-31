"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, LayoutDashboard } from "lucide-react";
import { ANIMATION_DELAY_LONG_MS } from "@/lib/constants";

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

export function StatsOverview() {
  const stats = [
    {
      icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
      iconColor: "bg-emerald-500/20",
      metric: "Track",
      label: "Contract status in one dashboard",
      delay: "card-stagger-1",
    },
    {
      icon: <AlertCircle className="w-6 h-6 text-amber-500" />,
      iconColor: "bg-amber-500/20",
      metric: "Alert",
      label: "Configurable reminder schedules",
      delay: "card-stagger-2",
    },
    {
      icon: <LayoutDashboard className="w-6 h-6 text-cyan-500" />,
      iconColor: "bg-cyan-500/20",
      metric: "Review",
      label: "Billing and export controls",
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
