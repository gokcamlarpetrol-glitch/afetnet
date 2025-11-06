// @afetnet: iOS Swift bridge for Dilithium5 post-quantum digital signatures
// Provides safe interface to Rust Dilithium implementation

import Foundation

@objc(AfetNetDilithiumBridge)
public class AfetNetDilithiumBridge: NSObject {

    // @afetnet: Generate Dilithium5 keypair
    @objc static func generateKeypair() -> String? {
        let resultPtr = dilithium_generate_keypair()

        guard let resultPtr = resultPtr else {
            NSLog("Failed to generate Dilithium keypair")
            return nil
        }

        let result = String(cString: resultPtr)
        free_string(resultPtr)

        return result
    }

    // @afetnet: Sign message using Dilithium5
    @objc static func sign(secretKeyHex: String, message: String) -> String? {
        let secretKeyCStr = secretKeyHex.cString(using: .utf8)
        let messageCStr = message.cString(using: .utf8)

        guard let secretKeyCStr = secretKeyCStr, let messageCStr = messageCStr else {
            NSLog("Invalid input strings")
            return nil
        }

        let resultPtr = dilithium_sign(secretKeyCStr, messageCStr)

        guard let resultPtr = resultPtr else {
            NSLog("Failed to sign message")
            return nil
        }

        let result = String(cString: resultPtr)
        free_string(resultPtr)

        return result
    }

    // @afetnet: Verify Dilithium5 signature
    @objc static func verify(publicKeyHex: String, message: String, signatureHex: String) -> Bool {
        let publicKeyCStr = publicKeyHex.cString(using: .utf8)
        let messageCStr = message.cString(using: .utf8)
        let signatureCStr = signatureHex.cString(using: .utf8)

        guard let publicKeyCStr = publicKeyCStr,
              let messageCStr = messageCStr,
              let signatureCStr = signatureCStr else {
            NSLog("Invalid input strings")
            return false
        }

        return dilithium_verify(publicKeyCStr, messageCStr, signatureCStr)
    }
}

























