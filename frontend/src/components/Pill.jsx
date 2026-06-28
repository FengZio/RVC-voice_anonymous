import React from 'react';

export default function Pill({ tone = 'neutral', children }) {
  return React.createElement('span', { className: `pill pill-${tone}` }, children);
}
