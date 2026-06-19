import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Legal TimeLock Network (LTN)',
  description: 'Verifiable Trust and Immutable Timestamps for Physical Legal Documents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 bg-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-lg">LT</span>
              <span className="font-bold text-lg text-blue-950 tracking-tight">Legal TimeLock Network</span>
            </div>
            <nav className="flex items-center gap-6">
              <a href="/" className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors">Home</a>
              <a href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors">Dashboard</a>
              <a href="/verify" className="text-sm font-medium text-slate-600 hover:text-blue-900 transition-colors">Verify Scan</a>
              <a href="/register" className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-950 transition-colors">Register File</a>
            </nav>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Legal TimeLock Network (LTN). Built for KLEOS Hackathon 2026.
          </div>
        </footer>
      </body>
    </html>
  );
}
