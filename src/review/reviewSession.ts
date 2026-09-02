export function shouldLoadReviewToken(settingsLoaded: boolean, token: string | null, loadedToken: string | null): boolean {
  return settingsLoaded && Boolean(token) && token !== loadedToken;
}
