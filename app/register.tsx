import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function RegisterScreen() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('driver'); // Default role
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Store user profile with role in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        role: selectedRole,
        createdAt: new Date().toISOString(),
      });
      
      Alert.alert('Success', 'Registration successful!');
      router.replace(`/${selectedRole}` as any);
      
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const themeColor = '#3b82f6';

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: themeColor }]}>
              Create Account
            </Text>
            <Text style={styles.subtitle}>Join LifeRoute today</Text>
          </View>

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>I am a:</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity 
                style={[styles.roleBtn, selectedRole === 'driver' && styles.roleBtnActive, { borderColor: '#22c55e' }]}
                onPress={() => setSelectedRole('driver')}
              >
                <Text style={[styles.roleBtnText, selectedRole === 'driver' && { color: '#22c55e' }]}>Driver</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.roleBtn, selectedRole === 'police' && styles.roleBtnActive, { borderColor: '#3b82f6' }]}
                onPress={() => setSelectedRole('police')}
              >
                <Text style={[styles.roleBtnText, selectedRole === 'police' && { color: '#3b82f6' }]}>Police</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.roleBtn, selectedRole === 'admin' && styles.roleBtnActive, { borderColor: '#f59e0b' }]}
                onPress={() => setSelectedRole('admin')}
              >
                <Text style={[styles.roleBtnText, selectedRole === 'admin' && { color: '#f59e0b' }]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <TouchableOpacity 
            style={[styles.registerBtn, { backgroundColor: themeColor }]} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>Register</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login' as any)}>
              <Text style={[styles.footerLink, { color: themeColor }]}>Log In</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleLabel: {
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '600',
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  roleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  roleBtnText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  registerBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 10,
  },
  backBtnText: {
    color: '#64748b',
    fontSize: 14,
  }
});
