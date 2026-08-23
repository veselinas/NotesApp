// =========================================================
// Global configuration
// =========================================================

// Replace with the Application (client) ID from your Azure AD
// app registration (Azure Portal -> App registrations -> your app
// -> Overview -> "Application (client) ID").
export const CLIENT_ID = "5ea7362c-541f-49b8-bc57-39c15eb171fa";

// "common" allows both personal Microsoft accounts and work/school
// accounts to sign in. Use your tenant ID instead if you want to
// restrict sign-in to a single organisation.
export const AUTHORITY = "https://login.microsoftonline.com/common";

// Must exactly match a "Single-page application" redirect URI
// registered on the Azure app (Authentication blade). Using
// location.origin + pathname means it works automatically whether
// you host at a domain root or in a sub-path, and whether you're
// testing on your laptop or on your phone.
export const REDIRECT_URI = "https://veselinas.github.io/NotesApp/";

// Delegated Microsoft Graph permissions the app requests.
export const GRAPH_SCOPES = ["Files.ReadWrite"];

// Folder created in the root of the signed-in user's OneDrive
// where every CSV file for this app is stored.
export const APP_FOLDER = "NotesApp";
