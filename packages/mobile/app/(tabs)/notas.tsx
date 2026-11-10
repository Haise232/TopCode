import { useEffect } from 'react'
import { colores } from '../../src/lib/tema'
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
        <ActivityIndicator color={colores.primaryLight} />
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
  container: { flex: 1, backgroundColor: colores.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colores.bg, justifyContent: 'center', alignItems: 'center' },
  empty: { color: colores.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colores.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colores.border, marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  materia: { color: colores.primaryLight, fontWeight: '700', fontSize: 15 },
  tema: { color: colores.textSecondary, fontSize: 13, marginTop: 2 },
  media: { color: colores.primary, fontSize: 28, fontWeight: '700' },
  detailRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  detail: { color: colores.textMuted, fontSize: 12 },
})
