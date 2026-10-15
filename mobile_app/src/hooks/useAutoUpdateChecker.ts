import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useAutoUpdateChecker() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  useEffect(() => {
    // Only native platforms (Android / iOS) in production mode support expo-updates
    if (Platform.OS === 'web' || __DEV__) {
      return;
    }

    let isMounted = true;

    async function checkForUpdates() {
      try {
        const Updates = await import('expo-updates');
        
        // If updates are disabled or running locally, skip
        if (!Updates.isEnabled) {
          return;
        }

        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable && isMounted) {
          setIsUpdating(true);
          setUpdateStatus('নতুন সিস্টেম আপডেট পাওয়া গেছে, ডাউনলোড হচ্ছে...');

          // Bounded fetch with 15s timeout to prevent hanging on flaky connections
          const fetchPromise = Updates.fetchUpdateAsync();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Update fetch timed out')), 15000)
          );

          await Promise.race([fetchPromise, timeoutPromise]);
          
          if (isMounted) {
            setUpdateStatus('ইনস্টলেশন সফল! অ্যাপ নতুন ভার্সনে রিস্টার্ট হচ্ছে...');
            setTimeout(async () => {
              try {
                await Updates.reloadAsync();
              } catch (e) {
                console.log('Failed to reload after update:', e);
                if (isMounted) setIsUpdating(false);
              }
            }, 1000);
          }
        }
      } catch (error) {
        // Silently continue to normal app if update check fails or times out
        console.log('Auto update check skipped/failed:', error);
        if (isMounted) {
          setIsUpdating(false);
        }
      }
    }

    checkForUpdates();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isUpdating, updateStatus };
}
