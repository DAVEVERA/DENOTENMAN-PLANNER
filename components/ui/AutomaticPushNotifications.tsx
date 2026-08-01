import { useEffect, useRef } from 'react';

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
    .buffer as ArrayBuffer;
}

/**
 * Houdt pushmeldingen automatisch actief voor iedere ingelogde gebruiker.
 * De browser/het besturingssysteem blijft eigenaar van de toestemmingsprompt;
 * bij de eerste gebruikersinteractie vragen we die toestemming eenmalig aan.
 */
export default function AutomaticPushNotifications() {
  const subscribing = useRef(false);

  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    )
      return;

    let disposed = false;

    async function ensureSubscription(requestPermission: boolean) {
      if (disposed || subscribing.current || Notification.permission === 'denied') return;
      subscribing.current = true;

      try {
        let permission: NotificationPermission = Notification.permission;
        if (permission === 'default' && requestPermission) {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') return;

        const keyResponse = await fetch('/api/notifications/subscribe', { cache: 'no-store' });
        if (keyResponse.status === 401) return;
        const keyData = await keyResponse.json();
        if (!keyResponse.ok || !keyData.success || !keyData.publicKey) return;

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToArrayBuffer(keyData.publicKey),
          }));

        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        });
      } catch (error) {
        console.error('[automatische pushinschrijving]', error);
      } finally {
        subscribing.current = false;
      }
    }

    void ensureSubscription(false);

    const requestOnFirstInteraction = () => {
      removeInteractionListeners();
      void ensureSubscription(true);
    };
    const removeInteractionListeners = () => {
      window.removeEventListener('pointerdown', requestOnFirstInteraction);
      window.removeEventListener('keydown', requestOnFirstInteraction);
    };

    if (Notification.permission === 'default') {
      window.addEventListener('pointerdown', requestOnFirstInteraction, { passive: true });
      window.addEventListener('keydown', requestOnFirstInteraction);
    }

    const repairSubscription = () => {
      if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
        void ensureSubscription(false);
      }
    };
    document.addEventListener('visibilitychange', repairSubscription);

    return () => {
      disposed = true;
      removeInteractionListeners();
      document.removeEventListener('visibilitychange', repairSubscription);
    };
  }, []);

  return null;
}
