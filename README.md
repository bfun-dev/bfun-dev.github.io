# Bets.Fun - Web3 Prediction Market Platform

A cutting-edge Web3-powered prediction market platform that enables blockchain-based predictive challenges through an innovative multi-chain ecosystem.

## 🚀 Features

- **Multi-chain Support**: Ethereum and Solana wallet integration
- **Real-time Markets**: Dynamic odds with pool-based betting system
- **Blockchain Transfers**: Real USDT transfers for winnings claims
- **Portfolio Tracking**: Comprehensive bet history and performance analytics
- **Badge System**: Achievements and user engagement rewards
- **Admin Panel**: Complete platform management interface
- **Auto-conversion**: Automatic token conversion to USDT
- **Fee Structure**: 12% total platform fees with transparent pricing

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: Solana Web3.js + Ethereum ethers.js
- **UI**: Tailwind CSS + shadcn/ui components
- **Authentication**: OAuth/OpenID Connect support

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd bets-fun
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**
   - Create a PostgreSQL database
   - Update DATABASE_URL in .env file

5. **Run database migrations**
   ```bash
   npm run db:push
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Secret key for session encryption | Yes |
| `ADMIN_SOLANA_PRIVATE_KEY` | Admin wallet private key for payouts | Yes |
| `ISSUER_URL` | OAuth provider URL | For auth |
| `REPL_ID` | Application ID for OAuth | For auth |

### Database Setup

The application uses PostgreSQL with Drizzle ORM. Schema includes:

- **Users**: User accounts and wallet data
- **Markets**: Prediction market definitions
- **Bets**: User bet records with payout tracking
- **Categories**: Market categorization
- **Badges**: Achievement system
- **Sessions**: Authentication sessions

## 🏗 Project Structure

```
bets-fun/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and configurations
├── server/                 # Express backend
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   ├── db.ts              # Database connection
│   └── replitAuth.ts      # Authentication middleware
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── package.json           # Dependencies and scripts
├── drizzle.config.ts      # Database configuration
└── vite.config.ts         # Frontend build configuration
```

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Setup for Production

1. Set `NODE_ENV=production`
2. Configure secure session secrets
3. Set up SSL certificates
4. Configure database with connection pooling
5. Set up monitoring and logging

## 🔐 Security Features

- **Session Management**: Secure session handling with PostgreSQL storage
- **Private Key Security**: Encrypted storage of blockchain private keys
- **Input Validation**: Comprehensive request validation with Zod schemas
- **Rate Limiting**: API rate limiting for abuse prevention
- **CORS Protection**: Configured CORS policies

## 📊 API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `GET /api/login` - Initiate login
- `GET /api/logout` - User logout

### Markets
- `GET /api/markets` - List all markets
- `GET /api/markets/:id` - Get market details
- `POST /api/markets` - Create new market (admin)

### Betting
- `POST /api/bets` - Place a bet
- `GET /api/bets/user` - Get user's bets
- `POST /api/user/claim/:betId` - Claim winnings

### Portfolio
- `GET /api/user/stats` - User statistics
- `GET /api/user/winnings` - Unclaimed winnings
- `GET /api/user/badges` - User achievements

## 🎮 Usage Guide

### For Users
1. **Connect Wallet**: Use the authentication system to connect
2. **Browse Markets**: Explore available prediction markets
3. **Place Bets**: Choose YES or NO positions with custom amounts
4. **Track Portfolio**: Monitor your active and completed bets
5. **Claim Winnings**: Receive USDT transfers for successful predictions

### For Administrators
1. **Access Admin Panel**: Navigate to `/admin` (requires admin privileges)
2. **Create Markets**: Set up new prediction markets
3. **Manage Categories**: Organize markets by category
4. **Resolve Markets**: Determine outcomes and trigger payouts
5. **Monitor Platform**: View statistics and user activity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the deployment guide for hosting questions

## 🔗 Links

- [Solana Documentation](https://docs.solana.com/)
- [Ethereum Documentation](https://ethereum.org/developers/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)