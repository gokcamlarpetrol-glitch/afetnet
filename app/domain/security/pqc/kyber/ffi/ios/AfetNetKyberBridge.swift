// @afetnet: iOS Swift bridge for Kyber1024 post-quantum key exchange
// Provides safe interface to Rust Kyber implementation

import Foundation

@objc(AfetNetKyberBridge)
public class AfetNetKyberBridge: NSObject {

    // @afetnet: Generate Kyber1024 keypair
    @objc static func generateKeypair() -> String? {
        // Call Rust function via bridging header
        let resultPtr = kyber_generate_keypair()

        guard let resultPtr = resultPtr else {
            NSLog("Failed to generate Kyber keypair")
            return nil
        }

        let result = String(cString: resultPtr)
        free_string(resultPtr)

        return result
    }

    // @afetnet: Encapsulate shared secret
    @objc static func encapsulate(publicKeyHex: String) -> String? {
        let publicKeyCStr = publicKeyHex.cString(using: .utf8)

        guard let publicKeyCStr = publicKeyCStr else {
            NSLog("Invalid public key string")
            return nil
        }

        let resultPtr = kyber_encapsulate(publicKeyCStr)

        guard let resultPtr = resultPtr else {
            NSLog("Failed to encapsulate")
            return nil
        }

        let result = String(cString: resultPtr)
        free_string(resultPtr)

        return result
    }

    // @afetnet: Decapsulate shared secret
    @objc static func decapsulate(secretKeyHex: String, ciphertextHex: String) -> String? {
        let secretKeyCStr = secretKeyHex.cString(using: .utf8)
        let ciphertextCStr = ciphertextHex.cString(using: .utf8)

        guard let secretKeyCStr = secretKeyCStr, let ciphertextCStr = ciphertextCStr else {
            NSLog("Invalid input strings")
            return nil
        }

        let resultPtr = kyber_decapsulate(secretKeyCStr, ciphertextCStr)

        guard let resultPtr = resultPtr else {
            NSLog("Failed to decapsulate")
            return nil
        }

        let result = String(cString: resultPtr)
        free_string(resultPtr)

        return result
    }
}















