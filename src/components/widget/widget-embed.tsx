"use client";

import Script from "next/script";
import { useEffect } from "react";

import { logger } from "@/lib/logger";

const WIDGET_ORIGIN = "https://workspace-79721d51-2e5e-4efc-ba28-2.vercel.app";
const WIDGET_SCRIPT_SRC = `${WIDGET_ORIGIN}/widget.js`;

type WidgetEmbedProps = {
  clinicSlug: string;
  location: "landing" | "dashboard";
};

function isWidgetUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return value.startsWith(WIDGET_ORIGIN);
}

function logWidgetError(message: string, error: unknown, location: string, extra?: Record<string, unknown>) {
  logger.error(message, { error, extra }, `Widget:${location}`);
}

export function WidgetEmbed({ clinicSlug, location }: WidgetEmbedProps) {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const target = event.target;

      if (target instanceof HTMLScriptElement && isWidgetUrl(target.src)) {
        logWidgetError("Widget script load failed", event.error ?? event.message, location, {
          src: target.src,
        });
        return;
      }

      if (target instanceof HTMLIFrameElement && isWidgetUrl(target.src)) {
        logWidgetError("Widget iframe failed", event.error ?? event.message, location, {
          src: target.src,
        });
        return;
      }

      if (typeof event.filename === "string" && isWidgetUrl(event.filename)) {
        logWidgetError("Widget runtime error", event.error ?? event.message, location, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const reasonText =
        reason instanceof Error
          ? `${reason.name}: ${reason.message}`
          : typeof reason === "string"
            ? reason
            : (() => {
                try {
                  return JSON.stringify(reason);
                } catch {
                  return String(reason);
                }
              })();

      if (reasonText.includes(WIDGET_ORIGIN) || reasonText.toLowerCase().includes("widget")) {
        logWidgetError("Widget unhandled rejection", reason, location, {
          reason: reasonText.slice(0, 4000),
        });
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== WIDGET_ORIGIN) {
        return;
      }

      const data = event.data;
      const dataText =
        typeof data === "string"
          ? data
          : (() => {
              try {
                return JSON.stringify(data);
              } catch {
                return String(data);
              }
            })();

      if (dataText.toLowerCase().includes("error") || dataText.toLowerCase().includes("fail")) {
        logger.error("Widget postMessage error payload", data, `Widget:${location}`);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLIFrameElement) && !(node instanceof HTMLScriptElement)) {
            continue;
          }

          const src = node.src;
          if (!isWidgetUrl(src)) {
            continue;
          }

          const onLoad = () => {
            node.removeEventListener("load", onLoad);
            node.removeEventListener("error", onError);
          };

          const onError = () => {
            logWidgetError("Widget node failed to load", new Error("Widget node error"), location, {
              src,
              nodeName: node.nodeName,
            });
            node.removeEventListener("load", onLoad);
            node.removeEventListener("error", onError);
          };

          node.addEventListener("load", onLoad);
          node.addEventListener("error", onError);
        }
      }
    });

    window.addEventListener("error", handleWindowError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("message", handleMessage);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("error", handleWindowError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("message", handleMessage);
      observer.disconnect();
    };
  }, [location]);

  return (
    <Script
      id={`widget-embed-${location}`}
      src={WIDGET_SCRIPT_SRC}
      data-clinic-slug={clinicSlug}
      strategy="afterInteractive"
      onError={(event) => {
        logWidgetError("Widget script onError", event, location, {
          clinicSlug,
          src: WIDGET_SCRIPT_SRC,
        });
      }}
    />
  );
}
