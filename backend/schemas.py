from pydantic import BaseModel, model_validator
from typing import Optional, List

# Esquemas de Inquilino
class InquilinoBase(BaseModel):
    nombre: Optional[str] = None
    name: Optional[str] = None
    subdominio: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def sync_names(cls, data):
        if isinstance(data, dict):
            if 'name' in data and not data.get('nombre'):
                data['nombre'] = data['name']
            elif 'nombre' in data and not data.get('name'):
                data['name'] = data['nombre']
        return data


class InquilinoCreate(InquilinoBase):
    pass

class InquilinoResponse(InquilinoBase):
    id: int
    estado_suscripcion: str
    nivel_plan: str
    creado_en: str

    class Config:
        from_attributes = True

class InquilinoRegistroRequest(BaseModel):
    nombre_tienda: str
    subdominio: Optional[str] = None
    nombre_admin: str
    usuario_admin: str
    contrasena_admin: str
    logo_url: Optional[str] = None
    color_primario: Optional[str] = None
    color_secundario: Optional[str] = None

class InquilinoCambioPlanRequest(BaseModel):
    nivel_plan: str

# Esquemas de Usuario
class UsuarioCreate(BaseModel):
    nombre_usuario: str
    contrasena: str
    nombre_completo: str
    rol: Optional[str] = "cajero" # cajero, supervisor, admin

class UsuarioUpdate(BaseModel):
    nombre_usuario: Optional[str] = None
    nombre_completo: Optional[str] = None
    contrasena: Optional[str] = None
    rol: Optional[str] = None

class UsuarioLogin(BaseModel):
    nombre_usuario: str
    contrasena: str
    subdominio: Optional[str] = None

class UsuarioResponse(BaseModel):
    id: int
    inquilino_id: Optional[int] = None
    nombre_usuario: str
    nombre_completo: str
    rol: str
    subdominio: Optional[str] = None

    class Config:
        from_attributes = True

# Esquemas de Variante de Producto
class VarianteProductoBase(BaseModel):
    nombre: Optional[str] = None
    name: Optional[str] = None
    codigo_barras: Optional[str] = None
    precio_costo: Optional[float] = None
    precio: Optional[float] = None
    cantidad: int
    clave_sat: Optional[str] = "01010101"
    clave_unidad_sat: Optional[str] = "H87"

    @model_validator(mode='before')
    @classmethod
    def sync_names(cls, data):
        if isinstance(data, dict):
            if 'name' in data and not data.get('nombre'):
                data['nombre'] = data['name']
            elif 'nombre' in data and not data.get('name'):
                data['name'] = data['nombre']
        return data


class VarianteProductoCreate(VarianteProductoBase):
    pass

class VarianteProductoResponse(VarianteProductoBase):
    id: int
    producto_id: int
    vendido: int

    class Config:
        from_attributes = True

# Esquemas de Producto
class ProductoBase(BaseModel):
    nombre: Optional[str] = None
    name: Optional[str] = None
    codigo_barras: Optional[str] = None
    precio: float
    precio_costo: float = 0.0
    cantidad: int
    inventario_minimo: int = 3
    fecha_entrada: Optional[str] = None
    imagen: Optional[str] = None
    clave_sat: Optional[str] = "01010101"
    clave_unidad_sat: Optional[str] = "H87"

    @model_validator(mode='before')
    @classmethod
    def sync_names(cls, data):
        if isinstance(data, dict):
            if 'name' in data and not data.get('nombre'):
                data['nombre'] = data['name']
            elif 'nombre' in data and not data.get('name'):
                data['name'] = data['nombre']
        return data


class ProductoCreate(ProductoBase):
    variantes: Optional[List[VarianteProductoCreate]] = []

class ProductoVenta(BaseModel):
    cantidad: int = 1

class ProductoResponse(ProductoBase):
    id: int
    vendido: int
    variantes: List[VarianteProductoResponse] = []

    class Config:
        from_attributes = True

# Esquemas de Token
class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioResponse

class TokenData(BaseModel):
    nombre_usuario: Optional[str] = None

