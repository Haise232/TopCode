import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useActividades, useDataInit } from '@topcode/shared'
import { useAuth } from '../../src/contexts/AuthContext'

export default function ActividadesScreen() {
  const { usuario } = useAuth()
  const { actividades, estados, loading, init, toggleEstado } = useActividades({ usuarioId: usuario?.id })

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
      data={actividades}
      keyExtractor={a => a.id}
      ListEmptyComponent={<Text style={styles.empty}>No hay actividades pendientes</Text>}
      renderItem={({ item }) => {
        const completada = estados[item.id] ?? false
        return (
          <TouchableOpacity
            style={[styles.card, completada && styles.cardDone]}
            onPress={() => toggleEstado(item.id, completada)}
          >
            <View style={styles.row}>
              <View style={[styles.check, completada && styles.checkDone]}>
                {completada && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.body}>
                <Text style={[styles.titulo, completada && styles.tituloDone]}>{item.titulo}</Text>
                {item.materia && <Text style={styles.materia}>{item.materia}</Text>}
                <Text style={styles.fecha}>{item.fecha_entrega.slice(0, 10)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      }}
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
  cardDone: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#374151',
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  checkDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  body: { flex: 1 },
  titulo: { color: '#e5e7eb', fontSize: 15, fontWeight: '600' },
  tituloDone: { textDecorationLine: 'line-through', color: '#6b7280' },
  materia: { color: '#8ff5d6', fontSize: 12, marginTop: 2 },
  fecha: { color: '#6b7280', fontSize: 12, marginTop: 4 },
})
