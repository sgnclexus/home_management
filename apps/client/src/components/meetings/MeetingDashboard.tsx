import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { 
  Meeting, 
  Vote, 
  Agreement, 
  MeetingStatus, 
  UserRole 
} from '@home-management/types';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { DataLoadingState, RealtimeStatusBadge, OptimisticUpdateIndicator } from '../realtime/LoadingStates';

interface MeetingDashboardProps {
  className?: string;
}

export const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ className = '' }) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { meetings: realtimeMeetings, updateMeeting, refreshData } = useRealtime();
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [activeVotes, setActiveVotes] = useState<Vote[]>([]);
  const [activeAgreements, setActiveAgreements] = useState<Agreement[]>([]);
  const [activeTab, setActiveTab] = useState<'meetings' | 'votes' | 'agreements'>('meetings');

  // Process real-time meetings data
  useEffect(() => {
    if (realtimeMeetings.data.length > 0) {
      const now = new Date();
      const upcoming = realtimeMeetings.data.filter(meeting => 
        new Date(meeting.scheduledDate) > now && meeting.status === 'scheduled'
      );
      setUpcomingMeetings(upcoming);

      // Mock active votes and agreements - in real app, these would come from separate real-time hooks
      // For now, we'll simulate some data based on meetings
      const mockVotes: Vote[] = upcoming.slice(0, 2).map((meeting, index) => ({
        id: `vote-${meeting.id}-${index}`,
        meetingId: meeting.id,
        question: `Vote for ${meeting.title} agenda item ${index + 1}`,
        description: `Please vote on the proposed changes discussed in ${meeting.title}`,
        options: ['Approve', 'Reject', 'Abstain'],
        votes: {},
        results: {},
        status: 'active' as const,
        createdBy: meeting.createdBy,
        isAnonymous: false,
        allowMultipleChoices: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const mockAgreements: Agreement[] = upcoming.slice(0, 1).map((meeting, index) => ({
        id: `agreement-${meeting.id}-${index}`,
        title: `Agreement from ${meeting.title}`,
        description: `Community agreement resulting from ${meeting.title}`,
        content: `This agreement was reached during the meeting: ${meeting.title}`,
        status: 'active' as const,
        meetingId: meeting.id,
        approvedBy: [],
        rejectedBy: [],
        comments: [],
        createdBy: meeting.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      setActiveVotes(mockVotes);
      setActiveAgreements(mockAgreements);
    }
  }, [realtimeMeetings.data]);

  const getStatusColor = (status: MeetingStatus) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageMeetings = user?.role === UserRole.ADMIN || user?.role === UserRole.VIGILANCE;

  return (
    <DataLoadingState
      loading={realtimeMeetings.loading}
      error={realtimeMeetings.error}
      retryAction={refreshData}
    >
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('meetings.dashboard.title')}
            </h1>
            <RealtimeStatusBadge lastUpdated={realtimeMeetings.lastUpdated} className="mt-1" />
          </div>
          {canManageMeetings && (
            <button
              onClick={() => {/* Navigate to create meeting */}}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('meetings.create.button')}
            </button>
          )}
        </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('meetings.stats.upcoming')}</p>
              <p className="text-2xl font-semibold text-gray-900">{upcomingMeetings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('meetings.stats.activeVotes')}</p>
              <p className="text-2xl font-semibold text-gray-900">{activeVotes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('meetings.stats.activeAgreements')}</p>
              <p className="text-2xl font-semibold text-gray-900">{activeAgreements.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('meetings.stats.totalMeetings')}</p>
              <p className="text-2xl font-semibold text-gray-900">{realtimeMeetings.data.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('meetings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'meetings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('meetings.tabs.meetings')}
          </button>
          <button
            onClick={() => setActiveTab('votes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'votes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('meetings.tabs.votes')} {activeVotes.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {activeVotes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('agreements')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'agreements'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('meetings.tabs.agreements')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">
              {t('meetings.upcoming.title')}
            </h2>
            {upcomingMeetings.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {t('meetings.empty.title')}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t('meetings.empty.description')}
                </p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {upcomingMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <div className="px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900">{meeting.title}</p>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
                                {t(`meetings.status.${meeting.status}`)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{meeting.description}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(meeting.scheduledDate).toLocaleString()}
                              {meeting.location && ` • ${meeting.location}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {/* Navigate to meeting details */}}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            {t('common.view')}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'votes' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">
              {t('meetings.votes.active')}
            </h2>
            {activeVotes.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {t('meetings.votes.empty.title')}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t('meetings.votes.empty.description')}
                </p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {activeVotes.map((vote) => (
                    <li key={vote.id}>
                      <div className="px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{vote.question}</p>
                            {vote.description && (
                              <p className="text-sm text-gray-500 mt-1">{vote.description}</p>
                            )}
                            <div className="mt-2 flex items-center text-xs text-gray-400">
                              <span>{vote.options.length} {t('meetings.votes.options')}</span>
                              {vote.isAnonymous && (
                                <span className="ml-2 bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                  {t('meetings.votes.anonymous')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {/* Navigate to vote */}}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              {t('meetings.votes.vote')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'agreements' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">
              {t('meetings.agreements.active')}
            </h2>
            {activeAgreements.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {t('meetings.agreements.empty.title')}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t('meetings.agreements.empty.description')}
                </p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {activeAgreements.map((agreement) => (
                    <li key={agreement.id}>
                      <div className="px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{agreement.title}</p>
                            <p className="text-sm text-gray-500 mt-1">{agreement.description}</p>
                            <div className="mt-2 flex items-center text-xs text-gray-400">
                              <span>{agreement.approvedBy.length} {t('meetings.agreements.approved')}</span>
                              <span className="ml-2">{agreement.rejectedBy.length} {t('meetings.agreements.rejected')}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {/* Navigate to agreement */}}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              {t('common.view')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </DataLoadingState>
  );
};