from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship, synonym
from database import Base

class Inquilino(Base):
    __tablename__ = "inquilinos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    name = synonym('nombre')
    subdominio = Column(String, unique=True, index=True, nullable=True)
    estado_suscripcion = Column(String, default="active") # active, trialing, past_due, canceled
    nivel_plan = Column(String, default="free") # free, premium
    creado_en = Column(String)
    stripe_id_cliente = Column(String, nullable=True)
    stripe_id_suscripcion = Column(String, nullable=True)
    fin_suscripcion = Column(String, nullable=True)
    fecha_ultimo_pago = Column(String, nullable=True)

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    nombre_usuario = Column(String, unique=True, index=True)
    nombre_completo = Column(String)
    contrasena_encriptada = Column(String)
    rol = Column(String, default="user")

    inquilino = relationship("Inquilino")

class Producto(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    nombre = Column(String, index=True)
    name = synonym('nombre')
    codigo_barras = Column(String, index=True, nullable=True)
    precio = Column(Float)
    precio_costo = Column(Float, default=0.0)
    cantidad = Column(Integer)
    inventario_minimo = Column(Integer, default=3)
    vendido = Column(Integer, default=0)
    fecha_entrada = Column(String, nullable=True)
    imagen = Column(String, nullable=True)
    clave_sat = Column(String, default="01010101")
    clave_unidad_sat = Column(String, default="H87")
    
    variantes = relationship("VarianteProducto", back_populates="producto", cascade="all, delete-orphan", lazy="joined")
    inquilino = relationship("Inquilino")

class VarianteProducto(Base):
    __tablename__ = "variantes_producto"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), index=True)
    nombre = Column(String, index=True)
    name = synonym('nombre')
    codigo_barras = Column(String, index=True, nullable=True)
    precio_costo = Column(Float, nullable=True)
    precio = Column(Float, nullable=True)
    cantidad = Column(Integer)
    vendido = Column(Integer, default=0)
    clave_sat = Column(String, default="01010101")
    clave_unidad_sat = Column(String, default="H87")

    producto = relationship("Producto", back_populates="variantes")
    inquilino = relationship("Inquilino")

class Notificacion(Base):
    __tablename__ = "notificaciones"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    mensaje = Column(String)
    leido = Column(Boolean, default=False)
    inquilino = relationship("Inquilino")

class Turno(Base):
    __tablename__ = "turnos"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    usuario_id = Column(Integer, index=True)
    hora_inicio = Column(String)
    hora_fin = Column(String, nullable=True)
    efectivo_inicial = Column(Float)
    efectivo_final_real = Column(Float, nullable=True)
    efectivo_final_esperado = Column(Float, default=0.0)
    diferencia = Column(Float, nullable=True)
    estado = Column(String, default="open") # "open", "closed"
    inquilino = relationship("Inquilino")

class MovimientoCaja(Base):
    __tablename__ = "movimientos_caja"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    turno_id = Column(Integer, index=True)
    tipo = Column(String) # "entrada", "salida", "retiro_parcial"
    monto = Column(Float)
    motivo = Column(String)
    creado_en = Column(String)
    inquilino = relationship("Inquilino")

class HistorialVenta(Base):
    __tablename__ = "historial_ventas"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    producto_id = Column(Integer, index=True)
    variante_id = Column(Integer, index=True, nullable=True)
    turno_id = Column(Integer, index=True, nullable=True)
    usuario_id = Column(Integer, index=True, nullable=True)
    cantidad = Column(Integer)
    precio_vendido = Column(Float, nullable=True) # Actual selling price
    precio_costo_vendido = Column(Float, default=0.0) # Cost price at transaction time
    descuento = Column(Float, default=0.0) # Discount applied
    metodo_pago = Column(String, default="efectivo") # "efectivo", "tarjeta", "mixto"
    monto_efectivo = Column(Float, default=0.0)
    monto_tarjeta = Column(Float, default=0.0)
    creado_en = Column(String)
    cancelado = Column(Boolean, default=False)
    motivo_cancelacion = Column(String, nullable=True)
    autorizado_por = Column(String, nullable=True)
    factura_id = Column(Integer, ForeignKey("facturas.id"), index=True, nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), index=True, nullable=True)
    inquilino = relationship("Inquilino")

