import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import type { UserRole } from '../types';

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_NPYiBsfST';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '2jdbhaq7do5j6soq8hod741bk5';

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

export interface AuthUser {
  userId: string;
  phoneNumber: string;
  name: string;
  role: UserRole;
  ownerId: string | null;
}

export interface AuthResult {
  user: AuthUser;
  session: CognitoUserSession;
}

function extractUserFromSession(session: CognitoUserSession): AuthUser {
  const payload = session.getIdToken().decodePayload();
  return {
    userId: payload.sub,
    phoneNumber: payload.phone_number || '',
    name: payload.name || '',
    role: (payload['custom:role'] || 'farmer') as UserRole,
    ownerId: payload['custom:owner_id'] || null,
  };
}

/**
 * Sign in with phone number and password.
 */
export function signIn(
  phoneNumber: string,
  password: string
): Promise<AuthResult | { challenge: 'NEW_PASSWORD_REQUIRED'; cognitoUser: CognitoUser }> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: phoneNumber,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: phoneNumber,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve({ user: extractUserFromSession(session), session });
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: () => {
        resolve({ challenge: 'NEW_PASSWORD_REQUIRED', cognitoUser });
      },
    });
  });
}

/**
 * Complete new password challenge.
 */
export function completeNewPassword(
  cognitoUser: CognitoUser,
  newPassword: string
): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => {
        resolve({ user: extractUserFromSession(session), session });
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * Get the current authenticated session (auto-refreshes tokens).
 */
export function getCurrentSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session);
    });
  });
}

/**
 * Get the current user from stored session.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return extractUserFromSession(session);
}

/**
 * Get the JWT ID token for API calls.
 */
export async function getIdToken(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return session.getIdToken().getJwtToken();
}

/**
 * Sign out the current user.
 */
export function signOut(): void {
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
}

/**
 * Sign up a new user with role selection.
 */
export function signUp(
  phoneNumber: string,
  password: string,
  name: string,
  role: UserRole = 'farmer',
  aadhaarLast4?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'phone_number', Value: phoneNumber }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
      new CognitoUserAttribute({ Name: 'custom:role', Value: role }),
    ];

    if (aadhaarLast4) {
      attributes.push(
        new CognitoUserAttribute({ Name: 'custom:aadhaar_last4', Value: aadhaarLast4 })
      );
    }

    userPool.signUp(phoneNumber, password, attributes, [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Confirm signup with OTP/verification code.
 */
export function confirmSignUp(phoneNumber: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: phoneNumber,
      Pool: userPool,
    });

    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Resend confirmation code.
 */
export function resendConfirmationCode(phoneNumber: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: phoneNumber,
      Pool: userPool,
    });

    cognitoUser.resendConfirmationCode((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
