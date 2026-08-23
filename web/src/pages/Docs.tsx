interface CodeBlockProps {
  content: string;
  language?: string;
  onCopy: (msg: string) => void;
}

const CodeBlock = ({ content, language, onCopy }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-dark-bg border border-border-subtle rounded-xl overflow-hidden shadow-2xl mb-6">
      <div className="bg-dark-bg/50 px-4 py-2 flex items-center gap-2 border-b border-border-subtle">
        <div className="w-2 h-2 rounded-full bg-brand-accent" />
        <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest text-dark-text">{language || 'shell'}</span>
      </div>
      <div className="p-6 font-mono text-sm group relative overflow-x-auto">
        <pre className="text-dark-text">
          {!content.startsWith('$') && !content.startsWith('{') && <span className="opacity-40 mr-3">{"$"}</span>}
          {content}
        </pre>
        <button 
          onClick={handleCopy}
          className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-dark-bg/80 rounded"
          title="Click to copy"
        >
          {copied ? <Check size={16} className="text-brand-accent" /> : <Copy size={16} className="opacity-40"/>}
        </button>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  Terminal, 
  Box, 
  Layout, 
  TestTube, 
  Check,
  Download, 
  ChevronRight,
  Menu as MenuIcon,
  X,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeSwitcher } from '../App';
import Logo from '../components/Logo';
import Toast from '../components/Toast';

const CATEGORIES = [
  { id: 'cli', label: 'CLI', icon: Terminal },
  { id: 'core', label: 'Core', icon: Box },
  { id: 'plugins', label: 'Plugins', icon: Layout },
  { id: 'tests', label: 'Tests', icon: TestTube },
];

interface NavigationItem {
  id: string;
  label: string;
}

interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

interface DocListItem {
  title: string;
  description: string;
}

interface DocSection {
  id: string;
  title?: string;
  type: 'text' | 'code' | 'list';
  content?: string;
  language?: string;
  items?: DocListItem[];
}

interface DocPage {
  badge: string;
  title: string;
  description: string;
  sections: DocSection[];
}

const NAVIGATION: Record<string, NavigationGroup[]> = {
  cli: [
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
        { id: 'shg-connect', label: 'shg connect' },
        { id: 'shg-install', label: 'shg install' },
        { id: 'shg-deploy', label: 'shg deploy' },
        { id: 'shg-doctor', label: 'shg doctor' },
        { id: 'shg-setup', label: 'shg setup' },
        { id: 'shg-assets', label: 'shg assets' },
        { id: 'shg-device', label: 'shg device' },
        { id: 'shg-screenshot', label: 'shg screenshot' },
      ]
    },
    {
      title: 'Advanced',
      items: [
        { id: 'configuration', label: 'shgrc.json' },
        { id: 'wifi-debugging', label: 'WiFi Debugging' },
      ]
    }
  ],
  core: [
    {
      title: 'Architecture',
      items: [
        { id: 'core-overview', label: 'Core Overview' },
        { id: 'executor', label: 'Command Executor' },
        { id: 'project-detection', label: 'Project Detection' },
      ]
    },
    {
      title: 'Platform Modules',
      items: [
        { id: 'android-module', label: 'Android Module' },
        { id: 'adb-management', label: 'ADB Management' },
      ]
    }
  ],
  plugins: [
    {
      title: 'Management',
      items: [
        { id: 'plugin-cli', label: 'shg plugin command' },
        { id: 'adding-plugins', label: 'Adding Plugins' },
        { id: 'syncing-plugins', label: 'Syncing Plugins' },
      ]
    }
  ],
  tests: [
    {
      title: 'Development',
      items: [
        { id: 'testing-shg', label: 'Testing SHG' },
        { id: 'running-diagnostics', label: 'Running Diagnostics' },
        { id: 'integration-tests', label: 'Integration Tests' },
      ]
    }
  ]
};

