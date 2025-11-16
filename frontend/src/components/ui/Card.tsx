import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
}

/**
 * Card component following FlowGuard design system
 * Includes hover effects and dark mode support
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
}) => {
  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };

  const hoverStyles = hover ? 'hover:shadow-lg hover:-translate-y-1' : '';

  return (
    <div
      className={`bg-[var(--color-surface)] rounded-xl shadow-md transition-all duration-250 ${paddings[padding]} ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
};

