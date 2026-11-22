# Homework Board

Weekly + daily homework planner for kids, with a parent dashboard for checkpoints.
Data lives in a **Google Sheet** that all your devices share.

## 1. Set up the Google Sheet (about 10 minutes)
1. Go to sheets.google.com and create a blank spreadsheet called "Homework Board".
2. Open **Extensions > Apps Script**. Delete the sample code and paste in everything from `apps-script/Code.gs`.
3. Change `FAMILY_CODE` at the top to your own long phrase (this is your shared password).
4. Click **Deploy > New deployment**. Click the gear and pick **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and approve the permission prompts. If Google shows "unverified app", choose Advanced > Go to project (it is your own script).
6. Copy the **Web app URL** (ends in `/exec`).

Tabs named Kids, Tasks and Notes are created automatically on first use. If you edit the script later, use **Deploy > Manage deployments > Edit > New version** so changes go live.

## 2. Publish the site on GitHub Pages
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo > Settings > Pages > Source: **GitHub Actions**.
3. Push again (or run the workflow in the Actions tab). The site appears at `https://<user>.github.io/<repo>/`.

## 3. Connect each device
Open the site, paste the Web app URL and your family code, tap Connect. Do this once per device.

## Notes
- The board refreshes every 20 seconds and when you return to the tab. Saves take 1 to 2 seconds.
- Anyone with the URL and family code can edit the board. Don't store anything sensitive.
- Backup / Restore (footer) saves a JSON copy. Restoring adds and overwrites records but does not delete extra rows already in the Sheet.

## Run locally
    npm install
    npm run dev
