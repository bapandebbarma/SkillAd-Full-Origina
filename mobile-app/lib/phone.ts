import { Linking } from "react-native";

export async function openPhoneDialer(phone: string): Promise<void> {
  await Linking.openURL(`tel:${phone}`);
}
