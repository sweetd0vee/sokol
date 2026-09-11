"""SQL-only ad-hoc schema patches. Complex data migrations live in sibling modules."""

from app.db.migrations.sql import SqlPatch

CHECK_QUARTER = SqlPatch(
    name="check_quarter",
    message="Check quarter migration completed.",
    statements=(
        "ALTER TABLE checks ADD COLUMN IF NOT EXISTS check_quarter INTEGER",
        """
    UPDATE checks
    SET check_quarter = EXTRACT(QUARTER FROM start_date)::INTEGER
    WHERE check_quarter IS NULL
    """,
        "ALTER TABLE checks ALTER COLUMN check_quarter SET NOT NULL",
        """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'ck_checks_check_quarter'
              AND conrelid = 'checks'::regclass
        ) THEN
            ALTER TABLE checks
            ADD CONSTRAINT ck_checks_check_quarter
            CHECK (check_quarter BETWEEN 1 AND 4);
        END IF;
    END $$;
    """,
    ),
)

CHECK_EFFECTIVENESS = SqlPatch(
    name="check_effectiveness",
    message="Check effectiveness migration completed.",
    statements=(
        "ALTER TABLE checks ADD COLUMN IF NOT EXISTS process_effectiveness VARCHAR(128)",
        "ALTER TABLE checks ADD COLUMN IF NOT EXISTS svk_effectiveness VARCHAR(128)",
        "ALTER TABLE checks ADD COLUMN IF NOT EXISTS sur_effectiveness VARCHAR(128)",
        "ALTER TABLE checks ADD COLUMN IF NOT EXISTS svik_effectiveness VARCHAR(128)",
    ),
)

CHECK_SHORT_NAME = SqlPatch(
    name="check_short_name",
    message="Check short_name migration completed.",
    statements=("ALTER TABLE checks ADD COLUMN IF NOT EXISTS short_name VARCHAR(255)",),
)

