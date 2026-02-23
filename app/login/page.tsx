'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-masters-darker via-masters-dark to-masters-green flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-8">
          <h1
            className="text-7xl bg-gradient-to-r from-masters-yellow to-masters-gold bg-clip-text text-transparent mb-2"
            style={{ fontFamily: "'Pinyon Script', cursive" }}
          >
            Pimento
          </h1>
          <p className="text-green-200/50 text-sm tracking-widest uppercase">Command Center</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 border border-green-800/30">
          <h2 className="text-white font-semibold text-lg mb-6 text-center">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-green-200/60 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-masters-darker/60 border border-green-800/30 rounded-lg text-white placeholder-green-300/20 focus:border-masters-yellow/50 focus:outline-none transition-colors"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-green-200/60 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-masters-darker/60 border border-green-800/30 rounded-lg text-white placeholder-green-300/20 focus:border-masters-yellow/50 focus:outline-none transition-colors"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="text-red-300 text-sm bg-red-950/40 border border-red-500/30 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-masters-yellow hover:bg-masters-gold text-masters-darker font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
