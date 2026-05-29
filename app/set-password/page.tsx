"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to set password');
      }

      setSuccess(true);
      const redirectTo = (data as { redirectTo?: string }).redirectTo || '/admin';
      setTimeout(() => {
        router.push(redirectTo);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
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
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px',
        background: '#e31837', borderRadius: '50%', filter: 'blur(100px)', opacity: '0.4'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-5%', width: '400px', height: '400px',
        background: '#ffcd00', borderRadius: '50%', filter: 'blur(100px)', opacity: '0.3'
      }} />

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
              src="/logo.webp"
              alt="MUBS Logo"
              width={100}
              height={100}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <h4 className="fw-bold mb-1" style={{ color: '#005696' }}>Create New Password</h4>
          <p className="text-muted small mb-0">You signed in with a temporary password. Please set a new password to continue.</p>
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
              <span className="fw-medium text-dark">Password set successfully!</span>
              <small className="text-muted mt-2">Redirecting to your dashboard...</small>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-floating mb-3 position-relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control pe-5"
                id="new-password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
              />
              <label htmlFor="new-password" className="text-muted">New Password</label>
              <button
                type="button"
                className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none p-2 me-1"
                style={{ zIndex: 5 }}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div className="form-floating mb-4 position-relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control pe-5"
                id="confirm-password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                style={{ borderRadius: '10px', border: '1px solid #ced4da' }}
              />
              <label htmlFor="confirm-password" className="text-muted">Confirm Password</label>
              <button
                type="button"
                className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none p-2 me-1"
                style={{ zIndex: 5 }}
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            <button
              type="submit"
              className="btn w-100 py-2 fw-bold text-white d-flex align-items-center justify-content-center gap-2 position-relative overflow-hidden"
              disabled={loading}
              style={{
                borderRadius: '10px',
                background: 'linear-gradient(90deg, #005696 0%, #007ac3 100%)',
                border: 'none',
                height: '52px',
                boxShadow: '0 4px 12px rgba(0,86,150,0.3)'
              }}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              ) : (
                <>
                  Set Password <span className="material-symbols-outlined ms-1" style={{ fontSize: '20px' }}>lock</span>
                </>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', display: 'flex' }}>
                <div style={{ flex: 1, background: '#e31837' }} />
                <div style={{ flex: 1, background: '#ffcd00' }} />
                <div style={{ flex: 1, background: '#005696' }} />
              </div>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
