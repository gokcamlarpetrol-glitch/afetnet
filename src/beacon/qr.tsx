// React import not needed for JSX in React 17+
import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

type Props = { value: unknown, size?: number };

export default function EmergencyQR({ value, size = 220 }: Props){
  const data = JSON.stringify(value);
  return (
    <View style={styles.box}>
      <QRCode value={data} size={size} backgroundColor="transparent" />
    </View>
  );
}
const styles = StyleSheet.create({
  box: { padding: 8, alignItems:"center", justifyContent:"center" }
});



