"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Modal, Button, Form } from 'react-bootstrap';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });

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

      const roles: string[] = Array.isArray(data?.user?.roles) ? data.user.roles : [];
      const activeRole: string | undefined = data?.user?.activeRole;
      router.push(pickRedirect(roles, activeRole));
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #005696 0%, #102a43 100%)', // Brand blue background
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Brand Colors Background Elements */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px',
        background: '#e31837', // brand red
        borderRadius: '50%', filter: 'blur(100px)', opacity: '0.4'
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-5%', width: '400px', height: '400px',
        background: '#ffcd00', // brand yellow
        borderRadius: '50%', filter: 'blur(100px)', opacity: '0.3'
      }}></div>

      <div
        className="card shadow-lg border-0"
        style={{
          maxWidth: '440px',
          width: '90%',
          padding: '2rem 2rem',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          zIndex: 1,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}
      >
        <div className="text-center mb-3">
          <div className="mb-2 d-flex justify-content-center">
            <Image
              src="/logo.png"
              alt="MUBS Logo"
              width={100}
              height={100}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <h4 className="fw-bold mb-1" style={{ color: '#005696' }}>Strategic Plan System</h4>
          <p className="text-muted small mb-0">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3" style={{ borderLeft: '4px solid #e31837' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#e31837' }}>error</span>
            <span className="fw-medium text-dark">{error}</span>
          </div>
        )}

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
              style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
            />
            <label htmlFor="email" className="text-muted">Email address</label>
          </div>
          <div className="form-floating mb-3">
            <input
              type="password"
              className="form-control"
              id="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
            />
            <label htmlFor="password" className="text-muted">Password</label>
          </div>
          <div className="d-flex justify-content-end mb-3 mt-n2">
            <button 
              type="button" 
              className="btn btn-link text-decoration-none small p-0"
              style={{ color: '#005696', fontSize: '0.85rem' }}
              onClick={() => {
                setShowForgotModal(true);
                setForgotMessage({ type: '', text: '' });
                setForgotEmail('');
              }}
            >
              Forgot your password?
            </button>
          </div>

          <button
            type="submit"
            className="btn w-100 py-2 fw-bold text-white d-flex align-items-center justify-content-center gap-2 position-relative overflow-hidden"
            disabled={loading}
            style={{
              borderRadius: '10px',
              background: 'linear-gradient(90deg, #005696 0%, #007ac3 100%)', // Brand blue gradient
              border: 'none',
              height: '52px',
              transition: 'transform 0.2s',
              boxShadow: '0 4px 12px rgba(0,86,150,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <>
                Sign In <span className="material-symbols-outlined ms-1" style={{ fontSize: '20px' }}>login</span>
              </>
            )}

            {/* Subtle Brand Strip on Button */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', display: 'flex' }}>
              <div style={{ flex: 1, background: '#e31837' /* Red */ }}></div>
              <div style={{ flex: 1, background: '#ffcd00' /* Yellow */ }}></div>
              <div style={{ flex: 1, background: '#005696' /* Blue */ }}></div>
            </div>
          </button>

          <div className="d-flex align-items-center my-3">
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
            <span className="mx-3 text-muted small fw-medium">OR CONTINUE WITH</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
          </div>

          <div className="d-flex justify-content-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Sign-In failed')}
              useOneTap
              theme="outline"
              size="large"
              shape="pill"
              text="signin_with"
            />
          </div>
        </form>

        <div className="text-center mt-4">
          {/* Subtle line with brand colors */}
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

      {/* Forgot Password Modal */}
      <Modal show={showForgotModal} onHide={() => !forgotLoading && setShowForgotModal(false)} centered>
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
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {forgotMessage.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span className="fw-medium text-dark">{forgotMessage.text}</span>
              </div>
            )}

            <div className="form-floating mb-2">
              <input
                type="email"
                className="form-control"
                id="forgot-email"
                placeholder="name@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                disabled={forgotLoading || forgotMessage.type === 'success'}
                style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
              />
              <label htmlFor="forgot-email" className="text-muted">Email address</label>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForgotModal(false)} disabled={forgotLoading}>Close</Button>
            <Button 
              type="submit"
              disabled={forgotLoading || !forgotEmail.trim() || forgotMessage.type === 'success'}
              style={{ background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
              className="fw-bold text-white d-flex align-items-center"
            >
              {forgotLoading ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Sending...</>
              ) : (
                <><span className="material-symbols-outlined me-1" style={{ fontSize: '16px' }}>send</span> Send Reset Link</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
    </GoogleOAuthProvider>
  );
}