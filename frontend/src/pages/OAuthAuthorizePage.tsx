import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OAuthHandshakeLoader } from '../components/OAuthHandshakeLoader';

export function OAuthAuthorizePage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');

  const [clientName, setClientName] = useState<string>(
    clientId && clientId.toLowerCase().includes('openspace') ? 'OpenSpace' : 'Application'
  );
  const [stepMessage, setStepMessage] = useState('Verifying identity & authorization request...');
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const initiateHandshake = useCallback(async () => {
    setIsError(false);
    setErrorMessage('');
    setStepMessage('Verifying authorization request & establishing handshake...');

    if (!clientId || !redirectUri) {
      setIsError(true);
      setErrorMessage(
        'Missing required OAuth parameters (client_id or redirect_uri). Please initiate sign in from your application.'
      );
      return;
    }

    try {
      const res = await fetch(`/api/v1/oauth/authorize${window.location.search}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Authorization failed with status ${res.status}`);
      }

      const data = await res.json();

      if (data.client?.name) {
        setClientName(data.client.name);
      }

      if (data.status === 'authorized' && data.redirectUrl) {
        setStepMessage('Authorized! Redirecting back to application...');
        window.location.replace(data.redirectUrl);
        return;
      }

      if (data.status === 'consent_required' && data.redirectUrl) {
        setStepMessage('Redirecting to consent confirmation...');
        window.location.replace(data.redirectUrl);
        return;
      }

      if (data.status === 'unauthenticated' && data.redirectUrl) {
        setStepMessage('Please sign in to authorize...');
        window.location.replace(data.redirectUrl);
        return;
      }

      // Default fallback if redirectUrl provided
      if (data.redirectUrl) {
        window.location.replace(data.redirectUrl);
        return;
      }

      throw new Error('Unexpected authorization response');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to complete authorization handshake';
      
      // Fallback directly to backend SSR route if API route is unreachable
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        setStepMessage('Connecting directly to authentication gateway...');
        window.location.replace(`/api/oauth/authorize${window.location.search}`);
        return;
      }

      setIsError(true);
      setErrorMessage(message);
    }
  }, [clientId, redirectUri]);

  useEffect(() => {
    initiateHandshake();
  }, [initiateHandshake]);

  return (
    <OAuthHandshakeLoader
      clientName={clientName}
      stepMessage={stepMessage}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={initiateHandshake}
    />
  );
}
