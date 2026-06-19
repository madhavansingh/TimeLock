import React from 'react';

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">KLEOS Hackathon 2026</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mt-4 mb-6">
            Verify Legal Documents with <span className="text-blue-900">Immutable Blockchain Proofs</span>
          </h1>
          <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
            Protect deeds, mortgage papers, contracts, and affidavits from backdating and alterations using Solana-anchored timestamps and Class 3 digital notary signatures.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/verify" className="bg-blue-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-950 transition-colors shadow-sm">
              Verify Document Scan
            </a>
            <a href="/register" className="border border-slate-350 bg-slate-100 text-slate-700 px-8 py-3 rounded-lg font-medium hover:bg-slate-200 transition-colors">
              Register New Document
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Core Trust Framework</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs">
            <div className="h-12 w-12 bg-blue-50 text-blue-900 rounded-lg flex items-center justify-center font-bold text-lg mb-6">01</div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Solana Trust Anchor</h3>
            <p className="text-sm text-slate-500">Document fingerprints are committed to Solana Program Derived Addresses (PDAs) preventing any backdating or deletion.</p>
          </div>

          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs">
            <div className="h-12 w-12 bg-blue-50 text-blue-900 rounded-lg flex items-center justify-center font-bold text-lg mb-6">02</div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Class 3 Notary Signing</h3>
            <p className="text-sm text-slate-500">Notaries bind signatures using physical Class 3 DSC hardware tokens. Private keys never touch our servers.</p>
          </div>

          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs">
            <div className="h-12 w-12 bg-blue-50 text-blue-900 rounded-lg flex items-center justify-center font-bold text-lg mb-6">03</div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Tamper Detection Engine</h3>
            <p className="text-sm text-slate-500">Upload scanned documents at any time. Our system matches SHA-256 fingerprints to flag even single-byte tampering.</p>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="bg-slate-900 text-white py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it Works</h2>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-2">1. Hash</div>
              <p className="text-sm text-slate-400">Compute SHA-256 fingerprint client-side to protect privacy.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-2">2. Anchor</div>
              <p className="text-sm text-slate-400">Submit hash + timestamp to Solana cluster via relayer.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-2">3. Notarize</div>
              <p className="text-sm text-slate-400">Independent notary affixes digital signature using DSC token.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-2">4. Scan</div>
              <p className="text-sm text-slate-400">Scan QR on physical sheet to retrieve full custody trails.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
