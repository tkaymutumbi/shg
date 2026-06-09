import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

const Terminal: React.FC = () => {
  return (
    <div className="w-full max-w-2xl mx-auto bg-[#2b120d] rounded-lg shadow-2xl overflow-hidden border border-[#3e1e18] font-mono text-sm text-[#d6d3d1] text-left">
      {/* OS-style Header */}
      <div className="bg-[#1e0d0a] px-4 py-2 flex items-center gap-2 border-b border-[#3e1e18]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="flex-1 text-center text-xs text-[#6e5a56]">shg — terminal</div>
      </div>

      {/* Terminal Content */}
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#fecaca] opacity-80">
          <span>❯</span>
          <motion.span 
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            transition={{ duration: 0.5, ease: "linear" }}
            className="font-bold overflow-hidden whitespace-nowrap"
          >
            shg
          </motion.span>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="py-4"
        >
          <Logo className="text-7xl mb-4" />
          <div className="text-[#a8a29e] text-base mb-6">
            Capacitor Android CLI - by SHG (v2026.4.1)
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="relative pl-6 border-l-2 border-[#57534e]"
        >
          {/* Badge */}
          <div className="absolute -left-1.5 top-0 w-3 h-3 bg-[#e7e5e4] rotate-45 transform border border-[#1e0d0a]" />
          
          <div className="mb-4 inline-block bg-[#e7e5e4] text-[#1c1917] px-3 py-1 font-bold">
            SHG CLI Interactive
          </div>

          <div className="space-y-3">
            <div className="font-bold text-[#f5f5f4]">What do you want to do?</div>
            
            <motion.div 
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 text-[#fecaca]"
            >
              <span className="mt-1">●</span>
              <div>
                <div className="font-bold">Dev Server (Live Reload)</div>
                <div className="text-[#a8a29e] text-xs">(start dev server + android app)</div>
              </div>
            </motion.div>

            {['Build & Deploy', 'Capacitor Setup', 'Build APK/AAB', 'View Logs'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-[#a8a29e] opacity-80">
                <span>○</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="pt-4 flex items-center gap-2">
          <span className="text-[#27c93f]">❯</span>
          <motion.span 
            animate={{ opacity: [1, 0] }} 
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="w-2 h-5 bg-[#fecaca]" 
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;
