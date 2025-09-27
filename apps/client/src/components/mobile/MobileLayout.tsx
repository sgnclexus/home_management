import React, { ReactNode } from 'react';
import { useMobileNavigation, useViewport, useDeviceDetection } from '../../hooks/useMobile';
import { MobileHeader } from './MobileHeader';
import { MobileNavigation } from './MobileNavigation';
import { MobileBottomBar } from './MobileBottomBar';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  showBottomBar?: boolean;
  headerActions?: ReactNode;
  onBack?: () => void;
  className?: string;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title,
  showBackButton = false,
  showBottomBar = true,
  headerActions,
  onBack,
  className = '',
}) => {
  const { isMenuOpen, toggleMenu, closeMenu, isMobile } = useMobileNavigation();
  const { isKeyboardOpen } = useViewport();
  const { screenSize } = useDeviceDetection();

  // Don't use mobile layout on desktop
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Mobile Header */}
      <MobileHeader
        title={title}
        showBackButton={showBackButton}
        onBack={onBack}
        onMenuToggle={toggleMenu}
        actions={headerActions}
      />

      {/* Mobile Navigation Overlay */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeMenu}
          />
          
          {/* Navigation Menu */}
          <MobileNavigation
            isOpen={isMenuOpen}
            onClose={closeMenu}
          />
        </>
      )}

      {/* Main Content */}
      <main
        className={`
          flex-1 overflow-auto
          ${showBottomBar && !isKeyboardOpen ? 'pb-16' : 'pb-4'}
          ${screenSize === 'sm' ? 'px-4' : 'px-6'}
          pt-4
        `}
        style={{
          paddingTop: '4.5rem', // Account for fixed header
          minHeight: isKeyboardOpen ? 'auto' : 'calc(100vh - 4.5rem)',
        }}
      >
        {children}
      </main>

      {/* Mobile Bottom Bar */}
      {showBottomBar && !isKeyboardOpen && (
        <MobileBottomBar />
      )}
    </div>
  );
};

export default MobileLayout;