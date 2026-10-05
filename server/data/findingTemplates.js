// Pre-filled common vulnerability templates to speed up finding entry.
const TEMPLATES = [
  {
    key: 'sqli', title: 'SQL Injection', category: 'Injection', owasp_category: 'A03:2021-Injection', cwe_id: 'CWE-89',
    impact: 'High', likelihood: 'High', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    description: 'The application constructs SQL queries using unsanitized user input, allowing an attacker to inject arbitrary SQL statements. This can lead to unauthorized data access, modification, or deletion, and in some cases full database compromise.',
    remediation: 'Use parameterized queries / prepared statements for all database access. Never concatenate user input directly into SQL strings. Apply least-privilege database accounts and enable a WAF as defense-in-depth.',
  },
  {
    key: 'xss_reflected', title: 'Reflected Cross-Site Scripting', category: 'Cross-Site Scripting', owasp_category: 'A03:2021-Injection', cwe_id: 'CWE-79',
    impact: 'Medium', likelihood: 'High', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
    description: 'User-supplied input is reflected back in the HTTP response without proper output encoding, allowing an attacker to craft a link that executes arbitrary JavaScript in a victim\'s browser session.',
    remediation: 'Apply context-aware output encoding for all reflected user input and implement a strict Content-Security-Policy header to reduce impact.',
  },
  {
    key: 'xss_stored', title: 'Stored Cross-Site Scripting', category: 'Cross-Site Scripting', owasp_category: 'A03:2021-Injection', cwe_id: 'CWE-79',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:L/A:N',
    description: 'Malicious script submitted by an attacker is persisted by the application and later served to other users without sanitization, resulting in script execution in the context of any user who views the affected page.',
    remediation: 'Sanitize and encode all user-supplied content before storage and again at render time. Implement a strict Content-Security-Policy as defense-in-depth.',
  },
  {
    key: 'csrf', title: 'Cross-Site Request Forgery', category: 'Broken Access Control', owasp_category: 'A01:2021-Broken Access Control', cwe_id: 'CWE-352',
    impact: 'Medium', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N',
    description: 'State-changing requests do not include an anti-CSRF token, allowing an attacker to trick an authenticated victim into unknowingly submitting a forged request that performs actions on their behalf.',
    remediation: 'Implement anti-CSRF tokens on all state-changing requests and validate them server-side. Additionally set SameSite=Strict/Lax on session cookies.',
  },
  {
    key: 'bac', title: 'Broken Access Control', category: 'Broken Access Control', owasp_category: 'A01:2021-Broken Access Control', cwe_id: 'CWE-284',
    impact: 'High', likelihood: 'High', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
    description: 'A user can access resources or perform actions that should be restricted to a higher-privileged role, because the application does not enforce authorization checks server-side.',
    remediation: 'Implement server-side authorization checks for every sensitive resource and action, following the principle of least privilege. Do not rely on hiding UI elements as an access control mechanism.',
  },
  {
    key: 'idor', title: 'Insecure Direct Object Reference (IDOR)', category: 'Broken Access Control', owasp_category: 'A01:2021-Broken Access Control', cwe_id: 'CWE-639',
    impact: 'High', likelihood: 'High', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N',
    description: 'The application exposes a direct reference to an internal object (e.g. a record ID) and allows an authenticated user to access other users\' records by simply changing that identifier, without an ownership check.',
    remediation: 'Enforce object-level authorization checks on the server for every request that references a resource ID, verifying the requesting user owns or is permitted to access that resource.',
  },
  {
    key: 'ssrf', title: 'Server-Side Request Forgery (SSRF)', category: 'SSRF', owasp_category: 'A10:2021-Server-Side Request Forgery', cwe_id: 'CWE-918',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N',
    description: 'The application fetches a remote resource based on a user-supplied URL without validation, allowing an attacker to make the server issue requests to internal network resources or cloud metadata endpoints.',
    remediation: 'Validate and allow-list destination hosts/schemes for any server-side outbound request. Block requests to private IP ranges and cloud metadata addresses (e.g. 169.254.169.254).',
  },
  {
    key: 'xxe', title: 'XML External Entity (XXE) Injection', category: 'Injection', owasp_category: 'A05:2021-Security Misconfiguration', cwe_id: 'CWE-611',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    description: 'The XML parser processes external entity references in user-supplied XML, allowing an attacker to read local files, perform SSRF, or cause denial of service via entity expansion.',
    remediation: 'Disable DTD processing and external entity resolution in the XML parser configuration. Prefer a data format such as JSON where external entities do not apply.',
  },
  {
    key: 'security_misconfig', title: 'Security Misconfiguration', category: 'Misconfiguration', owasp_category: 'A05:2021-Security Misconfiguration', cwe_id: 'CWE-16',
    impact: 'Medium', likelihood: 'Medium', cvss_vector: '',
    description: 'The application or its supporting infrastructure is running with insecure default configuration, unnecessary features enabled, verbose error messages, or missing security hardening.',
    remediation: 'Establish a repeatable hardening process for all environments, disable unused features/services, and ensure verbose error output is disabled in production.',
  },
  {
    key: 'sensitive_data', title: 'Sensitive Data Exposure', category: 'Information Disclosure', owasp_category: 'A02:2021-Cryptographic Failures', cwe_id: 'CWE-200',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    description: 'Sensitive information (such as credentials, tokens, or personal data) is transmitted or stored without adequate protection, exposing it to unauthorized parties.',
    remediation: 'Encrypt sensitive data in transit (TLS) and at rest, and ensure APIs return only the minimum data required for a given operation.',
  },
  {
    key: 'broken_auth', title: 'Broken Authentication', category: 'Authentication', owasp_category: 'A07:2021-Identification and Authentication Failures', cwe_id: 'CWE-287',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
    description: 'Weaknesses in the authentication mechanism (such as weak password policy, missing rate limiting, or predictable session tokens) allow an attacker to compromise user accounts.',
    remediation: 'Enforce a strong password policy, implement rate limiting and account lockout on authentication endpoints, and use cryptographically random, sufficiently long session identifiers.',
  },
  {
    key: 'insecure_deserialization', title: 'Insecure Deserialization', category: 'Injection', owasp_category: 'A08:2021-Software and Data Integrity Failures', cwe_id: 'CWE-502',
    impact: 'High', likelihood: 'Low', cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H',
    description: 'The application deserializes untrusted data without validation, which can allow an attacker to execute arbitrary code, tamper with application logic, or cause denial of service.',
    remediation: 'Avoid deserializing untrusted data. Where unavoidable, use integrity checks (signing) and a strict allow-list of types permitted during deserialization.',
  },
  {
    key: 'vulnerable_components', title: 'Vulnerable and Outdated Components', category: 'Misconfiguration', owasp_category: 'A06:2021-Vulnerable and Outdated Components', cwe_id: 'CWE-1104',
    impact: 'Medium', likelihood: 'Medium', cvss_vector: '',
    description: 'The application relies on a library, framework, or platform component with a known, publicly disclosed vulnerability.',
    remediation: 'Regularly update dependencies to the latest secure versions and implement automated dependency scanning in the CI/CD pipeline.',
  },
  {
    key: 'clickjacking', title: 'Clickjacking', category: 'Misconfiguration', owasp_category: 'A05:2021-Security Misconfiguration', cwe_id: 'CWE-1021',
    impact: 'Low', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N',
    description: 'The application does not set headers preventing it from being rendered within an iframe, allowing an attacker to overlay a transparent malicious page and trick users into performing unintended actions.',
    remediation: 'Set the X-Frame-Options header (or the frame-ancestors directive in a Content-Security-Policy) to restrict framing of the application.',
  },
  {
    key: 'open_redirect', title: 'Open Redirect', category: 'Misconfiguration', owasp_category: 'A01:2021-Broken Access Control', cwe_id: 'CWE-601',
    impact: 'Low', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N',
    description: 'A redirect parameter accepts an arbitrary destination URL without validation, which an attacker can abuse for phishing by disguising a malicious link behind the trusted domain.',
    remediation: 'Validate redirect destinations against an allow-list of internal paths/domains, or avoid user-controlled redirect targets entirely.',
  },
  {
    key: 'missing_headers', title: 'Missing Security Headers', category: 'Misconfiguration', owasp_category: 'A05:2021-Security Misconfiguration', cwe_id: 'CWE-16',
    impact: 'Low', likelihood: 'High', cvss_vector: '',
    description: 'The application does not send recommended security headers (such as Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options), reducing defense-in-depth against client-side attacks.',
    remediation: 'Configure the web server or application framework to send standard security headers on all responses.',
  },
  {
    key: 'weak_tls', title: 'Outdated TLS Version / Weak Cipher Suites', category: 'Misconfiguration', owasp_category: 'A02:2021-Cryptographic Failures', cwe_id: 'CWE-326',
    impact: 'Low', likelihood: 'Low', cvss_vector: '',
    description: 'The server accepts connections using deprecated TLS versions (1.0/1.1) or weak cipher suites, which are vulnerable to known cryptographic attacks.',
    remediation: 'Disable TLS 1.0/1.1 and weak cipher suites; enforce TLS 1.2 or higher with strong, modern cipher suites only.',
  },
  {
    key: 'rate_limiting', title: 'Missing Rate Limiting', category: 'Authentication', owasp_category: 'A07:2021-Identification and Authentication Failures', cwe_id: 'CWE-307',
    impact: 'Medium', likelihood: 'High', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
    description: 'A sensitive endpoint (login, OTP verification, password reset) does not enforce a rate limit, allowing an attacker to brute-force credentials or one-time codes.',
    remediation: 'Implement rate limiting and progressive lockout on all authentication-related endpoints, and monitor for repeated failed attempts.',
  },
  {
    key: 'file_upload', title: 'Unrestricted File Upload', category: 'Injection', owasp_category: 'A04:2021-Insecure Design', cwe_id: 'CWE-434',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N',
    description: 'The file upload feature does not adequately validate file type, content, or size, allowing an attacker to upload a malicious file (e.g. a web shell) that can later be executed on the server.',
    remediation: 'Validate uploaded file type by content (not just extension), store uploads outside the webroot with randomized names, and disable script execution in the upload directory.',
  },
  {
    key: 'command_injection', title: 'OS Command Injection', category: 'Injection', owasp_category: 'A03:2021-Injection', cwe_id: 'CWE-78',
    impact: 'High', likelihood: 'Low', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    description: 'User input is passed to a system shell command without sanitization, allowing an attacker to execute arbitrary operating system commands on the server.',
    remediation: 'Avoid invoking a shell with user input; use safe APIs that pass arguments directly. Where unavoidable, strictly validate input against an allow-list.',
  },
  {
    key: 'path_traversal', title: 'Path Traversal', category: 'Injection', owasp_category: 'A01:2021-Broken Access Control', cwe_id: 'CWE-22',
    impact: 'High', likelihood: 'Medium', cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    description: 'A file path parameter is not sanitized, allowing an attacker to use "../" sequences to access files outside the intended directory.',
    remediation: 'Resolve and canonicalize file paths server-side and verify the result is within the intended base directory before use. Avoid passing user input directly into file system APIs.',
  },
];

module.exports = { TEMPLATES };
