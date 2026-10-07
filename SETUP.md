# Goal Setting to the Now — Server: setup

A multi-user server for the Goal Setting app (*The ONE Thing* method). One PC
runs the server; everyone else just opens a web address. Each person signs up
for an account and gets their own private goals — nobody can see anyone
else's, administrators included.

**No installation beyond Node.js. Zero npm packages.** The server uses only
what ships with Node (its web server, SQLite database, and crypto).

## Install (the PC that hosts the server)

1. Install **Node.js 24 (LTS)** from <https://nodejs.org> — accept the defaults.
2. Copy this whole folder anywhere on that PC (keep the files together).
3. Double-click **`START SERVER.cmd`**. Leave the window open.
4. On that same PC, open <http://localhost:8484> in a browser and
   **create the first account — it automatically becomes the administrator.**
   Do this before telling anyone else the address.

## Let other people use it

- Others on the same network open: `http://<host-pc-name>:8484`
  (find the PC name with `hostname` in a command prompt).
- The first time, Windows must allow the port through its firewall. An
  **administrator** command prompt on the host PC:

  ```
  netsh advfirewall firewall add rule name="Goal Setting Server" dir=in action=allow protocol=TCP localport=8484
  ```

- Each person creates their own account on the sign-in page. By default
  sign-up is **open** to anyone who can reach the address. To require the
  administrator to approve each new account instead, create a `config.json`
  next to `server.mjs`:

  ```json
  { "openSignup": false }
  ```

  and restart the server. Pending accounts are approved on the **Users** page
  (button in the app header, administrators only).

## Where the data lives, and backups

- The live database is `%USERPROFILE%\GoalSettingData\goals.db` on the host
  PC — deliberately **not** inside OneDrive/Dropbox, because a sync client
  can lock or copy a live database mid-write and corrupt it.
- The server writes a **dated snapshot copy once per day** to two places:
  `%USERPROFILE%\GoalSettingData\backups\` and this folder's `Backups\`
  (safe to sync — snapshots are plain copies).
- To restore: stop the server, copy a snapshot over `goals.db`, start again.
- Individual users can also Export/Import their own goals as JSON from
  inside the app at any time.

## Run it automatically at sign-in (optional)

Task Scheduler → Create Task:
- Trigger: *At log on*.
- Action: Program = full path to `node.exe`
  (usually `C:\Program Files\nodejs\node.exe`),
  Arguments = `server.mjs`,
  **Start in** = this folder's full path.

Point Task Scheduler at `node.exe` directly — **not** at `START SERVER.cmd`
(cmd's built-in `start` shadows a file named `START ...` and silently does
nothing).

## Updating the app

When `Goal Setting to the Now.html` (the desktop file, one folder up) gets
new features:

```
node update-app.mjs
```

then restart the server. The server serves that file byte-identical — desktop
and server always run the same app, only the storage differs.

## Ports and options

- Port: `8484` by default. Change with `config.json` (`{ "port": 9000 }`) or
  the `PORT` environment variable.
- Data folder: override with the `GTN_DATA` environment variable.

## Notes

- Passwords are salted and hashed (PBKDF2, 150k iterations); sign-in is
  throttled after repeated failures; sessions are HttpOnly cookies.
- This is a small office/home tool served over plain HTTP on a trusted
  network. Do not expose port 8484 to the internet as-is — if remote access
  is ever needed, put it behind a VPN.
