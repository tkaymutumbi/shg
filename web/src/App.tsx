import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Terminal as TerminalIcon, Zap, Smartphone, Activity, ShieldCheck, Copy, Check, Code, Heart, Download, BookOpen, Sun, Moon, Menu, X } from 'lucide-react';
import Logo from './components/Logo';
import Terminal from './components/Terminal';
import Docs from './pages/Docs';

// Theme management utility
const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('shg-theme', next);
  return next;
};

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState(localStorage.getItem('shg-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <button 
      onClick={handleToggle}
      className="p-2 text-dark-text opacity-60 hover:opacity-100 transition-all hover:bg-brand-accent/10 rounded-lg"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

const LandingPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text selection:bg-brand-accent selection:text-white transition-colors duration-300">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-nav-bg backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo variant="header" className="text-xl" />
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <Link to="/docs" className="hover:text-brand-accent transition-colors flex items-center gap-2">
              <BookOpen size={20} />
              <span>Docs</span>
            </Link>
            <a href="https://github.com/Diplovee/shg" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent transition-colors flex items-center gap-2">
              <ExternalLink size={20} />
              <span>GitHub</span>
            </a>
            <ThemeSwitcher />
            <Link to="/docs" className="bg-brand-accent hover:opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg shadow-brand-accent/20">
              Get Started
            </Link>
          </div>
          
          <button className="sm:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden bg-nav-bg backdrop-blur-md border-b border-border-subtle"
            >
              <div className="px-4 py-6 flex flex-col gap-4">
                <Link to="/docs" className="hover:text-brand-accent transition-colors flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                  <BookOpen size={20} />
                  <span>Docs</span>
                </Link>
                <a href="https://github.com/Diplovee/shg" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent transition-colors flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                  <ExternalLink size={20} />
                  <span>GitHub</span>
                </a>
                <div className="flex items-center justify-between">
                  <span>Theme</span>
                  <ThemeSwitcher />
                </div>
                <Link to="/docs" className="bg-brand-accent hover:opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-all text-center" onClick={() => setIsMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <header className="pt-16 pb-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              Capacitor Android development,<br className="hidden md:block" /> simplified.
            </h1>
            <p className="text-lg md:text-2xl opacity-60 max-w-3xl mx-auto mb-10 leading-relaxed">
              Interactive & automation-first CLI to streamline your mobile workflow from setup to deployment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-16"
          >
            <Terminal />
          </motion.div>

          <div id="install" className="max-w-xl mx-auto">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-1 flex items-center shadow-lg group">
              <div className="flex-1 px-4 py-3 font-mono text-sm md:text-base text-gray-300 overflow-x-auto whitespace-nowrap text-left">
                <span className="text-brand-accent">$</span> bun install -g shg-cli
              </div>
              <CopyButton code="bun install -g shg-cli" />
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="py-24 bg-dark-bg/50 border-y border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why use SHG?</h2>
            <p className="opacity-60 text-lg">Built for developers who value speed and reliability.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<TerminalIcon className="text-brand-accent" />}
              title="Interactive TUI"
              description="No flags to remember. Just run `shg` and follow the guided menu for any task."
            />
            <FeatureCard 
              icon={<Zap className="text-brand-accent" />}
              title="Live Reload"
              description="Start a dev server and launch your Android app together with one command."
            />
            <FeatureCard 
              icon={<Smartphone className="text-brand-accent" />}
              title="WiFi Debugging"
              description="Deploy and hot-reload wirelessly. Auto-detects your device IP over WiFi."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-brand-accent" />}
              title="Auto-Fixing Doctor"
              description="Intelligent diagnostics for Node, Java, ADB, and Android SDK with automated fixes."
            />
            <FeatureCard 
              icon={<Activity className="text-brand-accent" />}
              title="Smart Deploy"
              description="A robust pipeline that builds, syncs, and runs your app with failure safety."
            />
            <FeatureCard 
              icon={<Download className="text-brand-accent" />}
              title="Auto-Install ADB"
              description="Downloads Android platform-tools automatically if ADB is missing from your system."
            />
          </div>
        </div>
      </section>

      {/* Code Examples / Quick Start */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center flex items-center justify-center gap-3">
            <Code size={32} className="text-brand-accent" />
            Quick Start
          </h2>
          <div className="space-y-6">
            <CodeBlock 
              label="Run diagnostics and fix environment issues"
              code="shg doctor --fix"
            />
            <CodeBlock 
              label="Initialize Capacitor and add Android platform"
              code="shg setup --install --add-android"
            />
            <CodeBlock 
              label="Start development with live reload"
              code="shg dev"
            />
            <CodeBlock 
              label="Build a release APK"
              code="shg build --release"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <Logo variant="header" className="text-xl" />
          </div>
          <p className="opacity-50 mb-4 flex items-center justify-center gap-2">
            Built with <Heart size={16} className="text-brand-accent fill-brand-accent" /> for the Capacitor community.
          </p>
          <div className="flex justify-center gap-6 text-sm opacity-60">
            <a href="https://github.com/Diplovee/shg/blob/main/LICENSE" className="hover:text-brand-accent transition-colors">MIT License</a>
            <a href="https://github.com/Diplovee/shg/blob/main/CONTRIBUTING.md" className="hover:text-brand-accent transition-colors">Contributing</a>
            <span>© 2026 SHG CLI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </Router>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-dark-bg border border-border-subtle p-8 rounded-2xl hover:border-brand-accent/50 transition-all group"
  >
    <div className="bg-brand-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="opacity-60 leading-relaxed">{description}</p>
  </motion.div>
);

const CodeBlock: React.FC<{ label: string; code: string }> = ({ label, code }) => (
  <div className="bg-dark-bg border border-border-subtle rounded-xl overflow-hidden shadow-sm">
    <div className="px-4 py-2 border-b border-border-subtle text-xs font-medium opacity-50 bg-dark-bg/50 uppercase tracking-wider text-left">
      {label}
    </div>
    <div className="p-4 font-mono text-brand-primary flex items-center justify-between gap-4 overflow-x-auto">
      <span className="whitespace-nowrap">{code}</span>
      <div className="shrink-0">
        <CopyButton code={code} variant="ghost" />
      </div>
    </div>
  </div>
);

const CopyButton: React.FC<{ code: string; variant?: 'default' | 'ghost' }> = ({ code, variant = 'default' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'ghost') {
    return (
      <button 
        onClick={handleCopy}
        className="opacity-60 hover:text-brand-accent transition-all relative"
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <Check size={18} className="text-green-500" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <Copy size={18} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  return (
    <button 
      onClick={handleCopy}
      className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-3 rounded-lg font-medium transition-all border border-gray-700 min-w-[100px] flex items-center justify-center gap-2"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="copied"
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -5, opacity: 0 }}
            className="flex items-center gap-2 text-green-400"
          >
            <Check size={18} />
            <span>Copied!</span>
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -5, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Copy size={18} />
            <span>Copy</span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

export { ThemeSwitcher };
export default App;
