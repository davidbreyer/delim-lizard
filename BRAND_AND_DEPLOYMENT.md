# Brand and Deployment Notes

Delim Lizard follows the shared Lizard tool branding: the transparent Yelling Lizard mark, the standard green palette, restrained 8px controls, and the `yyyyMMdd-HHmm` release stamp.

Tracked assets:

- `assets/yelling-lizard-logo.png`
- `assets/apple-icon.png`

The pre-commit hook runs `scripts/update-release.ps1`, updates asset query strings and the visible version, and stages `index.html` and `script.js`.

The intended repository is `https://github.com/davidbreyer/delim-lizard.git`. Publish with `master` as source/history and `gh-pages` as the GitHub Pages branch.
