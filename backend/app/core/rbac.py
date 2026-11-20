from typing import List, Set, Optional
from fastapi import Depends, HTTPException, status
from app.models.user import User
from app.api.v1.auth import get_current_user

# Role-to-Permissions Mapping
ROLE_PERMISSIONS: dict[str, Set[str]] = {
    "Admin (Full Access)": {"*"},
    "Administrator": {"*"},
    "Admin": {"*"},
    "Warehouse Supervisor": {
        "scanning:read", "scanning:write",
        "verification:read", "verification:write",
        "reconciliation:read", "reconciliation:approve",
        "inventory:read", "inventory:write",
        "wms:read", "wms:write", "wms:reverse",
        "reports:read", "reports:export"
    },
    "Operator": {
        "scanning:read", "scanning:write",
        "verification:read", "verification:write",
        "inventory:read",
        "wms:read"
    },
    "Warehouse Operator": {
        "scanning:read", "scanning:write",
        "verification:read", "verification:write",
        "inventory:read",
        "wms:read"
    },
    "Analyst / Data Scientist": {
        "scanning:read",
        "verification:read",
        "models:read", "models:retrain", "models:rollback",
        "calibration:read", "calibration:write",
        "reports:read", "reports:export"
    },
    "Viewer (Read Only)": {
        "scanning:read",
        "verification:read",
        "inventory:read",
        "reports:read"
    },
    "Viewer": {
        "scanning:read",
        "verification:read",
        "inventory:read",
        "reports:read"
    }
}

def user_has_permission(user: Optional[User], permission: str) -> bool:
    if not user:
        return False
    role_name = user.role.role_name if user.role else "Warehouse Operator"
    user_perms = ROLE_PERMISSIONS.get(role_name, set())
    if "*" in user_perms:
        return True
    return permission in user_perms

def require_permission(permission: str):
    """
    FastAPI dependency that validates active JWT user has the required permission.
    Raises HTTP 403 Forbidden if unauthorized.
    """
    def dependency(user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(user, permission):
            role_name = user.role.role_name if user.role else "Unknown"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: action '{permission}' requires higher privilege (current role: '{role_name}')"
            )
        return user
    return dependency
