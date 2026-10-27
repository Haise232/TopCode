import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { ActivityIndicator, View } from 'react-native'

export default function TabsLayout() {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f0a' }}>
        <ActivityIndicator color="#8ff5d6" size="large" />
      </View>
    )
  }

  if (!usuario) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#111812', borderTopColor: '#1e2d1e' },
        tabBarActiveTintColor: '#8ff5d6',
        tabBarInactiveTintColor: '#6b7280',
        headerStyle: { backgroundColor: '#111812' },
        headerTintColor: '#e5e7eb',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="notas" options={{ title: 'Notas' }} />
      <Tabs.Screen name="actividades" options={{ title: 'Tareas' }} />
    </Tabs>
  )
}
