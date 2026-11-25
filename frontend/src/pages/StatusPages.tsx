import React from 'react';
import { Link } from 'react-router-dom';
import { C } from '../components/Common';

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ padding: 32, fontFamily: 'Poppins, sans-serif' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 16, color: C.text }}>{title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.text2 }}>{message}</p>
      <Link to="/" style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>Back to Dashboard</Link>
    </div>
  );
}

export function ForbiddenPage() {
  return <StatusPage title="403 — No access" message="This page is for administrators. Ask an admin if you need access." />;
}

export function NotFoundPage() {
  return <StatusPage title="Page not found" message="The link may be wrong or the page has moved." />;
}
