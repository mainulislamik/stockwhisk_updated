const fs = require('fs');
let c = fs.readFileSync('mobile_app/src/screens/DashboardScreen.tsx', 'utf8');
const modals = 
      {/* Notifications Modal */}
      <Modal visible={notificationsMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setNotificationsMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 100 : 60, paddingRight: 16 }} activeOpacity={1} onPressOut={() => setNotificationsMenuVisible(false)}>
          <View style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 16, width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
              <MaterialCommunityIcons name="bell" size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>Notifications</Text>
            </View>
            
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <MaterialCommunityIcons name="bell-sleep" size={32} color="#334155" style={{ marginBottom: 8 }} />
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>You have 85 unread notifications.</Text>
            </View>
            
            <TouchableOpacity 
              style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 }}
              onPress={() => setNotificationsMenuVisible(false)}
            >
              <Text style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: 12 }}>View All</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Apps Modal */}
      <Modal visible={appsMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setAppsMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 100 : 60, paddingRight: 16 }} activeOpacity={1} onPressOut={() => setAppsMenuVisible(false)}>
          <View style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 16, width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
              <MaterialCommunityIcons name="apps" size={16} color="#a855f7" style={{ marginRight: 6 }} />
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>Apps & Modules</Text>
            </View>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {['POS', 'Inventory', 'Reports', 'Settings'].map((item, i) => (
                <TouchableOpacity key={i} style={{ width: '48%', backgroundColor: '#1e293b', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name={item === 'POS' ? 'cart' : item === 'Inventory' ? 'package-variant-closed' : item === 'Reports' ? 'chart-box' : 'cog'} size={24} color="#94a3b8" style={{ marginBottom: 8 }} />
                  <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
;
c = c.replace('</Modal>', '</Modal>\n' + modals);
fs.writeFileSync('mobile_app/src/screens/DashboardScreen.tsx', c, 'utf8');
