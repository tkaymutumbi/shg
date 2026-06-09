import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'large' | 'header';
}

const Logo: React.FC<LogoProps> = ({ className, variant = 'large' }) => {
  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-1.5 font-bold tracking-tighter ${className}`}>
        <div className="flex gap-1 group">
          <HeaderLetter char="S" />
          <HeaderLetter char="H" />
          <HeaderLetter char="G" />
        </div>
        <span className="text-[10px] bg-brand-accent text-white px-1 rounded ml-1 font-black opacity-90">CLI</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 font-black text-6xl tracking-tighter ${className}`}>
      <Letter char="S" />
      <Letter char="H" />
      <Letter char="G" />
    </div>
  );
};

const HeaderLetter: React.FC<{ char: string }> = ({ char }) => (
  <div className="relative leading-none">
    <span className="absolute top-[1px] left-[1px] text-brand-accent opacity-30 select-none">{char}</span>
    <span className="relative text-brand-accent drop-shadow-[0_0_1px_rgba(255,0,122,0.5)]">{char}</span>
  </div>
);

const Letter: React.FC<{ char: string }> = ({ char }) => (
  <div className="relative">
    <span className="absolute top-1 left-1 text-brand-primary opacity-30 select-none">{char}</span>
    <span className="absolute top-0.5 left-0.5 text-brand-primary opacity-60 select-none">{char}</span>
    <span className="relative text-brand-primary drop-shadow-[0_0_2px_rgba(254,202,202,0.8)]">{char}</span>
  </div>
);

export default Logo;
