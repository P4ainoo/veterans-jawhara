import { useState, useEffect } from 'react';
import { useSquadStore } from '../store/useSquadStore';
import clubLogo from '../assets/images/jawhara_crest_1790419338393.jpg';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const { events, currentUser } = useSquadStore();
  const [notifiedEventIds, setNotifiedEventIds] = useState<Set<string>>(new Set());

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  useEffect(() => {
    if (permission !== 'granted' || !currentUser) return;

    const checkEvents = () => {
      const now = new Date();
      events.forEach(event => {
        if (notifiedEventIds.has(event.id)) return;

        // Combine date and time
        // Note: Event dates are stored as 'YYYY-MM-DD' and time as 'HH:mm'
        const eventDate = new Date(`${event.date}T${event.time}`);
        const timeDiff = eventDate.getTime() - now.getTime();
        
        // 1 hour = 3600000 ms
        // Trigger if event is between 55 and 65 minutes away
        const oneHour = 60 * 60 * 1000;
        const windowMs = 5 * 60 * 1000; // 5 minute window to check

        if (timeDiff > 0 && Math.abs(timeDiff - oneHour) < windowMs) {
          // Send notification
          new Notification('JAWHARA TACTICAL ALERT', {
            body: `${event.type === 'MATCH' ? 'Match vs ' + event.opponent : 'Squad Drills'} starts in 1 hour at ${event.venue}. Be ready operative.`,
            icon: clubLogo
          });

          setNotifiedEventIds(prev => new Set(prev).add(event.id));
        }
      });
    };

    const interval = setInterval(checkEvents, 60000); // Check every minute
    checkEvents(); // Initial check

    return () => clearInterval(interval);
  }, [permission, events, notifiedEventIds, currentUser]);

  return { permission, requestPermission };
}
