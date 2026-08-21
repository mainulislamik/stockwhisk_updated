import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Appbar, Text, useTheme, FAB, TextInput, Button, Portal, Dialog, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner:   { bg: '#ede9fe', text: '#7c3aed' },
  manager: { bg: '#dbeafe', text: '#1d4ed8' },
  staff:   { bg: '#d1fae5', text: '#059669' },
  cashier: { bg: '#fef9c3', text: '#b45309' },
  default: { bg: '#f1f5f9', text: '#64748b' },
};

function getRoleStyle(role: string) {
  const key = role?.toLowerCase();
  return ROLE_COLORS[key] || ROLE_COLORS.default;
}

export default function UsersAndRolesScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const isDark = theme.dark;
  const { language } = usePreferences();
  const isBN = language === 'BN';

  const bgColor     = isDark ? '#0f172a' : '#f8fafc';
  const cardColor   = isDark ? '#1e293b' : '#ffffff';
  const textColor   = isDark ? '#f8fafc' : '#1e293b';
  const subColor    = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);

  // Add User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', first_name: '', last_name: '', phone: '', role: 'cashier', password: '' });
  const [tempPassword, setTempPassword] = useState('');

  // Role Edit State
  const [editingRole, setEditingRole] = useState<any>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        api.get('/users/').catch(() => api.get('/auth/shop-users/')),
        api.get('/roles/').catch(() => ({ data: { results: [] } })),
        api.get('/rbac/permissions/').catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data?.results || usersRes.data || []);
      setRoles(rolesRes.data?.results || rolesRes.data || []);
      setAllPermissions(permsRes.data?.results || permsRes.data || []);
    } catch (e) {
      Alert.alert('Error', 'Could not load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.first_name) {
      Alert.alert('Validation Error', 'Email and First Name are required.');
      return;
    }
    setAddingUser(true);
    try {
      const res = await api.post('/users/', newUser);
      if (res.data?.temporary_password) {
        setTempPassword(res.data.temporary_password);
        Alert.alert('Success', `User added! Temporary Password: ${res.data.temporary_password}`);
      } else {
        Alert.alert('Success', 'User added successfully!');
        setShowAddModal(false);
      }
      setNewUser({ email: '', first_name: '', last_name: '', phone: '', role: 'cashier', password: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add user.');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      isBN ? 'ইউজার মুছুন' : 'Delete User',
      isBN ? `আপনি কি ${user.first_name || user.email} কে মুছে ফেলতে চান?` : `Are you sure you want to delete ${user.first_name || user.email}?`,
      [
        { text: isBN ? 'বাতিল' : 'Cancel', style: 'cancel' },
        { 
          text: isBN ? 'মুছুন' : 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${user.id}/`);
              Alert.alert(isBN ? 'সফল' : 'Deleted', isBN ? 'ইউজার মুছে ফেলা হয়েছে।' : 'User has been removed.');
              fetchData();
            } catch (e) {
              Alert.alert('Error', isBN ? 'মুছতে ব্যর্থ হয়েছে।' : 'Failed to delete user.');
            }
          }
        }
      ]
    );
  };

  const togglePerm = (code: string) => {
    setRolePerms(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;
    setSavingRole(true);
    try {
      await api.post(`/roles/${editingRole.id}/set_permissions/`, { codes: rolePerms });
      Alert.alert(isBN ? 'সফল' : 'Success', isBN ? 'পারমিশন আপডেট হয়েছে!' : 'Permissions updated!');
      setEditingRole(null);
      fetchData();
    } catch (e) {
      Alert.alert('Error', isBN ? 'আপডেট করতে ব্যর্থ হয়েছে।' : 'Failed to update permissions.');
    } finally {
      setSavingRole(false);
    }
  };

  const groupedPerms = allPermissions.reduce((acc, p) => {
    const cat = p.category || 'Other';
    acc[cat] = acc[cat] || [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <Appbar.Header elevated={false} style={{ backgroundColor: cardColor, borderBottomWidth: 1, borderBottomColor: borderColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={textColor} />
        <Appbar.Content title={isBN ? 'ইউজার এবং রোল' : 'Users & Roles'} titleStyle={{ fontWeight: 'bold', color: textColor }} />
        <Appbar.Action icon="refresh" color={textColor} onPress={fetchData} />
      </Appbar.Header>

      <View style={{ flexDirection: 'row', margin: 16, backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 8, padding: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === 'users' ? '#4f46e5' : 'transparent', borderRadius: 6 }}
          onPress={() => setActiveTab('users')}
          activeOpacity={0.7}
        >
          <Text style={{ color: activeTab === 'users' ? '#fff' : subColor, fontWeight: 'bold' }}>{isBN ? 'স্টাফ ইউজার' : 'Staff Users'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === 'roles' ? '#4f46e5' : 'transparent', borderRadius: 6 }}
          onPress={() => setActiveTab('roles')}
          activeOpacity={0.7}
        >
          <Text style={{ color: activeTab === 'roles' ? '#fff' : subColor, fontWeight: 'bold' }}>{isBN ? 'রোল এবং পারমিশন' : 'Roles & Permissions'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {activeTab === 'users' ? (
            <>
              <View style={{ backgroundColor: '#4f46e5', borderRadius: 16, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="account-group" size={40} color="#fff" style={{ marginRight: 16 }} />
                <View>
                  <Text style={{ color: '#c7d2fe', fontSize: 13 }}>{isBN ? 'মোট ইউজার' : 'Total Users'}</Text>
                  <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>{users.length}</Text>
                </View>
              </View>

              <View style={{ backgroundColor: cardColor, borderRadius: 16, overflow: 'hidden', elevation: 2 }}>
                {users.length === 0 ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <MaterialCommunityIcons name="account-off-outline" size={48} color={subColor} style={{ marginBottom: 12 }} />
                    <Text style={{ color: subColor, fontSize: 15 }}>{isBN ? 'কোনো ইউজার পাওয়া যায়নি' : 'No users found'}</Text>
                  </View>
                ) : (
                  users.map((u: any, idx: number) => {
                    const role = u.role || u.shop_role || 'default';
                    const style = getRoleStyle(role);
                    const isLast = idx === users.length - 1;
                    return (
                      <View key={u.id || idx} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: borderColor }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: style.bg, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                          <Text style={{ fontSize: 20, fontWeight: 'bold', color: style.text }}>
                            {(u.first_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }}>{u.first_name || ''} {u.last_name || ''}</Text>
                          <Text style={{ fontSize: 13, color: subColor, marginTop: 2 }}>{u.email}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={{ backgroundColor: style.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: style.text, textTransform: 'capitalize' }}>{role}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteUser(u)}>
                            <MaterialCommunityIcons name="delete-outline" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </>
          ) : (
            <>
              {roles.length === 0 ? (
                <View style={{ backgroundColor: cardColor, borderRadius: 16, padding: 40, alignItems: 'center', elevation: 2 }}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={48} color={subColor} style={{ marginBottom: 12 }} />
                  <Text style={{ color: subColor, fontSize: 15 }}>{isBN ? 'কোনো রোল পাওয়া যায়নি' : 'No roles found'}</Text>
                </View>
              ) : (
                roles.map((r: any, idx: number) => {
                  const isEditing = editingRole?.id === r.id;

                  return (
                    <View key={r.id || idx} style={{ backgroundColor: cardColor, borderRadius: 12, marginBottom: 16, padding: 16, elevation: 1, borderWidth: 1, borderColor: borderColor }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor }}>{r.name}</Text>
                        {r.is_system && (
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#10b981', marginLeft: 8 }}>{isBN ? 'সিস্টেম' : 'System'}</Text>
                        )}
                        <View style={{ flex: 1 }} />
                        
                        {!isEditing ? (
                          <TouchableOpacity 
                            onPress={() => {
                              setEditingRole(r);
                              setRolePerms(r.permission_codes || []);
                            }}
                          >
                            <Text style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: 13 }}>{isBN ? 'পারমিশন এডিট করুন' : 'Edit Permissions'}</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={{ flexDirection: 'row' }}>
                            <Button 
                              mode="text" 
                              textColor={subColor} 
                              onPress={() => setEditingRole(null)} 
                              compact 
                              disabled={savingRole}
                            >
                              {isBN ? 'বাতিল' : 'Cancel'}
                            </Button>
                            <Button 
                              mode="contained" 
                              buttonColor="#4f46e5" 
                              onPress={handleSavePermissions} 
                              compact 
                              loading={savingRole}
                              disabled={savingRole}
                            >
                              {isBN ? 'সেভ করুন' : 'Save'}
                            </Button>
                          </View>
                        )}
                      </View>

                      {isEditing ? (
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderColor }}>
                          {Object.keys(groupedPerms).map((category, cIdx) => (
                            <View key={cIdx} style={{ marginBottom: 12 }}>
                              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4f46e5', marginBottom: 4, textTransform: 'capitalize' }}>
                                {category}
                              </Text>
                              {groupedPerms[category].map((p: any) => (
                                <View key={p.code} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                                  <Checkbox.Android
                                    status={rolePerms.includes(p.code) ? 'checked' : 'unchecked'}
                                    onPress={() => togglePerm(p.code)}
                                    color="#4f46e5"
                                  />
                                  <Text style={{ color: textColor, flex: 1, marginLeft: 4 }} onPress={() => togglePerm(p.code)}>
                                    {p.name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {r.permission_codes && r.permission_codes.length > 0 ? (
                            r.permission_codes.map((p: string, i: number) => (
                              <View key={i} style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8, marginBottom: 8 }}>
                                <Text style={{ fontSize: 12, color: textColor, fontWeight: '600' }}>{p}</Text>
                              </View>
                            ))
                          ) : (
                            <Text style={{ fontSize: 13, color: subColor, fontStyle: 'italic' }}>{isBN ? 'কোনো পারমিশন নেই' : 'No permissions assigned'}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* FAB for Adding User */}
      {activeTab === 'users' && (
        <FAB
          icon="plus"
          color="#fff"
          style={{ position: 'absolute', margin: 16, right: 0, bottom: 20, backgroundColor: '#4f46e5' }}
          onPress={() => setShowAddModal(true)}
        />
      )}

      {/* Add User Modal */}
      <Portal>
        <Dialog visible={showAddModal} onDismiss={() => setShowAddModal(false)} style={{ backgroundColor: cardColor, borderRadius: 16 }}>
          <Dialog.Title style={{ color: textColor }}>{isBN ? 'নতুন স্টাফ যুক্ত করুন' : 'Add New User'}</Dialog.Title>
          <Dialog.Content>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput label={isBN ? 'প্রথম নাম' : 'First Name'} value={newUser.first_name} onChangeText={(t) => setNewUser({...newUser, first_name: t})} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} activeOutlineColor="#4f46e5" textColor={textColor} />
              <TextInput label={isBN ? 'শেষ নাম' : 'Last Name'} value={newUser.last_name} onChangeText={(t) => setNewUser({...newUser, last_name: t})} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} activeOutlineColor="#4f46e5" textColor={textColor} />
              <TextInput label={isBN ? 'ইমেইল অ্যাড্রেস' : 'Email Address'} value={newUser.email} onChangeText={(t) => setNewUser({...newUser, email: t})} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={{ marginBottom: 12, backgroundColor: cardColor }} activeOutlineColor="#4f46e5" textColor={textColor} />
              <TextInput label={isBN ? 'ফোন (ঐচ্ছিক)' : 'Phone (Optional)'} value={newUser.phone} onChangeText={(t) => setNewUser({...newUser, phone: t})} mode="outlined" keyboardType="phone-pad" style={{ marginBottom: 12, backgroundColor: cardColor }} activeOutlineColor="#4f46e5" textColor={textColor} />
              <TextInput label={isBN ? 'রোল (যেমন: manager, cashier)' : 'Role (e.g. manager, cashier, staff)'} value={newUser.role} onChangeText={(t) => setNewUser({...newUser, role: t})} mode="outlined" style={{ marginBottom: 12, backgroundColor: cardColor }} activeOutlineColor="#4f46e5" textColor={textColor} />
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddModal(false)} textColor={subColor}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
            <Button mode="contained" onPress={handleAddUser} loading={addingUser} disabled={addingUser} buttonColor="#4f46e5" style={{ borderRadius: 8 }}>
              {isBN ? 'যুক্ত করুন' : 'Add User'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

    </View>
  );
}
