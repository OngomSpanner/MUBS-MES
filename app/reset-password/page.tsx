"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #005696 0%, #102a43 100%)',
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
          padding: '2.5rem 2rem',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          zIndex: 1,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}
      >
        <div className="text-center mb-4">
          <div className="mb-3 d-flex justify-content-center">
            <Image
              src="/logo.png"
              alt="MUBS Logo"
              width={100}
              height={100}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <h4 className="fw-bold mb-1" style={{ color: '#005696' }}>Reset Password</h4>
          <p className="text-muted small mb-0">Create a new, strong password</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-4" style={{ borderLeft: '4px solid #e31837' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#e31837' }}>error</span>
            <span className="fw-medium text-dark">{error}</span>
          </div>
        )}

        {success ? (
          <div className="text-center">
            <div className="alert alert-success py-3 d-flex flex-column align-items-center mb-4" style={{ borderLeft: '4px solid #10b981' }}>
              <span className="material-symbols-outlined mb-2" style={{ fontSize: '40px', color: '#10b981' }}>check_circle</span>
              <span className="fw-medium text-dark">Password successfully reset!</span>
              <small className="text-muted mt-2">Redirecting to login page...</small>
            </div>
            <button 
              className="btn btn-outline-primary w-100 mt-2 rounded-pill"
              onClick={() => router.push('/')}
            >
              Return to Login Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div className="form-floating mb-3">
              <input
                type="password"
                className="form-control"
                id="new-password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!token || loading}
                minLength={6}
                style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
              />
              <label htmlFor="new-password" className="text-muted">New Password</label>
            </div>
            
            <div className="form-floating mb-4">
              <input
                type="password"
                className="form-control"
                id="confirm-password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!token || loading}
                style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
              />
              <label htmlFor="confirm-password" className="text-muted">Confirm Password</label>
            </div>

            <button
              type="submit"
              className="btn w-100 py-2 fw-bold text-white d-flex align-items-center justify-content-center gap-2 position-relative overflow-hidden"
              disabled={loading || !token}
              style={{
                borderRadius: '10px',
                background: 'linear-gradient(90deg, #005696 0%, #007ac3 100%)',
                border: 'none',
                height: '52px',
                transition: 'transform 0.2s',
                boxShadow: '0 4px 12px rgba(0,86,150,0.3)'
              }}
              onMouseOver={(e) => !loading && token && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => !loading && token && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <>
                  Reset Password <span className="material-symbols-outlined ms-1" style={{ fontSize: '20px' }}>lock_reset</span>
                </>
              )}

              {/* Subtle Brand Strip on Button */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', display: 'flex' }}>
                <div style={{ flex: 1, background: '#e31837' }}></div>
                <div style={{ flex: 1, background: '#ffcd00' }}></div>
                <div style={{ flex: 1, background: '#005696' }}></div>
              </div>
            </button>
            
            <div className="text-center mt-3">
               <button 
                  type="button" 
                  className="btn btn-link text-decoration-none small text-muted p-0"
                  onClick={() => router.push('/')}
                >
                  <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: '16px' }}>arrow_back</span>
                  Back to login
                </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-vh-100 d-flex justify-content-center align-items-center">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
