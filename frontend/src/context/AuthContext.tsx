import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CognitoUser } from 'amazon-cognito-identity-js';
import type { UserRole } from '../types';
import {
  AuthUser,
  signIn as cognitoSignIn,
  completeNewPassword as cognitoCompleteNewPassword,
  getCurrentUser,
  signOut as cognitoSignOut,
  getIdToken,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
} from '../services/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  idToken: string | null;
  pendingCognitoUser: CognitoUser | null;
  needsNewPassword: boolean;
  login: (phoneNumber: string, password: string) => Promise<void>;
  signup: (phoneNumber: string, password: string, name: string, role: UserRole, aadhaarLast4?: string) => Promise<void>;
  confirmSignUp: (phoneNumber: string, code: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [pendingCognitoUser, setPendingCognitoUser] = useState<CognitoUser | null>(null);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const existingUser = await getCurrentUser();
        if (existingUser) {
          setUser(existingUser);
          const token = await getIdToken();
          setIdToken(token);
        }
      } catch {
        // No stored session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const result = await cognitoSignIn(phoneNumber, password);

    if ('challenge' in result && result.challenge === 'NEW_PASSWORD_REQUIRED') {
      setPendingCognitoUser(result.cognitoUser);
      setNeedsNewPassword(true);
      return;
    }

    if ('user' in result) {
      setUser(result.user);
      setIdToken(result.session.getIdToken().getJwtToken());
      setNeedsNewPassword(false);
      setPendingCognitoUser(null);
    }
  }, []);

  const signup = useCallback(async (phoneNumber: string, password: string, name: string, role: UserRole, aadhaarLast4?: string) => {
    await cognitoSignUp(phoneNumber, password, name, role, aadhaarLast4);
  }, []);

  const confirmSignUp = useCallback(async (phoneNumber: string, code: string) => {
    await cognitoConfirmSignUp(phoneNumber, code);
  }, []);

  const completeNewPassword = useCallback(async (newPassword: string) => {
    if (!pendingCognitoUser) throw new Error('No pending user');
    const result = await cognitoCompleteNewPassword(pendingCognitoUser, newPassword);
    setUser(result.user);
    setIdToken(result.session.getIdToken().getJwtToken());
    setNeedsNewPassword(false);
    setPendingCognitoUser(null);
  }, [pendingCognitoUser]);

  const logout = useCallback(() => {
    cognitoSignOut();
    setUser(null);
    setIdToken(null);
    setPendingCognitoUser(null);
    setNeedsNewPassword(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        idToken,
        pendingCognitoUser,
        needsNewPassword,
        login,
        signup,
        confirmSignUp,
        completeNewPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
