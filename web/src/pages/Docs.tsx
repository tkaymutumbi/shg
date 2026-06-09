import React from 'react';
import { Zap, ExternalLink } from 'lucide-react';

const Docs = () => {
  const [activeSection, setActiveSection] = React.useState('introduction');

  const sections = [
    { id: 'introduction', label: 'Introduction' },
    { id: 'installation', label: 'Installation' },
    { id: 'quick-start', label: 'Quick Start' },
    { id: 'commands', label: 'Commands' },
    { id: 'configuration', label: 'Configuration' },
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex flex-col md:flex-row">
      {/* Documentation Sidebar */}
      <aside className="w-full md:w-64 bg-gray-950 border-r border-gray-800 p-6 md:sticky md:top-0 md:h-screen overflow-y-auto">
        <div className="mb-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-accent rounded flex items-center justify-center font-bold text-white">S</div>
          <span className="font-bold text-lg">Docs</span>
        </div>
        
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                const element = document.getElementById(section.id);
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id 
                  ? 'bg-brand-accent/10 text-brand-accent' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 md:p-16 max-w-4xl mx-auto">
        <section id="introduction" className="mb-16">
          <h1 className="text-4xl font-bold mb-6">Introduction</h1>
          <p className="text-lg text-gray-400 leading-relaxed mb-6">
            SHG is an interactive, automation-first CLI designed to simplify Capacitor Android development. 
            It streamlines everything from project setup to deployment, so you can focus on building your app.
          </p>
          <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-xl flex gap-4">
            <Zap className="text-blue-400 shrink-0" size={24} />
            <p className="text-blue-100 text-sm">
              SHG is built to be fast, reliable, and user-friendly. No more memorizing long lists of flags.
            </p>
          </div>
        </section>

        <section id="installation" className="mb-16">
          <h2 className="text-3xl font-bold mb-6">Installation</h2>
          <p className="text-gray-400 mb-4">The easiest way to install SHG CLI is via Bun (recommended):</p>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-brand-primary mb-8 relative group">
            <code>bun install -g shg-cli</code>
          </div>
          
          <h3 className="text-xl font-bold mb-4">Prerequisites</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>Bun 1.3+ or Node.js 18+</li>
            <li>Java JDK 17+ (for Android builds)</li>
            <li>Android SDK with ANDROID_HOME set</li>
            <li>adb available on PATH</li>
          </ul>
        </section>

        <section id="quick-start" className="mb-16">
          <h2 className="text-3xl font-bold mb-6">Quick Start</h2>
          <p className="text-gray-400 mb-6">Get up and running in seconds with these core commands:</p>
          <div className="space-y-4">
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <div className="text-xs text-gray-500 uppercase mb-2">Check environment</div>
              <code className="text-brand-accent">shg doctor --fix</code>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <div className="text-xs text-gray-500 uppercase mb-2">Initialize project</div>
              <code className="text-brand-accent">shg setup --install --add-android</code>
            </div>
          </div>
        </section>

        <section id="commands" className="mb-16">
          <h2 className="text-3xl font-bold mb-6">Command Reference</h2>
          <div className="space-y-8">
            <CommandDoc 
              command="shg dev"
              description="Start a live-reload dev server and launch the Android app."
              flags={[
                { flag: '--wifi', desc: 'Connect to device over WiFi' },
                { flag: '--host <ip>', desc: 'Specify dev server host' },
                { flag: '--port <port>', desc: 'Specify dev server port' }
              ]}
            />
            <CommandDoc 
              command="shg deploy"
              description="Full pipeline: build, sync, and run the app."
              flags={[
                { flag: '--all', desc: 'Perform all steps (default)' },
                { flag: '--build', desc: 'Build only' },
                { flag: '--run', desc: 'Run only' }
              ]}
            />
          </div>
        </section>

        <section id="configuration" className="mb-16">
          <h2 className="text-3xl font-bold mb-6">Configuration</h2>
          <p className="text-gray-400 mb-6">Customize SHG behavior via local or global configuration files.</p>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 overflow-x-auto">
            <pre className="text-brand-primary text-sm">
{`{
  "defaultVariant": "debug",
  "autoSyncBeforeRun": true,
  "doctor": {
    "autoRunBeforeDeploy": true
  }
}`}
            </pre>
          </div>
        </section>

        <footer className="pt-8 border-t border-gray-800 flex justify-between items-center text-gray-500 text-sm">
          <span>© 2026 SHG CLI</span>
          <a href="/" className="hover:text-brand-accent transition-colors flex items-center gap-1">
            Back to Home <ExternalLink size={14} />
          </a>
        </footer>
      </main>
    </div>
  );
};

interface CommandDocProps {
  command: string;
  description: string;
  flags: { flag: string; desc: string }[];
}

const CommandDoc: React.FC<CommandDocProps> = ({ command, description, flags }) => (
  <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/30">
    <div className="flex items-center gap-3 mb-3">
      <div className="px-2 py-1 bg-brand-accent/20 text-brand-accent rounded text-sm font-bold">{command}</div>
    </div>
    <p className="text-gray-400 mb-4">{description}</p>
    <div className="space-y-2">
      {flags.map(f => (
        <div key={f.flag} className="flex gap-4 text-sm">
          <code className="text-gray-300 shrink-0 w-32">{f.flag}</code>
          <span className="text-gray-500">{f.desc}</span>
        </div>
      ))}
    </div>
  </div>
);

export default Docs;
