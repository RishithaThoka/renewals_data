"""
UserContext — stub for authentication/role filtering.
Every service method accepts this object as the first argument so auth
can be wired in later without any refactoring of the service layer.
"""
from dataclasses import dataclass, field


@dataclass
class UserContext:
    user_id: str = "admin"
    display_name: str = "Admin User"
    roles: list[str] = field(default_factory=lambda: ["admin"])
    is_admin: bool = True

    def has_role(self, role: str) -> bool:
        return role in self.roles or self.is_admin


# Fixed admin context used until real auth is wired
ADMIN_CONTEXT = UserContext()


def get_user_context() -> UserContext:
    """
    FastAPI dependency — returns fixed admin for now.
    Replace this function body when authentication is added.
    """
    return ADMIN_CONTEXT
