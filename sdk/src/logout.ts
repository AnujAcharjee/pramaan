import { UnsupportedFeatureError } from './errors.js';

export interface LogoutOptions {
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
  state?: string;
}

/**
 * Helper for OIDC RP-Initiated Logout.
 *
 * NOTE: OpenID Connect RP-Initiated Logout (`end_session_endpoint`) is NOT currently implemented
 * in the Pramaan Identity Provider server. Calling this will throw an UnsupportedFeatureError.
 */
export class LogoutService {
  /**
   * Construct an RP-Initiated logout URL.
   *
   * @throws {UnsupportedFeatureError} Always, until Pramaan implements end_session_endpoint.
   */
  getLogoutUrl(_options: LogoutOptions = {}): string {
    throw new UnsupportedFeatureError(
      'RP-Initiated Logout is not currently implemented in Pramaan Identity Provider. ' +
        'To log out, clear the local application session cookie. When Pramaan adds the end_session_endpoint ' +
        'per OIDC RP-Initiated Logout 1.0, this method will be enabled.',
    );
  }
}
