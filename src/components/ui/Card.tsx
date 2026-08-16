import type { HTMLAttributes } from 'react';
import './Card.css';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes = ['oc-card', className].filter(Boolean).join(' ');
  return <div className={classes} {...props} />;
}
