import React from 'react';
import { render, screen } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { NetworkStatus } from '../NetworkStatus';
import { useNetworkStatus } from '../../../hooks/usePWA';

// Mock the hooks
jest.mock('../../../hooks/usePWA');
jest.mock('next-i18next');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

describe('NetworkStatus', () => {
  const mockT = jest.fn((key: string, defaultValue?: string) => defaultValue || key);

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseTranslation.mockReturnValue({
      t: mockT,
      i18n: {} as any,
      ready: true,
    });
  });

  it('should not render when online and showOnlineStatus is false', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    const { container } = render(<NetworkStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('should render online status when online and showOnlineStatus is true', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<NetworkStatus showOnlineStatus={true} />);

    expect(screen.getByText('Connection restored. All features are available.')).toBeInTheDocument();
    expect(screen.getByText('Connection restored. All features are available.').closest('div')).toHaveClass('bg-green-600');
  });

  it('should render offline status when offline', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    render(<NetworkStatus />);

    expect(screen.getByText('You are currently offline. Some features may be limited.')).toBeInTheDocument();
    expect(screen.getByText('You are currently offline. Some features may be limited.').closest('div')).toHaveClass('bg-red-600');
  });

  it('should apply custom className', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    const customClass = 'custom-class';
    render(<NetworkStatus className={customClass} />);

    const statusElement = screen.getByText('You are currently offline. Some features may be limited.').closest('div');
    expect(statusElement).toHaveClass(customClass);
  });

  it('should use correct translation keys', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    render(<NetworkStatus />);

    expect(mockT).toHaveBeenCalledWith('pwa.networkStatus.offline', 'You are currently offline. Some features may be limited.');
  });

  it('should use correct translation keys for online status', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<NetworkStatus showOnlineStatus={true} />);

    expect(mockT).toHaveBeenCalledWith('pwa.networkStatus.online', 'Connection restored. All features are available.');
  });

  it('should have correct positioning classes', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    render(<NetworkStatus />);

    const statusElement = screen.getByText('You are currently offline. Some features may be limited.').closest('div');
    expect(statusElement).toHaveClass('fixed', 'top-0', 'left-0', 'right-0', 'z-50');
  });

  it('should display correct icons for offline status', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    render(<NetworkStatus />);

    const icon = screen.getByText('You are currently offline. Some features may be limited.')
      .closest('div')
      ?.querySelector('svg');
    
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('h-5', 'w-5');
  });

  it('should display correct icons for online status', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<NetworkStatus showOnlineStatus={true} />);

    const icon = screen.getByText('Connection restored. All features are available.')
      .closest('div')
      ?.querySelector('svg');
    
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('h-5', 'w-5');
  });
});