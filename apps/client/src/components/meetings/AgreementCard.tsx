import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Agreement, AgreementComment, AgreementStatus } from '@home-management/types';
import { useAuth } from '../../contexts/AuthContext';

interface AgreementCardProps {
  agreement: Agreement;
  onAgreementUpdated?: (agreement: Agreement) => void;
  className?: string;
}

export const AgreementCard: React.FC<AgreementCardProps> = ({
  agreement,
  onAgreementUpdated,
  className = ''
}) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUserApproved = agreement.approvedBy.includes(user?.uid || '');
  const hasUserRejected = agreement.rejectedBy.includes(user?.uid || '');
  const canInteract = agreement.status === 'active';

  const handleApprove = async () => {
    if (!canInteract) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/agreements/${agreement.id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('meetings.agreements.error.approve'));
      }

      const updatedAgreement = await response.json();
      onAgreementUpdated?.(updatedAgreement);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('meetings.agreements.error.approve'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!canInteract) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/agreements/${agreement.id}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('meetings.agreements.error.reject'));
      }

      const updatedAgreement = await response.json();
      onAgreementUpdated?.(updatedAgreement);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('meetings.agreements.error.reject'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/agreements/${agreement.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('meetings.agreements.error.comment'));
      }

      setNewComment('');
      // Refresh agreement data to get updated comments
      // In a real app, you might want to optimistically update the UI
    } catch (err) {
      setError(err instanceof Error ? err.message : t('meetings.agreements.error.comment'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: AgreementStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return '-';
      }
      
      return dateObj.toLocaleDateString();
    } catch (error) {
      console.warn('Invalid date format:', date);
      return '-';
    }
  };

  const renderComment = (comment: AgreementComment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-8' : ''} border-l-2 border-gray-200 pl-4 py-2`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">
              {comment.userId.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-gray-900">{comment.userId}</p>
            <p className="text-xs text-gray-500">{formatDate(comment.createdAt)}</p>
          </div>
          <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map(reply => renderComment(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="p-6">
        {/* Agreement Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-medium text-gray-900">
                {agreement.title}
              </h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agreement.status)}`}>
                {t(`meetings.agreements.status.${agreement.status}`)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{agreement.description}</p>
            
            {/* Dates */}
            <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
              <span>{t('common.created')}: {formatDate(agreement.createdAt)}</span>
              {agreement.effectiveDate && (
                <span>{t('meetings.agreements.effectiveDate')}: {formatDate(agreement.effectiveDate)}</span>
              )}
              {agreement.expirationDate && (
                <span>{t('meetings.agreements.expirationDate')}: {formatDate(agreement.expirationDate)}</span>
              )}
            </div>
          </div>
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

        {/* Agreement Content */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            {t('meetings.agreements.content')}
          </h4>
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {agreement.content}
            </p>
          </div>
        </div>

        {/* Approval Status */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    {t('meetings.agreements.approved')}
                  </p>
                  <p className="text-lg font-semibold text-green-900">
                    {agreement.approvedBy.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    {t('meetings.agreements.rejected')}
                  </p>
                  <p className="text-lg font-semibold text-red-900">
                    {agreement.rejectedBy.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Actions */}
        {canInteract && (
          <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-md">
            <div className="flex items-center space-x-2">
              {hasUserApproved && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('meetings.agreements.youApproved')}
                </span>
              )}
              {hasUserRejected && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('meetings.agreements.youRejected')}
                </span>
              )}
              {!hasUserApproved && !hasUserRejected && (
                <span className="text-sm text-gray-600">
                  {t('meetings.agreements.pendingYourResponse')}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleApprove}
                disabled={loading || hasUserApproved}
                className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  hasUserApproved
                    ? 'bg-green-100 text-green-800 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {hasUserApproved ? t('meetings.agreements.approved') : t('meetings.agreements.approve')}
              </button>
              <button
                onClick={handleReject}
                disabled={loading || hasUserRejected}
                className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  hasUserRejected
                    ? 'bg-red-100 text-red-800 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {hasUserRejected ? t('meetings.agreements.rejected') : t('meetings.agreements.reject')}
              </button>
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">
              {t('meetings.agreements.comments')} ({agreement.comments.length})
            </h4>
            <button
              onClick={() => setShowComments(!showComments)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showComments ? t('common.hide') : t('common.show')}
            </button>
          </div>

          {showComments && (
            <div className="space-y-4">
              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="space-y-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('meetings.agreements.addComment')}
                  rows={3}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || !newComment.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? t('common.adding') : t('meetings.agreements.addComment')}
                  </button>
                </div>
              </form>

              {/* Comments List */}
              {agreement.comments.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    {t('meetings.agreements.noComments')}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('meetings.agreements.noCommentsDescription')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agreement.comments.map(comment => renderComment(comment))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};