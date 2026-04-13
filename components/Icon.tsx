"use client";

import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
}

/**
 * A tiny component to render icons from the local SVG sprite.
 * This is 99% faster than loading the 4MB Material Symbols font.
 */
export default function Icon({ name, className = "", style = {}, size }: IconProps) {
  const iconStyle: React.CSSProperties = {
    ...style,
    width: size || style.width || '1em',
    height: size || style.height || '1em',
    display: 'inline-block',
    verticalAlign: 'middle',
    fill: 'currentColor',
  };

  return (
    <svg 
      className={`svg-icon icon-${name} ${className}`} 
      style={iconStyle}
      aria-hidden="true"
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
