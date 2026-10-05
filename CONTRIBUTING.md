# Contributing to Bragi

Thanks for helping improve Bragi, a self-hosted music streaming server with a
web app and Android app. Bragi is based on Navidrome and is maintained in this
repository.

## Before opening an issue

Search the [existing issues](https://github.com/Kinanqaz/Bragi/issues) first.
Use the bug report form for reproducible problems. For questions or feature
ideas, open a general issue and describe the use case.

## Local development

On Windows, start the live development environment from the repository root:

```powershell
.\scripts\dev.ps1
```

This starts the web app with hot reload and the Go backend. The root
[README](README.md) describes the project and Docker setup.

## Pull requests

- Keep each change focused and explain the user-visible effect.
- Link a related issue when one exists.
- Describe the checks you ran and include screenshots for visible UI changes.
- Avoid including generated files or unrelated local changes.
