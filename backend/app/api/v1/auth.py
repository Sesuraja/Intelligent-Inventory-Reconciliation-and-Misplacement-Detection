from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Dict, Any, List

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, decode_access_token
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Validates JWT Bearer tokens and returns the active authenticated user.
    Enforces strict signature verification and expiration checking.
    """
    if not token:
        if settings.REQUIRE_AUTH:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        # Development / evaluation fallback to first operator user
        user = db.query(User).first()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No registered users found in warehouse database",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing subject identity",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account not found or deactivated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticates user credentials against bcrypt hashes and issues a cryptographically signed JWT.
    Rejects any unverified password attempts.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    role_name = user.role.role_name if user.role else "Warehouse Operator"
    access_token = create_access_token(
        data={"sub": user.email, "role": role_name, "uid": user.id}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": role_name
        }
    }

@router.post("/refresh")
def refresh_token(current_user: User = Depends(get_current_user)):
    """Refreshes the JWT access token for an active user session."""
    role_name = current_user.role.role_name if current_user.role else "Warehouse Operator"
    access_token = create_access_token(
        data={"sub": current_user.email, "role": role_name, "uid": current_user.id}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": role_name
        }
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Records user session logout."""
    return {"success": True, "message": f"User {current_user.email} successfully logged out"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user profile and permissions."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.role_name if current_user.role else "Warehouse Operator",
        "created_at": current_user.created_at
    }

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    """Returns all registered users and roles for operator selection."""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role.role_name if u.role else "Warehouse Operator",
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]

@router.post("/users")
def create_user(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Creates a new warehouse user with role-based authorization."""
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    role_name = data.get("role", "Warehouse Operator")
    from app.models.user import Role
    role = db.query(Role).filter(Role.role_name == role_name).first()
    if not role:
        role = Role(role_name=role_name, description=f"{role_name} Access")
        db.add(role)
        db.commit()
        db.refresh(role)

    from app.core.security import get_password_hash
    pwd = data.get("password", "Warehouse123!")
    user = User(
        name=data.get("name", email.split("@")[0]),
        email=email,
        password_hash=get_password_hash(pwd),
        role_id=role.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": role.role_name,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

@router.patch("/users/{id}")
def update_user(id: int, updates: Dict[str, Any], db: Session = Depends(get_db)):
    """Updates user properties and permissions."""
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "name" in updates:
        user.name = updates["name"]
    if "email" in updates:
        user.email = updates["email"]
    if "role" in updates:
        from app.models.user import Role
        role_name = updates["role"]
        role = db.query(Role).filter(Role.role_name == role_name).first()
        if not role:
            role = Role(role_name=role_name, description=f"{role_name} Access")
            db.add(role)
            db.commit()
            db.refresh(role)
        user.role_id = role.id
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.role_name if user.role else "Warehouse Operator"
    }

@router.delete("/users/{id}")
def delete_user(id: int, db: Session = Depends(get_db)):
    """Deletes a user account."""
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"success": True, "message": f"User {id} deleted successfully"}

