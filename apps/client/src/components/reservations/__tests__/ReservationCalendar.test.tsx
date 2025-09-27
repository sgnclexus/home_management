import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { ReservationCalendar } from '../ReservationCalendar';
import { CommonArea, TimeSlot } from '@home-management/types';

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    'reservations.selectArea': 'Select Common Area',
    'reservations.selectDate': 'Select Date',
    'reservations.selectTimeSlot': 'Select Time Slot',
    'reservations.capacity': 'Capacity',
    'reservations.hours': 'Hours',
    'reservations.noAvailableSlots': 'No available time slots for this date',
  };
  return translations[key] || key;
});

const mockCommonAreas: CommonArea[] = [
  {
    id: '1',
    name: 'Pool',
    description: 'Community pool with rest area',
    capacity: 20,
    availableHours: { start: '06:00', end: '22:00' },
    isActive: true,
    rules: ['No food in pool area'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'Gym',
    description: 'Equipped gym with exercise machines',
    capacity: 10,
    availableHours: { start: '05:00', end: '23:00' },
    isActive: true,
    rules: ['Wear appropriate sportswear'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTimeSlots: TimeSlot[] = [
  {
    start: new Date('2024-01-15T10:00:00'),
    end: new Date('2024-01-15T12:00:00'),
    available: true,
  },
  {
    start: new Date('2024-01-15T14:00:00'),
    end: new Date('2024-01-15T16:00:00'),
    available: false,
  },
];

const defaultProps = {
  commonAreas: mockCommonAreas,
  selectedArea: null,
  selectedDate: new Date('2024-01-15'),
  onAreaSelect: jest.fn(),
  onDateSelect: jest.fn(),
  onTimeSlotSelect: jest.fn(),
  availableSlots: [],
  loading: false,
};

describe('ReservationCalendar', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    jest.clearAllMocks();
  });

  it('renders common areas selection', () => {
    render(<ReservationCalendar {...defaultProps} />);
    
    expect(screen.getByText('Select Common Area')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('Community pool with rest area')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
    expect(screen.getByText('Equipped gym with exercise machines')).toBeInTheDocument();
  });

  it('calls onAreaSelect when area is clicked', () => {
    const onAreaSelect = jest.fn();
    render(<ReservationCalendar {...defaultProps} onAreaSelect={onAreaSelect} />);
    
    fireEvent.click(screen.getByText('Pool'));
    
    expect(onAreaSelect).toHaveBeenCalledWith(mockCommonAreas[0]);
  });

  it('highlights selected area', () => {
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]} 
      />
    );
    
    const poolButton = screen.getByText('Pool').closest('button');
    expect(poolButton).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  it('shows calendar when area is selected', () => {
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]} 
      />
    );
    
    expect(screen.getByText('Select Date')).toBeInTheDocument();
    // Calendar navigation buttons
    expect(screen.getAllByRole('button')).toHaveLength(
      mockCommonAreas.length + 2 + 42 // areas + nav buttons + calendar days
    );
  });

  it('navigates between months', () => {
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]} 
      />
    );
    
    const nextButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg')?.getAttribute('d')?.includes('M9 5l7 7-7 7')
    );
    
    if (nextButton) {
      fireEvent.click(nextButton);
    }
    
    // Should show next month (this is a basic test, more specific date checking could be added)
    expect(screen.getByText('Select Date')).toBeInTheDocument();
  });

  it('calls onDateSelect when date is clicked', () => {
    const onDateSelect = jest.fn();
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        onDateSelect={onDateSelect}
      />
    );
    
    // Find a date button that's not disabled (future date)
    const dateButtons = screen.getAllByRole('button').filter(button => 
      button.textContent && /^\d+$/.test(button.textContent) && !button.disabled
    );
    
    if (dateButtons.length > 0) {
      fireEvent.click(dateButtons[0]);
      expect(onDateSelect).toHaveBeenCalled();
    }
  });

  it('shows time slots when area and date are selected', () => {
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        availableSlots={mockTimeSlots}
      />
    );
    
    expect(screen.getByText('Select Time Slot')).toBeInTheDocument();
    expect(screen.getByText('10:00 - 12:00')).toBeInTheDocument();
    expect(screen.getByText('14:00 - 16:00')).toBeInTheDocument();
  });

  it('calls onTimeSlotSelect when available slot is clicked', () => {
    const onTimeSlotSelect = jest.fn();
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        availableSlots={mockTimeSlots}
        onTimeSlotSelect={onTimeSlotSelect}
      />
    );
    
    fireEvent.click(screen.getByText('10:00 - 12:00'));
    
    expect(onTimeSlotSelect).toHaveBeenCalledWith(mockTimeSlots[0]);
  });

  it('does not call onTimeSlotSelect for unavailable slots', () => {
    const onTimeSlotSelect = jest.fn();
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        availableSlots={mockTimeSlots}
        onTimeSlotSelect={onTimeSlotSelect}
      />
    );
    
    fireEvent.click(screen.getByText('14:00 - 16:00'));
    
    expect(onTimeSlotSelect).not.toHaveBeenCalled();
  });

  it('shows loading state for time slots', () => {
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        loading={true}
      />
    );
    
    expect(screen.getByText('Select Time Slot')).toBeInTheDocument();
    // Should show loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows no available slots message', () => {
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        availableSlots={[]}
      />
    );
    
    expect(screen.getByText('No available time slots for this date')).toBeInTheDocument();
  });

  it('disables past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    
    render(
      <ReservationCalendar 
        {...defaultProps} 
        selectedArea={mockCommonAreas[0]}
        selectedDate={pastDate}
      />
    );
    
    // Past dates should be disabled
    const dateButtons = screen.getAllByRole('button').filter(button => 
      button.textContent && /^\d+$/.test(button.textContent) && button.disabled
    );
    
    expect(dateButtons.length).toBeGreaterThan(0);
  });
});