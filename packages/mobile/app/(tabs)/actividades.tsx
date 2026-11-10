import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { colores } from '../../src/lib/tema'
import { useActividades, useDataInit } from '@topcode/shared'
import { useAuth } from '../../src/contexts/AuthContext'

export default function ActividadesScreen() {
  const { usuario } = useAuth()
  const { actividades, estados, loading, init, toggleEstado } = useActividades({ usuarioId: usuario?.id })

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
  container: { flex: 1, backgroundColor: colores.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colores.bg, justifyContent: 'center', alignItems: 'center' },
  empty: { color: colores.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colores.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colores.border, marginBottom: 10,
  },
  cardDone: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colores.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  checkDone: { backgroundColor: colores.primary, borderColor: colores.primary },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  body: { flex: 1 },
  titulo: { color: colores.text, fontSize: 15, fontWeight: '600' },
  tituloDone: { textDecorationLine: 'line-through', color: colores.textMuted },
  materia: { color: colores.primaryLight, fontSize: 12, marginTop: 2 },
  fecha: { color: colores.textMuted, fontSize: 12, marginTop: 4 },
})
