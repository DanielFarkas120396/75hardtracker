import { CHALLENGE_LENGTH } from '@logic/constants'
import { StyleSheet, Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Companion</Text>
      <Text style={styles.text}>{`${CHALLENGE_LENGTH} days`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16110e' },
  title: { color: '#f9f3ea', fontSize: 28 },
  text: { color: '#f9f3ea', fontSize: 17 },
})
