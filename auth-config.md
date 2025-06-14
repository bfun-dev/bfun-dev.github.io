# Authentication Configuration for AWS Deployment

Since this application currently uses Replit Auth, you'll need to implement an alternative authentication system for AWS deployment.

## Recommended Authentication Options

### Option 1: AWS Cognito (Recommended)

AWS Cognito provides a complete authentication solution with OAuth support.

#### Setup Steps:

1. **Create User Pool**
```bash
aws cognito-idp create-user-pool \
  --pool-name bets-fun-users \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }'
```

2. **Create User Pool Client**
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <user-pool-id> \
  --client-name bets-fun-client \
  --generate-secret \
  --supported-identity-providers COGNITO \
  --callback-urls "https://yourdomain.com/api/callback" \
  --logout-urls "https://yourdomain.com/" \
  --allowed-o-auth-flows authorization_code \
  --allowed-o-auth-scopes openid email profile
```

3. **Code Changes Required**

Replace the current Replit Auth implementation in `server/replitAuth.ts`:

```typescript
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const payload = await verifier.verify(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
```

### Option 2: Auth0

Auth0 provides social login integration and enterprise features.

#### Setup Steps:

1. Create Auth0 account and application
2. Configure callback URLs
3. Install Auth0 SDK: `npm install auth0`

#### Code Implementation:

```typescript
import { auth } from 'express-openid-connect';

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL
};

app.use(auth(config));
```

### Option 3: Firebase Auth

Google's Firebase Authentication provides easy social login integration.

#### Setup Steps:

1. Create Firebase project
2. Enable Authentication methods
3. Install Firebase Admin SDK: `npm install firebase-admin`

#### Code Implementation:

```typescript
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!))
});

export const verifyFirebaseToken = async (idToken: string) => {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid Firebase token');
  }
};
```

## Required Environment Variables

Add these to your AWS deployment:

### For AWS Cognito:
```bash
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### For Auth0:
```bash
AUTH0_SECRET=your-auth0-secret
AUTH0_BASE_URL=https://yourdomain.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
```

### For Firebase:
```bash
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

## Frontend Changes Required

Update the authentication hook in `client/src/hooks/useAuth.ts`:

```typescript
// For Cognito
import { Auth } from 'aws-amplify';

// For Auth0
import { useAuth0 } from '@auth0/auth0-react';

// For Firebase
import { useAuthState } from 'react-firebase-hooks/auth';
```

## Migration Steps

1. Choose your authentication provider
2. Set up the provider account and configuration
3. Replace authentication code in server files
4. Update frontend authentication components
5. Test authentication flow thoroughly
6. Deploy with new environment variables

## Social Login Support

All three options support:
- Google OAuth
- GitHub OAuth
- Email/Password
- Custom OAuth providers

Configure these in your chosen provider's dashboard.