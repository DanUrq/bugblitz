# Security

Please don't report security problems in public issues. Use GitHub's
[private vulnerability reporting](https://github.com/DanUrq/bugblitz/security/advisories/new)
instead, with what you found and how to reproduce it. You'll get an answer within a week.

## How Bug Blitz handles data

- A shared blitz is reached through its link. Its id is 12 random characters, and nothing lists
  private blitzes.
- The creator's key is shown once, as their admin link. The key is after the `#`, so browsers never
  send it to the server, and the server stores only its SHA-256 hash.
- Screenshots go to a private Blob store and are served only through the API, to requests that name
  the blitz.
- Every blitz, with its screenshots, is deleted seven days after its last change.
- Testers' notes are stored as text and escaped wherever they're shown. The Claude skill treats them
  as data, never as instructions.
- Creating blitzes and making changes are rate-limited per IP.
