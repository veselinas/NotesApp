# Notebook

A small, installable notes web app that stores everything as CSV files in your
own OneDrive. Works on your laptop and, added to the Home Screen, behaves like
an app on your iPhone.

It currently ships four note types — **Grocery list**, **To-Do**, **Wish
list/Shopping list**, and **Research** — and is built so new note types are a
matter of adding one file, not restructuring the app (see "Adding a new note
type" below).

## How it's built

Plain HTML/CSS/JS, no build step, no framework, no server of your own to run.
Everything happens in the browser:

- **Sign-in**: [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
  using the **redirect** flow only (no popups — this matters for iOS Safari,
  which blocks popups more aggressively than desktop browsers).
- **Storage**: Microsoft Graph (`https://graph.microsoft.com`) reads and
  writes CSV files directly in a `NotesApp` folder in the signed-in user's
  OneDrive root.
- **Data format**: every note type is one or more CSV files. See
  `js/store.js` and the individual files in `js/noteTypes/` for the exact
  columns each note type uses.

```
notesapp/
├── index.html            # app shell, loads MSAL + all scripts
├── manifest.json          # lets iOS/Android "Add to Home Screen"
├── css/styles.css
└── js/
    ├── config.js           # <-- put your Azure client ID here
    ├── auth.js             # MSAL redirect sign-in
    ├── graph.js             # OneDrive file read/write
    ├── csv.js               # CSV parse/stringify
    ├── store.js              # notes index + generic table storage
    ├── ui.js                  # modals, toast, note list rendering
    ├── app.js                  # wires it all together
    └── noteTypes/
        ├── registry.js          # <-- list of all note types
        ├── checklistShared.js    # shared checkbox-list widget
        ├── grocery.js
        ├── todo.js
        ├── wishlist.js
        └── research.js
```

## One-time setup

### 1. Register an app in Azure

1. Go to the [Azure Portal](https://portal.azure.com) → **App registrations**
   → **New registration**.
2. Name it anything (e.g. "Notebook").
3. **Supported account types**: choose "Accounts in any organizational
   directory and personal Microsoft accounts" if you want to sign in with a
   personal OneDrive account (most people will want this).
4. Leave Redirect URI blank for now — you'll add it in step 3.
5. After creation, copy the **Application (client) ID** from the Overview
   page.

### 2. Add the API permission

In your app registration → **API permissions** → **Add a permission** →
**Microsoft Graph** → **Delegated permissions** → add `Files.ReadWrite`
(and keep the default `User.Read`). Admin consent isn't required for these —
each user consents for themselves the first time they sign in.

### 3. Register your redirect URI

Wherever you end up hosting the app (see below), go to **Authentication** →
**Add a platform** → **Single-page application**, and add the exact URL the
app will be served from, e.g.:

```
https://yourname.github.io/notesapp/index.html
```

It must match exactly (protocol, host, path) — this is why `config.js`
builds the redirect URI from `window.location` rather than hardcoding it, so
it automatically matches wherever you deploy.

### 4. Set your client ID

Open `js/config.js` and replace:

```js
export const CLIENT_ID = "YOUR_CLIENT_ID_HERE";
```

with the Application (client) ID from step 1.

### 5. Host it somewhere with HTTPS

MSAL's redirect flow requires HTTPS (localhost is exempt, for local testing).
Any static host works — pick one:

- **GitHub Pages** — push this folder to a repo, enable Pages on it.
- **Azure Static Web Apps** — a natural fit since you're already in Azure.
- **Netlify / Vercel** — drag-and-drop deploy of this folder.

Once it's live, open it on your iPhone in Safari and use **Share → Add to
Home Screen** — `manifest.json` and the meta tags in `index.html` make it
open full-screen like a native app.

## Using it

- Tap **Sign in** (top right) — you'll be redirected to Microsoft's sign-in
  page and back.
- The **+** button (top centre) creates a new note. Right now only Grocery
  list can be created this way — To-Do, Wish List, and Research are single,
  standing notes that are created automatically the first time you sign in.
- Tap a note's name to open it; the header **✓** button saves it back to
  OneDrive. Nothing is written to OneDrive until you tap it (except a couple
  of explicitly-immediate actions noted below).
- The grocery list's shared item suggestions, and a research topic's
  category suggestions, are written to OneDrive immediately when you add a
  genuinely new one — everything else in that note still waits for the save
  button.
- The To-Do note's **good night** button (bottom, intentionally
  low-contrast) is also an immediate, explicit write: after you confirm, it
  copies any still-outstanding tasks from the day you're viewing onto the
  next day.

## Adding a new note type

1. Create `js/noteTypes/yourtype.js` exporting an object shaped like the
   existing ones:

   ```js
   export const yourType = {
     id: "yourtype",
     label: "Your Type",
     groupLabel: "Your type",     // section header on the main menu
     singleton: false,             // true = exactly one instance, auto-created
     showInCreateMenu: true,       // whether it appears under "+"

     // required if showInCreateMenu is true:
     async createInstance(store) { /* store.createNoteRecord(...) */ },

     // required if singleton is true:
     async ensure(store) { /* store.ensureSingletonNote(...) */ },

     subtitleFor(record) { return null; },

     // build the note's UI; return { save: async () => {...} }
     async mount({ subheader, body, footer, setTitle }, record, ctx) { ... },
   };
   ```

2. Add it to the `NOTE_TYPES` array in `js/noteTypes/registry.js`.

That's it — the main menu, the notes index, and the create-note flow all
read from the registry, so a new type doesn't require touching `app.js`.

`ctx` (passed into `mount`) gives you `ctx.confirm(title, msg)`,
`ctx.prompt({ title, fields })`, and `ctx.toast(message)` for the same
confirm/prompt/toast UI the built-in types use, and `store.readTable` /
`store.writeTable` (from `js/store.js`) for arbitrary CSV files.

## Known limitations

- **Concurrency**: if you edit the same note on two devices before saving,
  the last save wins — there's no merge logic. Given typical single-user use
  this is usually fine, but worth knowing.
- **No offline mode**: every read and write goes straight to Graph; there's
  no local cache beyond the current browser session.
- **Token refresh**: if a silent token refresh ever fails (e.g. after a long
  time away), the app redirects you through sign-in again automatically —
  you may occasionally see a brief redirect even though you never explicitly
  signed out.
