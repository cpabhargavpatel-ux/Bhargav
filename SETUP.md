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

## iPhone and iPad (over Tailscale)

The app works in Safari on an iPhone or iPad, using the same sign-in and the same data as on the PC.
The pages adapt to the screen: the top bar scrolls sideways and the French / English menus open with a
tap, the French player stays short with **Play / Loop in a bar at the bottom** and the options behind a
**⚙ Options** button, and the **Book** page turns pages when you swipe.

1. Install Tailscale on the PC and on the phone/tablet and sign in to the same account.
2. On the device, open `http://<pc-tailscale-name>:<port>` (the port is in `config.json`; the name is
   shown in the Tailscale app, or use the PC's `100.x.y.z` address).
   If it does not load, allow the port through the Windows firewall (see "Let other people use it").
3. **Recording needs https.** Safari only allows the microphone on a secure page, so with plain `http://`
   everything works **except** Record my voice, Practice loop and Compare. To get https inside your
   Tailscale network, turn on **HTTPS certificates** (Tailscale admin console > DNS), then run this once
   on the PC:

   ```
   tailscale serve --bg <port>
   ```

   and open `https://<pc-name>.<your-tailnet>.ts.net/` on the iPhone/iPad instead (this is only visible
   inside your tailnet; do not use "funnel").
4. To use it like an app: in Safari tap **Share > Add to Home Screen**.
5. French voice: on the device, Settings > Accessibility > Spoken Content > Voices > French (download an
   Enhanced voice). If the "pure sounds" are silent, check the side switch is not in silent mode.

## Where the data lives, and backups

- The live database is `Data\goals.db` **inside this app folder** (for example
  `C:\Users\<you>\Desktop\Claude\Goal Setting Server\Data\goals.db`). It must
  **not** be inside a OneDrive/Dropbox-synced folder, because a sync client can
  lock or copy a live database mid-write and corrupt it — if the app folder is
  synced, the server keeps using the old `%USERPROFILE%\GoalSettingData` instead.
- Upgrading from an older version: on its first start the server **copies**
  `%USERPROFILE%\GoalSettingData\goals.db` into `Data\`, checks the copy, and uses
  it. The old folder is left untouched (delete it yourself once you are happy).
  `Update from GitHub.cmd` never touches `Data\`.
- The server writes a **dated snapshot copy once per day** to two places:
  `Data\backups\` and this folder's `Backups\` (safe to sync — snapshots are plain
  copies).
- To restore: stop the server, copy a snapshot over `Data\goals.db`, start again.
- Individual users can also Export/Import their own goals as JSON from
  inside the app at any time.

## Reading a PDF book (French > Book)

Put any PDF in the **`French Learning`** folder next to `server.mjs` (for example
`...\Goal Setting Server\French Learning\French-English_Bilingual_Visual_Dictionary.pdf`),
then open **French > Book**. It opens like a book (cover alone, then two-page spreads), with a
contents list from the PDF's bookmarks, full-text search with the matches highlighted, a
jump-to-page box, zoom, full screen, and it remembers the page you stopped at for each PDF.
Select a word or phrase on a page and press **Hear it** to have it read in French. The server
sends only the parts of a large PDF you look at. The PDF reader is
[PDF.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), bundled as `pdf.min.js`,
`pdf.worker.min.js` and `pdf_viewer.css`, so it works offline.

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

## Shadowing (video + your own voice)

Put videos in the **`Shadowing`** folder next to `server.mjs` (the app creates it on start), then open the
**Shadowing** tab and pick one. `.mp4` (H.264 + AAC), `.m4v`, `.webm` and `.mov` work, and so do audio files
(`.mp3`, `.m4a`, `.wav`). If a subtitle file has the same name (`lesson1.mp4` + `lesson1.srt` or `.vtt`) it is shown
automatically. Large videos stream, so they start quickly and you can skip around.

The list of videos folds away once you pick one (press **📁 Videos** to show it again) so the player gets the full width. Under the video is a **Transcript** box: paste your transcript with time stamps (`0:05 text`, `[00:12] text`, `1:02:30 text`, or a `.srt` as it is), press **Read**, and the current line follows the video; click a line to jump there, and tick *Repeat the line I click* to loop it. The line being said now is also pinned in a bar under the top menu all the time, wherever you scroll; it also shows the next line underneath, so you can see what is coming. Click the bar to hear the line again, or the next line to jump to it. It is saved per video in your account.

Keys: **B** start the video and the recording together / stop both, **S** start / stop the video, **R** record your voice / stop, **P** play your voice / stop, **O** play the original video from the point where your recording started,
**←** **→** back / forward 3 seconds, **0** back to the beginning, **L** repeat the video. The same actions are buttons
for the phone and iPad. By default R also starts the video (and stops it when you stop), so you can speak along with it;
use headphones so the video's sound doesn't leak into the recording. Your latest recording of each video is kept in your
account, so P still works tomorrow, and a tick lets P replay the video (muted) alongside your voice. The microphone needs
`http://localhost` on the PC or the `https://` address on an iPhone/iPad (see the Tailscale section above).
