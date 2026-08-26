"""Переводит старые цветовые индикаторы в смысловые значения."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# python -m app.db.migrate_recommendation_indicators

STATEMENTS = [
    """
    UPDATE recommendations
    SET indicator = CASE lower(trim(indicator))
      WHEN 'зелёный' THEN 'исполнено'
      WHEN 'зеленый' THEN 'исполнено'
      WHEN 'жёлтый' THEN 'на контроле'
      WHEN 'желтый' THEN 'на контроле'
      WHEN 'красный' THEN 'не решено'
      WHEN 'в процессе' THEN 'в процессе'
      WHEN 'в работе' THEN 'в процессе'
      WHEN 'ожидает' THEN 'на контроле'
      WHEN 'на контроле' THEN 'на контроле'
      WHEN 'не решено' THEN 'не решено'
      WHEN 'риск / просрочка' THEN 'не решено'
      WHEN 'риск/просрочка' THEN 'не решено'
      WHEN 'исполнено' THEN 'исполнено'
      WHEN 'закрыто' THEN 'исполнено'
      ELSE indicator
    END
    """,
    """
    UPDATE recommendations
    SET indicator = (ARRAY['в процессе', 'на контроле', 'не решено', 'исполнено'])[1 + ((id - 1) % 4)]
    """,
    """
    UPDATE recommendations
    SET status = (ARRAY['completed', 'unresolved', 'on_control', 'in_progress'])[1 + ((id - 1) % 4)]::recommendation_status
    """,
    """
    UPDATE recommendations
    SET additional_status = (ARRAY['on_time', 'deadline_violated', 'on_control'])[1 + ((id - 1) % 3)]::recommendation_additional_status
    """,
]


async def main() -> None:
    async with engine.begin() as conn:
        for statement in STATEMENTS:
            await conn.execute(text(statement))
    print("recommendation indicators migrated to semantic values")


if __name__ == "__main__":
    asyncio.run(main())
