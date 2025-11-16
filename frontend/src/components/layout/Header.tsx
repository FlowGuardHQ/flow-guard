import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

/**
 * Header component with FlowGuard branding and navigation
 * Includes mobile menu and dark mode support
 */
export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-[var(--color-surface)]/80 dark:bg-[#1a1a1a]/80 sticky top-0 z-50 backdrop-blur-md backdrop-saturate-150 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 md:h-20">
          {/* Logo and nav grouped together on the left */}
          <div className="flex items-center gap-8 lg:gap-12">
            <Logo variant="default" />

            <nav className="hidden md:flex space-x-6 lg:space-x-8">
              <Link
                to="/vaults"
                className="text-[var(--color-text-secondary)] hover:text-[#b2ac88] transition-colors font-medium"
              >
                Vaults
              </Link>
              <Link
                to="/proposals"
                className="text-[var(--color-text-secondary)] hover:text-[#b2ac88] transition-colors font-medium"
              >
                Proposals
              </Link>
              <Link
                to="/docs"
                className="text-[var(--color-text-secondary)] hover:text-[#b2ac88] transition-colors font-medium"
              >
                Docs
              </Link>
            </nav>
          </div>

          {/* Right side - Theme toggle and Launch App button */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <ThemeToggle />

            <Link to="/vaults" className="hidden sm:block">
              <Button variant="primary" size="sm">
                Launch App →
              </Button>
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6 text-[var(--color-text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700 backdrop-blur-md">
            <nav className="flex flex-col space-y-4">
              <Link
                to="/vaults"
                className="text-[var(--color-text-secondary)] hover:text-[#b2ac88] transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Vaults
              </Link>
              <Link
                to="/proposals"
                className="text-[var(--color-text-secondary)] hover:text-[#b2ac88] transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Proposals
              </Link>
              <Link
                to="/docs"
                className="text-[var(--color-text-secondary)] hover:text-[#b2ac88] transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <Link to="/vaults" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full sm:w-auto">
                  Launch App →
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

