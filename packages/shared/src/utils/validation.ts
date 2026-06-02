export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9_]{0,30}[a-z0-9]$/.test(username);
}

export function isValidDomain(domain: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i.test(domain);
}
