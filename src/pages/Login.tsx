import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);

  useState(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAlreadyLoggedIn(!!data.session);
      setSessionChecked(true);
    });
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    nav('/');
  }

  if (!sessionChecked) return null;
  if (alreadyLoggedIn) return <Navigate to="/" replace />;

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginBrand">CASANI AI STUDIO</div>
        <h1>Đăng nhập</h1>
        <p>Access your Casani creative workspace.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {errorMsg && <div className="loginError">{errorMsg}</div>}

          <button className="btn primary wide" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  );
}
