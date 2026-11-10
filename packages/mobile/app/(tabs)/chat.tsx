import { useState, useRef, useEffect } from 'react'
import { colores } from '../../src/lib/tema'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { usePublicMensajes } from '@topcode/shared'
import { useAuth } from '../../src/contexts/AuthContext'

export default function ChatScreen() {
  const { usuario } = useAuth()
  const { mensajes, loading, enviar, emitirTyping } = usePublicMensajes()
  const [texto, setTexto] = useState('')
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    if (mensajes.length > 0) listRef.current?.scrollToEnd({ animated: true })
  }, [mensajes.length])

  async function handleSend() {
    if (!texto.trim() || !usuario) return
    const t = texto
    setTexto('')
    const { error } = await enviar(t, usuario.id, usuario.nombre)
    if (error) setTexto(prev => prev || t)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={mensajes.filter(m => !m.eliminado)}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMe = item.usuario_id === usuario?.id
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && <Text style={styles.autor}>{item.autor}</Text>}
              <Text style={styles.texto}>{item.texto}</Text>
            </View>
          )
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={t => { setTexto(t); if (usuario) emitirTyping(usuario.nombre) }}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colores.textMuted}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.bg },
  list: { padding: 12, paddingBottom: 8 },
  bubble: {
    maxWidth: '80%', borderRadius: 16, padding: 10, marginBottom: 6,
  },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colores.primaryDark },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.border },
  autor: { fontSize: 11, color: colores.primaryLight, marginBottom: 2, fontWeight: '600' },
  texto: { color: colores.text, fontSize: 15 },
  inputRow: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: colores.border, backgroundColor: colores.surface2, alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: colores.surface, borderRadius: 12, padding: 10,
    color: colores.text, maxHeight: 120, fontSize: 15, marginRight: 8,
  },
  sendBtn: { backgroundColor: colores.primary, borderRadius: 12, padding: 10, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontSize: 18 },
})
