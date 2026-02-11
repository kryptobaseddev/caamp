/**
 * Security audit rules for SKILL.md scanning
 *
 * 46+ rules across categories: prompt injection, command injection,
 * data exfiltration, privilege escalation, obfuscation, and more.
 */

import type { AuditRule, AuditSeverity } from "../../../types.js";

function rule(
  id: string,
  name: string,
  description: string,
  severity: AuditSeverity,
  category: string,
  pattern: RegExp,
): AuditRule {
  return { id, name, description, severity, category, pattern };
}

export const AUDIT_RULES: AuditRule[] = [
  // ── Prompt Injection ────────────────────────────────────────
  rule("PI001", "System prompt override", "Attempts to override system instructions", "critical", "prompt-injection",
    /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules)/i),
  rule("PI002", "Role manipulation", "Attempts to assume a different role", "critical", "prompt-injection",
    /(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you're)|your\s+new\s+role\s+is)/i),
  rule("PI003", "Jailbreak attempt", "Common jailbreak patterns", "critical", "prompt-injection",
    /(?:DAN|Do\s+Anything\s+Now|developer\s+mode|god\s+mode|unrestricted\s+mode)/i),
  rule("PI004", "Instruction override", "Direct instruction override attempt", "high", "prompt-injection",
    /(?:new\s+instructions?:|updated?\s+instructions?:|override\s+instructions?:)/i),
  rule("PI005", "Hidden instructions", "Instructions hidden in comments or whitespace", "high", "prompt-injection",
    /<!--[\s\S]*?(?:execute|run|ignore|override)[\s\S]*?-->/i),
  rule("PI006", "Encoding bypass", "Base64 or encoded content", "medium", "prompt-injection",
    /(?:base64|atob|btoa|decodeURI|unescape)\s*\(/i),
  rule("PI007", "Context manipulation", "Fake conversation context", "high", "prompt-injection",
    /(?:Human:|Assistant:|User:|System:)\s*(?:ignore|execute|run)/i),
  rule("PI008", "Token smuggling", "Invisible characters or zero-width spaces", "medium", "prompt-injection",
    /[\u200B\u200C\u200D\u2060\uFEFF]/),

  // ── Command Injection ───────────────────────────────────────
  rule("CI001", "Destructive command", "File deletion or system modification", "critical", "command-injection",
    /(?:rm\s+-rf|rmdir\s+\/s|del\s+\/f|format\s+[a-z]:|mkfs|dd\s+if=)/i),
  rule("CI002", "Remote code execution", "Downloading and executing remote code", "critical", "command-injection",
    /(?:curl|wget|fetch)\s+.*\|\s*(?:sh|bash|zsh|python|node|eval)/i),
  rule("CI003", "Eval usage", "Dynamic code execution", "high", "command-injection",
    /\beval\s*\(/),
  rule("CI004", "Shell spawn", "Spawning shell processes", "high", "command-injection",
    /(?:exec|spawn|system|popen)\s*\(\s*['"`]/),
  rule("CI005", "Sudo escalation", "Privilege escalation via sudo", "critical", "command-injection",
    /sudo\s+(?:rm|chmod|chown|mv|cp|dd|mkfs|format)/i),
  rule("CI006", "Environment manipulation", "Modifying PATH or critical env vars", "high", "command-injection",
    /(?:export\s+PATH|setx?\s+PATH|PATH=.*:)/i),
  rule("CI007", "Cron/scheduled task", "Installing scheduled tasks", "high", "command-injection",
    /(?:crontab|at\s+\d|schtasks|launchctl\s+load)/i),
  rule("CI008", "Network listener", "Starting network services", "high", "command-injection",
    /(?:nc\s+-l|ncat\s+-l|socat\s+|python.*SimpleHTTPServer|php\s+-S)/i),

  // ── Data Exfiltration ───────────────────────────────────────
  rule("DE001", "Credential access", "Reading credential files", "critical", "data-exfiltration",
    /(?:\.env|\.aws\/credentials|\.ssh\/|\.gnupg|\.netrc|credentials\.json|token\.json)/i),
  rule("DE002", "API key extraction", "Patterns matching API key theft", "critical", "data-exfiltration",
    /(?:API[_-]?KEY|SECRET[_-]?KEY|ACCESS[_-]?TOKEN|PRIVATE[_-]?KEY)\s*[=:]/i),
  rule("DE003", "Data upload", "Uploading data to external services", "high", "data-exfiltration",
    /(?:curl|wget|fetch).*(?:POST|PUT|PATCH).*(?:pastebin|gist|transfer\.sh|requestbin|webhook)/i),
  rule("DE004", "Browser data theft", "Accessing browser profiles or cookies", "critical", "data-exfiltration",
    /(?:\.mozilla|\.chrome|\.config\/google-chrome|Cookies|Login\s+Data|Local\s+State)/i),
  rule("DE005", "Git credential theft", "Accessing git credentials", "high", "data-exfiltration",
    /(?:git\s+credential|\.git-credentials|\.gitconfig\s+credential)/i),
  rule("DE006", "Keychain access", "Accessing system keychain", "critical", "data-exfiltration",
    /(?:security\s+find-generic-password|security\s+find-internet-password|keyring\s+get)/i),

  // ── Privilege Escalation ────────────────────────────────────
  rule("PE001", "Chmod dangerous", "Setting dangerous file permissions", "high", "privilege-escalation",
    /chmod\s+(?:777|666|a\+[rwx]|o\+[rwx])/i),
  rule("PE002", "SUID/SGID", "Setting SUID or SGID bits", "critical", "privilege-escalation",
    /chmod\s+[ug]\+s/i),
  rule("PE003", "Docker escape", "Container escape patterns", "critical", "privilege-escalation",
    /(?:--privileged|--cap-add\s+SYS_ADMIN|--pid=host|nsenter)/i),
  rule("PE004", "Kernel module", "Loading kernel modules", "critical", "privilege-escalation",
    /(?:insmod|modprobe|rmmod)\s+/i),

  // ── Filesystem Abuse ────────────────────────────────────────
  rule("FS001", "System directory write", "Writing to system directories", "critical", "filesystem",
    /(?:\/etc\/|\/usr\/|\/bin\/|\/sbin\/|C:\\Windows\\|C:\\Program Files)/i),
  rule("FS002", "Hidden file creation", "Creating hidden files", "medium", "filesystem",
    /(?:touch|mkdir|cp|mv)\s+\.[a-zA-Z]/),
  rule("FS003", "Symlink attack", "Creating symlinks to sensitive files", "high", "filesystem",
    /ln\s+-s.*(?:\/etc\/passwd|\/etc\/shadow|\.ssh|\.env)/i),
  rule("FS004", "Mass file operation", "Recursive operations on broad paths", "medium", "filesystem",
    /(?:find|xargs|rm|chmod|chown)\s+.*(?:\/\s|\/\*|-R\s+\/)/i),

  // ── Network Abuse ──────────────────────────────────────────
  rule("NA001", "DNS exfiltration", "Data exfiltration via DNS", "high", "network",
    /(?:dig|nslookup|host)\s+.*\$\{?[A-Z_]+/i),
  rule("NA002", "Reverse shell", "Reverse shell patterns", "critical", "network",
    /(?:bash\s+-i|\/dev\/tcp\/|mkfifo|nc\s+.*-e)/i),
  rule("NA003", "Port scanning", "Network scanning", "medium", "network",
    /(?:nmap|masscan|zmap)\s+/i),
  rule("NA004", "Proxy/tunnel", "Creating network tunnels", "high", "network",
    /(?:ssh\s+-[DRLW]|ngrok|chisel|bore)/i),

  // ── Obfuscation ─────────────────────────────────────────────
  rule("OB001", "Hex encoding", "Hex-encoded commands", "medium", "obfuscation",
    /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){3,}/),
  rule("OB002", "String concatenation", "Building commands via concatenation", "medium", "obfuscation",
    /(?:\$\{[A-Z]+\}\$\{[A-Z]+\}|['"][a-z]+['"]\.['"][a-z]+['"])/i),
  rule("OB003", "Unicode escape", "Unicode-escaped commands", "medium", "obfuscation",
    /\\u[0-9a-fA-F]{4}(?:\\u[0-9a-fA-F]{4}){3,}/),

  // ── Supply Chain ────────────────────────────────────────────
  rule("SC001", "Package install", "Installing packages at runtime", "medium", "supply-chain",
    /(?:npm\s+install|pip\s+install|gem\s+install|cargo\s+install)\s+(?!-)/),
  rule("SC002", "Typosquatting patterns", "Packages with suspicious names", "low", "supply-chain",
    /(?:npm\s+install|pip\s+install)\s+(?:reqeusts|requets|reqests|lodahs|lodashe)/i),
  rule("SC003", "Postinstall script", "npm lifecycle scripts", "medium", "supply-chain",
    /(?:preinstall|postinstall|preuninstall|postuninstall)\s*[":]/i),
  rule("SC004", "Registry override", "Changing package registry", "high", "supply-chain",
    /(?:registry\s*=|--registry\s+)(?!https:\/\/registry\.npmjs\.org)/i),

  // ── Information Disclosure ──────────────────────────────────
  rule("ID001", "Process listing", "Listing running processes", "low", "info-disclosure",
    /(?:ps\s+aux|top\s+-b|tasklist)/i),
  rule("ID002", "System information", "Gathering system information", "low", "info-disclosure",
    /(?:uname\s+-a|systeminfo|hostnamectl)/i),
  rule("ID003", "Network enumeration", "Listing network configuration", "low", "info-disclosure",
    /(?:ifconfig|ip\s+addr|ipconfig|netstat\s+-[at])/i),
];

/** Get rules by category */
export function getRulesByCategory(category: string): AuditRule[] {
  return AUDIT_RULES.filter((r) => r.category === category);
}

/** Get rules by severity */
export function getRulesBySeverity(severity: AuditSeverity): AuditRule[] {
  return AUDIT_RULES.filter((r) => r.severity === severity);
}

/** Get all unique categories */
export function getCategories(): string[] {
  return [...new Set(AUDIT_RULES.map((r) => r.category))];
}
