# Security policy

## Supported version

Security fixes are expected to target the latest public release.

## Reporting a vulnerability

Please use GitHub's **Report a vulnerability** option in the repository Security tab when available. Do not publish exploit details, private meeting transcripts, or credentials in a public issue.

## Security boundaries

The bridge and model server should bind to `127.0.0.1`, not `0.0.0.0`. Do not expose these local inference endpoints directly to a LAN or the public internet. The bridge validates browser origins, but the project should still be treated as a local prototype and reviewed before use in sensitive environments.
