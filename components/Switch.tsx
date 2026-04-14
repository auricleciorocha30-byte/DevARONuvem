
import React from 'react';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export const Switch: React.FC<Props> = ({ checked, onChange }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#f68c3e]' : 'bg-gray-300'}`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
};
