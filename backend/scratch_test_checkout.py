import requests

# 1. Login to get token
login_url = "http://localhost:8000/api/auth/login"
credentials = {"nombre_usuario": "enr", "contrasena": "pos123"}
response = requests.post(login_url, json=credentials)
if response.status_code != 200:
    print("Login failed:", response.text)
    exit(1)

data = response.json()
token = data["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 2. Get a client id
clients_url = "http://localhost:8000/api/customers/"
response = requests.get(clients_url, headers=headers)
if response.status_code != 200:
    print("Failed to get customers:", response.text)
    exit(1)

customers = response.json()
if not customers:
    print("No customers found in database.")
    exit(1)
client = customers[0]
print(f"Using customer: {client['nombre']} (ID: {client['id']})")

# 3. Get a product with quantity
inv_url = "http://localhost:8000/api/inventory/"
response = requests.get(inv_url, headers=headers)
if response.status_code != 200:
    print("Failed to get inventory:", response.text)
    exit(1)
inventory = response.json()
products_with_stock = [p for p in inventory if p["cantidad"] > 0]
if not products_with_stock:
    print("No products with stock found.")
    exit(1)
product = products_with_stock[0]
print(f"Using product: {product['nombre']} (ID: {product['id']}), Stock: {product['cantidad']}")

# 4. Get active shift or open one
shift_url = "http://localhost:8000/api/shifts/active"
response = requests.get(shift_url, headers=headers)
shift = response.json()
shift_id = None
if not shift:
    print("No active shift, opening one...")
    open_url = "http://localhost:8000/api/shifts/open"
    response = requests.post(open_url, json={"efectivo_inicial": 100.0}, headers=headers)
    if response.status_code != 200:
        print("Failed to open shift:", response.text)
        exit(1)
    shift = response.json()
shift_id = shift["id"]
print(f"Using active shift ID: {shift_id}")

# 5. Try checkout with credit
checkout_url = "http://localhost:8000/api/sales/checkout"
checkout_payload = {
    "elementos": [
        {
            "producto_id": product["id"],
            "variante_id": None,
            "cantidad": 1
        }
    ],
    "metodo_pago": "credito",
    "monto_efectivo": 0.0,
    "monto_tarjeta": 0.0,
    "descuento": 0.0,
    "turno_id": shift_id,
    "cliente_id": client["id"]
}

print("Sending checkout payload:", checkout_payload)
response = requests.post(checkout_url, json=checkout_payload, headers=headers)
print("Response status code:", response.status_code)
print("Response JSON/Text:", response.text)
