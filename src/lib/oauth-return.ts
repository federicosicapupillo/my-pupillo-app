/** Social login must return to a public page that waits for session/profile hydration. */
export function oauthReturnUrl(origin: string, redirect?: string): string {
  const url = new URL('/auth', origin);
  if (redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\')) {
    url.searchParams.set('redirect', redirect);
  }
  return url.toString();
}