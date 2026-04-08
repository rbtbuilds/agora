# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Agora, please report it responsibly.

**Do NOT open a public GitHub issue.**

Instead, use one of these methods:

1. **GitHub Private Vulnerability Reporting** - Use the "Report a vulnerability" button on the Security tab of this repository.
2. **Email** - Send details to agora@bentolabs.co.uk

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Scope

The following components are in scope for security reports:

- API server (`packages/api/`)
- Commerce layer (cart, checkout, orders, payments)
- Authentication and authorization middleware
- Webhook dispatcher and HMAC verification
- Store registration and adapter endpoints
- Protocol validator (`packages/validator/`)

The following are out of scope:

- Demo application (`packages/demo/`)
- Marketing site (`packages/marketing/`)
- Crawler scripts (`crawler/`)

## Security Measures

- All endpoints with financial operations use timing-safe token comparison
- SSRF protection on all server-side URL fetching
- Request body size limits (100KB)
- SQL injection prevention via parameterized queries
- HMAC-SHA256 signed webhook deliveries
- Approval tokens are single-use with 15-minute expiry
- Secret scanning enabled on this repository
- Dependabot alerts enabled for dependency vulnerabilities
