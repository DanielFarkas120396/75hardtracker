import ExpoModulesCore
import Security

/// Small values in the keychain, synced through iCloud Keychain: a new iPhone on the same
/// Apple ID gets them back with nothing to type. Holds the cloud backup's encryption key.
/// With iCloud Keychain switched off the items stay on this device only.
public class SyncedKeychainModule: Module {
  private let service = (Bundle.main.bundleIdentifier ?? "app") + ".synced"

  private func query(_ key: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
      kSecAttrSynchronizable as String: true,
    ]
  }

  public func definition() -> ModuleDefinition {
    Name("SyncedKeychain")

    AsyncFunction("setItem") { (key: String, value: String) in
      SecItemDelete(self.query(key) as CFDictionary)
      var item = self.query(key)
      item[kSecValueData as String] = Data(value.utf8)
      // Synced items can't be "this device only"; readable once the phone was unlocked after a restart.
      item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
      let status = SecItemAdd(item as CFDictionary, nil)
      guard status == errSecSuccess else {
        throw Exception(name: "ERR_KEYCHAIN", description: "Keychain write failed (\(status))")
      }
    }

    AsyncFunction("getItem") { (key: String) -> String? in
      var item = self.query(key)
      item[kSecReturnData as String] = true
      item[kSecMatchLimit as String] = kSecMatchLimitOne
      var result: AnyObject?
      let status = SecItemCopyMatching(item as CFDictionary, &result)
      if status == errSecItemNotFound { return nil }
      guard status == errSecSuccess, let data = result as? Data else {
        throw Exception(name: "ERR_KEYCHAIN", description: "Keychain read failed (\(status))")
      }
      return String(data: data, encoding: .utf8)
    }

    AsyncFunction("removeItem") { (key: String) in
      let status = SecItemDelete(self.query(key) as CFDictionary)
      guard status == errSecSuccess || status == errSecItemNotFound else {
        throw Exception(name: "ERR_KEYCHAIN", description: "Keychain delete failed (\(status))")
      }
    }
  }
}
