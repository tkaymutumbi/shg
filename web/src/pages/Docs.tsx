import React, { useState } from 'react';
import { 
  Search, 
  Terminal, 
  Box, 
  Layout, 
  TestTube, 
  BookOpen, 
  Newspaper, 
  MessageSquare, 
  Download, 
  ChevronRight,
  Menu as MenuIcon,
  X,
  Copy,
  Lightbulb,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeSwitcher } from '../App';
import Logo from '../components/Logo';

const Docs = () => {
  const [activeSection, setActiveSection] = useState('installation');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    {
      title: 'Get Started',
      items: [
        { id: 'welcome', label: 'Welcome to SHG' },
        { id: 'installation', label: 'Installation' },
        { id: 'quickstart', label: 'Quickstart' },
      ]
    },
    {
      title: 'Commands',
      items: [
        { id: 'shg-dev', label: 'shg dev' },
        { id: 'shg-deploy', label: 'shg deploy' },
        { id: 'shg-doctor', label: 'shg doctor' },
        { id: 'shg-setup', label: 'shg setup' },
      ]
    },
    {
      title: 'Advanced',
      items: [
        { id: 'configuration', label: 'shgrc.json' },
        { id: 'wifi-debugging', label: 'WiFi Debugging' },
        { id: 'asset-generation', label: 'Asset Generation' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text selection:bg-brand-accent/30 transition-colors duration-300">
      {/* Top Navbar */}
      <nav className="h-14 border-b border-border-subtle bg-nav-bg backdrop-blur-md sticky top-0 z-50 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo variant="header" className="text-lg" />
          </Link>
          
          <div className="hidden lg:flex items-center gap-1 text-sm font-medium opacity-60">
            <NavTab icon={<Terminal size={16}/>} label="CLI" active />
            <NavTab icon={<Box size={16}/>} label="Core" />
            <NavTab icon={<Layout size={16}/>} label="Plugins" />
            <NavTab icon={<TestTube size={16}/>} label="Tests" />
          </div>
        </div>

        <div className="flex-1 max-w-md hidden md:flex relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40">
            <Search size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full bg-dark-bg/50 border border-border-subtle rounded-md py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-accent transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-dark-bg px-1.5 py-0.5 rounded opacity-40 border border-border-subtle">
            Ctrl K
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 mr-4 opacity-60 text-sm">
            <span className="hover:text-brand-accent cursor-pointer"><BookOpen size={18}/></span>
            <span className="hover:text-brand-accent cursor-pointer"><Newspaper size={18}/></span>
            <span className="hover:text-brand-accent cursor-pointer"><MessageSquare size={18}/></span>
          </div>
          <button className="hidden md:flex items-center gap-2 bg-brand-accent text-white px-3 py-1.5 rounded-md text-sm font-bold hover:opacity-90 transition-colors shadow-lg shadow-brand-accent/20">
            <Download size={16} />
            Install SHG
          </button>
          <ThemeSwitcher />
          <button 
            className="lg:hidden p-2 opacity-60"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20}/> : <MenuIcon size={20}/>}
          </button>
        </div>
      </nav>

      <div className="max-w-[1440px] mx-auto flex">
        {/* Left Sidebar */}
        <aside className={`
          fixed inset-0 top-14 z-40 lg:static lg:block w-64 border-r border-border-subtle bg-dark-bg overflow-y-auto h-[calc(100vh-3.5rem)]
          ${isMobileMenuOpen ? 'block' : 'hidden'}
        `}>
          <div className="p-6 space-y-8 text-left">
            {navigation.map((group) => (
              <div key={group.title}>
                <h4 className="text-xs font-bold opacity-40 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ChevronRight size={12}/> {group.title}
                </h4>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`
                        w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors
                        ${activeSection === item.id 
                          ? 'bg-brand-accent/10 text-brand-accent font-medium border border-brand-accent/20' 
                          : 'opacity-60 hover:opacity-100 hover:bg-dark-bg/50'}
                      `}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Central Content */}
        <main className="flex-1 min-w-0 p-8 lg:p-12 overflow-y-auto h-[calc(100vh-3.5rem)] scroll-smooth text-left">
          <div className="max-w-3xl">
            <header className="mb-12">
              <div className="text-brand-accent text-sm font-bold mb-4 uppercase tracking-wider">Get Started</div>
              <h1 className="text-5xl font-black mb-6 tracking-tight">Installation</h1>
              <p className="text-xl opacity-60 leading-relaxed">
                Install SHG with bun, npm, or directly from source.
              </p>
              
              <div className="mt-8 flex items-center gap-2">
                <button className="bg-dark-bg/50 border border-border-subtle hover:border-brand-accent/50 px-3 py-1.5 rounded flex items-center gap-2 text-sm">
                  <Copy size={14}/> Copy page
                </button>
                <button className="bg-dark-bg/50 border border-border-subtle hover:border-brand-accent/50 px-2 py-1.5 rounded">
                  <ChevronDown size={14}/>
                </button>
              </div>
            </header>

            <div className="space-y-12">
              <section id="overview">
                <h2 className="text-3xl font-bold mb-6 tracking-tight">Overview</h2>
                <p className="opacity-70 leading-7 mb-6 text-lg">
                  SHG ships as a lightweight CLI tool to automate your Capacitor Android workflows. 
                  It handles everything from environment checks to wireless debugging.
                </p>
                
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex gap-4 text-green-500">
                  <Lightbulb className="shrink-0 mt-1" size={20} />
                  <p className="text-sm leading-6">
                    After installation, verify with <code className="bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/30 mx-1 font-mono">shg --version</code> and <code className="bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/30 mx-1 font-mono">shg doctor</code>.
                  </p>
                </div>
              </section>

              <section id="installation-actual">
                <h2 className="text-3xl font-bold mb-6 tracking-tight">Installation</h2>
                
                <div className="border-b border-border-subtle mb-8 flex gap-8">
                  <button className="pb-4 text-brand-accent border-b-2 border-brand-accent text-sm font-bold tracking-tight">Bun</button>
                  <button className="pb-4 opacity-50 hover:opacity-100 text-sm font-medium">npm</button>
                  <button className="pb-4 opacity-50 hover:opacity-100 text-sm font-medium">Source</button>
                </div>

                <div className="bg-dark-bg border border-border-subtle rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-dark-bg/50 px-4 py-2 flex items-center gap-2 border-b border-border-subtle">
                    <div className="w-2 h-2 rounded-full bg-brand-accent" />
                    <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest text-dark-text">shell</span>
                  </div>
                  <div className="p-6 font-mono text-sm group relative">
                    <span className="opacity-40 mr-3 text-dark-text">$</span>
                    <span className="text-dark-text">bun install -g shg-cli</span>
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-dark-bg/80 rounded">
                      <Copy size={16} className="opacity-40"/>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <footer className="mt-20 pt-12 border-t border-border-subtle flex items-center justify-between opacity-50">
              <div className="text-sm">
                © 2026 SHG CLI — Sub-company of Xalo Software
              </div>
              <div className="flex gap-6">
                <ExternalLink size={18} className="hover:text-brand-accent cursor-pointer transition-colors"/>
                <Terminal size={18} className="hover:text-brand-accent cursor-pointer transition-colors"/>
              </div>
            </footer>
          </div>
        </main>

        {/* Right Sidebar - On this page */}
        <aside className="hidden xl:block w-64 p-8 sticky top-14 h-[calc(100vh-3.5rem)] text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
            <MenuIcon size={14}/> On this page
          </h4>
          <nav className="space-y-4">
            <button className="block text-sm text-brand-accent font-bold">Overview</button>
            <button className="block text-sm opacity-60 hover:opacity-100 transition-colors">Installation</button>
            <button className="block text-sm opacity-60 hover:opacity-100 transition-colors">Prerequisites</button>
            <button className="block text-sm opacity-60 hover:opacity-100 transition-colors">Uninstall</button>
          </nav>
        </aside>
      </div>
    </div>
  );
};

const NavTab = ({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) => (
  <button className={`
    flex items-center gap-2 px-3 py-2 rounded-md transition-colors
    ${active ? 'text-dark-text bg-dark-bg/50 shadow-sm' : 'hover:opacity-100 hover:bg-dark-bg/30'}
  `}>
    {icon}
    <span>{label}</span>
  </button>
);

export default Docs;
