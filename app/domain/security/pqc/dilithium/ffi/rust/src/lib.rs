// @afetnet: Dilithium5 signature implementation for post-quantum digital signatures
// Uses pqcrypto-dilithium for standardized post-quantum cryptography

use pqcrypto_dilithium::dilithium5;
use hex;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn dilithium_generate_keypair() -> *mut c_char {
    // @afetnet: Generate Dilithium5 keypair
    let keys = dilithium5::keypair();
    let (public_key, secret_key) = keys;

    // Encode keys as hex strings
    let public_hex = hex::encode(public_key.as_bytes());
    let secret_hex = hex::encode(secret_key.as_bytes());

    let result = format!("{}:{}", public_hex, secret_hex);
    let c_string = CString::new(result).unwrap();

    c_string.into_raw()
}

#[no_mangle]
pub extern "C" fn dilithium_sign(secret_key_hex: *const c_char, message: *const c_char) -> *mut c_char {
    // @afetnet: Sign message using Dilithium5 secret key
    let c_str_secret = unsafe { CStr::from_ptr(secret_key_hex) };
    let secret_hex = c_str_secret.to_str().unwrap_or("");

    let c_str_message = unsafe { CStr::from_ptr(message) };
    let message_str = c_str_message.to_str().unwrap_or("");

    // Decode secret key
    let secret_key_bytes = hex::decode(secret_hex).unwrap_or_default();
    let secret_key = dilithium5::SecretKey::from_bytes(&secret_key_bytes).unwrap_or_default();

    // Sign message
    let signature = dilithium5::sign(message_str.as_bytes(), &secret_key);
    let signature_hex = hex::encode(signature.as_bytes());

    let c_string = CString::new(signature_hex).unwrap();
    c_string.into_raw()
}

#[no_mangle]
pub extern "C" fn dilithium_verify(public_key_hex: *const c_char, message: *const c_char, signature_hex: *const c_char) -> bool {
    // @afetnet: Verify Dilithium5 signature
    let c_str_public = unsafe { CStr::from_ptr(public_key_hex) };
    let public_hex = c_str_public.to_str().unwrap_or("");

    let c_str_message = unsafe { CStr::from_ptr(message) };
    let message_str = c_str_message.to_str().unwrap_or("");

    let c_str_signature = unsafe { CStr::from_ptr(signature_hex) };
    let signature_hex_str = c_str_signature.to_str().unwrap_or("");

    // Decode keys
    let public_key_bytes = hex::decode(public_hex).unwrap_or_default();
    let signature_bytes = hex::decode(signature_hex_str).unwrap_or_default();

    let public_key = dilithium5::PublicKey::from_bytes(&public_key_bytes).unwrap_or_default();
    let signature = dilithium5::Signature::from_bytes(&signature_bytes).unwrap_or_default();

    // Verify signature
    dilithium5::verify(message_str.as_bytes(), &signature, &public_key)
}

#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    // @afetnet: Free C string allocated by Rust
    unsafe {
        if s.is_null() { return; }
        CString::from_raw(s);
    }
}





















