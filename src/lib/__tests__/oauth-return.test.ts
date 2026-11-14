import { describe, expect, it } from 'vitest';
import { oauthReturnUrl } from '../oauth-return';

describe('Google return destination', () => {
  it('returns to public auth instead of homepage or protected dashboard', () => {
    expect(oauthReturnUrl('https://pupillo.life')).toBe('https://pupillo.life/auth');
  });
  it('preserves an intended local destination until session hydration', () => {
    expect(new URL(oauthReturnUrl('https://pupillo.life', '/onboarding')).searchParams.get('redirect')).toBe('/onboarding');
  });
  it.each(['https://other.example', '//other.example', '/\\other.example'])('rejects external destination %s', (redirect) => {
    expect(oauthReturnUrl('https://pupillo.life', redirect)).toBe('https://pupillo.life/auth');
  });
});