# Home Management System

A comprehensive condominium administration system built with Next.js and NestJS.

## Features

- **User Management**: Role-based access control for administrators, vigilance committee, residents, and security
- **Payment Management**: Online payment processing with Stripe and PayPal integration
- **Common Area Reservations**: Interactive booking system for shared facilities
- **Meeting Management**: Schedule meetings, share notes, and conduct voting
- **Multi-language Support**: Spanish and English localization
- **Real-time Synchronization**: Live updates across all user sessions
- **Progressive Web App**: Mobile-optimized with offline capabilities

## Tech Stack

### Frontend
- **Next.js 13**: React framework with server-side rendering
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React Query**: Data fetching and caching
- **React Hook Form**: Form management
- **next-i18next**: Internationalization

### Backend
- **NestJS**: Node.js framework with TypeScript
- **Firebase Admin**: Authentication and Firestore database
- **Stripe & PayPal**: Payment processing
- **Class Validator**: Input validation
- **Passport JWT**: Authentication middleware

### Shared Libraries
- **@home-management/types**: Shared TypeScript interfaces
- **@home-management/utils**: Common utilities and constants

## Project Structure

```
home-management-app/
├── apps/
│   ├── client/          # Next.js frontend application
│   └── server/          # NestJS backend application
├── libs/
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Shared utilities
└── firebase/            # Firebase configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Firebase project with Firestore and Authentication enabled
- Stripe account for payment processing

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd home-management-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
cp apps/client/.env.local.example apps/client/.env.local
cp apps/server/.env.example apps/server/.env
```

4. Configure your environment variables with your Firebase, Stripe, and other service credentials.

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

Or start them individually:
```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

### Building

Build all applications:
```bash
npm run build
```

### Testing

Run tests for all applications:
```bash
npm run test
```

### Linting and Formatting

```bash
# Lint all code
npm run lint

# Format all code
npm run format

# Check formatting
npm run format:check
```

## Environment Variables

### Required Variables

- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL`: Firebase service account email
- `FIREBASE_PRIVATE_KEY`: Firebase service account private key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `JWT_SECRET`: Secret for JWT token signing

See `.env.example` for a complete list of environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## License

This project is licensed under the MIT License.