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
          setUpdateStatus('নতুন আপডেট ডাউনলোড হচ্ছে...');

          await Updates.fetchUpdateAsync();
          
          if (isMounted) {
            setUpdateStatus('ইনস্টলেশন সম্পূর্ণ! পুনরায় চালু হচ্ছে...');
            // Wait 1.2s for user to see the success state
            setTimeout(async () => {
              try {
                await Updates.reloadAsync();
              } catch (e) {
                console.log('Failed to reload after update:', e);
              }
            }, 1200);
          }
        }
      } catch (error) {
        // Silently continue to normal app if update check fails
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
