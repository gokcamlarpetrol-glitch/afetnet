// @afetnet: Kyber1024 KEM implementation for post-quantum key exchange
// Uses pqcrypto-kyber for standardized post-quantum cryptography

use pqcrypto_kyber::kyber1024;
use rand::Rng;
use hex;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn kyber_generate_keypair() -> *mut c_char {
    // @afetnet: Generate Kyber1024 keypair
    let keys = kyber1024::keypair();
    let (public_key, secret_key) = keys;

    // Encode keys as hex strings
    let public_hex = hex::encode(public_key.as_bytes());
    let secret_hex = hex::encode(secret_key.as_bytes());

    let result = format!("{}:{}", public_hex, secret_hex);
    let c_string = CString::new(result).unwrap();

    c_string.into_raw()
}

#[no_mangle]
pub extern "C" fn kyber_encapsulate(public_key_hex: *const c_char) -> *mut c_char {
    // @afetnet: Encapsulate shared secret using public key
    let c_str = unsafe { CStr::from_ptr(public_key_hex) };
    let public_hex = c_str.to_str().unwrap_or("");

    // Decode public key
    let public_key_bytes = hex::decode(public_hex).unwrap_or_default();
    let public_key = kyber1024::PublicKey::from_bytes(&public_key_bytes).unwrap_or_default();

    // Generate shared secret
    let (shared_secret, ciphertext) = kyber1024::encapsulate(&public_key);

    let shared_hex = hex::encode(shared_secret.as_bytes());
    let ciphertext_hex = hex::encode(ciphertext.as_bytes());

    let result = format!("{}:{}", shared_hex, ciphertext_hex);
    let c_string = CString::new(result).unwrap();

    c_string.into_raw()
}

#[no_mangle]
pub extern "C" fn kyber_decapsulate(secret_key_hex: *const c_char, ciphertext_hex: *const c_char) -> *mut c_char {
    // @afetnet: Decapsulate shared secret using secret key
    let c_str_secret = unsafe { CStr::from_ptr(secret_key_hex) };
    let secret_hex = c_str_secret.to_str().unwrap_or("");

    let c_str_cipher = unsafe { CStr::from_ptr(ciphertext_hex) };
    let cipher_hex = c_str_cipher.to_str().unwrap_or("");

    // Decode keys
    let secret_key_bytes = hex::decode(secret_hex).unwrap_or_default();
    let ciphertext_bytes = hex::decode(cipher_hex).unwrap_or_default();

    let secret_key = kyber1024::SecretKey::from_bytes(&secret_key_bytes).unwrap_or_default();
    let ciphertext = kyber1024::Ciphertext::from_bytes(&ciphertext_bytes).unwrap_or_default();

    // Decapsulate
    let shared_secret = kyber1024::decapsulate(&ciphertext, &secret_key);

    let shared_hex = hex::encode(shared_secret.as_bytes());
    let c_string = CString::new(shared_hex).unwrap();

    c_string.into_raw()
}

#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    // @afetnet: Free C string allocated by Rust
    unsafe {
        if s.is_null() { return; }
        CString::from_raw(s);
    }
}


