const DOC_CONTENT: Record<string, DocPage> = {
  welcome: {
    badge: 'CLI',
    title: 'Welcome to SHG',
    description: 'Capacitor Android development, simplified. Interactive & automation-first CLI to streamline your mobile workflow.',
    sections: [
      { id: 'overview', title: 'Overview', content: 'SHG (Simplified Hybrid Gateway) is a powerful CLI tool designed to eliminate the friction in Capacitor-based Android development. It brings interactive menus, intelligent diagnostics, and seamless wireless debugging to your fingertips.', type: 'text' },
      { id: 'core-features', title: 'Core Features', type: 'list', items: [
        { title: 'Interactive TUI', description: 'No flags to remember. Just run shg and follow the guided menu.' },
        { title: 'Bundled Verification', description: 'Build and launch a self-contained debug APK with shg build and shg run.' },
        { title: 'Optional Live Reload', description: 'Use shg dev --wifi for focused UI work with exact ADB targeting and diagnostics.' },
        { title: 'Screenshot QA', description: 'Capture a temporary device PNG with shg screenshot for visual inspection.' },
        { title: 'Auto-Fixing Doctor', description: 'Intelligent diagnostics for Node, Java, ADB, and Android SDK.' }
      ]}
    ]
  },
  installation: {
    badge: 'CLI',
    title: 'Installation',
    description: 'Install SHG with bun, npm, or directly from source.',
    sections: [
      { id: 'install-bun', title: 'Install via Bun (Recommended)', content: 'bun install -g shg-cli', type: 'code' },
      { id: 'install-npm', title: 'Install via npm', content: 'npm install -g shg-cli', type: 'code' },
      { id: 'android-prerequisites', title: 'Android prerequisites', content: 'Install Android Studio/platform-tools and JDK 21+ for the current Capacitor 8 Android project. Run `shg doctor` before `shg dev`, `shg build`, or `shg run`; if it reports `invalid source release: 21`, activate JDK 21 and rerun the doctor.', type: 'text' },
      { id: 'verification', title: 'Verification', content: 'shg --version\nshg doctor', type: 'code' }
    ]
  },
  quickstart: {
    badge: 'CLI',
    title: 'Quickstart',
    description: 'Get your Capacitor Android project running in minutes.',
    sections: [
      { id: 'doctor-code', title: '1. Run Diagnostics', content: 'shg doctor --fix', type: 'code' },
      { id: 'setup-code', title: '2. Setup Project', content: 'shg setup --install --add-android', type: 'code' },
      { id: 'build-code', title: '3. Build and Launch', content: 'shg build\nshg run\nshg device status\nshg device screenshot', type: 'code' },
      { id: 'dev-code', title: 'Optional Live Reload', content: 'shg dev --wifi --host <LAN-IP> --port 5173', type: 'code' }
    ]
  },
  'shg-dev': {
    badge: 'CLI Commands',
    title: 'shg dev',
    description: 'Optional Vite live reload on your Android device; use shg build and shg run for normal verification.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg dev [options]', type: 'code' },
      { id: 'options', title: 'Options', type: 'list', items: [
        { title: '--wifi', description: 'Connect to the device over WiFi and pass the exact ADB endpoint to Capacitor.' },
        { title: '--host <host>', description: 'Specify the dev server host; use the laptop LAN IP for WiFi, not localhost.' },
        { title: '--port <port>', description: 'Specify the dev server port (default: 5173).' }
      ]},
      { id: 'workflow', title: 'What it does', content: 'shg dev starts or reuses Vite, syncs Capacitor, builds and installs a debug Android app, then launches it with live reload. It is optional UI development; use shg build followed by shg run for normal bundled verification.', type: 'text' },
      { id: 'java', title: 'Java requirement', content: 'The current Capacitor 8 project targets Java 21. If Gradle reports invalid source release: 21, activate JDK 21+ (for example, mise use --global java@21.0.2), rerun shg doctor, and retry.', type: 'text' }
    ]
  },
  'shg-connect': {
    badge: 'CLI Commands',
    title: 'shg connect',
    description: 'Pair Android 11+ Wireless debugging from the terminal with an Android-compatible QR code.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg connect', type: 'code' },
      { id: 'first-pairing', title: 'First pairing', content: 'Enable Developer options → Wireless debugging on the phone, choose Pair device with QR code, and scan the QR shown by SHG. SHG waits for the exact studio-* mDNS pairing service, runs adb pair, discovers the secure connect service, and verifies the device is ready.', type: 'text' },
      { id: 'repeat', title: 'After pairing', content: 'shg dev\nshg run\nshg install --release', type: 'code' },
      { id: 'fallback', title: 'When mDNS is blocked', content: 'Keep the computer and phone on the same Wi-Fi network. Check VPN isolation, guest-network multicast, Windows Defender Firewall, and platform-tools. `shg devices --wifi` retains the IP/port and six-digit pairing-code fallback.', type: 'text' },
      { id: 'secret', title: 'QR safety', content: 'The QR contains a short-lived pairing credential. Do not share screenshots. SHG never saves the temporary QR secret; it stores only the reusable post-pairing endpoint.', type: 'text' }
    ]
  },
  'shg-install': {
    badge: 'CLI Commands',
    title: 'shg install',
    description: 'Build, install, and launch the selected APK on a connected or paired Android device.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg install\nshg install --release\nshg install --release --flavor free --device <id>', type: 'code' },
      { id: 'options', title: 'Options', type: 'list', items: [
        { title: '--release', description: 'Select the release APK.' },
        { title: '--variant <name>', description: 'Select a Gradle variant.' },
        { title: '--flavor <name>', description: 'Select a product flavor.' },
        { title: '--device <id>', description: 'Target an exact ADB device.' },
        { title: '--no-build / --no-sync', description: 'Install an existing APK or skip the web/Capacitor sync step.' }
      ]},
      { id: 'artifacts', title: 'APK versus AAB', content: 'Debug and release APKs can be installed directly. Build an AAB with `shg build --release --aab` for Play Store or bundle distribution; ordinary `adb install` does not install an AAB.', type: 'text' }
    ]
  },
  'shg-screenshot': {
    badge: 'CLI Commands',
    title: 'shg screenshot',
    description: 'Capture a temporary PNG from a ready Android device.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg screenshot\nshg screenshot --device <exact-id>', type: 'code' },
      { id: 'details', title: 'Details', content: 'The default output is written outside the project. Inspect the printed path with view_image and do not commit temporary screenshots.', type: 'text' }
    ]
  },
  'shg-device': {
    badge: 'CLI Commands',
    title: 'shg device',
    description: 'Inspect and control a connected Android device through targeted ADB commands.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg device <command> [options]', type: 'code' },
      { id: 'commands', title: 'Commands', type: 'list', items: [
        { title: 'status / wake', description: 'Inspect screen and lock state, wake the device, or enable keep-awake mode.' },
        { title: 'screenshot / dump-ui', description: 'Capture a temporary PNG or save the UIAutomator hierarchy for inspection.' },
        { title: 'tap / swipe / text / key', description: 'Send basic input events to the focused Android app.' },
        { title: 'launch / logs / shell', description: 'Launch the project package, tail targeted logcat, or run an explicit ADB shell command.' }
      ]},
      { id: 'examples', title: 'Examples', content: 'shg device wake --keep-awake\nshg device tap 540 1200 --wake\nshg device text "hello world"\nshg device dump-ui --output /tmp/window.xml', type: 'code' },
      { id: 'sleep', title: 'Sleep and lock behavior', content: 'A sleeping screen can be woken while ADB remains connected. SHG does not bypass secure lock screens, and WiFi ADB may disconnect when Android suspends WiFi.', type: 'text' }
    ]
  },
  'shg-deploy': {
    badge: 'CLI Commands',
    title: 'shg deploy',
    description: 'A robust pipeline to build, sync, and run your app.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg deploy [options]', type: 'code' },
      { id: 'options', title: 'Options', type: 'list', items: [
        { title: '--all', description: 'Run build, sync, and run (default).' },
        { title: '--build', description: 'Only run the web build.' },
        { title: '--sync', description: 'Only run capacitor sync.' }
      ]}
    ]
  },
  'shg-doctor': {
    badge: 'CLI Commands',
    title: 'shg doctor',
    description: 'Intelligent diagnostics and auto-fixing for your environment.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg doctor [options]', type: 'code' },
      { id: 'checks', title: 'Checks Performed', content: 'SHG checks for Node, Bun, Java, Gradle, ADB, Android SDK, and project-specific dependencies.', type: 'text' }
    ]
  },
  'shg-setup': {
    badge: 'CLI Commands',
    title: 'shg setup',
    description: 'Guided setup for new or existing Capacitor projects.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg setup [options]', type: 'code' },
      { id: 'steps', title: 'Available Steps', type: 'list', items: [
        { title: '--install', description: 'Add Capacitor core and CLI.' },
        { title: '--init', description: 'Initialize Capacitor configuration.' },
        { title: '--add-android', description: 'Add the Android platform folder.' }
      ]}
    ]
  },
  'shg-assets': {
    badge: 'CLI Commands',
    title: 'shg assets',
    description: 'Generate high-quality app icons and splash screens.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg assets', type: 'code' },
      { id: 'details', title: 'Details', content: 'Uses @capacitor/assets under the hood to generate all required Android sizes from your assets/ directory.', type: 'text' }
    ]
  },
  'configuration': {
    badge: 'Advanced',
    title: 'shgrc.json',
    description: 'Customize SHG behavior via global or local configuration.',
    sections: [
      { id: 'location', title: 'File Locations', content: 'Global: ~/.config/shg/config.json\nLocal: .shgrc.json', type: 'text' },
      { id: 'structure', title: 'Example Structure', content: JSON.stringify({ defaultFlow: "deployAll", doctor: { autoRunBeforeDeploy: true } }, null, 2), type: 'code', language: 'json' }
    ]
  },
  'wifi-debugging': {
    badge: 'Advanced',
    title: 'WiFi Debugging',
    description: 'Deploy and debug your app without cables.',
    sections: [
      { id: 'overview', title: 'How it works', content: '`shg connect` uses Android Studio-compatible QR pairing for Android 11+ and discovers `_adb-tls-pairing._tcp` and `_adb-tls-connect._tcp` services through ADB mDNS. Legacy IP/pairing-code and USB workflows remain available when mDNS is unavailable.', type: 'text' }
    ]
  },
  // CORE CONTENT
  'core-overview': {
    badge: 'Core',
    title: 'Core Architecture',
    description: 'Understanding the internal structure of SHG.',
    sections: [
      { id: 'design', title: 'Design Principles', content: 'SHG is built with TypeScript and Bun for speed. It uses a modular architecture where commands are decoupled from the core logic.', type: 'text' }
    ]
  },
  'executor': {
    badge: 'Core',
    title: 'Command Executor',
    description: 'The engine that runs sub-processes safely.',
    sections: [
      { id: 'overview', title: 'executor.ts', content: 'Wraps shell execution with chalk-styled output and error handling, ensuring consistent logging across the CLI.', type: 'text' }
    ]
  },
  'project-detection': {
    badge: 'Core',
    title: 'Project Detection',
    description: 'How SHG identifies Capacitor projects.',
    sections: [
      { id: 'overview', title: 'project.ts', content: 'Locates Capacitor configuration files and validates the existence of the android/ platform folder and web assets.', type: 'text' }
    ]
  },
  'android-module': {
    badge: 'Core',
    title: 'Android Module',
    description: 'Deep integration with the Android ecosystem.',
    sections: [
      { id: 'overview', title: 'android.ts', content: 'Manages device listing, IP detection, and wireless connection handshakes.', type: 'text' }
    ]
  },
  'adb-management': {
    badge: 'Core',
    title: 'ADB Management',
    description: 'Automatic ADB installation and linking.',
    sections: [
      { id: 'overview', title: 'Automatic Download', content: 'SHG can automatically download Android platform-tools if ADB is missing, ensuring a smooth onboarding experience.', type: 'text' }
    ]
  },
  // PLUGINS CONTENT
  'plugin-cli': {
    badge: 'Plugins',
    title: 'shg plugin command',
    description: 'Manage Capacitor plugins directly from SHG.',
    sections: [
      { id: 'usage', title: 'Usage', content: 'shg plugin [add|list|sync] [name]', type: 'code' }
    ]
  },
  'adding-plugins': {
    badge: 'Plugins',
    title: 'Adding Plugins',
    description: 'Streamlined plugin installation.',
    sections: [
      { id: 'overview', title: 'Auto-Sync', content: 'Adding a plugin via SHG automatically triggers a `capacitor sync`, reducing manual steps.', type: 'text' }
    ]
  },
  'syncing-plugins': {
    badge: 'Plugins',
    title: 'Syncing Plugins',
    description: 'Keep your Android project in sync.',
    sections: [
      { id: 'overview', title: 'shg plugin sync', content: 'Quickly sync all web assets and plugins to the Android platform.', type: 'text' }
    ]
  },
  // TESTS CONTENT
  'testing-shg': {
    badge: 'Tests',
    title: 'Testing SHG',
    description: 'Ensuring stability and reliability.',
    sections: [
      { id: 'overview', title: 'Quality Control', content: 'SHG uses a combination of unit tests and integration tests to verify CLI behavior.', type: 'text' }
    ]
  },
  'running-diagnostics': {
    badge: 'Tests',
    title: 'Running Diagnostics',
    description: 'Self-testing the doctor command.',
    sections: [
      { id: 'usage', title: 'Manual Testing', content: 'Developers can run `shg doctor` in various states (missing SDK, no device) to verify its auto-fixing logic.', type: 'text' }
    ]
  },
  'integration-tests': {
    badge: 'Tests',
    title: 'Integration Tests',
    description: 'Testing against real Capacitor projects.',
    sections: [
      { id: 'overview', title: 'Flow', content: 'Automated flows create a temporary Capacitor project to test `shg setup`, `shg build`, and `shg sync`.', type: 'text' }
    ]
  }
};


