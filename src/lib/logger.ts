// Centralized logging utility
type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  timestamp: string;
  level: LogLevel;
  context?: string;
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      const context: LogContext = {
        timestamp: new Date().toISOString(),
        level: 'info',
        context: args[0]?.context || 'App'
      };
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    const context: LogContext = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      context: args[0]?.context || 'App'
    };
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, error: any, context?: string) => {
    const logContext: LogContext = {
      timestamp: new Date().toISOString(),
      level: 'error',
      context: context || 'App'
    };
    console.error(`[ERROR] ${message}`, error, logContext);
    
    // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
    // if (typeof window !== 'undefined' && window.trackError) {
    //   window.trackError(message, error);
    // }
  }
};
