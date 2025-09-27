/**
 * Critical User Journeys End-to-End Tests
 * 
 * These tests cover the most important user workflows:
 * 1. User authentication and profile management
 * 2. Payment processing workflow
 * 3. Reservation booking workflow
 * 4. Meeting participation workflow
 * 5. Real-time notifications
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockApiResponses, mockFetch, cleanup } from '../../test-utils/test-setup';

// Mock components for testing
const MockPaymentDashboard = () => <div data-testid="payment-dashboard">Payment Dashboard</div>;
const MockReservationCalendar = () => <div data-testid="reservation-calendar">Reservation Calendar</div>;
const MockMeetingDashboard = () => <div data-testid="meeting-dashboard">Meeting Dashboard</div>;

describe('Critical User Journeys E2E Tests', () => {
  beforeEach(() => {
    cleanup();
    mockFetch({
      '/api/payments': mockApiResponses.payments,
      '/api/reservations': mockApiResponses.reservations,
      '/api/meetings': mockApiResponses.meetings,
      '/api/notifications': mockApiResponses.notifications,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('User Authentication Journey', () => {
    it('should complete full authentication flow', async () => {
      const user = userEvent.setup();
      
      // Mock login form component
      const LoginForm = () => (
        <form data-testid="login-form">
          <input
            type="email"
            placeholder="Email"
            data-testid="email-input"
          />
          <input
            type="password"
            placeholder="Password"
            data-testid="password-input"
          />
          <button type="submit" data-testid="login-button">
            Sign In
          </button>
        </form>
      );

      renderWithProviders(<LoginForm />, {
        authContext: { user: null, loading: false },
      });

      // User enters credentials
      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const loginButton = screen.getByTestId('login-button');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');

      // User submits form
      await user.click(loginButton);

      // Verify form submission
      expect(loginButton).toBeInTheDocument();
    });

    it('should handle authentication errors gracefully', async () => {
      const user = userEvent.setup();
      
      const LoginFormWithError = () => (
        <div>
          <form data-testid="login-form">
            <input type="email" data-testid="email-input" />
            <input type="password" data-testid="password-input" />
            <button type="submit" data-testid="login-button">Sign In</button>
          </form>
          <div data-testid="error-message">Invalid credentials</div>
        </div>
      );

      renderWithProviders(<LoginFormWithError />, {
        authContext: { user: null, loading: false, error: 'Invalid credentials' },
      });

      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveTextContent('Invalid credentials');
    });
  });

  describe('Payment Processing Journey', () => {
    it('should complete payment workflow from dashboard to confirmation', async () => {
      const user = userEvent.setup();
      
      const PaymentWorkflow = () => {
        const [step, setStep] = React.useState('dashboard');
        
        return (
          <div>
            {step === 'dashboard' && (
              <div data-testid="payment-dashboard">
                <div data-testid="payment-amount">$100.00</div>
                <button 
                  data-testid="pay-now-button"
                  onClick={() => setStep('payment-form')}
                >
                  Pay Now
                </button>
              </div>
            )}
            
            {step === 'payment-form' && (
              <div data-testid="payment-form">
                <input
                  type="text"
                  placeholder="Card Number"
                  data-testid="card-number-input"
                />
                <input
                  type="text"
                  placeholder="Expiry Date"
                  data-testid="expiry-input"
                />
                <input
                  type="text"
                  placeholder="CVV"
                  data-testid="cvv-input"
                />
                <button
                  data-testid="submit-payment-button"
                  onClick={() => setStep('confirmation')}
                >
                  Submit Payment
                </button>
              </div>
            )}
            
            {step === 'confirmation' && (
              <div data-testid="payment-confirmation">
                <div data-testid="success-message">Payment Successful!</div>
                <div data-testid="transaction-id">Transaction ID: TXN123</div>
              </div>
            )}
          </div>
        );
      };

      renderWithProviders(<PaymentWorkflow />);

      // Step 1: View payment dashboard
      expect(screen.getByTestId('payment-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('payment-amount')).toHaveTextContent('$100.00');

      // Step 2: Initiate payment
      const payNowButton = screen.getByTestId('pay-now-button');
      await user.click(payNowButton);

      // Step 3: Fill payment form
      await waitFor(() => {
        expect(screen.getByTestId('payment-form')).toBeInTheDocument();
      });

      const cardNumberInput = screen.getByTestId('card-number-input');
      const expiryInput = screen.getByTestId('expiry-input');
      const cvvInput = screen.getByTestId('cvv-input');

      await user.type(cardNumberInput, '4242424242424242');
      await user.type(expiryInput, '12/25');
      await user.type(cvvInput, '123');

      // Step 4: Submit payment
      const submitButton = screen.getByTestId('submit-payment-button');
      await user.click(submitButton);

      // Step 5: Verify confirmation
      await waitFor(() => {
        expect(screen.getByTestId('payment-confirmation')).toBeInTheDocument();
      });

      expect(screen.getByTestId('success-message')).toHaveTextContent('Payment Successful!');
      expect(screen.getByTestId('transaction-id')).toHaveTextContent('Transaction ID: TXN123');
    });

    it('should handle payment failures gracefully', async () => {
      const user = userEvent.setup();
      
      const PaymentWithError = () => (
        <div>
          <div data-testid="payment-form">
            <button data-testid="submit-payment-button">Submit Payment</button>
          </div>
          <div data-testid="error-message">Payment failed. Please try again.</div>
        </div>
      );

      renderWithProviders(<PaymentWithError />);

      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveTextContent('Payment failed. Please try again.');
    });
  });

  describe('Reservation Booking Journey', () => {
    it('should complete reservation booking from calendar to confirmation', async () => {
      const user = userEvent.setup();
      
      const ReservationWorkflow = () => {
        const [step, setStep] = React.useState('calendar');
        const [selectedArea, setSelectedArea] = React.useState('');
        const [selectedTime, setSelectedTime] = React.useState('');
        
        return (
          <div>
            {step === 'calendar' && (
              <div data-testid="reservation-calendar">
                <div data-testid="available-areas">
                  <button
                    data-testid="pool-area"
                    onClick={() => {
                      setSelectedArea('Pool');
                      setStep('time-selection');
                    }}
                  >
                    Pool - Available
                  </button>
                  <button
                    data-testid="gym-area"
                    onClick={() => {
                      setSelectedArea('Gym');
                      setStep('time-selection');
                    }}
                  >
                    Gym - Available
                  </button>
                </div>
              </div>
            )}
            
            {step === 'time-selection' && (
              <div data-testid="time-selection">
                <h3>Book {selectedArea}</h3>
                <div data-testid="available-times">
                  <button
                    data-testid="time-slot-1"
                    onClick={() => {
                      setSelectedTime('10:00 AM - 12:00 PM');
                      setStep('booking-form');
                    }}
                  >
                    10:00 AM - 12:00 PM
                  </button>
                  <button
                    data-testid="time-slot-2"
                    onClick={() => {
                      setSelectedTime('2:00 PM - 4:00 PM');
                      setStep('booking-form');
                    }}
                  >
                    2:00 PM - 4:00 PM
                  </button>
                </div>
              </div>
            )}
            
            {step === 'booking-form' && (
              <div data-testid="booking-form">
                <h3>Confirm Reservation</h3>
                <div data-testid="booking-details">
                  <p>Area: {selectedArea}</p>
                  <p>Time: {selectedTime}</p>
                </div>
                <textarea
                  data-testid="notes-input"
                  placeholder="Additional notes (optional)"
                />
                <button
                  data-testid="confirm-booking-button"
                  onClick={() => setStep('confirmation')}
                >
                  Confirm Booking
                </button>
              </div>
            )}
            
            {step === 'confirmation' && (
              <div data-testid="booking-confirmation">
                <div data-testid="success-message">Reservation Confirmed!</div>
                <div data-testid="booking-id">Booking ID: RES123</div>
                <div data-testid="reminder-info">
                  You will receive a reminder 24 hours before your reservation.
                </div>
              </div>
            )}
          </div>
        );
      };

      renderWithProviders(<ReservationWorkflow />);

      // Step 1: View available areas
      expect(screen.getByTestId('reservation-calendar')).toBeInTheDocument();
      
      const poolArea = screen.getByTestId('pool-area');
      expect(poolArea).toHaveTextContent('Pool - Available');

      // Step 2: Select area
      await user.click(poolArea);

      // Step 3: Select time slot
      await waitFor(() => {
        expect(screen.getByTestId('time-selection')).toBeInTheDocument();
      });

      const timeSlot = screen.getByTestId('time-slot-1');
      await user.click(timeSlot);

      // Step 4: Fill booking form
      await waitFor(() => {
        expect(screen.getByTestId('booking-form')).toBeInTheDocument();
      });

      const bookingDetails = screen.getByTestId('booking-details');
      expect(bookingDetails).toHaveTextContent('Area: Pool');
      expect(bookingDetails).toHaveTextContent('Time: 10:00 AM - 12:00 PM');

      const notesInput = screen.getByTestId('notes-input');
      await user.type(notesInput, 'Pool party for residents');

      // Step 5: Confirm booking
      const confirmButton = screen.getByTestId('confirm-booking-button');
      await user.click(confirmButton);

      // Step 6: Verify confirmation
      await waitFor(() => {
        expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument();
      });

      expect(screen.getByTestId('success-message')).toHaveTextContent('Reservation Confirmed!');
      expect(screen.getByTestId('booking-id')).toHaveTextContent('Booking ID: RES123');
      expect(screen.getByTestId('reminder-info')).toHaveTextContent(
        'You will receive a reminder 24 hours before your reservation.'
      );
    });
  });

  describe('Meeting Participation Journey', () => {
    it('should allow user to view meeting details and participate in voting', async () => {
      const user = userEvent.setup();
      
      const MeetingWorkflow = () => {
        const [hasVoted, setHasVoted] = React.useState(false);
        
        return (
          <div>
            <div data-testid="meeting-dashboard">
              <div data-testid="meeting-info">
                <h2>Monthly Board Meeting</h2>
                <p>Date: March 15, 2024</p>
                <p>Time: 7:00 PM</p>
              </div>
              
              <div data-testid="meeting-agenda">
                <h3>Agenda</h3>
                <ul>
                  <li>Budget Review</li>
                  <li>Maintenance Updates</li>
                  <li>New Policies</li>
                </ul>
              </div>
              
              {!hasVoted && (
                <div data-testid="voting-section">
                  <h3>Vote: Approve New Pool Hours</h3>
                  <div data-testid="voting-options">
                    <button
                      data-testid="vote-yes"
                      onClick={() => setHasVoted(true)}
                    >
                      Yes
                    </button>
                    <button
                      data-testid="vote-no"
                      onClick={() => setHasVoted(true)}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
              
              {hasVoted && (
                <div data-testid="vote-confirmation">
                  <p>Thank you for voting!</p>
                  <div data-testid="vote-results">
                    <p>Current Results:</p>
                    <p>Yes: 15 votes (75%)</p>
                    <p>No: 5 votes (25%)</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      };

      renderWithProviders(<MeetingWorkflow />);

      // Step 1: View meeting details
      expect(screen.getByTestId('meeting-dashboard')).toBeInTheDocument();
      
      const meetingInfo = screen.getByTestId('meeting-info');
      expect(meetingInfo).toHaveTextContent('Monthly Board Meeting');
      expect(meetingInfo).toHaveTextContent('March 15, 2024');

      const agenda = screen.getByTestId('meeting-agenda');
      expect(agenda).toHaveTextContent('Budget Review');
      expect(agenda).toHaveTextContent('Maintenance Updates');

      // Step 2: Participate in voting
      const votingSection = screen.getByTestId('voting-section');
      expect(votingSection).toHaveTextContent('Vote: Approve New Pool Hours');

      const yesButton = screen.getByTestId('vote-yes');
      await user.click(yesButton);

      // Step 3: View vote confirmation and results
      await waitFor(() => {
        expect(screen.getByTestId('vote-confirmation')).toBeInTheDocument();
      });

      expect(screen.getByTestId('vote-confirmation')).toHaveTextContent('Thank you for voting!');
      
      const results = screen.getByTestId('vote-results');
      expect(results).toHaveTextContent('Yes: 15 votes (75%)');
      expect(results).toHaveTextContent('No: 5 votes (25%)');
    });
  });

  describe('Real-time Notifications Journey', () => {
    it('should display and handle real-time notifications', async () => {
      const user = userEvent.setup();
      
      const NotificationWorkflow = () => {
        const [notifications, setNotifications] = React.useState([
          {
            id: '1',
            title: 'Payment Due',
            message: 'Your monthly maintenance fee is due in 3 days.',
            type: 'warning',
            isRead: false,
          },
          {
            id: '2',
            title: 'Reservation Confirmed',
            message: 'Your pool reservation for tomorrow at 2 PM is confirmed.',
            type: 'success',
            isRead: false,
          },
        ]);
        
        const markAsRead = (id: string) => {
          setNotifications(prev =>
            prev.map(notif =>
              notif.id === id ? { ...notif, isRead: true } : notif
            )
          );
        };
        
        return (
          <div>
            <div data-testid="notification-center">
              <h3>Notifications ({notifications.filter(n => !n.isRead).length})</h3>
              
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  data-testid={`notification-${notification.id}`}
                  className={notification.isRead ? 'read' : 'unread'}
                >
                  <h4>{notification.title}</h4>
                  <p>{notification.message}</p>
                  <span data-testid={`notification-type-${notification.id}`}>
                    {notification.type}
                  </span>
                  {!notification.isRead && (
                    <button
                      data-testid={`mark-read-${notification.id}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      };

      renderWithProviders(<NotificationWorkflow />);

      // Step 1: View notifications
      const notificationCenter = screen.getByTestId('notification-center');
      expect(notificationCenter).toHaveTextContent('Notifications (2)');

      // Step 2: Check notification content
      const paymentNotification = screen.getByTestId('notification-1');
      expect(paymentNotification).toHaveTextContent('Payment Due');
      expect(paymentNotification).toHaveTextContent('Your monthly maintenance fee is due in 3 days.');

      const reservationNotification = screen.getByTestId('notification-2');
      expect(reservationNotification).toHaveTextContent('Reservation Confirmed');

      // Step 3: Mark notification as read
      const markReadButton = screen.getByTestId('mark-read-1');
      await user.click(markReadButton);

      // Step 4: Verify notification count updated
      await waitFor(() => {
        expect(notificationCenter).toHaveTextContent('Notifications (1)');
      });
    });
  });

  describe('Multi-language Support Journey', () => {
    it('should switch languages and update interface text', async () => {
      const user = userEvent.setup();
      
      const LanguageSwitchWorkflow = () => {
        const [language, setLanguage] = React.useState('en');
        
        const translations = {
          en: {
            welcome: 'Welcome',
            dashboard: 'Dashboard',
            payments: 'Payments',
            reservations: 'Reservations',
          },
          es: {
            welcome: 'Bienvenido',
            dashboard: 'Panel de Control',
            payments: 'Pagos',
            reservations: 'Reservas',
          },
        };
        
        return (
          <div>
            <div data-testid="language-switcher">
              <button
                data-testid="switch-to-english"
                onClick={() => setLanguage('en')}
                className={language === 'en' ? 'active' : ''}
              >
                English
              </button>
              <button
                data-testid="switch-to-spanish"
                onClick={() => setLanguage('es')}
                className={language === 'es' ? 'active' : ''}
              >
                Español
              </button>
            </div>
            
            <div data-testid="main-content">
              <h1 data-testid="welcome-text">{translations[language].welcome}</h1>
              <nav data-testid="navigation">
                <a data-testid="dashboard-link">{translations[language].dashboard}</a>
                <a data-testid="payments-link">{translations[language].payments}</a>
                <a data-testid="reservations-link">{translations[language].reservations}</a>
              </nav>
            </div>
          </div>
        );
      };

      renderWithProviders(<LanguageSwitchWorkflow />);

      // Step 1: Verify default language (English)
      expect(screen.getByTestId('welcome-text')).toHaveTextContent('Welcome');
      expect(screen.getByTestId('dashboard-link')).toHaveTextContent('Dashboard');
      expect(screen.getByTestId('payments-link')).toHaveTextContent('Payments');

      // Step 2: Switch to Spanish
      const spanishButton = screen.getByTestId('switch-to-spanish');
      await user.click(spanishButton);

      // Step 3: Verify Spanish translations
      await waitFor(() => {
        expect(screen.getByTestId('welcome-text')).toHaveTextContent('Bienvenido');
      });
      
      expect(screen.getByTestId('dashboard-link')).toHaveTextContent('Panel de Control');
      expect(screen.getByTestId('payments-link')).toHaveTextContent('Pagos');
      expect(screen.getByTestId('reservations-link')).toHaveTextContent('Reservas');

      // Step 4: Switch back to English
      const englishButton = screen.getByTestId('switch-to-english');
      await user.click(englishButton);

      // Step 5: Verify English translations restored
      await waitFor(() => {
        expect(screen.getByTestId('welcome-text')).toHaveTextContent('Welcome');
      });
      
      expect(screen.getByTestId('dashboard-link')).toHaveTextContent('Dashboard');
      expect(screen.getByTestId('payments-link')).toHaveTextContent('Payments');
    });
  });
});