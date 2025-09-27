import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { MeetingDashboard } from '../MeetingDashboard';
import { useAuth } from '../../../contexts/AuthContext';
import { UserRole } from '@home-management/types';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockT = (key: string, options?: any) => {
  const translations: Record<string, string> = {
    'meetings.dashboard.title': 'Meeting Dashboard',
    'meetings.create.button': 'Create Meeting',
    'meetings.stats.upcoming': 'Upcoming',
    'meetings.stats.activeVotes': 'Active Votes',
    'meetings.stats.activeAgreements': 'Active Agreements',
    'meetings.stats.totalMeetings': 'Total Meetings',
    'meetings.tabs.meetings': 'Meetings',
    'meetings.tabs.votes': 'Votes',
    'meetings.tabs.agreements': 'Agreements',
    'meetings.upcoming.title': 'Upcoming Meetings',
    'meetings.empty.title': 'No upcoming meetings',
    'meetings.empty.description': 'There are no meetings scheduled.',
    'meetings.error': 'Error loading meetings',
    'common.retry': 'Retry',
    'common.view': 'View',
  };
  return translations[key] || key;
};

const mockUser = {
  uid: 'user-1',
  role: UserRole.ADMIN,
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockMeetings = [
  {
    id: 'meeting-1',
    title: 'Monthly Board Meeting',
    description: 'Regular monthly meeting',
    scheduledDate: new Date('2024-03-15T10:00:00Z'),
    status: 'scheduled',
    attendees: ['user-1', 'user-2'],
    createdBy: 'admin-1',
    location: 'Community Center',
  },
];

const mockVotes = [
  {
    id: 'vote-1',
    meetingId: 'meeting-1',
    question: 'Should we approve the budget?',
    options: ['Yes', 'No'],
    status: 'active',
    isAnonymous: false,
    allowMultipleChoices: false,
  },
];

const mockAgreements = [
  {
    id: 'agreement-1',
    title: 'Pool Rules',
    description: 'Updated pool usage rules',
    status: 'active',
    approvedBy: ['user-1'],
    rejectedBy: [],
  },
];

describe('MeetingDashboard', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
  });

  it('renders dashboard with loading state initially', () => {
    render(<MeetingDashboard />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders dashboard with data after loading', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMeetings),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMeetings),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgreements),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVotes),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('1')).toBeInTheDocument(); // Upcoming meetings count
    expect(screen.getByText('Monthly Board Meeting')).toBeInTheDocument();
  });

  it('shows create meeting button for admin users', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Create Meeting')).toBeInTheDocument();
    });
  });

  it('does not show create meeting button for regular users', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockUser, role: UserRole.RESIDENT },
    });

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Dashboard')).toBeInTheDocument();
    });

    expect(screen.queryByText('Create Meeting')).not.toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Meeting Dashboard')).toBeInTheDocument();
    });

    // Click on votes tab
    fireEvent.click(screen.getByText('Votes'));
    expect(screen.getByText('Votes')).toHaveClass('text-blue-600');

    // Click on agreements tab
    fireEvent.click(screen.getByText('Agreements'));
    expect(screen.getByText('Agreements')).toHaveClass('text-blue-600');
  });

  it('displays error message when fetch fails', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error loading meetings')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retries loading data when retry button is clicked', async () => {
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error loading meetings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Meeting Dashboard')).toBeInTheDocument();
    });
  });

  it('displays empty state when no meetings are available', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No upcoming meetings')).toBeInTheDocument();
    });

    expect(screen.getByText('There are no meetings scheduled.')).toBeInTheDocument();
  });

  it('shows vote badge when there are active votes', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMeetings),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVotes),
      });

    render(<MeetingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Vote badge
    });
  });
});