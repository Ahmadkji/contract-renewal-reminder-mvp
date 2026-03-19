import * as React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
}

/**
 * Base email layout component
 * Provides consistent styling and structure for all emails
 */
export function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <>
      {previewText && (
        <div style={{ display: 'none', fontSize: '1px', lineHeight: '1px', maxHeight: '0', maxWidth: '0', opacity: '0', overflow: 'hidden' }}>
          {previewText}
        </div>
      )}
      <div
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '16px',
          lineHeight: '1.6',
          color: '#333333',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px',
        }}
      >
        {children}
      </div>
    </>
  );
}
