import { useState, type FormEvent } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles, WalletCards, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);
    setBusy(false);
    if (result.error) {
      setError(
        result.error.includes('Invalid login')
          ? 'Wrong email or password. Please try again.'
          : result.error.includes('already registered')
          ? 'That email is already registered. Try logging in instead.'
          : result.error
      );
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError('');
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <div className="auth-logo">
            <WalletCards size={28} />
          </div>
          <h2>Take control of<br />your money.</h2>
          <p>Track expenses, set budgets, and reach your savings goals — all in one beautiful dashboard.</p>
          <div className="auth-features">
            <div><ShieldCheck size={18} /> <span>Your data is private and secure</span></div>
            <div><Sparkles size={18} /> <span>Smart insights into your spending</span></div>
            <div><WalletCards size={18} /> <span>All your wallets in one place</span></div>
          </div>
        </div>
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <div className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</div>
            <h1>{mode === 'login' ? 'Sign in to Pocketwise' : 'Start your money journey'}</h1>
            <p>{mode === 'login' ? 'Enter your details to access your dashboard.' : 'Create an account to start tracking your finances.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>Email address</span>
              <div className="auth-input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@gmail.com"
                  required
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-wrap">
                <Lock size={17} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </label>

            {error && <div className="auth-error"><X size={15} /> {error}</div>}

            <button type="submit" className="primary-button auth-submit" disabled={busy}>
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>Don't have an account? <button onClick={() => switchMode('register')}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => switchMode('login')}>Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
