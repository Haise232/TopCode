import { Tabs, Redirect } from 'expo-router'
import { colores } from '../../src/lib/tema'
import { useAuth } from '../../src/contexts/AuthContext'
import { ActivityIndicator, View } from 'react-native'

export default function TabsLayout() {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colores.bg }}>
        <ActivityIndicator color={colores.primaryLight} size="large" />
      </View>
    )
  }

  if (!usuario) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: colores.surface, borderTopColor: colores.border },
        tabBarActiveTintColor: colores.primaryLight,
        tabBarInactiveTintColor: colores.textMuted,
        headerStyle: { backgroundColor: colores.surface },
        headerTintColor: colores.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="notas" options={{ title: 'Notas' }} />
      <Tabs.Screen name="actividades" options={{ title: 'Tareas' }} />
    </Tabs>
  )
}
