# Deploy Paper Pulse

## 1. Create the GitHub repository

Create a new public repository under `Peteroos` named:

```text
paper-pulse
```

Do not initialize it with a README, license, or `.gitignore`.

## 2. Push this project

From this directory:

```bash
git remote set-url origin https://github.com/Peteroos/paper-pulse.git
git push -u origin main
```

If Git asks for authentication, use a GitHub personal access token or sign in with GitHub Desktop.

## 3. Enable GitHub Pages

In the repository:

1. Open Settings → Pages.
2. Set Source to GitHub Actions.
3. Open Actions and run `Update Papers and Deploy Pages` once.

After it succeeds, the site will be available at:

```text
https://peteroos.github.io/paper-pulse/
```

The workflow also runs every day at 12:20 UTC to refresh paper data.
