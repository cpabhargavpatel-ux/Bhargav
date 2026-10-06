# Goal Setting launcher (Windows)
1. Copy this `launcher` folder somewhere permanent on your PC (keep the files together).
2. Double-click `Install.cmd` once.
3. Double-click **Goal Setting** on your Desktop: the server starts hidden (no cmd window) and your browser opens on the right localhost port (auto-detected).

Use **Stop Goal Setting** to shut the background server down. Server output: `goal-app.log` in the app folder.
If your app is plain HTML pages (login.html, app.html...), a built-in mini web server is used automatically (port 8123).
If auto-detect picks the wrong start command, set `$StartCmd` at the top of `GoalSetting.ps1`.
