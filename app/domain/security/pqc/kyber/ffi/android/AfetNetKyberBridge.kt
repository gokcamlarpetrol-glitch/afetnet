// @afetnet: Android Kotlin bridge for Kyber1024 post-quantum key exchange
// Provides safe interface to Rust Kyber implementation

package com.afetnet.bridge.kyber

object AfetNetKyberBridge {

    // @afetnet: Load native library
    init {
        System.loadLibrary("afetnet_kyber")
    }

    // @afetnet: Generate Kyber1024 keypair
    @JvmStatic
    external fun generateKeypair(): String?

    // @afetnet: Encapsulate shared secret
    @JvmStatic
    external fun encapsulate(publicKeyHex: String): String?

    // @afetnet: Decapsulate shared secret
    @JvmStatic
    external fun decapsulate(secretKeyHex: String, ciphertextHex: String): String?

    // @afetnet: Free native string
    @JvmStatic
    external fun freeString(s: String?)
}


























