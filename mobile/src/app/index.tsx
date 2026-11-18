import { StyleSheet, Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Companion</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16110e' },
  title: { color: '#f9f3ea', fontSize: 28 },
})
