import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Platform,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  isUpdating?: boolean;
  statusText?: string;
  subText?: string;
}

const { width } = Dimensions.get('window');

export default function ModernBootSplash({
  isUpdating = false,
  statusText,
  subText,
}: Props) {
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [percentDisplay, setPercentDisplay] = useState(isUpdating ? 12 : 55);

  useEffect(() => {
    // 1. Fade in screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // 2. Continuous pulse for the glowing brand halo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();

    // 3. Smooth icon rotation if updating
    if (isUpdating) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      ).start();

      // Progressive progress simulation (0 to 95%)
      Animated.timing(progressAnim, {
        toValue: 0.95,
        duration: 3200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Percentage counter interval
      const interval = setInterval(() => {
        setPercentDisplay((prev) => {
          if (prev >= 98) {
            clearInterval(interval);
            return 98;
          }
          const step = Math.floor(Math.random() * 8) + 3;
          return Math.min(prev + step, 98);
        });
      }, 250);

      return () => clearInterval(interval);
    } else {
      // Normal boot progress simulation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start();

      const interval = setInterval(() => {
        setPercentDisplay((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return Math.min(prev + 15, 100);
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isUpdating]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Dynamic titles and subtitles
  const mainTitle = statusText || (isUpdating ? 'নতুন সিস্টেম আপডেট হচ্ছে...' : 'স্টকহুইস্ক ইআরপি চালু হচ্ছে...');
  const helperText = subText || (isUpdating 
    ? 'লেটেস্ট সিকিউরিটি প্যাচ ও নতুন ফিচার ইন্সটল হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন' 
    : 'ক্লাউড ডেটাবেজ ও অফলাইন ক্যাশ সিঙ্ক হচ্ছে...');

  return (
    <Animated.View style={[styles.rootContainer, { opacity: fadeAnim }]}>
      {/* Background Decorative Ambient Circles */}
      <View style={styles.ambientCircleTop} />
      <View style={styles.ambientCircleBottom} />

      <View style={styles.contentWrapper}>
        {/* Brand Icon with Pulsing Halo */}
        <View style={styles.brandIconWrapper}>
          <Animated.View
            style={[
              styles.glowHalo,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/splash-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          {isUpdating && (
            <Animated.View style={[styles.updateBadge, { transform: [{ rotate: spin }] }]}>
              <MaterialCommunityIcons name="sync" size={18} color="#ffffff" />
            </Animated.View>
          )}
        </View>

        {/* Brand Typography */}
        <Text style={styles.brandTitle}>StockWhisk</Text>
        <Text style={styles.brandSubtitle}>ENTERPRISE CLOUD POS & RETAIL</Text>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusHeading}>{mainTitle}</Text>
          </View>

          <Text style={styles.statusSubtext}>{helperText}</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth,
                  backgroundColor: isUpdating ? '#0284c7' : '#4f46e5',
                },
              ]}
            />
          </View>

          <View style={styles.progressInfoRow}>
            <Text style={styles.progressPercentText}>{percentDisplay}% সম্পন্ন</Text>
            <Text style={styles.progressStateText}>
              {isUpdating ? 'ডাউনলোড ও ইনস্টল' : 'ডাটাবেজ কানেকশন প্রস্তুত'}
            </Text>
          </View>
        </View>

        {/* Bottom Security / Trust Footer */}
        <View style={styles.footerContainer}>
          <View style={styles.securityBadge}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#10b981" />
            <Text style={styles.securityText}>এনক্রিপ্টেড ক্লাউড সিঙ্ক • নিরাপদ কানেকশন</Text>
          </View>
          <Text style={styles.versionText}>StockWhisk v1.0.0 (Official Build)</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070a13',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
  ambientCircleTop: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  ambientCircleBottom: {
    position: 'absolute',
    bottom: -100,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  contentWrapper: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  brandIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  glowHalo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(2, 132, 199, 0.22)',
  },
  logoContainer: {
    width: 104,
    height: 104,
    borderRadius: 26,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  logoImage: {
    width: 72,
    height: 72,
  },
  updateBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284c7',
    borderWidth: 2.5,
    borderColor: '#070a13',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 2,
    marginBottom: 28,
    textAlign: 'center',
  },
  statusCard: {
    width: '100%',
    backgroundColor: '#0e1626',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  statusHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressInfoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  progressStateText: {
    fontSize: 11,
    color: '#64748b',
  },
  footerContainer: {
    marginTop: 36,
    alignItems: 'center',
    gap: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  securityText: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '600',
  },
  versionText: {
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.5,
  },
});
