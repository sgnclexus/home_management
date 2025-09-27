import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { PWAInstallPrompt } from '../PWAInstallPrompt';
import { usePWAInstall } from '../../../hooks/usePWA';

// Mock the hooks
jest.mock('../../../hooks/usePWA');
jest.mock('next-i18next');

const mockUsePWAInstall = usePWAInstall as jest.MockedFunction<typeof usePWAInstall>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

describe('PWAInstallPrompt', () => {
  const mockShowInstallPrompt = jest.fn();
  const mockDismissInstallPrompt = jest.fn();
  const mockT = jest.fn((key: string, defaultValue?: string) => defaultValue || key);

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseTranslation.mockReturnValue({
      t: mockT,
      i18n: {} as any,
      ready: true,
    });

    mockUsePWAInstall.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      showInstallPrompt: mockShowInstallPrompt,
      dismissInstallPrompt: mockDismissInstallPrompt,
    });
  });

  it('should render install prompt when installable and not installed', () => {
    render(<PWAInstallPrompt />);

    expect(screen.getByText('Install Home Management App')).toBeInTheDocument();
    expect(screen.getByText('Install our app for a better experience with offline access and push notifications.')).toBeInTheDocument();
    expect(screen.getByText('Install')).toBeInTheDocument();
    expect(screen.getByText('Not now')).toBeInTheDocument();
  });

  it('should not render when app is already installed', () => {
    mockUsePWAInstall.mockReturnValue({
      isInstallable: false,
      isInstalled: true,
      showInstallPrompt: mockShowInstallPrompt,
      dismissInstallPrompt: mockDismissInstallPrompt,
    });

    const { container } = render(<PWAInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when not installable', () => {
    mockUsePWAInstall.mockReturnValue({
      isInstallable: false,
      isInstalled: false,
      showInstallPrompt: mockShowInstallPrompt,
      dismissInstallPrompt: mockDismissInstallPrompt,
    });

    const { container } = render(<PWAInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('should call showInstallPrompt when install button is clicked', async () => {
    mockShowInstallPrompt.mockResolvedValue();
    const onInstall = jest.fn();

    render(<PWAInstallPrompt onInstall={onInstall} />);

    const installButton = screen.getByText('Install');
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(mockShowInstallPrompt).toHaveBeenCalled();
      expect(onInstall).toHaveBeenCalled();
    });
  });

  it('should handle install prompt errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockShowInstallPrompt.mockRejectedValue(new Error('Install failed'));

    render(<PWAInstallPrompt />);

    const installButton = screen.getByText('Install');
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(mockShowInstallPrompt).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Failed to show install prompt:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it('should call dismissInstallPrompt when dismiss button is clicked', () => {
    const onDismiss = jest.fn();

    render(<PWAInstallPrompt onDismiss={onDismiss} />);

    const dismissButton = screen.getByText('Not now');
    fireEvent.click(dismissButton);

    expect(mockDismissInstallPrompt).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-class';
    render(<PWAInstallPrompt className={customClass} />);

    const promptElement = screen.getByText('Install Home Management App').closest('div');
    expect(promptElement).toHaveClass(customClass);
  });

  it('should use translation keys correctly', () => {
    render(<PWAInstallPrompt />);

    expect(mockT).toHaveBeenCalledWith('pwa.installPrompt.title', 'Install Home Management App');
    expect(mockT).toHaveBeenCalledWith('pwa.installPrompt.description', 'Install our app for a better experience with offline access and push notifications.');
    expect(mockT).toHaveBeenCalledWith('pwa.installPrompt.install', 'Install');
    expect(mockT).toHaveBeenCalledWith('pwa.installPrompt.dismiss', 'Not now');
  });
});