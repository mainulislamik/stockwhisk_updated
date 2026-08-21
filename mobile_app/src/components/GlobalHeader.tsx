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
} from 'react-native';
import { useTheme, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { api } from '../api';

export default function GlobalHeader() {
  const { user, billing, logout } = useAuth();
  const { isDarkMode, toggleDarkMode, language, toggleLanguage } = usePreferences();
  const isBN = language === 'BN';
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

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

  const handleLogout = () => {
    Alert.alert(
      isBN ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout',
      isBN ? 'আপনি কি নিশ্চিত যে লগআউট করতে চান?' : 'Are you sure you want to log out?',
      [
        { text: isBN ? 'বাতিল' : 'Cancel', style: 'cancel' },
        {
          text: isBN ? 'লগআউট' : 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const shopInitial = user?.shop_name ? user.shop_name.charAt(0).toUpperCase() : 'S';
  const shopCode = (user as any)?.shop_code || `SW-${1000 + ((user as any)?.shop || 0)}`;

  return (
    <View style={styles.container}>
      <Surface
        style={[
          styles.headerSurface,
          {
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: isDarkMode ? '#1e293b' : '#e2e8f0',
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
            <View style={[styles.avatarBox, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
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
                style={[
                  styles.shopTitle,
                  { color: isDarkMode ? '#f8fafc' : '#0f172a' },
                ]}
              >
                {user?.shop_name || (isBN ? 'আমার দোকান' : 'My Shop')}
              </Text>

              <View style={styles.badgesRow}>
                {/* Shop Code */}
                <View
                  style={[
                    styles.shopCodeBadge,
                    { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff' },
                  ]}
                >
                  <Text style={[styles.shopCodeText, { color: isDarkMode ? '#93c5fd' : '#2563eb' }]}>
                    {shopCode}
                  </Text>
                </View>

                {/* Plan Badge */}
                {billing?.state === 'paid' ? (
                  <View style={[styles.planBadge, { backgroundColor: '#ea580c' }]}>
                    <MaterialCommunityIcons name="check-decagram" size={10} color="#fff" style={{ marginRight: 2 }} />
                    <Text style={styles.planText}>PRO</Text>
                  </View>
                ) : billing?.state === 'free' ? (
                  <View style={[styles.planBadge, { backgroundColor: '#10b981' }]}>
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
              style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
              accessibilityLabel="Toggle Theme"
            >
              <MaterialCommunityIcons
                name={isDarkMode ? 'weather-sunny' : 'weather-night'}
                size={18}
                color={isDarkMode ? '#fbbf24' : '#64748b'}
              />
            </TouchableOpacity>

            {/* Language Switcher Pill */}
            <TouchableOpacity
              onPress={toggleLanguage}
              style={[styles.langPill, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
            >
              <Text
                style={[
                  styles.langOption,
                  language === 'BN' && styles.langOptionActive,
                  language === 'BN' && { backgroundColor: '#4f46e5', color: '#ffffff' },
                ]}
              >
                BN
              </Text>
              <Text
                style={[
                  styles.langOption,
                  language === 'EN' && styles.langOptionActive,
                  language === 'EN' && { backgroundColor: '#4f46e5', color: '#ffffff' },
                ]}
              >
                EN
              </Text>
            </TouchableOpacity>

            {/* Contact Support */}
            <TouchableOpacity
              onPress={() => setContactMenuVisible(true)}
              style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
            >
              <MaterialCommunityIcons name="headset" size={18} color={isDarkMode ? '#94a3b8' : '#475569'} />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
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
              style={[styles.iconButton, { backgroundColor: isDarkMode ? '#2d1515' : '#fef2f2' }]}
            >
              <MaterialCommunityIcons name="logout-variant" size={18} color="#ef4444" />
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
            style={[styles.modalCard, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="headset" size={20} color="#3b82f6" style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                {isBN ? 'সাপোর্ট ও যোগাযোগ' : 'Support & Assistance'}
              </Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 14 }}>
              {isBN ? 'যেকোনো সহায়তার জন্য আমরা প্রস্তুত।' : 'We are here to assist you anytime.'}
            </Text>

            <TouchableOpacity
              style={[styles.contactRow, { backgroundColor: '#064e3b' }]}
              onPress={() => {
                setContactMenuVisible(false);
                Linking.openURL('https://wa.me/8801613511887');
              }}
            >
              <MaterialCommunityIcons name="whatsapp" size={20} color="#34d399" style={{ marginRight: 10 }} />
              <View>
                <Text style={{ color: '#a7f3d0', fontSize: 10 }}>WhatsApp / Hotline</Text>
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>+8801613511887</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactRow, { backgroundColor: '#1e3a8a', marginTop: 8 }]}
              onPress={() => {
                setContactMenuVisible(false);
                Linking.openURL('mailto:admin@stockwhisk.com');
              }}
            >
              <MaterialCommunityIcons name="email-outline" size={20} color="#93c5fd" style={{ marginRight: 10 }} />
              <View>
                <Text style={{ color: '#bfdbfe', fontSize: 10 }}>Email</Text>
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
    gap: 5,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
