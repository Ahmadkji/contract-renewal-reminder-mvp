import * as React from 'react';

interface EmailFooterProps {
  companyName?: string;
  companyUrl?: string;
  unsubscribeUrl?: string;
}

/**
 * Email footer component
 * Provides consistent footer for all emails with company info and unsubscribe link
 */
export function EmailFooter({
  companyName = 'Your Company',
  companyUrl = 'https://yourdomain.com',
  unsubscribeUrl,
}: EmailFooterProps) {
  return (
    <div
      style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: '0 0 10px 0' }}>
        © {new Date().getFullYear()} {companyName}. All rights reserved.
      </p>
      
      <p style={{ margin: '0 0 10px 0' }}>
        <a
          href={companyUrl}
          style={{
            color: '#6b7280',
            textDecoration: 'underline',
          }}
        >
          {companyUrl}
        </a>
      </p>
      
      {unsubscribeUrl && (
        <p style={{ margin: '0' }}>
          <a
            href={unsubscribeUrl}
            style={{
              color: '#6b7280',
              textDecoration: 'underline',
            }}
          >
            Unsubscribe
          </a>
        </p>
      )}
    </div>
  );
}
