import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, Eye, EyeOff, FileText, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';
import type { UserRole } from '../../types';

const F = 'Poppins, sans-serif';

const FEATURES = [
  { icon: <CheckCircle2 size={18} />, title: 'Plan and track every task', text: 'WBS, Gantt and Kanban with live progress against the baseline.' },
  { icon: <FileText size={18} />, title: 'Monthly executive report', text: 'One page per project, frozen each month for management review.' },
  { icon: <BarChart3 size={18} />, title: 'Issues, risks and billing together', text: 'See what needs attention across all your projects.' },
];

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 960);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { theme, toggle } = useTheme();
  const wide = useWide();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [allowedRole, setAllowedRole] = useState<'member' | 'client' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const isDark = theme === 'dark';
  const t = {
    page: isDark ? '#0F172A' : '#F5F7FA',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F1F5F9' : '#0F172A',
    muted: isDark ? '#94A3B8' : '#475569',
    border: isDark ? '#334155' : '#E2E8F0',
    field: isDark ? '#0F172A' : '#FFFFFF',
  };

  // Sign-up only: the email must be in a project member list; that list decides member or client.
  const validateEmailRole = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (mode !== 'signup' || !normalized || !normalized.includes('@')) {
      setAllowedRole(null);
      setEmailError('');
      return;
    }
    const response = await supabase.rpc('validate_member_email', { p_email: normalized });
    const members = (response.data as Array<{ email: string; type: 'internal' | 'client' }>) || [];
    if (response.error || members.length === 0) {
      setAllowedRole(null);
      setEmailError('This email is not in any project member list. Ask your project manager to add you first.');
      setRole('member');
      return;
    }
    setEmailError('');
    const next = members[0].type === 'client' ? 'client' : 'member';
    setAllowedRole(next);
    setRole(next);
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError('');
    setEmailError('');
    setAllowedRole(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && emailError) { setError(emailError); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (!fullName.trim()) { setError('Please enter your full name.'); setLoading(false); return; }
        await signUp(email, password, fullName, role);
        setSignupSuccess(true);
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message === 'ACCOUNT_INACTIVE' ? 'This account is disabled. Please contact an administrator.' : message);
    } finally {
      setLoading(false);
    }
  };

  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 };
  const field: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px', fontSize: 13, borderRadius: 10, border: `1.5px solid ${t.border}`,
    background: t.field, color: t.text, fontFamily: F, outline: 'none', boxSizing: 'border-box',
  };
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; };
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; };

  const logo = (light: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16,
        background: light ? '#FFFFFF' : '#4F46E5', color: light ? '#312E81' : '#FFFFFF' }}>PT</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: light ? '#FFFFFF' : t.text, letterSpacing: '-0.2px' }}>Project Tracking System</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: t.page, fontFamily: F }}>
      {/* Brand panel */}
      {wide && (
        <aside style={{ flex: '0 0 46%', maxWidth: 640, background: '#312E81', color: '#E0E7FF', padding: '48px 56px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', right: -120, top: -120, width: 420, height: 420, borderRadius: '50%', border: '1px solid rgba(199,210,254,0.18)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', right: -40, top: -40, width: 260, height: 260, borderRadius: '50%', border: '1px solid rgba(199,210,254,0.18)' }} />
          {logo(true)}
          <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingTop: 48 }}>
            <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.35, maxWidth: 440 }}>
              Every project, task and report in one place.
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: 13, lineHeight: 1.7, color: '#C7D2FE', maxWidth: 440 }}>
              Plan the work, follow progress against the baseline, and share a clear monthly picture with management.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{f.icon}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{f.title}</span>
                    <span style={{ display: 'block', fontSize: 13, color: '#C7D2FE', lineHeight: 1.6 }}>{f.text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} aria-hidden="true" /> Access is limited to people added to a project.
          </div>
        </aside>
      )}

      {/* Form side */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: wide ? '32px 48px' : '20px 16px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: wide ? 'flex-end' : 'space-between', gap: 12 }}>
          {!wide && logo(false)}
          <button type="button" onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 10, border: `1px solid ${t.border}`, background: t.card, color: t.muted, cursor: 'pointer' }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            {signupSuccess ? (
              <div>
                <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: isDark ? '#064E3B' : '#D1FAE5', color: '#047857', display: 'grid', placeItems: 'center', marginBottom: 16 }}><CheckCircle2 size={24} /></span>
                <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: t.text }}>Check your email</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: t.muted, lineHeight: 1.7 }}>
                  We sent a confirmation link to <strong style={{ color: t.text }}>{email}</strong>. Open it, then sign in here.
                </p>
                <button type="button" onClick={() => { switchMode('login'); setSignupSuccess(false); }}
                  style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: F, cursor: 'pointer' }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: t.text }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
                <p style={{ margin: '0 0 28px', fontSize: 13, color: t.muted }}>
                  {mode === 'login' ? 'Sign in to continue to your projects.' : 'Use the email your project manager added to the project.'}
                </p>

                {error && (
                  <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 18, background: isDark ? '#7F1D1D' : '#FEF2F2', border: `1px solid ${isDark ? '#991B1B' : '#FECACA'}`, color: isDark ? '#FCA5A5' : '#991B1B', fontSize: 13, lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {mode === 'signup' && (
                    <div>
                      <label htmlFor="auth-name" style={label}>Full name</label>
                      <input id="auth-name" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                        placeholder="First and last name" required style={field} onFocus={focus} onBlur={blur} />
                    </div>
                  )}
                  <div>
                    <label htmlFor="auth-email" style={label}>Email</label>
                    <input id="auth-email" type="email" autoComplete="email" value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(''); setAllowedRole(null); }}
                      onBlur={(e) => { blur(e); void validateEmailRole(email); }} onFocus={focus}
                      placeholder="you@company.com" required style={field} />
                    {mode === 'signup' && emailError && <div style={{ marginTop: 6, fontSize: 11, color: isDark ? '#FCA5A5' : '#B91C1C' }}>{emailError}</div>}
                    {mode === 'signup' && allowedRole && (
                      <div style={{ marginTop: 6, fontSize: 11, color: isDark ? '#6EE7B7' : '#047857' }}>
                        Found in a project as {allowedRole === 'client' ? 'a customer contact — your account will be a Client' : 'staff — your account will be a Member'}.
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="auth-password" style={label}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
                        required minLength={6} style={{ ...field, paddingRight: 44 }} onFocus={focus} onBlur={blur} />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                        style={{ position: 'absolute', right: 6, top: 6, width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: 8 }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mode === 'login' && <div style={{ marginTop: 6, fontSize: 11, color: t.muted }}>Forgot your password? Ask an administrator to set a new one.</div>}
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ height: 44, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: F, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                    {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                </form>

                <p style={{ margin: '24px 0 0', fontSize: 13, color: t.muted, textAlign: 'center' }}>
                  {mode === 'login' ? 'New here? ' : 'Already have an account? '}
                  <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    style={{ border: 0, background: 'transparent', padding: 0, color: '#4F46E5', fontWeight: 700, fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
                    {mode === 'login' ? 'Create an account' : 'Sign in'}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: t.muted, textAlign: 'center' }}>© {new Date().getFullYear()} Project Tracking System</div>
      </main>
    </div>
  );
}
