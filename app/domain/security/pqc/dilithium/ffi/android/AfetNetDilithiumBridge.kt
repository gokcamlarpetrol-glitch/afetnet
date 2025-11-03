// @afetnet: Android Kotlin bridge for Dilithium5 post-quantum digital signatures
// Provides safe interface to Rust Dilithium implementation

package com.afetnet.bridge.dilithium

object AfetNetDilithiumBridge {

    // @afetnet: Load native library
    init {
        System.loadLibrary("afetnet_dilithium")
    }

    // @afetnet: Generate Dilithium5 keypair
    @JvmStatic
    external fun generateKeypair(): String?

    // @afetnet: Sign message using Dilithium5
    @JvmStatic
    external fun sign(secretKeyHex: String, message: String): String?

    // @afetnet: Verify Dilithium5 signature
    @JvmStatic
    external fun verify(publicKeyHex: String, message: String, signatureHex: String): Boolean

    // @afetnet: Free native string
    @JvmStatic
    external fun freeString(s: String?)
}



















