# Delim Lizard

A small, client-side JavaScript app that turns pasted values into a delimited list.

Features include custom delimiters, single/double/bracket wrapping, list prefixes and suffixes, automatic input splitting, trimming, blank removal, duplicate removal, natural sorting, and presets for SQL, CSV, JavaScript, and URL query values.

Open `index.html` directly or serve the folder with any static web server. All processing remains in the browser.

Delim Lizard remembers the last input and settings in the current browser and rebuilds the output when reopened. **Clear** empties both editors.

## GitHub Pages

The intended deployment uses `master` for source and `gh-pages` for the public site:

```powershell
git push origin master
git push origin master:gh-pages
```

Enable the release-stamp hook once after cloning:

```powershell
git config core.hooksPath .githooks
```
