import { useEffect } from 'react'
import { colores, esNavidad } from '../../src/lib/tema'
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
      {esNavidad && <Text style={styles.fiestas}>❄ Felices fiestas ❄</Text>}

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
  container: { flex: 1, backgroundColor: colores.bg },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '700', color: colores.text, marginBottom: 2 },
  fiestas: { fontSize: 12, color: colores.gold, marginBottom: 12, letterSpacing: 0.5 },
  clase: { fontSize: 13, color: colores.primaryLight, marginBottom: 20 },
  card: {
    backgroundColor: colores.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colores.border, marginBottom: 12,
  },
  cardLabel: { fontSize: 11, color: colores.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  cardTitle: { fontSize: 16, color: colores.text, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: colores.primaryLight, marginTop: 4 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 14, color: colores.textMuted, marginBottom: 10, fontWeight: '600' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colores.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colores.border, marginBottom: 6,
  },
  rowLabel: { color: colores.textSecondary, fontSize: 14 },
  rowValue: { color: colores.primaryLight, fontWeight: '700', fontSize: 16 },
  loading: { color: colores.textMuted, textAlign: 'center', marginTop: 20 },
})
