import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  Linking,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTheme, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { api } from '../api';
import { AppColors } from '../constants/theme';

export default function GlobalHeader() {
  const { user, billing, logout } = useAuth();
  const { isDarkMode, toggleDarkMode, language, toggleLanguage } = usePreferences();
  const isBN = language === 'BN';
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 400;

  const [contactMenuVisible, setContactMenuVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/notifications/?unread=1&page_size=1');
      if (res.data) {
        setUnreadCount(typeof res.data.count === 'number' ? res.data.count : (res.data.results?.length || 0));
      }
    } catch (e) {
      // ignore
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmText = isBN ? 'আপনি কি নিশ্চিত যে লগআউট করতে চান?' : 'Are you sure you want to log out?';
      if (typeof window !== 'undefined' && window.confirm(confirmText)) {
        await logout();
      }
    } else {
      Alert.alert(
        isBN ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout',
        isBN ? 'আপনি কি নিশ্চিত যে লগআউট করতে চান?' : 'Are you sure you want to log out?',
        [
          { text: isBN ? 'বাতিল' : 'Cancel', style: 'cancel' },
          {
            text: isBN ? 'লগআউট' : 'Logout',
            style: 'destructive',
            onPress: () => logout(),
          },
        ]
      );
    }
  };

  const shopCode = (user as any)?.shop_code || `SW-${1000 + ((user as any)?.shop || 0)}`;

  return (
    <View style={styles.container}>
      <Surface
        style={[
          styles.headerSurface,
          {
            backgroundColor: isDarkMode ? AppColors.dark.surface : AppColors.light.surface,
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: isDarkMode ? AppColors.dark.border : AppColors.light.border,
          },
        ]}
        elevation={2}
      >
        <View style={styles.contentRow}>
          {/* Left: Shop Logo & Info */}
          <TouchableOpacity
            style={styles.shopInfo}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
          >
            {/* Avatar / Logo */}
            <View style={[styles.avatarBox, { backgroundColor: isDarkMode ? AppColors.dark.surfaceVariant : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
              {(user as any)?.shop_logo ? (
                <Image
                  source={{
                    uri: (user as any).shop_logo.startsWith('http')
                      ? (user as any).shop_logo
                      : `https://stockwhisk.com${(user as any).shop_logo.startsWith('/') ? '' : '/'}${(user as any).shop_logo}`,
                  }}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={require('../../assets/logo.png')}
                  style={[styles.logoImage, { width: '90%', height: '90%' }]}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Shop Details */}
            <View style={styles.textContainer}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.shopTitle,
                  { color: isDarkMode ? AppColors.dark.textPrimary : AppColors.light.textPrimary, fontSize: isSmallScreen ? 14 : 15 },
                ]}
              >
                {user?.shop_name || (isBN ? 'আমার দোকান' : 'My Shop')}
              </Text>

              <View style={styles.badgesRow}>
                {/* Shop Code */}
                <View
                  style={[
                    styles.shopCodeBadge,
                    { backgroundColor: isDarkMode ? AppColors.primaryBgDark : AppColors.primaryBgLight },
                  ]}
                >
                  <Text style={[styles.shopCodeText, { color: isDarkMode ? AppColors.primaryAccent : AppColors.primary }]}>
                    {shopCode}
                  </Text>
                </View>

                {/* Plan Badge */}
                {billing?.state === 'paid' ? (
                  <View style={[styles.planBadge, { backgroundColor: AppColors.primary }]}>
                    <MaterialCommunityIcons name="check-decagram" size={10} color="#fff" style={{ marginRight: 2 }} />
                    <Text style={styles.planText}>PRO</Text>
                  </View>
                ) : billing?.state === 'free' ? (
                  <View style={[styles.planBadge, { backgroundColor: AppColors.success }]}>
                    <MaterialCommunityIcons name="gift" size={10} color="#fff" style={{ marginRight: 2 }} />
                    <Text style={styles.planText}>FREE</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          {/* Right: Actions */}
          <View style={styles.actionsRow}>
            {/* Dark/Light Mode */}
            <TouchableOpacity
              onPress={toggleDarkMode}
              style={[styles.iconButton, { backgroundColor: isDarkMode ? AppColors.dark.surfaceVariant : AppColors.light.background }]}
              accessibilityLabel="Toggle Theme"
            >
              <MaterialCommunityIcons
                name={isDarkMode ? 'weather-sunny' : 'weather-night'}
                size={18}
                color={isDarkMode ? '#fbbf24' : '#64748b'}
              />
            </TouchableOpacity>

            {/* Language Switcher Pill */}
            <View style={[styles.langPill, { backgroundColor: isDarkMode ? AppColors.dark.surfaceVariant : AppColors.light.surfaceVariant }]}>
              <TouchableOpacity
                onPress={() => { if (language !== 'BN') toggleLanguage(); }}
                activeOpacity={0.7}
                style={[
                  styles.langOption,
                  language === 'BN' && { backgroundColor: AppColors.primary }
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: language === 'BN' ? '#ffffff' : '#64748b' }}>
                  BN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (language !== 'EN') toggleLanguage(); }}
                activeOpacity={0.7}
                style={[
                  styles.langOption,
                  language === 'EN' && { backgroundColor: AppColors.primary }
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: language === 'EN' ? '#ffffff' : '#64748b' }}>
                  EN
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contact Support */}
            {!isSmallScreen && (
              <TouchableOpacity
                onPress={() => setContactMenuVisible(true)}
                style={[styles.iconButton, { backgroundColor: isDarkMode ? AppColors.dark.surfaceVariant : AppColors.light.background }]}
              >
                <MaterialCommunityIcons name="headset" size={18} color={isDarkMode ? '#94a3b8' : '#475569'} />
              </TouchableOpacity>
            )}

            {/* Notifications */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={[styles.iconButton, { backgroundColor: isDarkMode ? AppColors.dark.surfaceVariant : AppColors.light.background }]}
            >
              <MaterialCommunityIcons name="bell-outline" size={18} color={isDarkMode ? '#94a3b8' : '#475569'} />
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.iconButton, { backgroundColor: isDarkMode ? AppColors.dangerBgDark : AppColors.dangerBgLight }]}
            >
              <MaterialCommunityIcons name="logout-variant" size={18} color={AppColors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </Surface>

      {/* Contact Support Modal */}
      <Modal
        visible={contactMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setContactMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setContactMenuVisible(false)}
        >
          <View
            style={[styles.modalCard, { backgroundColor: isDarkMode ? AppColors.dark.surface : AppColors.light.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="headset" size={20} color={AppColors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: isDarkMode ? AppColors.dark.textPrimary : AppColors.light.textPrimary }]}>
                {isBN ? 'সাপোর্ট ও যোগাযোগ' : 'Support & Assistance'}
              </Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 14 }}>
              {isBN ? 'যেকোনো সহায়তার জন্য আমরা প্রস্তুত।' : 'We are here to assist you anytime.'}
            </Text>

            <TouchableOpacity
              style={[styles.contactRow, { backgroundColor: isDarkMode ? '#052e16' : '#166534' }]}
              onPress={() => {
                setContactMenuVisible(false);
                Linking.openURL('https://wa.me/8801613511887');
              }}
            >
              <MaterialCommunityIcons name="whatsapp" size={20} color="#34d399" style={{ marginRight: 10 }} />
              <View>
                <Text style={{ color: '#a7f3d0', fontSize: 10 }}>WhatsApp / Hotline</Text>
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>+880****1887</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactRow, { backgroundColor: isDarkMode ? '#1e1b4b' : '#312e81', marginTop: 8 }]}
              onPress={() => {
                setContactMenuVisible(false);
                Linking.openURL('mailto:admin@stockwhisk.com');
              }}
            >
              <MaterialCommunityIcons name="email-outline" size={20} color="#c7d2fe" style={{ marginRight: 10 }} />
              <View>
                <Text style={{ color: '#c7d2fe', fontSize: 10 }}>Email</Text>
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>admin@stockwhisk.com</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
  },
  headerSurface: {
    width: '100%',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 6,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  shopTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  shopCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shopCodeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  planText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  langPill: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 2,
  },
  langOption: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
  },
  langOptionActive: {
    overflow: 'hidden',
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactRow: {
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
