'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const start: LoginState = { step: 'email', email: '', message: '', error: false };

const box: React.CSSProperties = { maxWidth: 460, margin: '48px auto', padding: '26px 24px', background: '#fff', borderTop: '7px solid #db2777', borderRadius: 20, boxShadow: '0 6px 24px rgba(194,65,12,.12)' };
const input: React.CSSProperties = { font: 'inherit', fontSize: 18, width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '2px solid #e9a8cf', borderRadius: 12, margin: '6px 0 14px' };
const button: React.CSSProperties = { font: 'inherit', fontWeight: 700, fontSize: 17, width: '100%', padding: 12, border: 0, borderRadius: 999, background: 'linear-gradient(90deg,#db2777,#7c3aed)', color: '#fff', cursor: 'pointer' };

export default function Login() {
  const [s, action, busy] = useActionState(login, start);
  return (
    <main style={{ padding: '0 16px' }}>
      <div style={box}>
        <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#c2410c' }}>Master page</div>
        <h1 style={{ margin: '4px 0 18px', fontSize: 30 }}>🔒 Teacher sign-in</h1>
        <form action={action}>
          {s.step === 'email' ? (
            <>
              <label htmlFor="email">Your email</label>
              <input id="email" name="email" type="email" autoComplete="email" required defaultValue={s.email} style={input} />
              <button disabled={busy} style={button}>{busy ? '⏳ Sending…' : '📧 Send me a sign-in code'}</button>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>Code sent to <b>{s.email}</b>.</p>
              <label htmlFor="code">Code from the email</label>
              <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required style={{ ...input, letterSpacing: '.3em', textAlign: 'center' }} />
              <button disabled={busy} style={button}>{busy ? '⏳ Checking…' : '✅ Sign in'}</button>
            </>
          )}
        </form>
        {s.message && (
          <p role="status" style={{ marginBottom: 0, padding: '10px 12px', borderRadius: 12, background: s.error ? '#fef3c7' : '#dcfce7', color: s.error ? '#92400e' : '#166534' }}>
            {s.message}
          </p>
        )}
      </div>
    </main>
  );
}
