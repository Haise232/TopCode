import { useState } from 'react'
import { colores, esNavidad } from '../../src/lib/tema'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    const { error: e } = await supabase.auth.signInWithPassword({ email, password })
    if (e) setError(e.message)
    else router.replace('/(tabs)/')
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>TopCode</Text>
        <Text style={styles.subtitle}>Intranet académica</Text>
        {esNavidad && <Text style={styles.fiestas}>❄ Felices fiestas ❄</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colores.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colores.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.bg, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colores.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colores.border },
  title: { fontSize: 28, fontWeight: '700', color: colores.primaryLight, textAlign: 'center', marginBottom: 4 },
  fiestas: { fontSize: 13, color: colores.gold, textAlign: 'center', marginTop: -16, marginBottom: 20 },
  subtitle: { fontSize: 14, color: colores.textMuted, textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: colores.surface2, borderWidth: 1, borderColor: colores.border,
    borderRadius: 10, padding: 14, color: colores.text, marginBottom: 12, fontSize: 15,
  },
  error: { color: '#f87171', marginBottom: 12, fontSize: 13 },
  button: { backgroundColor: colores.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
