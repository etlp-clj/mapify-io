import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { OIDC_CONFIG, OIDC_DEBUG, AUTH_DISABLED } from "@/config/constants";
import { useEffect } from "react";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Authentication provider component that wraps the OIDC provider
 * Provides authentication context to the entire application
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  if (AUTH_DISABLED) {
    return <>{children}</>;
  }

  // OIDC event handlers for debugging and error handling
  const onSigninCallback = () => {
    OIDC_DEBUG.log("Sign-in callback successful");
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const onSignoutCallback = () => {
    OIDC_DEBUG.log("Sign-out callback successful");
  };

  const onUserLoaded = (user: any) => {
    OIDC_DEBUG.log("User loaded", { userId: user?.profile?.sub, name: user?.profile?.name });
  };

  const onUserUnloaded = () => {
    OIDC_DEBUG.log("User unloaded");
  };

  const onAccessTokenExpiring = () => {
    OIDC_DEBUG.log("Access token expiring, attempting silent renewal");
  };

  const onAccessTokenExpired = () => {
    OIDC_DEBUG.error("Access token expired");
  };

  const onSilentRenewError = (error: Error) => {
    OIDC_DEBUG.error("Silent renew failed", error);
  };

  const onUserSignedOut = () => {
    OIDC_DEBUG.log("User signed out");
  };

  const enhancedConfig = {
    ...OIDC_CONFIG,
    onSigninCallback,
    onSignoutCallback,
    onUserLoaded,
    onUserUnloaded,
    onAccessTokenExpiring,
    onAccessTokenExpired,
    onSilentRenewError,
    onUserSignedOut,
  };

  useEffect(() => {
    OIDC_DEBUG.log("AuthProvider initialized", {
      authority: OIDC_CONFIG.authority,
      clientId: OIDC_CONFIG.client_id,
      redirectUri: OIDC_CONFIG.redirect_uri,
    });
  }, []);

  return (
    <OidcAuthProvider {...enhancedConfig}>
      {children}
    </OidcAuthProvider>
  );
};