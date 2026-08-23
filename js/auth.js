// =========================================================
// Authentication (MSAL, redirect flow only - no popups)
// =========================================================
import { CLIENT_ID, AUTHORITY, REDIRECT_URI, GRAPH_SCOPES } from "./config.js";

let msalInstance = null;
let activeAccount = null;

function getMsal() {
  if (!msalInstance) {
    msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: AUTHORITY,
        redirectUri: REDIRECT_URI,
      },
      cache: {
        // localStorage (not sessionStorage) so sign-in survives the
        // full-page redirect round trip and works the same on iOS
        // Safari and on desktop browsers.
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
      },
    });
  }
  return msalInstance;
}

/**
 * Call once on app start. Completes a pending redirect (if the user
 * was just sent back from login.microsoftonline.com) and restores
 * any previously signed-in account from cache.
 * Returns the active account, or null if signed out.
 */
export async function initAuth() {
  const client = getMsal();
  const result = await client.handleRedirectPromise();
  if (result && result.account) {
    activeAccount = result.account;
  } else {
    const accounts = client.getAllAccounts();
    if (accounts.length > 0) activeAccount = accounts[0];
  }
  if (activeAccount) client.setActiveAccount(activeAccount);
  return activeAccount;
}

export function getActiveAccount() {
  return activeAccount;
}

/** Kick off sign-in. This navigates away from the page (redirect flow). */
export function signIn() {
  const client = getMsal();
  return client.loginRedirect({ scopes: GRAPH_SCOPES });
}

export function signOut() {
  const client = getMsal();
  return client.logoutRedirect();
}

/**
 * Get a Graph access token, refreshing silently when possible.
 * Falls back to a redirect (not a popup) if silent refresh fails,
 * e.g. because the refresh token expired.
 */
export async function getAccessToken() {
  const client = getMsal();
  if (!activeAccount) throw new Error("Not signed in");
  const request = { scopes: GRAPH_SCOPES, account: activeAccount };
  try {
    const result = await client.acquireTokenSilent(request);
    return result.accessToken;
  } catch (err) {
    // Silent refresh failed (e.g. interaction required) - redirect
    // to sign in again rather than showing a popup.
    await client.acquireTokenRedirect(request);
    // acquireTokenRedirect navigates away; nothing returns here.
    return null;
  }
}
