# Security Policy

## Overview

The AGI Detector is an open-source project designed to be run locally by individual users. Security is a shared responsibility between the maintainers (who provide secure code) and users (who protect their API keys and environment).

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Security Features

### Implemented Security Measures

1. **SSRF Protection**: URL validation prevents crawling of localhost, private IPs, and cloud metadata endpoints
2. **Safe JSON Parsing**: All JSON parsing includes error handling to prevent application crashes
3. **Input Validation**: API endpoints validate all query parameters and request bodies using Zod schemas
4. **Request Limits**:
   - Maximum request body size: 1MB
   - Maximum response size: 10MB
   - Request timeouts: 30 seconds
   - Redirect limits: 3 maximum
5. **Security Headers**:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - X-XSS-Protection enabled
6. **Browser Security**: Playwright launches without dangerous flags (--disable-web-security removed)
7. **Dependency Management**: Regular dependency updates to patch known vulnerabilities

### Database Security

- Uses Prisma ORM with parameterized queries (SQL injection safe)
- No raw SQL queries with user input
- Connection encryption enforced via SSL/TLS

## User Responsibilities

### 🔒 Protect Your API Keys

**NEVER commit `.env` files to version control!**

Your `.env` file contains sensitive credentials:
- OpenAI API key
- Database connection strings
- Brave API key
- Firecrawl API key

**Best Practices:**
1. Keep `.env` files local only
2. Use different API keys for development and production
3. Rotate API keys regularly
4. Use read-only database credentials when possible
5. Monitor API usage for unusual activity

### 🌐 Safe Crawler Usage

The crawler is designed to access public AI research sources only. However:

**DO:**
- ✅ Use the default trusted sources (OpenAI, DeepMind, Anthropic, etc.)
- ✅ Crawl publicly accessible research blogs and papers
- ✅ Respect rate limits and robots.txt

**DON'T:**
- ❌ Modify the code to crawl localhost or internal network addresses
- ❌ Crawl private or authenticated endpoints
- ❌ Bypass the URL validator
- ❌ Use the crawler for unauthorized data collection

### 🔄 Keep Dependencies Updated

Run these commands regularly to get security patches:

```bash
npm update
npm audit fix
```

Check for vulnerabilities:
```bash
npm audit
```

## Reporting Security Issues

### 🚨 Critical Security Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

**DO NOT** create a public GitHub issue for security vulnerabilities.

**Instead, please:**
1. Email the maintainer at: [security contact - add your email]
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge receipt within 48 hours
- Provide a fix timeline within 7 days
- Credit you in the fix (unless you prefer to remain anonymous)
- Notify users of the security update

### 📝 General Security Concerns

For non-critical security improvements or questions:
- Open a GitHub issue with the label `security`
- Start a GitHub Discussion in the Security category

## Security Updates

Security updates are released as:
- **Patch versions** (2.0.x) for minor security fixes
- **Minor versions** (2.x.0) for significant security improvements
- **Major versions** (x.0.0) for breaking security changes

Subscribe to GitHub releases to get notified of security updates.

## Known Limitations

### Local Execution Only

This tool is designed for **local use only**. Do not:
- Deploy API endpoints publicly without authentication
- Expose the database to the internet
- Share your instance with untrusted users

If you need multi-user access, implement:
- User authentication (JWT, OAuth, etc.)
- API key authentication for endpoints
- Rate limiting per user
- Role-based access control

### Third-Party Services

This application relies on third-party services:
- **OpenAI API**: Data sent to OpenAI for analysis
- **Firecrawl**: URLs sent to Firecrawl for crawling
- **Brave Search**: Search queries sent to Brave

**Privacy Implications:**
- Article content is sent to OpenAI for AGI analysis
- Crawled URLs are visible to Firecrawl
- Search terms are visible to Brave

**Recommendations:**
- Review OpenAI's data usage policy
- Use API keys with appropriate usage limits
- Consider self-hosted alternatives for sensitive use cases

## Security Checklist for Contributors

Before submitting a PR, ensure:

- [ ] No hardcoded secrets or API keys
- [ ] All user inputs are validated
- [ ] SQL queries use parameterized statements
- [ ] External URLs are validated before fetching
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up to date (`npm audit` passes)
- [ ] New API endpoints have input validation
- [ ] Tests cover security-sensitive code

## Security Audit History

| Date       | Auditor          | Type              | Findings | Status   |
|------------|------------------|-------------------|----------|----------|
| 2025-10-26 | Internal Review  | Full Security Audit | 10      | ✅ Fixed |

### Recent Security Improvements

**October 2025 Security Hardening:**
- Added SSRF protection with URL validator
- Implemented safe JSON parsing across all API routes
- Added input validation using Zod schemas
- Fixed browser security flags in Playwright
- Updated vulnerable dependencies (axios, babel)
- Added security headers (X-Frame-Options, etc.)
- Implemented request size limits
- Added comprehensive security documentation

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/deploying/production-checklist#security)
- [Prisma Security Guidelines](https://www.prisma.io/docs/guides/database/advanced-database-tasks/sql-injection-prevention)
- [OpenAI API Security](https://platform.openai.com/docs/guides/safety-best-practices)

## License

This security policy is part of the AGI Detector project and is licensed under the same MIT License.

---

**Last Updated:** October 26, 2025
**Policy Version:** 1.0
