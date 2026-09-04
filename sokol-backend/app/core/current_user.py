from __future__ import annotations

from dataclasses import dataclass

from app.core.roles import Role, is_admin_role


@dataclass(frozen=True)
class CurrentUser:
    username: str
    display_name: str
    role: Role

    @property
    def short_name(self) -> str:
        return self.username

    @property
    def is_admin(self) -> bool:
        return is_admin_role(self.role)