ATTACHMENTS = SqlPatch(
    name="attachments",
    message="Attachments migration completed.",
    statements=(
        """
    CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(32) NOT NULL,
        entity_id INTEGER NOT NULL,
        slot VARCHAR(64) NOT NULL,
        check_serial_number VARCHAR(32) NOT NULL,
        bucket VARCHAR(128) NOT NULL,
        object_key VARCHAR(512) NOT NULL,
        original_name VARCHAR(512) NOT NULL,
        content_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
        "CREATE INDEX IF NOT EXISTS ix_attachments_entity_type ON attachments (entity_type)",
        "CREATE INDEX IF NOT EXISTS ix_attachments_entity_id ON attachments (entity_id)",
        "CREATE INDEX IF NOT EXISTS ix_attachments_check_serial_number ON attachments (check_serial_number)",
        "CREATE INDEX IF NOT EXISTS ix_attachments_entity_lookup ON attachments (entity_type, entity_id)",
    ),
)

ANALYTICS_INDEXES = SqlPatch(
    name="analytics_indexes",
    message="Analytics indexes migration completed.",
    statements=(
        "CREATE INDEX IF NOT EXISTS ix_checks_start_date ON checks (start_date)",
        "CREATE INDEX IF NOT EXISTS ix_checks_check_leader ON checks (check_leader)",
        "CREATE INDEX IF NOT EXISTS ix_checks_status ON checks (status)",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_deadline ON recommendations (deadline)",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_auditor ON recommendations (auditor)",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_audit_object_gin ON recommendations USING GIN (audit_object)",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_status ON recommendations (status)",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_materiality_level ON recommendations (materiality_level)",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_deadline_status ON recommendations (deadline, status)",
    ),
)

RECOMMENDATION_OBSERVATION_NAME = SqlPatch(
    name="recommendation_observation_name",
    message="Recommendation observation_name migration completed.",
    statements=(
        """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS observation_name TEXT
    """,
    ),
)

RECOMMENDATION_INDICATOR_ON_CONTROL = SqlPatch(
    name="recommendation_indicator_on_control",
    message="recommendation indicator migrated: 'ожидает' -> 'на контроле'",
    statements=(
        """
    UPDATE recommendations
    SET indicator = 'на контроле'
    WHERE lower(trim(indicator)) IN ('ожидает', 'жёлтый', 'желтый')
    """,
    ),
)

RECOMMENDATION_ADDITIONAL_INDICATOR = SqlPatch(
    name="recommendation_additional_indicator",
    message="Recommendation additional_indicator migration completed.",
    statements=(
        """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS additional_indicator VARCHAR(32)
    """,
        """
    UPDATE recommendations
    SET additional_indicator = CASE additional_status::text
        WHEN 'on_time' THEN 'в срок'
        WHEN 'deadline_violated' THEN 'срок нарушен'
        WHEN 'on_control' THEN 'на контроле'
        ELSE 'не указан'
    END
    WHERE additional_indicator IS NULL OR additional_indicator = ''
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN additional_indicator SET DEFAULT 'не указан'
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN additional_indicator SET NOT NULL
    """,
    ),
)

RECOMMENDATION_FIELDS = SqlPatch(
    name="recommendation_fields",
    message="Recommendation fields migration completed.",
    statements=(
        """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS sequence_number INTEGER
    """,
        """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS description TEXT
    """,
        """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS materiality_level VARCHAR(32)
    """,
        """
    ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS indicator VARCHAR(32)
    """,
        """
    UPDATE recommendations
    SET description = name
    WHERE description IS NULL OR description = ''
    """,
        """
    UPDATE recommendations
    SET materiality_level = 'не указан'
    WHERE materiality_level IS NULL OR materiality_level = ''
    """,
        """
    UPDATE recommendations
    SET indicator = 'не указан'
    WHERE indicator IS NULL OR indicator = ''
    """,
        """
    WITH ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY check_id
                ORDER BY created_at, id
            ) AS seq
        FROM recommendations
    )
    UPDATE recommendations AS r
    SET sequence_number = ranked.seq
    FROM ranked
    WHERE r.id = ranked.id
      AND (r.sequence_number IS NULL OR r.sequence_number < 1)
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN sequence_number SET DEFAULT 1
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN sequence_number SET NOT NULL
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN description SET DEFAULT ''
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN description SET NOT NULL
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN materiality_level SET DEFAULT 'не указан'
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN materiality_level SET NOT NULL
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN indicator SET DEFAULT 'не указан'
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN indicator SET NOT NULL
    """,
    ),
)

RECOMMENDATION_AUDIT_OBJECT_ARRAY = SqlPatch(
    name="recommendation_audit_object_array",
    message="Recommendation audit_object array migration completed.",
    statements=(
        "DROP INDEX IF EXISTS ix_recommendations_audit_object",
        """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'recommendations'
              AND column_name = 'audit_object'
              AND data_type <> 'ARRAY'
        ) THEN
            ALTER TABLE recommendations
            ALTER COLUMN audit_object TYPE TEXT[]
            USING CASE
                WHEN audit_object IS NULL OR btrim(audit_object::text) = ''
                    THEN ARRAY['Не указан']::TEXT[]
                ELSE regexp_split_to_array(audit_object::text, '\\s*[,;]\\s*')::TEXT[]
            END;
        END IF;

        UPDATE recommendations
        SET audit_object = ARRAY['Не указан']::TEXT[]
        WHERE audit_object IS NULL OR array_length(audit_object, 1) IS NULL;

        ALTER TABLE recommendations
        ALTER COLUMN audit_object SET DEFAULT ARRAY['Не указан']::TEXT[];

        ALTER TABLE recommendations
        ALTER COLUMN audit_object SET NOT NULL;
    END $$;
    """,
        "CREATE INDEX IF NOT EXISTS ix_recommendations_audit_object_gin ON recommendations USING GIN (audit_object)",
    ),
)

RECOMMENDATION_CLOSURE = SqlPatch(
    name="recommendation_closure",
    message="Recommendation closure fields migration completed.",
    statements=(
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS actual_completion_date DATE",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_1_reason VARCHAR(64)",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_1_date DATE",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_1_comment TEXT",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_2_reason VARCHAR(64)",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS extension_2_comment TEXT",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS remove_from_control_reason VARCHAR(64)",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS remove_from_control_date DATE",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS remove_from_control_comment TEXT",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS closure_verification_status VARCHAR(64)",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS closure_information TEXT",
    ),
)

RECOMMENDATION_CLOSURE_LISTS = SqlPatch(
    name="recommendation_closure_lists",
    message="Recommendation closure lists migration completed.",
    statements=(
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS deadline_extensions JSONB",
        "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS control_removals JSONB",
    ),
)

RECOMMENDATION_STATUSES = SqlPatch(
    name="recommendation_statuses",
    message=(
        "recommendation status enums updated: "
        "completed/unresolved/on_control/in_progress; "
        "on_time/deadline_violated/on_control"
    ),
    statements=(
        """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'recommendation_status_new'
      ) THEN
        CREATE TYPE recommendation_status_new AS ENUM (
          'completed',
          'unresolved',
          'on_control',
          'in_progress'
        );
      END IF;
    END $$;
    """,
        """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'recommendation_additional_status_new'
      ) THEN
        CREATE TYPE recommendation_additional_status_new AS ENUM (
          'on_time',
          'deadline_violated',
          'on_control'
        );
      END IF;
    END $$;
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN status TYPE recommendation_status_new
    USING (
      CASE status::text
        WHEN 'completed' THEN 'completed'
        WHEN 'COMPLETED' THEN 'completed'
        WHEN 'overdue' THEN 'unresolved'
        WHEN 'OVERDUE' THEN 'unresolved'
        WHEN 'unresolved' THEN 'unresolved'
        WHEN 'UNRESOLVED' THEN 'unresolved'
        WHEN 'not_started' THEN 'on_control'
        WHEN 'NOT_STARTED' THEN 'on_control'
        WHEN 'on_control' THEN 'on_control'
        WHEN 'ON_CONTROL' THEN 'on_control'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'IN_PROGRESS' THEN 'in_progress'
        ELSE 'on_control'
      END
    )::recommendation_status_new
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN additional_status TYPE recommendation_additional_status_new
    USING (
      CASE additional_status::text
        WHEN 'on_time' THEN 'on_time'
        WHEN 'ON_TIME' THEN 'on_time'
        WHEN 'deadline_violated' THEN 'deadline_violated'
        WHEN 'DEADLINE_VIOLATED' THEN 'deadline_violated'
        WHEN 'on_control' THEN 'on_control'
        WHEN 'ON_CONTROL' THEN 'on_control'
        WHEN 'pending_review' THEN 'on_control'
        WHEN 'PENDING_REVIEW' THEN 'on_control'
        WHEN 'removed_control' THEN 'on_time'
        WHEN 'REMOVED_CONTROL' THEN 'on_time'
        WHEN 'none' THEN 'on_time'
        WHEN 'NONE' THEN 'on_time'
        ELSE 'on_control'
      END
    )::recommendation_additional_status_new
    """,
        """
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_status') THEN
        DROP TYPE recommendation_status;
      END IF;
    END $$;
    """,
        """
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_additional_status') THEN
        DROP TYPE recommendation_additional_status;
      END IF;
    END $$;
    """,
        """
    ALTER TYPE recommendation_status_new RENAME TO recommendation_status
    """,
        """
    ALTER TYPE recommendation_additional_status_new RENAME TO recommendation_additional_status
    """,
    ),
)

MATERIALITY_REQUIRED = SqlPatch(
    name="materiality_required",
    message="materiality_level updated: 'не указан' -> 'средний', default = 'средний'",
    statements=(
        """
    UPDATE recommendations
    SET materiality_level = 'средний'
    WHERE materiality_level IS NULL
       OR materiality_level = ''
       OR materiality_level = 'не указан'
    """,
        """
    ALTER TABLE recommendations
    ALTER COLUMN materiality_level SET DEFAULT 'средний'
    """,
    ),
)

RECOMMENDATION_INDICATORS = SqlPatch(
    name="recommendation_indicators",
    message="recommendation indicators migrated to semantic values",
    statements=(
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
    ),
)
