import { useAuth as useOidcAuth } from "react-oidc-context";
import { AUTH_DISABLED } from "@/config/constants";

/**
 * Dev auth hook - returns mock authenticated state without Keycloak
 */
const useDevAuth = () => ({
  isAuthenticated: true,
  isLoading: false,
  hasError: false,
  error: null as Error | null,
  user: null,
  signIn: () => {},
  signOut: () => {},
  getAccessToken: () => undefined as string | undefined,
});

/**
 * OIDC auth hook - wraps react-oidc-context for Keycloak authentication
 */
const useOidcAuthWrapper = () => {
  const auth = useOidcAuth();

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    hasError: !!auth.error,
    error: auth.error,
    user: auth.user,
    signIn: () => auth.signinRedirect(),
    signOut: () => auth.signoutRedirect(),
    getAccessToken: () => auth.user?.access_token,
  };
};

/**
 * Auth hook - uses dev bypass when VITE_AUTH_DISABLED=true, otherwise Keycloak OIDC
 */
export const useAuth = AUTH_DISABLED ? useDevAuth : useOidcAuthWrapper;