# Esquemas de Cancelación/Devolución
class CancelarVentaRequest(BaseModel):
    motivo: str
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    usuario_autorizacion: Optional[str] = None
    contrasena_autorizacion: Optional[str] = None
    cantidad: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def sync_auth_fields(cls, data):
        if isinstance(data, dict):
            if 'usuario_autorizacion' in data and not data.get('auth_username'):
                data['auth_username'] = data['usuario_autorizacion']
            elif 'auth_username' in data and not data.get('usuario_autorizacion'):
                data['usuario_autorizacion'] = data['auth_username']
                
            if 'contrasena_autorizacion' in data and not data.get('auth_password'):
                data['auth_password'] = data['contrasena_autorizacion']
            elif 'auth_password' in data and not data.get('auth_password'):
                data['auth_password'] = data['contrasena_autorizacion']
        return data

class DevolucionResponse(BaseModel):
    id: int
    venta_id: int
    producto_id: int
    nombre_producto: str
    cantidad: int
    precio: float
    motivo: str
    autorizado_por: Optional[str] = None
    creado_en: str

    class Config:
        from_attributes = True

# Esquemas de Turno de Caja
class TurnoCreate(BaseModel):
    efectivo_inicial: float

class TurnoClose(BaseModel):
    efectivo_final_real: float

class TurnoResponse(BaseModel):
    id: int
    usuario_id: int
    hora_inicio: str
    hora_fin: Optional[str] = None
    efectivo_inicial: float
    efectivo_final_real: Optional[float] = None
    efectivo_final_esperado: float
    diferencia: Optional[float] = None
    estado: str

    class Config:
        from_attributes = True

# Esquemas de Movimiento de Caja
class MovimientoCajaCreate(BaseModel):
    tipo: str # 'entrada', 'salida', 'retiro_parcial'
    monto: float
    motivo: str

class MovimientoCajaResponse(BaseModel):
    id: int
    turno_id: int
    tipo: str
    monto: float
    motivo: str
    creado_en: str

    class Config:
        from_attributes = True

# Esquemas de Checkout
class ElementoCheckout(BaseModel):
    producto_id: int
    variante_id: Optional[int] = None
    cantidad: int

class PeticionCheckout(BaseModel):
    elementos: List[ElementoCheckout]
    metodo_pago: Optional[str] = None
    payment_method: Optional[str] = None
    monto_efectivo: float = 0.0
    cash_amount: Optional[float] = None
    monto_tarjeta: float = 0.0
    card_amount: Optional[float] = None
    descuento: float = 0.0
    discount: Optional[float] = None
    turno_id: Optional[int] = None
    cliente_id: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def sync_checkout_fields(cls, data):
        if isinstance(data, dict):
            mp = data.get('metodo_pago') or data.get('payment_method')
            data['metodo_pago'] = mp
            data['payment_method'] = mp

            me = data.get('monto_efectivo') if data.get('monto_efectivo') is not None else data.get('cash_amount', 0.0)
            data['monto_efectivo'] = me
            data['cash_amount'] = me

            mt = data.get('monto_tarjeta') if data.get('monto_tarjeta') is not None else data.get('card_amount', 0.0)
            data['monto_tarjeta'] = mt
            data['card_amount'] = mt

            d = data.get('descuento') if data.get('descuento') is not None else data.get('discount', 0.0)
            data['descuento'] = d
            data['discount'] = d
        return data

# Esquemas de Perfil de Facturación
class PerfilFacturacionBase(BaseModel):
    rfc: str
    razon_social: str
    regimen_fiscal: str
    codigo_postal: str
    correo: str

class PerfilFacturacionCreate(PerfilFacturacionBase):
    pass

class PerfilFacturacionResponse(PerfilFacturacionBase):
    id: int

    class Config:
        from_attributes = True

class FacturaPeticionCreate(BaseModel):
    venta_id: Optional[int] = None
    venta_ids: Optional[List[int]] = None
    perfil_facturacion_id: Optional[int] = None
    nuevo_perfil_facturacion: Optional[PerfilFacturacionCreate] = None

class FacturaResponse(BaseModel):
    id: int
    uuid: str
    monto_total: float
    xml_url: Optional[str] = None
    pdf_url: Optional[str] = None
    creado_en: str
    estado: str

    class Config:
        from_attributes = True

# Esquemas de Proveedor
class ProveedorBase(BaseModel):
    nombre: Optional[str] = None
    name: Optional[str] = None
    rfc: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def sync_names(cls, data):
        if isinstance(data, dict):
            if 'name' in data and not data.get('nombre'):
                data['nombre'] = data['name']
            elif 'nombre' in data and not data.get('name'):
                data['name'] = data['nombre']
        return data


class ProveedorCreate(ProveedorBase):
    pass

class ProveedorResponse(ProveedorBase):
    id: int

    class Config:
        from_attributes = True

