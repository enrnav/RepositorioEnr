import os
import uuid
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

# Intentamos importar reportlab. Si no está disponible, usaremos un fallback.
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

def prettify_xml(elem):
    """Retorna el XML con formato indentado y legible."""
    rough_string = ET.tostring(elem, 'utf-8')
    reparsed = minidom.parseString(rough_string)
    return reparsed.toprettyxml(indent="  ")

def generate_cfdi_xml(sale_info, billing_profile, items, invoice_uuid, timestamp_str):
    """
    Genera una estructura XML compatible con el estándar CFDI 4.0 del SAT.
    """
    # Totales
    subtotal = 0.0
    descuento_total = sale_info.get("discount", 0.0)
    
    # Calcular totales por concepto
    conceptos_data = []
    for item in items:
        # Suponiendo que el precio unitario ya incluye o no IVA. Haremos desglose estándar de IVA 16%
        # Para abarrotes, algunos productos son tasa 0%, pero por simplicidad de simulación usaremos IVA 16%
        # a menos que se indique lo contrario.
        item_qty = item["quantity"]
        item_price = item["price"]
        item_total = item_qty * item_price
        
        # Desglose de impuesto (IVA 16%)
        # Base = Importe / 1.16
        # IVA = Importe - Base
        # Si queremos simplificar, asumimos que el precio de venta ya incluye IVA
        base = round(item_total / 1.16, 2)
        iva = round(item_total - base, 2)
        
        subtotal += base
        
        conceptos_data.append({
            "sat_key": item.get("sat_key") or "01010101",
            "sat_unit_key": item.get("sat_unit_key") or "H87",
            "quantity": item_qty,
            "name": item["name"],
            "price_unit": round(item_price / 1.16, 4),
            "total": base,
            "base": base,
            "iva": iva
        })
        
    subtotal = round(subtotal, 2)
    descuento_total = round(descuento_total, 2)
    total_impuestos = round(sum(c["iva"] for c in conceptos_data), 2)
    total = round(subtotal - descuento_total + total_impuestos, 2)
    
    # Raíz del XML (cfdi:Comprobante)
    ET.register_namespace('cfdi', 'http://www.sat.gob.mx/cfd/4')
    ET.register_namespace('xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    ET.register_namespace('tfd', 'http://www.sat.gob.mx/TimbreFiscalDigital')
    
    attribs = {
        "Version": "4.0",
        "Fecha": timestamp_str,
        "Sello": "SIMULADO_" + str(uuid.uuid4()).replace("-", "")[:40],
        "FormaPago": "01" if sale_info.get("payment_method") == "efectivo" else "04", # 01 Efectivo, 04 Tarjeta de crédito/débito
        "NoCertificado": "00001000000501234567",
        "Certificado": "SIMULADO_CERTIFICADO_BASE_64...",
        "SubTotal": f"{subtotal:.2f}",
        "Descuento": f"{descuento_total:.2f}" if descuento_total > 0 else "0.00",
        "Moneda": "MXN",
        "Total": f"{total:.2f}",
        "TipoDeComprobante": "I",
        "MetodoPago": "PUE",
        "LugarExpedicion": "64000",
        "Exportacion": "01"
    }
    
    comprobante = ET.Element("{http://www.sat.gob.mx/cfd/4}Comprobante", attribs)
    comprobante.set("{http://www.w3.org/2001/XMLSchema-instance}schemaLocation", "http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd")
    
    # Emisor
    emisor = ET.SubElement(comprobante, "{http://www.sat.gob.mx/cfd/4}Emisor", {
        "Rfc": "AED180425EE3",
        "Nombre": "ABARROTES ED E",
        "RegimenFiscal": "626"  # Régimen Simplificado de Confianza
    })
    
    # Receptor
    receptor = ET.SubElement(comprobante, "{http://www.sat.gob.mx/cfd/4}Receptor", {
        "Rfc": billing_profile["rfc"],
        "Nombre": billing_profile["razon_social"],
        "DomicilioFiscalReceptor": billing_profile["codigo_postal"],
        "RegimenFiscalReceptor": billing_profile["regimen_fiscal"],
        "UsoCFDI": "G03"  # Gastos en general por defecto
    })
    
    # Conceptos
    conceptos = ET.SubElement(comprobante, "{http://www.sat.gob.mx/cfd/4}Conceptos")
    for c in conceptos_data:
        concepto = ET.SubElement(conceptos, "{http://www.sat.gob.mx/cfd/4}Concepto", {
            "ClaveProdServ": c["sat_key"],
            "Cantidad": f"{c['quantity']}",
            "ClaveUnidad": c["sat_unit_key"],
            "Descripcion": c["name"],
            "ValorUnitario": f"{c['price_unit']:.4f}",
            "Importe": f"{c['total']:.2f}",
            "ObjetoImp": "02" # Sí objeto de impuesto
        })
        
        # Impuestos del concepto
        impuestos_concepto = ET.SubElement(concepto, "{http://www.sat.gob.mx/cfd/4}Impuestos")
        traslados_concepto = ET.SubElement(impuestos_concepto, "{http://www.sat.gob.mx/cfd/4}Traslados")
        ET.SubElement(traslados_concepto, "{http://www.sat.gob.mx/cfd/4}Traslado", {
            "Base": f"{c['base']:.2f}",
            "Impuesto": "002", # IVA
            "TipoFactor": "Tasa",
            "TasaOCuota": "0.160000",
            "Importe": f"{c['iva']:.2f}"
        })
        
    # Impuestos Globales
    impuestos_globales = ET.SubElement(comprobante, "{http://www.sat.gob.mx/cfd/4}Impuestos", {
        "TotalImpuestosTrasladados": f"{total_impuestos:.2f}"
    })
    traslados_globales = ET.SubElement(impuestos_globales, "{http://www.sat.gob.mx/cfd/4}Traslados")
    ET.SubElement(traslados_globales, "{http://www.sat.gob.mx/cfd/4}Traslado", {
        "Base": f"{subtotal:.2f}",
        "Impuesto": "002",
        "TipoFactor": "Tasa",
        "TasaOCuota": "0.160000",
        "Importe": f"{total_impuestos:.2f}"
    })
    
    # Complemento (Timbre Fiscal Digital)
    complemento = ET.SubElement(comprobante, "{http://www.sat.gob.mx/cfd/4}Complemento")
    tfd = ET.SubElement(complemento, "{http://www.sat.gob.mx/TimbreFiscalDigital}TimbreFiscalDigital", {
        "Version": "1.1",
        "UUID": invoice_uuid,
        "FechaTimbrado": timestamp_str,
        "RfcProvCertif": "SFE0807172DD",
        "SelloCFD": attribs["Sello"],
        "NoCertificadoSAT": "00001000000505678901",
        "SelloSAT": "SIMULADO_SELLO_SAT_" + str(uuid.uuid4()).replace("-", "")[:40]
    })
    
    # Generar XML identado
    xml_str = prettify_xml(comprobante)
    return xml_str

def draw_simulated_qr(canvas, x, y, size):
    """Dibuja un patrón simulado de código QR en el PDF usando rectángulos pequeños."""
    canvas.saveState()
    canvas.setFillColor(colors.black)
    
    # Dibujar marcos de las esquinas (patrón de posicionamiento del QR)
    # Esquina Superior Izquierda
    canvas.rect(x, y + size - (size * 0.25), size * 0.25, size * 0.25, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.rect(x + (size * 0.05), y + size - (size * 0.20), size * 0.15, size * 0.15, stroke=0, fill=1)
    canvas.setFillColor(colors.black)
    canvas.rect(x + (size * 0.08), y + size - (size * 0.17), size * 0.09, size * 0.09, stroke=0, fill=1)
    
    # Esquina Superior Derecha
    canvas.rect(x + size - (size * 0.25), y + size - (size * 0.25), size * 0.25, size * 0.25, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.rect(x + size - (size * 0.20), y + size - (size * 0.20), size * 0.15, size * 0.15, stroke=0, fill=1)
    canvas.setFillColor(colors.black)
    canvas.rect(x + size - (size * 0.17), y + size - (size * 0.17), size * 0.09, size * 0.09, stroke=0, fill=1)
    
    # Esquina Inferior Izquierda
    canvas.rect(x, y, size * 0.25, size * 0.25, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.rect(x + (size * 0.05), y + (size * 0.05), size * 0.15, size * 0.15, stroke=0, fill=1)
    canvas.setFillColor(colors.black)
    canvas.rect(x + (size * 0.08), y + (size * 0.08), size * 0.09, size * 0.09, stroke=0, fill=1)
    
    # Algunos píxeles aleatorios/estructurados en el centro y otras áreas
    canvas.setFillColor(colors.black)
    grid_size = 12
    step = size / grid_size
    for i in range(grid_size):
        for j in range(grid_size):
            # Evitar las esquinas donde ya dibujamos los patrones
            if (i < 4 and j < 4) or (i > grid_size - 5 and j < 4) or (i < 4 and j > grid_size - 5):
                continue
            # Dibujar un pixel si el hash de su posición es par
            if (i * 3 + j * 7) % 2 == 0:
                canvas.rect(x + i * step, y + j * step, step * 0.9, step * 0.9, stroke=0, fill=1)
                
    canvas.restoreState()

def generate_cfdi_pdf(pdf_path, sale_info, billing_profile, items, invoice_uuid, timestamp_str):
    """
    Genera un archivo PDF con un diseño premium representando la factura CFDI 4.0.
    Si ReportLab no está disponible, escribe un reporte básico de texto.
    """
    os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
    
    subtotal = 0.0
    descuento_total = sale_info.get("discount", 0.0)
    for item in items:
        subtotal += item["quantity"] * item["price"] / 1.16
        
    subtotal = round(subtotal, 2)
    descuento_total = round(descuento_total, 2)
    total_impuestos = round(sum((item["quantity"] * item["price"]) - (item["quantity"] * item["price"] / 1.16) for item in items), 2)
    total = round(subtotal - descuento_total + total_impuestos, 2)
    
    if not REPORTLAB_AVAILABLE:
        # Fallback simple si no está reportlab instalado
        with open(pdf_path, "w", encoding="utf-8") as f:
            f.write(f"FACTURA ELECTRÓNICA CFDI 4.0 (SIMULACIÓN SIN REPORTLAB)\n")
            f.write(f"====================================================\n")
            f.write(f"FOLIO FISCAL (UUID): {invoice_uuid}\n")
            f.write(f"FECHA TIMBRADO: {timestamp_str}\n\n")
            f.write(f"EMISOR:\n")
            f.write(f" - Nombre: ABARROTES ED E\n")
            f.write(f" - RFC: AED180425EE3\n")
            f.write(f" - Régimen Fiscal: 626 - Régimen Simplificado de Confianza\n\n")
            f.write(f"RECEPTOR:\n")
            f.write(f" - Nombre: {billing_profile['razon_social']}\n")
            f.write(f" - RFC: {billing_profile['rfc']}\n")
            f.write(f" - Domicilio Fiscal (C.P.): {billing_profile['codigo_postal']}\n")
            f.write(f" - Régimen Fiscal: {billing_profile['regimen_fiscal']}\n\n")
            f.write(f"CONCEPTOS:\n")
            for item in items:
                f.write(f" - {item['name']} | Cantidad: {item['quantity']} | P.U. (con IVA): {item['price']} | Clave SAT: {item.get('sat_key')}\n")
            f.write(f"\nRESUMEN:\n")
            f.write(f" - Subtotal: ${subtotal:.2f}\n")
            if descuento_total > 0:
                f.write(f" - Descuento: ${descuento_total:.2f}\n")
            f.write(f" - IVA (16%): ${total_impuestos:.2f}\n")
            f.write(f" - Total: ${total:.2f}\n")
        return
        
    # Usar reportlab para generar un PDF premium
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Colores premium
    c_primary = colors.HexColor("#1e293b")   # Slate 800
    c_secondary = colors.HexColor("#0f172a") # Slate 900
    c_accent = colors.HexColor("#3b82f6")    # Blue 500
    c_gray_light = colors.HexColor("#f1f5f9")# Slate 100
    c_text_dark = colors.HexColor("#334155") # Slate 700
    
    # Estilos de Texto personalizados
    style_title = ParagraphStyle(
        name="InvoiceTitle",
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=c_primary,
        spaceAfter=12
    )
    
    style_normal = ParagraphStyle(
        name="InvoiceNormal",
        fontName="Helvetica",
        fontSize=9,
        textColor=c_text_dark,
        leading=12
    )
    
    style_header_label = ParagraphStyle(
        name="InvoiceHeaderLabel",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=c_secondary,
        leading=12
    )
    
    style_table_header = ParagraphStyle(
        name="InvoiceTableHeader",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=colors.white,
        alignment=1 # Centered
    )
    
    style_table_cell = ParagraphStyle(
        name="InvoiceTableCell",
        fontName="Helvetica",
        fontSize=8,
        textColor=c_text_dark
    )
    
    style_table_cell_bold = ParagraphStyle(
        name="InvoiceTableCellBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=c_text_dark
    )
    
    story = []
    
    # Encabezado (Logo / Nombre Empresa y Datos del CFDI)
    header_data = [
        [
            Paragraph("<b>ABARROTES ED & E</b><br/>RFC: AED180425EE3<br/>Régimen Fiscal: 626 - Régimen Simplificado de Confianza<br/>Lugar de Expedición: 64000", style_normal),
            Paragraph("<font size=14 color='#1e293b'><b>FACTURA ELECTRÓNICA</b></font><br/><b>Folio Fiscal (UUID):</b><br/>" + invoice_uuid + "<br/><b>Fecha de Emisión:</b> " + timestamp_str + "<br/><b>Uso CFDI:</b> G03 - Gastos en general", style_normal)
        ]
    ]
    header_table = Table(header_data, colWidths=[3.5*inch, 4.0*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    
    # Datos del Receptor (Cliente)
    receptor_data = [
        [
            Paragraph("<b>RECEPTOR:</b>", style_header_label),
            Paragraph(f"<b>RFC:</b> {billing_profile['rfc']}", style_normal)
        ],
        [
            Paragraph(f"<b>Razón Social:</b> {billing_profile['razon_social']}", style_normal),
            Paragraph(f"<b>Régimen Fiscal:</b> {billing_profile['regimen_fiscal']}", style_normal)
        ],
        [
            Paragraph(f"<b>Domicilio Fiscal (C.P.):</b> {billing_profile['codigo_postal']}", style_normal),
            Paragraph(f"<b>Correo Electrónico:</b> {billing_profile['correo']}", style_normal)
        ]
    ]
    receptor_table = Table(receptor_data, colWidths=[3.75*inch, 3.75*inch])
    receptor_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_gray_light),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,-1), (-1,-1), 1, c_primary),
    ]))
    story.append(receptor_table)
    story.append(Spacer(1, 15))
    
    # Tabla de Conceptos
    table_data = [
        [
            Paragraph("<b>Clave SAT</b>", style_table_header),
            Paragraph("<b>Cant.</b>", style_table_header),
            Paragraph("<b>Unidad SAT</b>", style_table_header),
            Paragraph("<b>Descripción</b>", style_table_header),
            Paragraph("<b>Precio Unitario</b>", style_table_header),
            Paragraph("<b>Importe</b>", style_table_header)
        ]
    ]
    
    for item in items:
        price_unit = item["price"] / 1.16
        item_total = item["quantity"] * price_unit
        
        table_data.append([
            Paragraph(item.get("sat_key") or "01010101", style_table_cell),
            Paragraph(str(item["quantity"]), style_table_cell),
            Paragraph(item.get("sat_unit_key") or "H87", style_table_cell),
            Paragraph(item["name"], style_table_cell),
            Paragraph(f"${price_unit:.2f}", style_table_cell),
            Paragraph(f"${item_total:.2f}", style_table_cell)
        ])
        
    concepts_table = Table(table_data, colWidths=[1.1*inch, 0.6*inch, 1.0*inch, 2.6*inch, 1.1*inch, 1.1*inch])
    concepts_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_gray_light]),
    ]))
    story.append(concepts_table)
    story.append(Spacer(1, 15))
    
    # Sección de Totales y Timbre Digital (Distribución en dos columnas)
    # Columna izquierda: Información del Timbre, Sello y Código QR
    # Columna derecha: Subtotal, Impuestos, Total
    
    totals_data = [
        [Paragraph("<b>Subtotal:</b>", style_normal), Paragraph(f"${subtotal:.2f}", style_normal)],
    ]
    if descuento_total > 0:
        totals_data.append([Paragraph("<b>Descuento:</b>", style_normal), Paragraph(f"-${descuento_total:.2f}", style_normal)])
    totals_data.extend([
        [Paragraph("<b>IVA (16%):</b>", style_normal), Paragraph(f"${total_impuestos:.2f}", style_normal)],
        [Paragraph("<b>Total:</b>", style_header_label), Paragraph(f"<b>${total:.2f}</b>", style_header_label)]
    ])
    
    totals_table = Table(totals_data, colWidths=[1.5*inch, 1.2*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,-1), (-1,-1), c_gray_light),
    ]))
    
    # Creamos una estructura de dos columnas al final del documento
    # Columna izquierda tendrá el QR y los textos del Timbre.
    # Columna derecha tendrá los Totales.
    tfd_info = (
        f"<b>No. Certificado SAT:</b> 00001000000505678901<br/>"
        f"<b>RFC Prov. Certificación:</b> SFE0807172DD<br/>"
        f"<b>Sello Digital CFDI:</b><br/>"
        f"<font size=5 color='#64748b'>SIMULADO_SELLO_CFDI_SHA256_HASH_VAL_" + str(uuid.uuid4()).replace("-", "") + "</font><br/>"
        f"<b>Sello SAT:</b><br/>"
        f"<font size=5 color='#64748b'>SIMULADO_SELLO_SAT_SHA256_HASH_VAL_" + str(uuid.uuid4()).replace("-", "") + "</font>"
    )
    
    bottom_layout_data = [
        [
            Paragraph(tfd_info, style_normal),
            totals_table
        ]
    ]
    bottom_layout_table = Table(bottom_layout_data, colWidths=[4.7*inch, 2.8*inch])
    bottom_layout_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(bottom_layout_table)
    
    # Función para dibujar el QR en la última página
    def add_qr(canvas, doc):
        canvas.saveState()
        # Dibujamos el QR en la parte inferior izquierda de la página
        draw_simulated_qr(canvas, 36, 36, 75)
        
        # Agregar leyenda del SAT al lado del QR
        legend_style = canvas.beginPath()
        canvas.setFont("Helvetica", 6)
        canvas.setFillColor(c_text_dark)
        legend_text = (
            "Este documento es una representación impresa de un CFDI 4.0. "
            "El timbrado y sellos digitales son simulaciones para fines de demostración. "
            "Para verificar la validez fiscal, escanee el código QR correspondiente."
        )
        canvas.drawString(120, 36, legend_text)
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_qr, onLaterPages=add_qr)
