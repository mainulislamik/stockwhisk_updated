import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

export default function Skeleton({ style, isDark }: { style?: ViewStyle, isDark?: boolean }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[{ backgroundColor: isDark ? '#334155' : '#cbd5e1', opacity, borderRadius: 8 }, style as any]} />
  );
}
