import os
import json
import urllib.request
import urllib.error

# Configura la URL base de OpenWA Easy API.
# Se puede sobrescribir usando la variable de entorno OPENWA_API_URL
OPENWA_API_URL = os.getenv("OPENWA_API_URL", "http://localhost:8080")

def send_whatsapp_message(to_number: str, message: str) -> bool:
    """
    Envía un mensaje de texto a través del Easy API de OpenWA.
    Limpia el número telefónico y le añade la extensión @c.us si es necesario.
    """
    try:
        # Limpiar el número de caracteres no numéricos
        clean_number = "".join(filter(str.isdigit, to_number))
        
        if not clean_number:
            print("Error: El número telefónico está vacío.")
            return False

        # OpenWA requiere el número con formato JID (ej. 5218112345678@c.us)
        if not clean_number.endswith("@c.us"):
            # Si tiene 10 dígitos (México), usualmente se le agrega el prefijo de país 521
            if len(clean_number) == 10:
                clean_number = "521" + clean_number
            elif len(clean_number) == 12 and clean_number.startswith("52"):
                # Algunos sistemas de WhatsApp usan 521 para móviles en México en lugar de 52
                if not clean_number.startswith("521"):
                    clean_number = "521" + clean_number[2:]
            to_number = f"{clean_number}@c.us"
        else:
            to_number = clean_number

        url = f"{OPENWA_API_URL}/sendText"
        payload = {
            "chatId": to_number,
            "text": message
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            print(f"Respuesta de OpenWA: {res_body}")
            # Retorna True si la petición HTTP fue exitosa y se obtuvo una respuesta válida
            return True
    except Exception as e:
        print(f"Error al enviar mensaje por WhatsApp (OpenWA): {e}")
        return False

def format_ticket_message(sale_data: dict, store_settings: dict) -> str:
    """
    Formatea los datos de una venta en un ticket de texto estructurado y legible
    apto para enviarse por mensaje de WhatsApp.
    """
    ticket_lines = [
        "📝 *TICKET DE COMPRA*",
        f"🏢 *{store_settings.get('store_name', 'ABARROTES ED & E')}*",
    ]

    if store_settings.get('address'):
        ticket_lines.append(f"📍 {store_settings.get('address')}")
    if store_settings.get('phone'):
        ticket_lines.append(f"📞 Tel: {store_settings.get('phone')}")
        
    ticket_lines.extend([
        "-----------------------------------------",
        f"🆔 *Ticket:* #{sale_data.get('id', 'N/A')}",
        f"📅 *Fecha:* {sale_data.get('created_at', '')}",
        f"👤 *Atendido por:* {sale_data.get('cashier', 'N/A')}",
    ])
    
    if sale_data.get('customer_name'):
        ticket_lines.append(f"👥 *Cliente:* {sale_data.get('customer_name')}")
        
    ticket_lines.append("-----------------------------------------")
    ticket_lines.append("*DETALLE DE ARTÍCULOS:*")
    
    for item in sale_data.get('items', []):
        qty = item.get('quantity', 1)
        name = item.get('product_name', 'Producto')
        price = item.get('price', 0.0)
        item_discount = item.get('discount', 0.0)
        total = (qty * price) - item_discount
        
        item_line = f"• {qty}x {name} @ ${price:,.2f}"
        if item_discount > 0:
            item_line += f" (Desc: -${item_discount:,.2f})"
        item_line += f" = *${total:,.2f}*"
        ticket_lines.append(item_line)
        
    ticket_lines.append("-----------------------------------------")
    ticket_lines.append(f"🟢 *Subtotal:* ${sale_data.get('subtotal', 0.0):,.2f}")
    if sale_data.get('discount', 0.0) > 0:
        ticket_lines.append(f"🔴 *Descuento Total:* -${sale_data.get('discount', 0.0):,.2f}")
    ticket_lines.append(f"💵 *TOTAL:* *${sale_data.get('total', 0.0):,.2f}*")
    
    pm = sale_data.get('payment_method', '').capitalize()
    ticket_lines.append(f"💳 *Método de Pago:* {pm}")
    
    if sale_data.get('payment_method') == 'efectivo':
        paid = sale_data.get('cash_amount', 0.0)
        change = max(0.0, paid - sale_data.get('total', 0.0))
        ticket_lines.append(f"💵 *Efectivo Recibido:* ${paid:,.2f}")
        ticket_lines.append(f"🪙 *Cambio:* ${change:,.2f}")
        
    ticket_lines.append("-----------------------------------------")
    ticket_lines.append(f"💡 _{store_settings.get('ticket_footer', '¡Gracias por su compra!')}_")
    
    return "\n".join(ticket_lines)
