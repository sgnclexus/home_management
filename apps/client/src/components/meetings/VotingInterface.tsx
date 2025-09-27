import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { Vote, VoteStatus } from '@home-management/types';
import { useAuth } from '../../contexts/AuthContext';

interface VotingInterfaceProps {
  vote: Vote;
  onVoteSubmitted?: (vote: Vote) => void;
  className?: string;
}

export const VotingInterface: React.FC<VotingInterfaceProps> = ({
  vote,
  onVoteSubmitted,
  className = ''
}) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [userVoteStatus, setUserVoteStatus] = useState<{
    hasVoted: boolean;
    selectedOptions?: string[];
  }>({ hasVoted: false });
  const [voteResults, setVoteResults] = useState<{
    vote: Vote;
    totalVotes: number;
    participationRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchUserVoteStatus();
    if (vote.status === 'closed') {
      fetchVoteResults();
      setShowResults(true);
    }
  }, [vote.id]);

  const fetchUserVoteStatus = async () => {
    try {
      const response = await fetch(`/api/meetings/votes/${vote.id}/status`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (response.ok) {
        const status = await response.json();
        setUserVoteStatus(status);
        if (status.hasVoted && status.selectedOptions) {
          setSelectedOptions(status.selectedOptions);
        }
      }
    } catch (err) {
      console.error('Failed to fetch vote status:', err);
    }
  };

  const fetchVoteResults = async () => {
    try {
      const response = await fetch(`/api/meetings/votes/${vote.id}/results`, {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (response.ok) {
        const results = await response.json();
        setVoteResults(results);
      }
    } catch (err) {
      console.error('Failed to fetch vote results:', err);
    }
  };

  const handleOptionToggle = (option: string) => {
    if (vote.allowMultipleChoices) {
      setSelectedOptions(prev => 
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      );
    } else {
      setSelectedOptions([option]);
    }
  };

  const handleSubmitVote = async () => {
    if (selectedOptions.length === 0) {
      setError(t('meetings.votes.validation.selectOption'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/votes/${vote.id}/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          selectedOptions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('meetings.votes.error.submit'));
      }

      const updatedVote = await response.json();
      setUserVoteStatus({ hasVoted: true, selectedOptions });
      onVoteSubmitted?.(updatedVote);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('meetings.votes.error.submit'));
    } finally {
      setLoading(false);
    }
  };

  const getOptionPercentage = (option: string) => {
    if (!voteResults || voteResults.totalVotes === 0) return 0;
    const count = voteResults.vote.results[option] || 0;
    return Math.round((count / voteResults.totalVotes) * 100);
  };

  const getOptionCount = (option: string) => {
    return voteResults?.vote.results[option] || 0;
  };

  const canVote = vote.status === 'active' && !userVoteStatus.hasVoted;
  const canViewResults = vote.status === 'closed' || userVoteStatus.hasVoted;

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="p-6">
        {/* Vote Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {vote.question}
            </h3>
            {vote.description && (
              <p className="text-sm text-gray-600 mb-4">{vote.description}</p>
            )}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                vote.status === 'active' ? 'bg-green-100 text-green-800' :
                vote.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {t(`meetings.votes.status.${vote.status}`)}
              </span>
              {vote.isAnonymous && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {t('meetings.votes.anonymous')}
                </span>
              )}
              {vote.allowMultipleChoices && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {t('meetings.votes.multipleChoice')}
                </span>
              )}
            </div>
          </div>
          {canViewResults && (
            <button
              onClick={() => {
                setShowResults(!showResults);
                if (!showResults && !voteResults) {
                  fetchVoteResults();
                }
              }}
              className="ml-4 text-sm text-blue-600 hover:text-blue-800"
            >
              {showResults ? t('meetings.votes.hideResults') : t('meetings.votes.showResults')}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Vote Options */}
        <div className="space-y-3">
          {vote.options.map((option, index) => {
            const isSelected = selectedOptions.includes(option);
            const isUserChoice = userVoteStatus.selectedOptions?.includes(option);
            const percentage = showResults ? getOptionPercentage(option) : 0;
            const count = showResults ? getOptionCount(option) : 0;

            return (
              <div key={index} className="relative">
                {/* Progress bar background for results */}
                {showResults && (
                  <div className="absolute inset-0 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-blue-200 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}

                {/* Option content */}
                <div
                  className={`relative flex items-center p-4 rounded-md border-2 transition-colors ${
                    canVote
                      ? `cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`
                      : `${
                          isUserChoice
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`
                  }`}
                  onClick={canVote ? () => handleOptionToggle(option) : undefined}
                >
                  <div className="flex items-center flex-1">
                    {canVote && (
                      <input
                        type={vote.allowMultipleChoices ? 'checkbox' : 'radio'}
                        name={`vote-${vote.id}`}
                        checked={isSelected}
                        onChange={() => handleOptionToggle(option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                    )}
                    {!canVote && isUserChoice && (
                      <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span className={`ml-3 text-sm font-medium ${
                      isUserChoice ? 'text-green-900' : 'text-gray-900'
                    }`}>
                      {option}
                    </span>
                  </div>

                  {showResults && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span>{count} {t('meetings.votes.votes')}</span>
                      <span>({percentage}%)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vote Actions */}
        {canVote && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmitVote}
              disabled={loading || selectedOptions.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.submitting') : t('meetings.votes.submit')}
            </button>
          </div>
        )}

        {/* Vote Status */}
        {userVoteStatus.hasVoted && vote.status === 'active' && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  {t('meetings.votes.submitted')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {showResults && voteResults && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {voteResults.totalVotes}
                </p>
                <p className="text-sm text-gray-500">
                  {t('meetings.votes.totalVotes')}
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {Math.round(voteResults.participationRate)}%
                </p>
                <p className="text-sm text-gray-500">
                  {t('meetings.votes.participation')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vote Closed Message */}
        {vote.status === 'closed' && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-800">
                  {t('meetings.votes.closed')}
                  {vote.closedAt && (
                    <span className="ml-1">
                      {t('meetings.votes.closedAt', { 
                        date: new Date(vote.closedAt).toLocaleString() 
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};