class DevolucionProducto(Base):
    __tablename__ = "devoluciones_producto"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    venta_id = Column(Integer, index=True)
    producto_id = Column(Integer, index=True)
    cantidad = Column(Integer)
    precio = Column(Float)
    motivo = Column(String)
    autorizado_por = Column(String, nullable=True)
    creado_en = Column(String)
    inquilino = relationship("Inquilino")

class PerfilFacturacion(Base):
    __tablename__ = "perfiles_facturacion"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    rfc = Column(String, unique=True, index=True)
    razon_social = Column(String, index=True)
    regimen_fiscal = Column(String)
    codigo_postal = Column(String)
    correo = Column(String)
    inquilino = relationship("Inquilino")

class Factura(Base):
    __tablename__ = "facturas"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    uuid = Column(String, unique=True, index=True)
    monto_total = Column(Float)
    xml_url = Column(String, nullable=True)
    pdf_url = Column(String, nullable=True)
    creado_en = Column(String)
    estado = Column(String, default="active") # "active", "cancelled"
    inquilino = relationship("Inquilino")

class Proveedor(Base):
    __tablename__ = "proveedores"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    nombre = Column(String, index=True)
    name = synonym('nombre')
    rfc = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    correo = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    notas = Column(String, nullable=True)
    inquilino = relationship("Inquilino")

class Compra(Base):
    __tablename__ = "compras"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=True)
    numero_factura = Column(String, nullable=True)
    costo_total = Column(Float, default=0.0)
    creado_en = Column(String)
    notas = Column(String, nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    proveedor = relationship("Proveedor")
    elementos = relationship("ElementoCompra", back_populates="compra", cascade="all, delete-orphan")
    inquilino = relationship("Inquilino")

class ElementoCompra(Base):
    __tablename__ = "elementos_compra"
    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id"))
    producto_id = Column(Integer, ForeignKey("productos.id"))
    variante_id = Column(Integer, ForeignKey("variantes_producto.id"), nullable=True)
    cantidad = Column(Integer)
    precio_costo = Column(Float)
    precio = Column(Float, nullable=True)

    compra = relationship("Compra", back_populates="elementos")
    producto = relationship("Producto")
    variante = relationship("VarianteProducto")

class ConfiguracionesTienda(Base):
    __tablename__ = "configuraciones_tienda"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    nombre_tienda = Column(String, default="ABARROTES ED & E")
    rfc = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    correo = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    tasa_impuesto = Column(Float, default=16.0)
    pie_ticket = Column(String, default="¡Gracias por su compra!")
    logo_url = Column(String, nullable=True)
    color_primario = Column(String, default="#064E3B")
    color_secundario = Column(String, default="#064E3B")
    inquilino = relationship("Inquilino")

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    nombre = Column(String, index=True)
    name = synonym('nombre')
    telefono = Column(String, nullable=True)
    correo = Column(String, nullable=True)
    limite_credito = Column(Float, default=0.0)
    saldo_actual = Column(Float, default=0.0)
    inquilino = relationship("Inquilino")

class PagoCliente(Base):
    __tablename__ = "pagos_cliente"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    turno_id = Column(Integer, nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    monto = Column(Float)
    creado_en = Column(String)
    notas = Column(String, nullable=True)
    inquilino = relationship("Inquilino")

class BitacoraUsuario(Base):
    __tablename__ = "bitacora_usuarios"
    id = Column(Integer, primary_key=True, index=True)
    inquilino_id = Column(Integer, ForeignKey("inquilinos.id"), index=True, nullable=True)
    usuario = Column(String)
    nombre_usuario = synonym('usuario')
    nombre_completo = Column(String)
    rol = Column(String)
    accion = Column(String)
    action = synonym('accion')
    detalles = Column(String)
    details = synonym('detalles')
    fecha_hora = Column(String)

    inquilino = relationship("Inquilino")
