from sqlalchemy.orm import Session
from database import SessionLocal
import models
import schemas
from routes import checkout
from fastapi import HTTPException

db = SessionLocal()
try:
    # 1. Get user (e.g. ID 5)
    current_user = db.query(models.Usuario).filter(models.Usuario.id == 5).first()
    print(f"Mocking current user: {current_user.nombre_usuario} (Inquilino: {current_user.inquilino_id})")

    # 2. Get client (inquilino 5)
    client = db.query(models.Cliente).filter(models.Cliente.inquilino_id == current_user.inquilino_id).first()
    if not client:
        print("No clients found, creating one...")
        client = models.Cliente(inquilino_id=current_user.inquilino_id, nombre="Cliente Test", limite_credito=1000.0, saldo_actual=0.0)
        db.add(client)
        db.commit()
        db.refresh(client)
    print(f"Using client: {client.nombre} (ID: {client.id}), Saldo: {client.saldo_actual}, Limite: {client.limite_credito}")

    # 3. Get product (inquilino 5)
    product = db.query(models.Producto).filter(models.Producto.inquilino_id == current_user.inquilino_id).first()
    if not product:
        print("No products found, creating one...")
        product = models.Producto(inquilino_id=current_user.inquilino_id, nombre="Prod Test", precio=50.0, cantidad=10)
        db.add(product)
        db.commit()
        db.refresh(product)
    print(f"Using product: {product.nombre} (ID: {product.id}), Stock: {product.cantidad}")

    # 4. Get active shift or open one
    shift = db.query(models.Turno).filter(
        models.Turno.inquilino_id == current_user.inquilino_id,
        models.Turno.estado == "open"
    ).first()
    if not shift:
        print("Opening new shift...")
        shift = models.Turno(inquilino_id=current_user.inquilino_id, usuario_id=current_user.id, efectivo_inicial=100.0, estado="open")
        db.add(shift)
        db.commit()
        db.refresh(shift)
    print(f"Using shift ID: {shift.id}")

    # 5. Build payload
    payload = schemas.PeticionCheckout(
        elementos=[
            schemas.ElementoCheckout(producto_id=product.id, variante_id=None, cantidad=1)
        ],
        metodo_pago="credito",
        monto_efectivo=0.0,
        monto_tarjeta=0.0,
        descuento=0.0,
        turno_id=shift.id,
        cliente_id=client.id
    )

    print("\n--- Running direct checkout function ---")
    try:
        res = checkout(checkout_data=payload, db=db, current_user=current_user)
        print("Checkout success!", res)
    except HTTPException as he:
        print(f"HTTPException raised: status_code={he.status_code}, detail={he.detail}")
    except Exception as ex:
        print(f"Generic error raised: {type(ex)} - {ex}")

finally:
    db.close()
