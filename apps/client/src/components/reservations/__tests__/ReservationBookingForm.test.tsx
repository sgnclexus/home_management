import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { ReservationBookingForm } from '../ReservationBookingForm';
import { CommonArea, TimeSlot, CreateReservationDto } from '@home-management/types';

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    'reservations.confirmBooking': 'Confirm Booking',
    'reservations.bookingSummary': 'Booking Summary',
    'reservations.area': 'Area',
    'reservations.date': 'Date',
    'reservations.time': 'Time',
    'reservations.capacity': 'Capacity',
    'reservations.people': 'people',
    'reservations.areaRules': 'Area Rules',
    'reservations.notes': 'Notes',
    'reservations.optional': 'optional',
    'reservations.notesPlaceholder': 'Add any special notes or comments for your reservation...',
    'reservations.characters': 'characters',
    'reservations.booking': 'Booking...',
    'reservations.confirmReservation': 'Confirm Reservation',
    'cancel': 'Cancel',
  };
  return translations[key] || key;
});

const mockArea: CommonArea = {
  id: '1',
  name: 'Pool',
  description: 'Community pool with rest area',
  capacity: 20,
  availableHours: { start: '06:00', end: '22:00' },
  isActive: true,
  rules: [
    'No food in pool area',
    'Children must be accompanied by an adult',
    'Maximum 2 hours continuous use'
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTimeSlot: TimeSlot = {
  start: new Date('2024-01-15T10:00:00'),
  end: new Date('2024-01-15T12:00:00'),
  available: true,
};

const mockDate = new Date('2024-01-15');

const defaultProps = {
  selectedArea: mockArea,
  selectedDate: mockDate,
  selectedTimeSlot: mockTimeSlot,
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  loading: false,
};

describe('ReservationBookingForm', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    jest.clearAllMocks();
  });

  it('renders booking form with all required information', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
    expect(screen.getByText('Booking Summary')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('20 people')).toBeInTheDocument();
    expect(screen.getByText('10:00 - 12:00')).toBeInTheDocument();
  });

  it('displays area rules when available', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    expect(screen.getByText('Area Rules')).toBeInTheDocument();
    expect(screen.getByText('No food in pool area')).toBeInTheDocument();
    expect(screen.getByText('Children must be accompanied by an adult')).toBeInTheDocument();
    expect(screen.getByText('Maximum 2 hours continuous use')).toBeInTheDocument();
  });

  it('does not display area rules section when no rules exist', () => {
    const areaWithoutRules = { ...mockArea, rules: [] };
    render(
      <ReservationBookingForm 
        {...defaultProps} 
        selectedArea={areaWithoutRules} 
      />
    );
    
    expect(screen.queryByText('Area Rules')).not.toBeInTheDocument();
  });

  it('allows user to enter notes', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    const notesTextarea = screen.getByPlaceholderText('Add any special notes or comments for your reservation...');
    
    fireEvent.change(notesTextarea, { target: { value: 'Family gathering' } });
    
    expect(notesTextarea).toHaveValue('Family gathering');
  });

  it('shows character count for notes', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    const notesTextarea = screen.getByPlaceholderText('Add any special notes or comments for your reservation...');
    
    fireEvent.change(notesTextarea, { target: { value: 'Test note' } });
    
    expect(screen.getByText('9/500 characters')).toBeInTheDocument();
  });

  it('limits notes to 500 characters', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    const notesTextarea = screen.getByPlaceholderText('Add any special notes or comments for your reservation...');
    
    expect(notesTextarea).toHaveAttribute('maxLength', '500');
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<ReservationBookingForm {...defaultProps} onCancel={onCancel} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit with correct data when form is submitted', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ReservationBookingForm {...defaultProps} onSubmit={onSubmit} />);
    
    const notesTextarea = screen.getByPlaceholderText('Add any special notes or comments for your reservation...');
    fireEvent.change(notesTextarea, { target: { value: 'Family gathering' } });
    
    fireEvent.click(screen.getByText('Confirm Reservation'));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        areaId: '1',
        startTime: mockTimeSlot.start,
        endTime: mockTimeSlot.end,
        notes: 'Family gathering',
      });
    });
  });

  it('submits without notes when notes field is empty', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ReservationBookingForm {...defaultProps} onSubmit={onSubmit} />);
    
    fireEvent.click(screen.getByText('Confirm Reservation'));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        areaId: '1',
        startTime: mockTimeSlot.start,
        endTime: mockTimeSlot.end,
        notes: undefined,
      });
    });
  });

  it('shows loading state when submitting', async () => {
    const onSubmit = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<ReservationBookingForm {...defaultProps} onSubmit={onSubmit} />);
    
    fireEvent.click(screen.getByText('Confirm Reservation'));
    
    expect(screen.getByText('Booking...')).toBeInTheDocument();
    
    // Buttons should be disabled during loading
    expect(screen.getByText('Cancel')).toBeDisabled();
    
    await waitFor(() => {
      expect(screen.queryByText('Booking...')).not.toBeInTheDocument();
    });
  });

  it('disables buttons during submission', async () => {
    const onSubmit = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<ReservationBookingForm {...defaultProps} onSubmit={onSubmit} />);
    
    fireEvent.click(screen.getByText('Confirm Reservation'));
    
    expect(screen.getByText('Cancel')).toBeDisabled();
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).not.toBeDisabled();
    });
  });

  it('formats date correctly', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    // Should display formatted date (this will depend on locale)
    expect(screen.getByText(/domingo.*14.*enero.*2024/i)).toBeInTheDocument();
  });

  it('formats time slot correctly', () => {
    render(<ReservationBookingForm {...defaultProps} />);
    
    expect(screen.getByText('10:00 - 12:00')).toBeInTheDocument();
  });

  it('returns null when required props are missing', () => {
    const { container } = render(
      <ReservationBookingForm 
        {...defaultProps} 
        selectedArea={null} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('handles submission errors gracefully', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<ReservationBookingForm {...defaultProps} onSubmit={onSubmit} />);
    
    fireEvent.click(screen.getByText('Confirm Reservation'));
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error creating reservation:', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
  });

  it('trims whitespace from notes before submission', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ReservationBookingForm {...defaultProps} onSubmit={onSubmit} />);
    
    const notesTextarea = screen.getByPlaceholderText('Add any special notes or comments for your reservation...');
    fireEvent.change(notesTextarea, { target: { value: '  Family gathering  ' } });
    
    fireEvent.click(screen.getByText('Confirm Reservation'));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        areaId: '1',
        startTime: mockTimeSlot.start,
        endTime: mockTimeSlot.end,
        notes: 'Family gathering',
      });
    });
  });
});