# Security

Status: Phase 0 baseline.

EPUB files are untrusted ZIP containers that may include XHTML, SVG, scripts, remote resources, encrypted resources, and malicious archive paths. The implementation must enforce bounded extraction, path normalization, script prohibition, remote-request blocking, preview isolation, and the DRM boundary defined in `product-requirements.md`.

No book content may be sent to analytics, error reporting, AI services, or application servers.
