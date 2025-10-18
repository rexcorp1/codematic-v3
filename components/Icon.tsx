import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  title?: string;
}

const Icon: React.FC<IconProps> = ({ name, className, onClick, title }) => {
  return (
    <span data-tooltip={title} className={`material-symbols-outlined ${className || ''}`} onClick={onClick}>
      {name}
    </span>
  );
};

export default Icon;