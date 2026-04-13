"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Modal, Button, Form } from 'react-bootstrap';


const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark text-white">Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (searchParams.get('admin') === 'true' || searchParams.get('emergency') === '1') {
      setShowAdminLogin(true);
    }
  }, [searchParams]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send reset link');
      }

      setForgotMessage({ type: 'success', text: data.message });
      setForgotEmail('');
    } catch (err: any) {
      setForgotMessage({ type: 'danger', text: err.message || 'Failed to send reset link' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const pickRedirect = (roles: string[], activeRole?: string) => {
      const set = new Set(roles);
      const role = activeRole && roles.includes(activeRole) ? activeRole : undefined;
      if (role === 'Strategy Manager' || role === 'System Administrator') return '/admin';
      if (role === 'Committee Member') return '/comm';
      if (role === 'Principal') return '/principal';
      if (role === 'Department Head' || role === 'Unit Head' || role === 'HOD') return '/department-head';
      if (role === 'Staff' || role === 'Viewer') return '/staff';

      if (set.has('System Administrator') || set.has('Strategy Manager')) return '/admin';
      if (set.has('Committee Member')) return '/comm';
      if (set.has('Principal')) return '/principal';
      if (set.has('Department Head') || set.has('Unit Head') || set.has('HOD')) return '/department-head';
      return '/staff';
    };

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid email or password');
      }

      // First login with temporary password: must set new password
      if (data?.user?.mustChangePassword) {
        router.push('/set-password');
        return; // keep loading until redirect
      }

      const roles: string[] = Array.isArray(data?.user?.roles) ? data.user.roles : [];
      const activeRole: string | undefined = data?.user?.activeRole;
      router.push(pickRedirect(roles, activeRole));
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Google Sign-In failed');
      }

      const roles: string[] = Array.isArray(data?.user?.roles) ? data.user.roles : [];
      const activeRole: string | undefined = data?.user?.activeRole;
      // same routing priority as password login
      const set = new Set(roles);
      if (activeRole === 'Strategy Manager' || activeRole === 'System Administrator') router.push('/admin');
      else if (activeRole === 'Committee Member') router.push('/comm');
      else if (activeRole === 'Principal') router.push('/principal');
      else if (activeRole === 'Department Head' || activeRole === 'Unit Head' || activeRole === 'HOD') router.push('/department-head');
      else if (activeRole === 'Staff' || activeRole === 'Viewer') router.push('/staff');
      else if (set.has('System Administrator') || set.has('Strategy Manager')) router.push('/admin');
      else if (set.has('Committee Member')) router.push('/comm');
      else if (set.has('Principal')) router.push('/principal');
      else if (set.has('Department Head') || set.has('Unit Head') || set.has('HOD')) router.push('/department-head');
      else router.push('/staff');
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
      setLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          z-index: 0;
          animation: float 20s infinite ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a192f',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        {/* Animated Background Blobs */}
        <div className="blob" style={{ top: '10%', right: '10%', width: '450px', height: '450px', background: 'rgba(0, 86, 150, 0.4)', animationDelay: '0s' }}></div>
        <div className="blob" style={{ bottom: '10%', left: '5%', width: '400px', height: '400px', background: 'rgba(227, 24, 55, 0.25)', animationDelay: '-5s' }}></div>
        <div className="blob" style={{ top: '40%', left: '20%', width: '300px', height: '300px', background: 'rgba(255, 205, 0, 0.15)', animationDelay: '-10s' }}></div>
        <div className="blob" style={{ bottom: '20%', right: '15%', width: '350px', height: '350px', background: 'rgba(0, 61, 107, 0.4)', animationDelay: '-15s' }}></div>

        <div
          className="card shadow-lg border-0"
          style={{
            maxWidth: '420px',
            width: '92%',
            padding: '2.8rem 2.25rem',
            borderRadius: '32px',
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            zIndex: 1,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
            color: '#003d6b',
          }}
        >
          <div className="text-center mb-4">
            <div className="mb-3 d-flex justify-content-center">
              <Image src="/logo.png" alt="MUBS Logo" width={80} height={80} style={{ objectFit: 'contain' }} priority />
            </div>
            <h4 className="fw-bold mb-1" style={{ color: '#003d6b', letterSpacing: '-0.02em' }}>MUBS Monitoring & Evaluation System</h4>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3" style={{ borderLeft: '4px solid #e31837' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#e31837' }}>error</span>
              <span className="fw-medium text-dark">{error}</span>
            </div>
          )}

          <div className="d-flex justify-content-center mb-1 py-1">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Sign-In failed')}
              useOneTap
              theme="filled_blue"
              size="large"
              shape="pill"
              text="continue_with"
              width="280px"
            />
          </div>

          {showAdminLogin && (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div className="d-flex align-items-center my-4">
                <div style={{ flex: 1, height: '1px', background: 'rgba(222, 226, 230, 0.6)' }}></div>
                <span className="mx-3 text-muted small fw-bold text-uppercase" style={{ letterSpacing: '0.12em', fontSize: '0.62rem', opacity: 0.8 }}>Admin Emergency Access</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(222, 226, 230, 0.6)' }}></div>
              </div>

              <form onSubmit={handleLogin}>
                <div className="form-floating mb-3">
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ borderRadius: '14px', background: 'rgba(248, 249, 250, 0.5)', border: '1px solid rgba(222, 226, 230, 0.8)', color: '#000' }}
                  />
                  <label htmlFor="email" className="text-muted">Email address</label>
                </div>
                <div className="form-floating mb-3 position-relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control pe-5"
                    id="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ borderRadius: '14px', background: 'rgba(248, 249, 250, 0.5)', border: '1px solid rgba(222, 226, 230, 0.8)', color: '#000' }}
                  />
                  <label htmlFor="password" className="text-muted">Password</label>
                  <button
                    type="button"
                    className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none p-2 me-1"
                    style={{ zIndex: 5 }}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                
                <button
                  type="submit"
                  className="btn w-100 py-2 fw-bold text-white d-flex align-items-center justify-content-center gap-2 position-relative overflow-hidden mb-3"
                  disabled={loading}
                  style={{
                    borderRadius: '14px',
                    background: 'linear-gradient(90deg, #005696 0%, #007ac3 100%)',
                    border: 'none',
                    height: '52px',
                    boxShadow: '0 8px 20px rgba(0,86,150,0.3)'
                  }}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <>Admin Login <span className="material-symbols-outlined ms-1">arrow_forward</span></>
                  )}
                </button>

                <div className="text-center">
                  <button 
                    type="button" 
                    className="btn btn-link text-muted text-decoration-none small"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => setShowForgotModal(true)}
                  >
                    Trouble logging in? Reset Password
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="text-center mt-3">
            <div className="mx-auto mb-3" style={{ height: '3px', width: '50px', display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ flex: 1, background: '#e31837' }}></div>
              <div style={{ flex: 1, background: '#ffcd00' }}></div>
              <div style={{ flex: 1, background: '#005696' }}></div>
            </div>
            <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
              &copy; {new Date().getFullYear()} Makerere University Business School.
            </small>
          </div>
        </div>
        
        <Modal show={showForgotModal} onHide={() => !forgotLoading && setShowForgotModal(false)} centered backdrop="static" keyboard={false} size="lg">
          <Modal.Header closeButton className="modal-header-mubs">
            <Modal.Title className="fw-bold d-flex align-items-center gap-2">
              <span className="material-symbols-outlined">lock_reset</span>
              Reset Password
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleForgotPassword}>
            <Modal.Body className="p-4">
              <p className="text-muted small mb-4">Enter your email address and we will send you a link to securely reset your password.</p>
              {forgotMessage.text && (
                <div className={`alert alert-${forgotMessage.type} small py-2 d-flex align-items-center gap-2 mb-4`} style={{ borderLeft: `4px solid ${forgotMessage.type === 'success' ? '#10b981' : '#e31837'}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{forgotMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                  <span className="fw-medium text-dark">{forgotMessage.text}</span>
                </div>
              )}
              <div className="form-floating mb-2">
                <input type="email" className="form-control" id="forgot-email" placeholder="name@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required disabled={forgotLoading || forgotMessage.type === 'success'} style={{ borderRadius: '10px', border: '1px solid #ced4da' }} />
                <label htmlFor="forgot-email" className="text-muted">Email address</label>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="light" onClick={() => setShowForgotModal(false)} disabled={forgotLoading}>Close</Button>
              <Button type="submit" disabled={forgotLoading || !forgotEmail.trim() || forgotMessage.type === 'success'} style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }} className="fw-bold text-white d-flex align-items-center">
                {forgotLoading ? <><span className="spinner-border spinner-border-sm me-2"></span> Sending...</> : <><span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>send</span> Send Reset Link</>}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </div>
    </GoogleOAuthProvider>
  );
}