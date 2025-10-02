from flask import Flask, request, jsonify
from nacl.signing import SigningKey
from nacl.encoding import Base58Encoder
import time
import json
import base58

app = Flask(__name__)

# In a real application, this key would be securely managed and not hardcoded
# This is the "issuer" key that signs volunteer QRs
ISSUER_SECRET_KEY_HEX = "YOUR_ISSUER_SECRET_KEY_HEX_HERE" # Placeholder
ISSUER_SIGNING_KEY = SigningKey(ISSUER_SECRET_KEY_HEX, encoder=Base58Encoder)

@app.route('/generate_volunteer_qr', methods=['POST'])
def generate_volunteer_qr():
    """
    Generate a signed QR code for a volunteer
    
    Expected JSON payload:
    {
        "id": "VOL001",
        "name": "Ayşe Yılmaz",
        "role": "medic",
        "expires_in_hours": 24
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        volunteer_id = data.get('id')
        name = data.get('name')
        role = data.get('role')
        expires_in_hours = data.get('expires_in_hours', 24)  # Default 24 hours

        if not all([volunteer_id, name, role]):
            return jsonify({"error": "Missing required fields: id, name, role"}), 400

        # Validate role
        valid_roles = ['medic', 'search_rescue', 'coordinator', 'firefighter', 'police', 'civil_defense', 'volunteer']
        if role not in valid_roles:
            return jsonify({"error": f"Invalid role. Must be one of: {valid_roles}"}), 400

        issued_at = int(time.time() * 1000)  # Milliseconds
        expires_at = issued_at + expires_in_hours * 60 * 60 * 1000

        # Generate a new key pair for the volunteer for this QR (ephemeral or linked to their device)
        # For simplicity, we'll use a dummy key here. In a real system, the volunteer's device
        # would generate its own key pair and send the public key to the backend.
        volunteer_signing_key = SigningKey.generate()
        volunteer_public_key_bs58 = volunteer_signing_key.verify_key.encode(Base58Encoder).decode('utf-8')

        payload = {
            "id": volunteer_id,
            "name": name,
            "role": role,
            "issuedAt": issued_at,
            "expiresAt": expires_at,
            "publicKey": volunteer_public_key_bs58  # Volunteer's public key
        }

        payload_str = json.dumps(payload, separators=(',', ':'))

        # The issuer signs the payload
        signed = ISSUER_SIGNING_KEY.sign(payload_str.encode('utf-8'))
        signature_bs58 = signed.signature.encode(Base58Encoder).decode('utf-8')

        signed_data = {
            "payload": payload_str,
            "signature": signature_bs58
        }

        qr_data = base58.b58encode(json.dumps(signed_data, separators=(',', ':')).encode('utf-8')).decode('utf-8')

        return jsonify({
            "qr_data": qr_data,
            "volunteer_public_key": volunteer_public_key_bs58,
            "expires_at": expires_at,
            "expires_in_hours": expires_in_hours,
            "message": "Volunteer QR generated successfully. This QR data should be displayed to the volunteer."
        })

    except Exception as e:
        return jsonify({"error": f"Failed to generate volunteer QR: {str(e)}"}), 500

@app.route('/verify_volunteer_qr', methods=['POST'])
def verify_volunteer_qr():
    """
    Verify a volunteer QR code
    
    Expected JSON payload:
    {
        "qr_data": "base58_encoded_qr_data"
    }
    """
    try:
        data = request.json
        if not data or 'qr_data' not in data:
            return jsonify({"error": "Missing qr_data field"}), 400

        qr_data = data['qr_data']

        # Decode the QR data
        decoded = base58.b58decode(qr_data).decode('utf-8')
        signed_data = json.loads(decoded)

        payload_str = signed_data['payload']
        signature_bs58 = signed_data['signature']

        # Parse the payload
        payload = json.loads(payload_str)

        # Check expiration
        current_time = int(time.time() * 1000)
        if payload['expiresAt'] < current_time:
            return jsonify({
                "valid": False,
                "error": "QR code has expired",
                "expired_at": payload['expiresAt'],
                "current_time": current_time
            }), 400

        # Verify signature
        signature = base58.b58decode(signature_bs58)
        try:
            ISSUER_SIGNING_KEY.verify_key.verify(payload_str.encode('utf-8'), signature)
            signature_valid = True
        except:
            signature_valid = False

        if not signature_valid:
            return jsonify({
                "valid": False,
                "error": "Invalid signature"
            }), 400

        return jsonify({
            "valid": True,
            "volunteer": {
                "id": payload['id'],
                "name": payload['name'],
                "role": payload['role'],
                "issued_at": payload['issuedAt'],
                "expires_at": payload['expiresAt'],
                "public_key": payload['publicKey']
            },
            "time_until_expiry_ms": payload['expiresAt'] - current_time
        })

    except Exception as e:
        return jsonify({"error": f"Failed to verify volunteer QR: {str(e)}"}), 500

@app.route('/volunteer_roles', methods=['GET'])
def get_volunteer_roles():
    """Get list of available volunteer roles"""
    roles = [
        {
            "id": "medic",
            "name": "Tıbbi Personel",
            "description": "Acil tıbbi müdahale ve triage",
            "permissions": ["medical_assistance", "triage", "emergency_care"]
        },
        {
            "id": "search_rescue",
            "name": "Arama Kurtarma",
            "description": "Arama ve kurtarma operasyonları",
            "permissions": ["search_operations", "rescue_operations", "equipment_access"]
        },
        {
            "id": "coordinator",
            "name": "Koordinatör",
            "description": "Operasyon koordinasyonu ve kaynak yönetimi",
            "permissions": ["coordination", "resource_management", "communication"]
        },
        {
            "id": "firefighter",
            "name": "İtfaiyeci",
            "description": "Yangın söndürme ve tehlikeli madde kontrolü",
            "permissions": ["fire_suppression", "rescue_operations", "hazard_control"]
        },
        {
            "id": "police",
            "name": "Polis",
            "description": "Güvenlik ve trafik kontrolü",
            "permissions": ["security", "traffic_control", "investigation"]
        },
        {
            "id": "civil_defense",
            "name": "Sivil Savunma",
            "description": "Sivil koruma ve acil durum müdahalesi",
            "permissions": ["civil_protection", "emergency_response", "public_safety"]
        },
        {
            "id": "volunteer",
            "name": "Gönüllü",
            "description": "Temel yardım ve bilgi paylaşımı",
            "permissions": ["basic_assistance", "information_sharing"]
        }
    ]

    return jsonify({"roles": roles})

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "volunteer_qr",
        "timestamp": int(time.time() * 1000)
    })

if __name__ == '__main__':
    # Example usage:
    # curl -X POST -H "Content-Type: application/json" -d '{"id": "VOL001", "name": "Ayşe Yılmaz", "role": "medic", "expires_in_hours": 48}' http://127.0.0.1:5000/generate_volunteer_qr
    
    print("Volunteer QR Service starting...")
    print("Example: Generate QR for a medic")
    print('curl -X POST -H "Content-Type: application/json" -d \'{"id": "VOL001", "name": "Ayşe Yılmaz", "role": "medic", "expires_in_hours": 48}\' http://127.0.0.1:5000/generate_volunteer_qr')
    
    app.run(debug=True, port=5000, host='0.0.0.0')