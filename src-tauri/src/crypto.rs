use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use keyring::Entry;
use rand::{rngs::OsRng, RngCore};
use base64::{Engine as _, engine::general_purpose::STANDARD};

const SERVICE_NAME: &str = "RealEstateERP";
const KEY_NAME: &str = "encryption_key";

pub fn encrypt(plaintext: &str) -> Result<String, String> {
    if plaintext.trim().is_empty() {
        return Ok(plaintext.to_string());
    }

    let key_bytes = get_or_create_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);

    Ok(STANDARD.encode(combined))
}

pub fn decrypt(encrypted_b64: &str) -> Result<String, String> {
    if encrypted_b64.trim().is_empty() {
        return Ok(encrypted_b64.to_string());
    }

    let combined = match STANDARD.decode(encrypted_b64) {
        Ok(c) if c.len() > 12 => c,
        _ => return Ok(encrypted_b64.to_string()),
    };

    let key_bytes = get_or_create_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let nonce = Nonce::from_slice(&combined[0..12]);
    let ciphertext = &combined[12..];

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| e.to_string())?;

    String::from_utf8(plaintext_bytes).map_err(|e| e.to_string())
}

fn get_or_create_key() -> Result<[u8; 32], String> {
    let entry = Entry::new(SERVICE_NAME, KEY_NAME).map_err(|e| e.to_string())?;
    
    match entry.get_password() {
        Ok(base64_key) => {
            let key_bytes = STANDARD.decode(&base64_key).map_err(|e| e.to_string())?;
            let mut key = [0u8; 32];
            key.copy_from_slice(&key_bytes[0..32]);
            Ok(key)
        }
        Err(_) => {
            let mut key = [0u8; 32];
            // Using OsRng for keys to ensure cryptographic security
            OsRng.fill_bytes(&mut key); 
            let base64_key = STANDARD.encode(&key);
            entry.set_password(&base64_key).map_err(|e| e.to_string())?;
            Ok(key)
        }
    }
}