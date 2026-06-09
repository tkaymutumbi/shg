import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`flex gap-3 font-black text-6xl tracking-tighter ${className}`}>
      <Letter char="S" />
      <Letter char="H" />
      <Letter char="G" />
    </div>
  );
};

const Letter: React.FC<{ char: string }> = ({ char }) => (
  <div className="relative">
    {/* Triple outline/shadow effect from the image */}
    <span className="absolute top-1 left-1 text-brand-primary opacity-30 select-none">{char}</span>
    <span className="absolute top-0.5 left-0.5 text-brand-primary opacity-60 select-none">{char}</span>
    <span className="relative text-brand-primary drop-shadow-[0_0_2px_rgba(254,202,202,0.8)]">{char}</span>
  </div>
);

export default Logo;