# Esquemas de Elemento de Compra
class ElementoCompraBase(BaseModel):
    producto_id: int
    variante_id: Optional[int] = None
    cantidad: int
    precio_costo: float
    precio: Optional[float] = None

class ElementoCompraCreate(ElementoCompraBase):
    pass

class ElementoCompraResponse(ElementoCompraBase):
    id: int
    compra_id: int
    nombre_producto: Optional[str] = None

    class Config:
        from_attributes = True

# Esquemas de Compra
class CompraCreate(BaseModel):
    proveedor_id: Optional[int] = None
    numero_factura: Optional[str] = None
    notas: Optional[str] = None
    elementos: List[ElementoCompraCreate]

class CompraResponse(BaseModel):
    id: int
    proveedor_id: Optional[int] = None
    numero_factura: Optional[str] = None
    costo_total: float
    creado_en: str
    notas: Optional[str] = None
    usuario_id: Optional[int] = None
    elementos: List[ElementoCompraResponse] = []
    nombre_proveedor: Optional[str] = None
    nombre_usuario: Optional[str] = None

    class Config:
        from_attributes = True

# Esquemas de Configuración de Tienda
class ConfiguracionesTiendaBase(BaseModel):
    nombre_tienda: str
    rfc: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    direccion: Optional[str] = None
    tasa_impuesto: float = 16.0
    pie_ticket: Optional[str] = "¡Gracias por su compra!"
    logo_url: Optional[str] = None
    color_primario: Optional[str] = "#064E3B"
    color_secundario: Optional[str] = "#064E3B"

class ConfiguracionesTiendaCreate(ConfiguracionesTiendaBase):
    pass

class ConfiguracionesTiendaResponse(ConfiguracionesTiendaBase):
    id: int

    class Config:
        from_attributes = True

# Esquemas de Cliente
class ClienteBase(BaseModel):
    nombre: Optional[str] = None
    name: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    limite_credito: float = 0.0

    @model_validator(mode='before')
    @classmethod
    def sync_names(cls, data):
        if isinstance(data, dict):
            if 'name' in data and not data.get('nombre'):
                data['nombre'] = data['name']
            elif 'nombre' in data and not data.get('name'):
                data['name'] = data['nombre']
        return data


class ClienteCreate(ClienteBase):
    pass

class ClienteResponse(ClienteBase):
    id: int
    saldo_actual: float

    class Config:
        from_attributes = True

# Esquemas de Pago de Cliente
class PagoClienteCreate(BaseModel):
    monto: float
    notes: Optional[str] = None
    notas: Optional[str] = None
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    usuario_autorizacion: Optional[str] = None
    contrasena_autorizacion: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def sync_auth_fields(cls, data):
        if isinstance(data, dict):
            u = data.get('auth_username') or data.get('usuario_autorizacion')
            p = data.get('auth_password') or data.get('contrasena_autorizacion')
            data['auth_username'] = u
            data['usuario_autorizacion'] = u
            data['auth_password'] = p
            data['contrasena_autorizacion'] = p
            if 'notes' in data and not data.get('notas'):
                data['notas'] = data['notes']
        return data

class PagoClienteResponse(BaseModel):
    id: int
    cliente_id: int
    turno_id: Optional[int] = None
    usuario_id: int
    monto: float
    creado_en: str
    notas: Optional[str] = None

    class Config:
        from_attributes = True

class WhatsAppPeticionEnvio(BaseModel):
    numero_telefono: str

# Esquemas de SuperAdmin
class SuperAdminInquilinoResponse(BaseModel):
    id: int
    nombre: str
    subdominio: Optional[str] = None
    estado_suscripcion: str
    nivel_plan: str
    creado_en: str
    usuario_admin: Optional[str] = None
    nombre_admin: Optional[str] = None
    cantidad_productos: int
    cantidad_ventas: int
    fecha_ultimo_pago: Optional[str] = None
    fin_suscripcion: Optional[str] = None

    class Config:
        from_attributes = True

class SuperAdminInquilinoUpdate(BaseModel):
    nivel_plan: str
    estado_suscripcion: str

class SuperAdminInquilinoResetPassword(BaseModel):
    nueva_contrasena: str

class BitacoraUsuarioResponse(BaseModel):
    id: int
    inquilino_id: Optional[int] = None
    usuario: str
    nombre_completo: str
    rol: str
    accion: str
    detalles: str
    fecha_hora: str

    class Config:
        from_attributes = True
