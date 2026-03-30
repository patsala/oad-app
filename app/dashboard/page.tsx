'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => {
        if (!res.ok) { router.push('/'); return null; }
        return res.json();
      })
      .then(data => {
        if (data) setUsername(data.username);
        setLoading(false);
      })
      .catch(() => router.push('/'));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-masters-darker via-masters-dark to-masters-green flex items-center justify-center">
        <div className="text-green-200/50 text-lg tracking-widest uppercase animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-masters-darker via-masters-dark to-masters-green">
      {/* Header */}
      <header className="border-b border-green-800/30 bg-masters-darker/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1
            className="text-3xl bg-gradient-to-r from-masters-yellow to-masters-gold bg-clip-text text-transparent"
            style={{ fontFamily: "'Pinyon Script', cursive" }}
          >
            Pimento
          </h1>
          <div className="flex items-center gap-4">
            {username && (
              <span className="text-green-200/50 text-sm tracking-wide">{username}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-green-200/60 border border-green-800/40 rounded-lg hover:border-masters-yellow/50 hover:text-masters-yellow transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12 text-center">
          <p className="text-green-200/40 text-xs tracking-widest uppercase mb-3">Command Center</p>
          <h2 className="text-4xl font-bold text-white mb-3">Choose Your Game</h2>
          <p className="text-green-200/50">Select a pool game to get started</p>
        </div>

        {/* Game Tiles */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* One and Done */}
          <button
            onClick={() => router.push('/oad')}
            className="glass border border-green-800/30 hover:border-masters-yellow/50 rounded-2xl p-8 text-left transition-all hover:scale-[1.02] group"
          >
            <div className="text-5xl mb-5">⛳</div>
            <h3
              className="text-3xl bg-gradient-to-r from-masters-yellow to-masters-gold bg-clip-text text-transparent mb-3 group-hover:from-masters-gold group-hover:to-masters-yellow"
              style={{ fontFamily: "'Pinyon Script', cursive" }}
            >
              One and Done
            </h3>
            <p className="text-green-200/50 mb-6 leading-relaxed">
              AI-powered analytics for your survivor pool. Make smarter picks with data-driven insights, course fit, and season planning.
            </p>
            <div className="flex items-center gap-2 text-masters-yellow text-sm font-semibold tracking-wide">
              <span>Enter Game</span>
              <span>→</span>
            </div>
          </button>

          {/* Best Ball — placeholder */}
          <div className="glass border border-green-800/20 rounded-2xl p-8 opacity-50 cursor-not-allowed">
            <div className="text-5xl mb-5 grayscale">🏌️</div>
            <h3
              className="text-3xl text-green-200/40 mb-3"
              style={{ fontFamily: "'Pinyon Script', cursive" }}
            >
              Best Ball
            </h3>
            <p className="text-green-200/30 mb-6 leading-relaxed">
              Live best-ball betting games with automatic scoring and real-time leaderboards.
            </p>
            <div className="inline-block px-4 py-1.5 border border-green-800/30 rounded-lg text-green-200/30 text-xs tracking-widest uppercase">
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
