import { useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useHomeDatos, useDataInit } from '@topcode/shared'
import { useAuth } from '../../src/contexts/AuthContext'

export default function HomeScreen() {
  const { usuario } = useAuth()
  const { notasRecientes, proximoEvento, proximaActividad, actividadesPendientes, loading, init } = useHomeDatos(usuario?.id)

  useDataInit(init, [usuario?.id])

  function saludo() {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>{saludo()}, {usuario?.nombre?.split(' ')[0]}</Text>
      <Text style={styles.clase}>{usuario?.clase ?? 'Sin clase asignada'}</Text>

      {/* Próximo evento */}
      {proximoEvento && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Próximo evento</Text>
          <Text style={styles.cardTitle}>{proximoEvento.titulo}</Text>
          <Text style={styles.cardMeta}>{proximoEvento.fecha}</Text>
        </View>
      )}

      {/* Próxima actividad */}
      {proximaActividad && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Próxima entrega</Text>
          <Text style={styles.cardTitle}>{proximaActividad.titulo}</Text>
          <Text style={styles.cardMeta}>{proximaActividad.fecha_entrega.slice(0, 10)} · {actividadesPendientes} pendiente{actividadesPendientes !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Notas recientes */}
      {notasRecientes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimas notas</Text>
          {notasRecientes.map(n => (
            <View key={n.id} style={styles.row}>
              <Text style={styles.rowLabel}>{n.materia}</Text>
              <Text style={styles.rowValue}>{n.media.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      )}

      {loading && <Text style={styles.loading}>Cargando...</Text>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0a' },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#e5e7eb', marginBottom: 2 },
  clase: { fontSize: 13, color: '#8ff5d6', marginBottom: 20 },
  card: {
    backgroundColor: '#111812', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1e2d1e', marginBottom: 12,
  },
  cardLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  cardTitle: { fontSize: 16, color: '#e5e7eb', fontWeight: '600' },
  cardMeta: { fontSize: 13, color: '#8ff5d6', marginTop: 4 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 14, color: '#6b7280', marginBottom: 10, fontWeight: '600' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111812', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#1e2d1e', marginBottom: 6,
  },
  rowLabel: { color: '#d1d5db', fontSize: 14 },
  rowValue: { color: '#8ff5d6', fontWeight: '700', fontSize: 16 },
  loading: { color: '#6b7280', textAlign: 'center', marginTop: 20 },
})
