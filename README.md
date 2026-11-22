# Homework Board

Simple weekly homework planner for kids, with a parent dashboard for checkpoints.

## Run locally
    npm install
    npm run dev

## Deploy on GitHub Pages
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo > Settings > Pages > Build and deployment > Source: **GitHub Actions**.
3. Push again (or run the workflow from the Actions tab). Your site appears at `https://<user>.github.io/<repo>/`.

## Important: where data lives
Data is saved in the browser (localStorage) of each device, so it is NOT shared between devices.
Use the **Backup / Restore** buttons to move the board between phones and laptops.
