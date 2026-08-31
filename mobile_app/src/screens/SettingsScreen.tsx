import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Linking, Image } from 'react-native';
import { Appbar, Text, ActivityIndicator, useTheme, TextInput, Button, Switch } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { user, loadUser } = useAuth();
  const { language, printerWidth, setPrinterWidth } = usePreferences();
  const isBN = language === 'BN';
  
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);

  // Modernize: Use hooks for permissions
  const [permissionResponse, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [shopForm, setShopForm] = useState({ 
    name: '', phone: '', address: '', currency: 'BDT', 
    vat_enabled: false, vat_percent: '0',
    emi_enabled: false, delivery_enabled: true,
    whatsapp_invoice_enabled: true, barcode_prefix: '', offline_sale_mode: false,
    service_enabled: true, reports_enabled: true, finance_enabled: true,
    logo: ''
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (user) {
        setProfileForm({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          phone: (user as any).phone || ''
        });
      }
      
      const res = await api.get('/auth/shop-settings/');
      setShopForm({
        name: res.data.name || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        currency: res.data.currency || 'BDT',
        // Strictly cast to boolean to prevent Android crashes with Switch
        vat_enabled: !!res.data.vat_enabled,
        vat_percent: (res.data.vat_percent || 0).toString(),
        emi_enabled: !!res.data.emi_enabled,
        delivery_enabled: res.data.delivery_enabled !== false,
        whatsapp_invoice_enabled: res.data.whatsapp_invoice_enabled !== false,
        barcode_prefix: res.data.barcode_prefix || '',
        offline_sale_mode: !!res.data.offline_sale_mode,
        service_enabled: res.data.service_enabled !== false,
        reports_enabled: res.data.reports_enabled !== false,
        finance_enabled: res.data.finance_enabled !== false,
        logo: res.data.logo || ''
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (file) {
          try {
            setShopSaving(true);
            const formData = new FormData();
            formData.append('logo', file);
            const res = await api.patch('/auth/shop-settings/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data && res.data.logo) {
              setShopForm(prev => ({ ...prev, logo: res.data.logo }));
              if (loadUser) await loadUser();
              Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'লোগো সফলভাবে আপডেট হয়েছে!' : 'Logo updated successfully!');
            }
          } catch (error) {
            Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'লোগো আপলোড করতে ব্যর্থ হয়েছে।' : 'Failed to upload logo');
          } finally {
            setShopSaving(false);
          }
        }
      };
      input.click();
    } else {
      try {
        let hasPermission = permissionResponse?.granted;
        if (!hasPermission) {
          const perm = await requestPermission();
          hasPermission = perm.granted;
        }

        if (!hasPermission) {
          Alert.alert(isBN ? 'অনুমতি প্রয়োজন' : 'Permission Required', isBN ? 'গ্যালারি থেকে লোগো সিলেক্ট করতে পারমিশন দিন।' : 'Media library permission is required to choose logo.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, // Modernized API
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setShopSaving(true);

          const uri = asset.uri;
          const uriParts = uri.split('.');
          const fileType = uriParts[uriParts.length - 1] || 'jpg';

          const formData = new FormData();
          formData.append('logo', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name: `shop_logo_${Date.now()}.${fileType}`,
            type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
          } as any);

          const res = await api.patch('/auth/shop-settings/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data && res.data.logo) {
            setShopForm(prev => ({ ...prev, logo: res.data.logo }));
            if (loadUser) await loadUser();
            Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'লোগো সফলভাবে আপডেট হয়েছে!' : 'Logo updated successfully!');
          }
        }
      } catch (err) {
        console.error(err);
        Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'মোবাইল থেকে লোগো আপলোড করতে সমস্যা হয়েছে।' : 'Failed to upload logo from device.');
      } finally {
        setShopSaving(false);
      }
    }
  };

  const handleDownloadBackup = async () => {
    setBackupDownloading(true);
    try {
      if (Platform.OS === 'web') {
        const res = await api.get('/backup/download/', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `shop_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } else {
        await Linking.openURL('https://stockwhisk.com/api/backup/download/');
      }
    } catch (err) {
      console.error('Backup download failed', err);
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'ব্যাকআপ ডাউনলোড করতে ব্যর্থ হয়েছে।' : 'Failed to download backup.');
    } finally {
      setBackupDownloading(false);
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await api.patch('/auth/me/', profileForm);
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveShop = async () => {
    setShopSaving(true);
    try {
      const { logo, ...restShopForm } = shopForm;
      const payload = {
        ...restShopForm,
        vat_percent: parseFloat(shopForm.vat_percent) || 0
      };
      await api.patch('/auth/shop-settings/', payload);
      await loadUser();
      Alert.alert('Success', 'Shop settings saved successfully!');
    } catch (e: any) {
      const errDetail = e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message || 'Failed to save shop settings';
      Alert.alert('Error', errDetail);
    } finally {
      setShopSaving(false);
    }
  };

  const isDarkMode = theme.dark;
  const bgColor = isDarkMode ? '#0f172a' : '#f8fafc';
  const cardColor = isDarkMode ? '#1e293b' : '#ffffff';
  const textColor = isDarkMode ? '#f8fafc' : '#1e293b';
  const subTextColor = isDarkMode ? '#94a3b8' : '#64748b';
  const borderColor = isDarkMode ? '#334155' : '#e2e8f0';
  const primaryColor = '#4f46e5';

  const CustomSwitch = ({ label, value, onValueChange, icon }: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
          <MaterialCommunityIcons name={icon} size={18} color={primaryColor} />
        </View>
        <Text style={{ fontSize: 15, color: textColor, fontWeight: '500' }}>{label}</Text>
      </View>
      <Switch value={!!value} onValueChange={onValueChange} color={primaryColor} />
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={{ fontSize: 14, fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8, marginLeft: 8 }}>
      {title}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <Appbar.Header statusBarHeight={0} elevated={false} style={{ backgroundColor: cardColor, borderBottomWidth: 1, borderBottomColor: borderColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={textColor} />
        <Appbar.Content title="সেটিংস (Settings)" titleStyle={{ fontWeight: 'bold', color: textColor }} />
        <PageGuideButton pageKey="/app/settings" />
      </Appbar.Header>
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            
            <SectionHeader title="আপনার প্রোফাইল (Profile)" />
            <View style={{ backgroundColor: cardColor, borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
              <TextInput label="First Name" value={profileForm.first_name || ''} onChangeText={(t) => setProfileForm({ ...profileForm, first_name: t })} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} />
              <TextInput label="Last Name" value={profileForm.last_name || ''} onChangeText={(t) => setProfileForm({ ...profileForm, last_name: t })} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} />
              <TextInput label="Phone Number" value={profileForm.phone || ''} onChangeText={(t) => setProfileForm({ ...profileForm, phone: t })} mode="outlined" keyboardType="phone-pad" style={{ marginBottom: 16, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} left={<TextInput.Icon icon="phone" color={subTextColor} />} />
              
              <Button mode="contained" onPress={saveProfile} loading={profileSaving} disabled={profileSaving} style={{ borderRadius: 8, paddingVertical: 4 }} buttonColor={primaryColor}>
                প্রোফাইল সেভ করুন
              </Button>
            </View>

            <SectionHeader title="শপ সেটিংস (Shop Settings)" />
            <View style={{ backgroundColor: cardColor, borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
              
              {/* Logo Uploader */}
              <View style={{ alignItems: 'center', marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                <Text style={{ fontSize: 14, color: subTextColor, marginBottom: 12 }}>Shop Logo</Text>
                <View style={{ width: 90, height: 90, backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', borderRadius: 45, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: primaryColor }}>
                  {shopForm.logo ? (
                    <Image 
                      source={{ uri: shopForm.logo.startsWith('http') ? shopForm.logo : `https://stockwhisk.com${shopForm.logo.startsWith('/') ? '' : '/'}${shopForm.logo}` }} 
                      style={{ width: '100%', height: '100%' }} 
                      resizeMode="contain"
                    />
                  ) : (
                    <MaterialCommunityIcons name="storefront" size={40} color={subTextColor} />
                  )}
                </View>
                <Button mode="outlined" onPress={handleLogoUpload} compact textColor={primaryColor} style={{ borderColor: primaryColor, borderRadius: 20 }}>
                  লোগো পরিবর্তন করুন
                </Button>
              </View>

              <TextInput label="Shop Code" value={(user as any)?.shop_code || `SW-${1000 + ((user as any)?.shop || 0)}`} mode="outlined" disabled style={{ marginBottom: 12, backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }} outlineColor={borderColor} />
              <TextInput label="Shop Name" value={shopForm.name || ''} onChangeText={(t) => setShopForm({ ...shopForm, name: t })} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} left={<TextInput.Icon icon="store" color={subTextColor} />} />
              <TextInput label="Shop Phone" value={shopForm.phone || ''} onChangeText={(t) => setShopForm({ ...shopForm, phone: t })} mode="outlined" keyboardType="phone-pad" style={{ marginBottom: 12, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} left={<TextInput.Icon icon="phone-classic" color={subTextColor} />} />
              <TextInput label="Currency" value={shopForm.currency || ''} onChangeText={(t) => setShopForm({ ...shopForm, currency: t })} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} left={<TextInput.Icon icon="cash" color={subTextColor} />} />
              <TextInput label="Address" value={shopForm.address || ''} onChangeText={(t) => setShopForm({ ...shopForm, address: t })} mode="outlined" multiline numberOfLines={3} style={{ marginBottom: 16, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} left={<TextInput.Icon icon="map-marker" color={subTextColor} />} />
              
              <TextInput label="Barcode Prefix" value={shopForm.barcode_prefix || ''} onChangeText={(t) => setShopForm({ ...shopForm, barcode_prefix: t })} mode="outlined" style={{ marginBottom: 24, backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} left={<TextInput.Icon icon="barcode" color={subTextColor} />} />
            </View>

            <SectionHeader title="মডিউল এবং ফিচার (Features)" />
            <View style={{ backgroundColor: cardColor, borderRadius: 16, paddingHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, marginBottom: 16 }}>
              <CustomSwitch label="Enable VAT/Tax" icon="receipt" value={shopForm.vat_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, vat_enabled: val })} />
              
              {shopForm.vat_enabled && (
                <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                  <TextInput label="VAT Percentage (%)" value={shopForm.vat_percent || ''} onChangeText={(t) => setShopForm({ ...shopForm, vat_percent: t })} mode="outlined" keyboardType="numeric" style={{ backgroundColor: cardColor }} outlineColor={borderColor} activeOutlineColor={primaryColor} />
                </View>
              )}

              <CustomSwitch label="Service Section (সার্ভিস ও মেরামত)" icon="tools" value={shopForm.service_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, service_enabled: val })} />
              <CustomSwitch label="Reports Section (রিপোর্ট ও পরিসংখ্যান)" icon="chart-line" value={shopForm.reports_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, reports_enabled: val })} />
              <CustomSwitch label="Finance Section (ফাইন্যান্স ও হিসাব)" icon="calculator-variant" value={shopForm.finance_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, finance_enabled: val })} />

              <CustomSwitch label="EMI Enabled" icon="credit-card-outline" value={shopForm.emi_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, emi_enabled: val })} />
              <CustomSwitch label="Delivery Enabled" icon="truck-delivery-outline" value={shopForm.delivery_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, delivery_enabled: val })} />
              <CustomSwitch label="WhatsApp Invoice" icon="whatsapp" value={shopForm.whatsapp_invoice_enabled} onValueChange={(val: boolean) => setShopForm({ ...shopForm, whatsapp_invoice_enabled: val })} />
              <View style={{ borderBottomWidth: 0 }}>
                <CustomSwitch label="Offline Sale Mode" icon="wifi-off" value={shopForm.offline_sale_mode} onValueChange={(val: boolean) => setShopForm({ ...shopForm, offline_sale_mode: val })} />
              </View>
            </View>

            <Button mode="contained" onPress={saveShop} loading={shopSaving} disabled={shopSaving} style={{ borderRadius: 8, paddingVertical: 6, marginBottom: 20 }} buttonColor={primaryColor}>
              শপ সেটিংস সেভ করুন
            </Button>

            <SectionHeader title="রিসোর্স ও ম্যানেজমেন্ট" />
            <View style={{ backgroundColor: cardColor, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, marginBottom: 24 }}>
              
              {/* Thermal Printer Paper Size */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  <MaterialCommunityIcons name="printer-pos" size={26} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, marginBottom: 2 }}>{isBN ? 'রিসিট প্রিন্টার সাইজ' : 'Thermal Printer Size'}</Text>
                  <Text style={{ fontSize: 13, color: subTextColor }}>{printerWidth === '58mm' ? '58mm (ছোট থার্মাল পেপার)' : '80mm (বড় থার্মাল পেপার)'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button
                    mode={printerWidth === '58mm' ? 'contained' : 'outlined'}
                    compact
                    onPress={() => setPrinterWidth('58mm')}
                  >
                    58mm
                  </Button>
                  <Button
                    mode={printerWidth === '80mm' ? 'contained' : 'outlined'}
                    compact
                    onPress={() => setPrinterWidth('80mm')}
                  >
                    80mm
                  </Button>
                </View>
              </View>

              {/* Video Tutorial */}
              <TouchableOpacity
                onPress={() => navigation.navigate('TutorialsScreen')}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}
                activeOpacity={0.7}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  <MaterialCommunityIcons name="play-circle-outline" size={26} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, marginBottom: 2 }}>ভিডিও টিউটোরিয়াল</Text>
                  <Text style={{ fontSize: 13, color: subTextColor }}>কিভাবে ব্যবহার করবেন শিখুন</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={subTextColor} />
              </TouchableOpacity>

              {/* Users & Roles */}
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('UsersAndRoles')}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}
                activeOpacity={0.7}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  <MaterialCommunityIcons name="account-group-outline" size={26} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, marginBottom: 2 }}>ইউজার এবং রোল</Text>
                  <Text style={{ fontSize: 13, color: subTextColor }}>স্টাফ ও পারমিশন ম্যানেজ করুন</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={subTextColor} />
              </TouchableOpacity>

              {/* Data Backup */}
              <TouchableOpacity
                onPress={handleDownloadBackup}
                disabled={backupDownloading}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
                activeOpacity={0.7}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  {backupDownloading ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <MaterialCommunityIcons name="database-arrow-down-outline" size={26} color="#2563eb" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, marginBottom: 2 }}>
                    {isBN ? 'দোকানের ডাটা ব্যাকআপ' : 'Shop Data Backup'}
                  </Text>
                  <Text style={{ fontSize: 13, color: subTextColor }}>
                    {isBN ? 'সব ডাটা JSON ফাইলে ডাউনলোড করুন' : 'Export & download complete JSON backup'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="download" size={22} color="#2563eb" />
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

