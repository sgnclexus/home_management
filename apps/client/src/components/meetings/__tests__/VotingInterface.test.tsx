import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { VotingInterface } from '../VotingInterface';
import { useAuth } from '../../../contexts/AuthContext';
import { Vote } from '@home-management/types';

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
    'meetings.votes.status.active': 'Active',
    'meetings.votes.status.closed': 'Closed',
    'meetings.votes.anonymous': 'Anonymous',
    'meetings.votes.multipleChoice': 'Multiple Choice',
    'meetings.votes.showResults': 'Show Results',
    'meetings.votes.hideResults': 'Hide Results',
    'meetings.votes.submit': 'Submit Vote',
    'meetings.votes.submitted': 'Vote submitted successfully',
    'meetings.votes.closed': 'This vote has been closed',
    'meetings.votes.votes': 'votes',
    'meetings.votes.totalVotes': 'Total Votes',
    'meetings.votes.participation': 'Participation',
    'meetings.votes.validation.selectOption': 'Please select an option',
    'common.submitting': 'Submitting...',
  };
  return translations[key] || key;
};

const mockUser = {
  uid: 'user-1',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockActiveVote: Vote = {
  id: 'vote-1',
  meetingId: 'meeting-1',
  question: 'Should we approve the budget?',
  description: 'Vote on the annual budget proposal',
  options: ['Yes', 'No', 'Abstain'],
  votes: {},
  results: { 'Yes': 0, 'No': 0, 'Abstain': 0 },
  status: 'active',
  createdBy: 'admin-1',
  isAnonymous: false,
  allowMultipleChoices: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockClosedVote: Vote = {
  ...mockActiveVote,
  status: 'closed',
  votes: { 'user-1': 'Yes', 'user-2': 'No' },
  results: { 'Yes': 1, 'No': 1, 'Abstain': 0 },
  closedAt: new Date(),
};

describe('VotingInterface', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
  });

  it('renders active vote correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hasVoted: false }),
    });

    render(<VotingInterface vote={mockActiveVote} />);

    expect(screen.getByText('Should we approve the budget?')).toBeInTheDocument();
    expect(screen.getByText('Vote on the annual budget proposal')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Abstain')).toBeInTheDocument();
  });

  it('allows user to select single option for single-choice vote', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hasVoted: false }),
    });

    render(<VotingInterface vote={mockActiveVote} />);

    await waitFor(() => {
      expect(screen.getByText('Should we approve the budget?')).toBeInTheDocument();
    });

    const yesOption = screen.getByLabelText('Yes');
    fireEvent.click(yesOption);

    expect(yesOption).toBeChecked();

    // Clicking another option should uncheck the first
    const noOption = screen.getByLabelText('No');
    fireEvent.click(noOption);

    expect(noOption).toBeChecked();
    expect(yesOption).not.toBeChecked();
  });

  it('allows user to select multiple options for multiple-choice vote', async () => {
    const multipleChoiceVote = {
      ...mockActiveVote,
      allowMultipleChoices: true,
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hasVoted: false }),
    });

    render(<VotingInterface vote={multipleChoiceVote} />);

    await waitFor(() => {
      expect(screen.getByText('Multiple Choice')).toBeInTheDocument();
    });

    const yesOption = screen.getByLabelText('Yes');
    const noOption = screen.getByLabelText('No');

    fireEvent.click(yesOption);
    fireEvent.click(noOption);

    expect(yesOption).toBeChecked();
    expect(noOption).toBeChecked();
  });

  it('submits vote successfully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasVoted: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockActiveVote),
      });

    const onVoteSubmitted = jest.fn();
    render(<VotingInterface vote={mockActiveVote} onVoteSubmitted={onVoteSubmitted} />);

    await waitFor(() => {
      expect(screen.getByText('Should we approve the budget?')).toBeInTheDocument();
    });

    // Select an option
    fireEvent.click(screen.getByLabelText('Yes'));

    // Submit vote
    fireEvent.click(screen.getByText('Submit Vote'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/meetings/votes/vote-1/cast',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            selectedOptions: ['Yes'],
          }),
        })
      );
    });

    expect(onVoteSubmitted).toHaveBeenCalledWith(mockActiveVote);
  });

  it('shows error when no option is selected', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hasVoted: false }),
    });

    render(<VotingInterface vote={mockActiveVote} />);

    await waitFor(() => {
      expect(screen.getByText('Should we approve the budget?')).toBeInTheDocument();
    });

    // Try to submit without selecting an option
    fireEvent.click(screen.getByText('Submit Vote'));

    await waitFor(() => {
      expect(screen.getByText('Please select an option')).toBeInTheDocument();
    });
  });

  it('displays user vote status when already voted', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        hasVoted: true,
        selectedOptions: ['Yes'],
      }),
    });

    render(<VotingInterface vote={mockActiveVote} />);

    await waitFor(() => {
      expect(screen.getByText('Vote submitted successfully')).toBeInTheDocument();
    });

    // Submit button should not be visible
    expect(screen.queryByText('Submit Vote')).not.toBeInTheDocument();
  });

  it('shows results for closed vote', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          hasVoted: true,
          selectedOptions: ['Yes'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          vote: mockClosedVote,
          totalVotes: 2,
          participationRate: 100,
        }),
      });

    render(<VotingInterface vote={mockClosedVote} />);

    await waitFor(() => {
      expect(screen.getByText('This vote has been closed')).toBeInTheDocument();
    });

    expect(screen.getByText('2')).toBeInTheDocument(); // Total votes
    expect(screen.getByText('100%')).toBeInTheDocument(); // Participation rate
  });

  it('toggles results visibility', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        hasVoted: true,
        selectedOptions: ['Yes'],
      }),
    });

    render(<VotingInterface vote={mockActiveVote} />);

    await waitFor(() => {
      expect(screen.getByText('Show Results')).toBeInTheDocument();
    });

    // Click to show results
    fireEvent.click(screen.getByText('Show Results'));

    // Mock the results fetch
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        vote: mockActiveVote,
        totalVotes: 0,
        participationRate: 0,
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Hide Results')).toBeInTheDocument();
    });
  });

  it('displays anonymous vote indicator', async () => {
    const anonymousVote = {
      ...mockActiveVote,
      isAnonymous: true,
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hasVoted: false }),
    });

    render(<VotingInterface vote={anonymousVote} />);

    await waitFor(() => {
      expect(screen.getByText('Anonymous')).toBeInTheDocument();
    });
  });

  it('handles vote submission error', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasVoted: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Vote submission failed' }),
      });

    render(<VotingInterface vote={mockActiveVote} />);

    await waitFor(() => {
      expect(screen.getByText('Should we approve the budget?')).toBeInTheDocument();
    });

    // Select an option and submit
    fireEvent.click(screen.getByLabelText('Yes'));
    fireEvent.click(screen.getByText('Submit Vote'));

    await waitFor(() => {
      expect(screen.getByText('Vote submission failed')).toBeInTheDocument();
    });
  });
});