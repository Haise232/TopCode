import { useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useNotas, useDataInit } from '@topcode/shared'
import { useAuth } from '../../src/contexts/AuthContext'

export default function NotasScreen() {
  const { usuario } = useAuth()
  const { notas, loading, init } = useNotas({ usuarioId: usuario?.id })

  useDataInit(init, [usuario?.id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#8ff5d6" />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={notas}
      keyExtractor={n => n.id}
      ListEmptyComponent={<Text style={styles.empty}>No hay notas registradas</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.materia}>{item.materia}</Text>
              <Text style={styles.tema}>{item.tema}</Text>
            </View>
            <Text style={styles.media}>{item.media.toFixed(1)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detail}>Teórica: {item.teorica}</Text>
            <Text style={styles.detail}>Práctica: {item.practica}</Text>
          </View>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0a' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0a0f0a', justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#111812', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1e2d1e', marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  materia: { color: '#8ff5d6', fontWeight: '700', fontSize: 15 },
  tema: { color: '#d1d5db', fontSize: 13, marginTop: 2 },
  media: { color: '#22c55e', fontSize: 28, fontWeight: '700' },
  detailRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  detail: { color: '#6b7280', fontSize: 12 },
})
