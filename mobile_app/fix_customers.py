import re

with open('src/screens/CustomersScreen.tsx', 'r') as f:
    content = f.read()

# Find the start of the Modal section
start_idx = content.find('{/* Customer Detail & Pay Modal */}')
if start_idx == -1:
    print("Start not found")
else:
    good_content = content[:start_idx]
    
    new_modals = """{/* Customer Detail & Pay Modal */}
      <Modal visible={!!selectedCustomer} transparent animationType="fade" onRequestClose={() => { if (!paymentModalVisible) setSelectedCustomer(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => { if (!paymentModalVisible) setSelectedCustomer(null); }}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!paymentModalVisible && selectedCustomer && (
                    <View>
                      <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 12 }}>{selectedCustomer.name}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ফোন:' : 'Phone:'} {selectedCustomer.phone || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ইমেইল:' : 'Email:'} {selectedCustomer.email || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'ঠিকানা:' : 'Address:'} {selectedCustomer.address || 'N/A'}</Text>
                      <Text variant="bodyMedium" style={{ marginBottom: 4 }}>{isBN ? 'মোট ক্রয়:' : 'Total Spend:'} ৳{selectedCustomer.total_purchased || '0'}</Text>
                      <Divider style={{ marginVertical: 12 }} />
                      <Text variant="bodyLarge" style={{ color: Number(selectedCustomer.due_balance) > 0 ? '#dc2626' : undefined, fontWeight: 'bold', marginTop: 4 }}>
                        {isBN ? 'বকেয়া ব্যালেন্স:' : 'Due Balance:'} ৳{selectedCustomer.due_balance || '0'}
                      </Text>
                      {!!selectedCustomer.phone && (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                          <Button mode="contained-tonal" icon="phone" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${selectedCustomer.phone}`)}>
                            {isBN ? 'কল করুন' : 'Call'}
                          </Button>
                          <Button mode="contained" icon="whatsapp" buttonColor="#25D366" textColor="#fff" style={{ flex: 1 }} onPress={() => {
                              const digits = selectedCustomer.phone.replace(/\D/g, "");
                              const intl = digits.startsWith("880") ? digits : (digits.startsWith("01") ? `88${digits}` : digits);
                              Linking.openURL(`https://wa.me/${intl}`);
                            }}>
                            WhatsApp
                          </Button>
                        </View>
                      )}
                      <Button mode="outlined" icon="receipt" style={{ marginTop: 12 }} onPress={() => {
                          const cust = selectedCustomer;
                          setSelectedCustomer(null);
                          (navigation as any).navigate('Sales', { search: cust.phone || cust.name });
                        }}>
                        {isBN ? 'পূর্বের চালানসমূহ দেখুন' : 'View Purchase Invoices'}
                      </Button>
                      <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <Button mode="outlined" onPress={() => setSelectedCustomer(null)}>{isBN ? 'বন্ধ করুন' : 'Close'}</Button>
                        {Number(selectedCustomer.due_balance) > 0 && (
                          <Button mode="contained" buttonColor="#4f46e5" onPress={() => {
                            setAmount(selectedCustomer.due_balance);
                            setPaymentModalVisible(true);
                          }}>
                            {isBN ? 'বকেয়া গ্রহণ করুন' : 'Receive Payment'}
                          </Button>
                        )}
                      </View>
                    </View>
                  )}

                  {paymentModalVisible && selectedCustomer && (
                    <View>
                      <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>{isBN ? 'বকেয়া পেমেন্ট গ্রহণ' : 'Receive Payment'}</Text>
                      <TextInput mode="outlined" label={isBN ? 'টাকার পরিমাণ' : 'Amount'} value={amount} onChangeText={setAmount} keyboardType="numeric" style={{ marginBottom: 12, backgroundColor: theme.colors.surface }} />
                      <Text variant="labelMedium" style={{ marginBottom: 8, fontWeight: '600' }}>{isBN ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {PAYMENT_METHODS.map(m => (
                          <TouchableOpacity key={m.key} onPress={() => setMethod(m.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: method === m.key ? '#4f46e5' : '#ccc', backgroundColor: method === m.key ? '#e0e7ff' : theme.colors.surface }}>
                            <Text style={{ fontSize: 12, color: method === m.key ? '#4f46e5' : theme.colors.onSurface, fontWeight: method === m.key ? 'bold' : 'normal' }}>{m.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput mode="outlined" label={isBN ? 'নোট (ঐচ্ছিক)' : 'Note (Optional)'} value={note} onChangeText={setNote} style={{ marginBottom: 20, backgroundColor: theme.colors.surface }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <Button disabled={paying} onPress={() => setPaymentModalVisible(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                        <Button mode="contained" buttonColor="#4f46e5" loading={paying} disabled={paying} onPress={handlePayment}>{isBN ? 'জমা দিন' : 'Submit'}</Button>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Customer Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowAddModal(false)}>
            <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: 20, borderRadius: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>
                    {isBN ? 'নতুন গ্রাহক যুক্ত করুন' : 'Add New Customer'}
                  </Text>
                  <TextInput mode="outlined" label={isBN ? 'নাম *' : 'Name *'} value={newCust.name} onChangeText={(t) => setNewCust({ ...newCust, name: t })} style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'মোবাইল নম্বর' : 'Phone'} value={newCust.phone} onChangeText={(t) => setNewCust({ ...newCust, phone: t })} keyboardType="phone-pad" style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'ইমেইল' : 'Email'} value={newCust.email} onChangeText={(t) => setNewCust({ ...newCust, email: t })} keyboardType="email-address" autoCapitalize="none" style={{ marginBottom: 10, backgroundColor: theme.colors.surface }} />
                  <TextInput mode="outlined" label={isBN ? 'ঠিকানা' : 'Address'} value={newCust.address} onChangeText={(t) => setNewCust({ ...newCust, address: t })} multiline numberOfLines={2} style={{ marginBottom: 20, backgroundColor: theme.colors.surface }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    <Button disabled={addingCustomer} onPress={() => setShowAddModal(false)}>{isBN ? 'বাতিল' : 'Cancel'}</Button>
                    <Button mode="contained" buttonColor="#4f46e5" loading={addingCustomer} disabled={addingCustomer} onPress={handleAddCustomer}>{isBN ? 'যুক্ত করুন' : 'Add Customer'}</Button>
                  </View>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
"""
    with open('src/screens/CustomersScreen.tsx', 'w') as f:
        f.write(good_content + new_modals)
    print("Fixed CustomersScreen.tsx")