const Docs = () => {
  const [activeCategory, setActiveCategory] = useState('cli');
  const [activeSection, setActiveSection] = useState('welcome');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef<HTMLElement>(null);
  const scrollContentToTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const results: { id: string; badge: string; title: string; description: string }[] = [];
    for (const [id, doc] of Object.entries(DOC_CONTENT)) {
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchDesc = doc.description.toLowerCase().includes(q);
      let foundSection = false;
      for (const section of doc.sections) {
        if (section.content && typeof section.content === 'string' && section.content.toLowerCase().includes(q)) {
          foundSection = true;
          break;
        }
        if (section.title && section.title.toLowerCase().includes(q)) {
          foundSection = true;
          break;
        }
      }
      if (matchTitle || matchDesc || foundSection) {
        results.push({ id, badge: doc.badge, title: doc.title, description: doc.description });
      }
    }
    return results;
  }, [searchQuery]);

  const showToast = (message: string) => {
    setToast({ isVisible: true, message });
  };

  const renderTextWithCode = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const command = part.slice(1, -1);
        return (
          <code 
            key={index} 
            className="bg-brand-accent/10 text-brand-accent px-1.5 py-0.5 rounded border border-brand-accent/20 font-mono text-sm mx-1 cursor-pointer hover:bg-brand-accent/20 transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(command);
              showToast(`Copied: ${command}`);
            }}
            title="Click to copy"
          >
            {command}
          </code>
        );
      }
      return part;
    });
  };


          const navigation = NAVIGATION[activeCategory] || NAVIGATION.cli;
          const content = DOC_CONTENT[activeSection] || DOC_CONTENT.welcome;

          return (
          <div className="min-h-screen bg-dark-bg text-dark-text selection:bg-brand-accent/30 transition-colors duration-300">
          <Toast 
          message={toast.message} 
          isVisible={toast.isVisible} 
          onClose={() => setToast({ ...toast, isVisible: false })} 
          />
      {/* Top Navbar */}
      <nav className="h-14 border-b border-border-subtle bg-nav-bg backdrop-blur-md sticky top-0 z-50 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo variant="header" className="text-lg" />
          </Link>

          <div className="hidden lg:flex items-center gap-1 text-sm font-medium opacity-60">
            {CATEGORIES.map((cat) => (
              <NavTab 
                key={cat.id}
                icon={<cat.icon size={16}/>} 
                label={cat.label} 
                active={activeCategory === cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const firstSection = NAVIGATION[cat.id][0].items[0].id;
                  setActiveSection(firstSection);
                  scrollContentToTop();
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 max-w-md hidden md:flex relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40">
            <Search size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Search docs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-bg/50 border border-border-subtle rounded-md py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <a 
            href="https://github.com/Diplovee/shg" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 bg-brand-accent text-white px-3 py-1.5 rounded-md text-sm font-bold hover:opacity-90 transition-colors shadow-lg shadow-brand-accent/20"
          >
            <Download size={16} />
            GitHub
          </a>
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
                        scrollContentToTop();
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
        <main ref={contentRef} className="flex-1 min-w-0 p-8 lg:p-12 overflow-y-auto h-[calc(100vh-3.5rem)] scroll-smooth text-left">
          <div className="max-w-3xl">
            {searchResults !== null ? (
              <>
                <header className="mb-8">
                  <h1 className="text-3xl font-bold mb-2">Search results</h1>
                  <p className="opacity-60">
                    {searchResults.length === 0 
                      ? `No results found for "${searchQuery}"`
                      : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'} for "${searchQuery}"`
                    }
                  </p>
                </header>
                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          setSearchQuery('');
                          setActiveSection(result.id);
                          scrollContentToTop();
                        }}
                        className="w-full text-left bg-dark-bg/30 border border-border-subtle p-4 rounded-xl hover:border-brand-accent/40 transition-all group"
                      >
                        <div className="text-xs text-brand-accent font-bold mb-1 uppercase tracking-wider">{result.badge}</div>
                        <div className="font-bold mb-1 group-hover:text-brand-accent transition-colors">{result.title}</div>
                        <div className="text-sm opacity-60 line-clamp-2">{result.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <header className="mb-12">
                  <div className="text-brand-accent text-sm font-bold mb-4 uppercase tracking-wider">{content.badge}</div>
                  <h1 className="text-5xl font-black mb-6 tracking-tight">{content.title}</h1>
                  <p className="text-xl opacity-60 leading-relaxed">
                    {content.description}
                  </p>
                </header>

                <div className="space-y-12">
                  {content.sections.map((section) => (
                    <section key={section.id} id={section.id}>
                      {section.title && <h2 className="text-3xl font-bold mb-6 tracking-tight">{section.title}</h2>}

                      {section.type === 'text' && (
                        <p className="opacity-70 leading-7 mb-6 text-lg whitespace-pre-line">
                          {renderTextWithCode(section.content ?? '')}
                        </p>
                      )}

                      {section.type === 'code' && (
                        <CodeBlock content={section.content ?? ''} language={section.language} onCopy={showToast} />
                      )}


                      {section.type === 'list' && (
                        <div className="grid grid-cols-1 gap-4 mb-6">
                          {section.items?.map((item, idx) => (
                            <div key={idx} className="bg-dark-bg/30 border border-border-subtle p-4 rounded-xl flex gap-4">
                              <div className="text-brand-accent font-bold opacity-40">{idx + 1}.</div>
                              <div>
                                <div className="font-bold mb-1">{item.title}</div>
                                <div className="text-sm opacity-60">{renderTextWithCode(item.description)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>

                <footer className="mt-20 pt-12 border-t border-border-subtle flex items-center justify-between opacity-50">
                  <div className="text-sm">
                    © 2026 SHG CLI — Simplified Hybrid Gateway
                  </div>
                  <div className="flex gap-6">
                    <a href="https://github.com/Diplovee/shg" target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={18} className="hover:text-brand-accent cursor-pointer transition-colors"/>
                    </a>
                    <Terminal size={18} className="hover:text-brand-accent cursor-pointer transition-colors"/>
                  </div>
                </footer>
              </>
            )}
          </div>
        </main>

        {/* Right Sidebar - On this page */}
        <aside className="hidden xl:block w-64 p-8 sticky top-14 h-[calc(100vh-3.5rem)] text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
            <MenuIcon size={14}/> On this page
          </h4>
          <nav className="space-y-4">
            {content.sections.map((section) => (
              <button 
                key={section.id}
                onClick={() => {
                  const element = document.getElementById(section.id);
                  if (element) element.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block text-sm opacity-60 hover:opacity-100 hover:text-brand-accent transition-all text-left truncate w-full"
              >
                {section.title || 'Overview'}
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
};

const NavTab = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center gap-2 px-3 py-2 rounded-md transition-colors
      ${active ? 'text-dark-text bg-dark-bg/50 shadow-sm border border-border-subtle' : 'hover:opacity-100 hover:bg-dark-bg/30'}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default Docs;
